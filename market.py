"""Allowlisted read-only market adapters and last-known-good cache."""
import hashlib
import json
import logging
import math
import re
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
CST = timezone(timedelta(hours=8), 'CST')
BASE = 'https://finance.sina.com.cn/'
NBS = 'https://www.stats.gov.cn/english/PressRelease/'
INSTRUMENTS = {
    'HC2701': {'name': 'Hot-rolled coil', 'short': 'HRC', 'venue': 'SHFE', 'unit': 'CNY/t', 'icon': 'layers'},
    'I2701': {'name': 'Iron ore', 'short': 'Iron ore', 'venue': 'DCE', 'unit': 'CNY/t', 'icon': 'mountain'},
    'JM2701': {'name': 'Coking coal', 'short': 'Coking coal', 'venue': 'DCE', 'unit': 'CNY/t', 'icon': 'flame'},
    'USDCNY': {'name': 'USD / CNY', 'short': 'USD/CNY', 'venue': 'ONSHORE FX', 'unit': 'CNY/USD', 'icon': 'arrows'},
    'J2701': {'name': 'Coke', 'short': 'Coke', 'venue': 'DCE', 'unit': 'CNY/t', 'icon': 'box'},
}
for code, meta in INSTRUMENTS.items():
    meta.update({'id': code, 'url': BASE + ('money/forex/hq/USDCNY.shtml' if code == 'USDCNY' else f'futures/quotes/{code}.shtml'),
                 'precision': 4 if code == 'USDCNY' else (1 if code in ('I2701', 'JM2701', 'J2701') else 0),
                 'basis': 'prior close' if code == 'USDCNY' else 'prior settlement'})

GACC_INDEX = 'http://english.customs.gov.cn/Statistics/Statistics'
GACC_STEEL = re.compile(r'products,\s*of steel or iron', re.I)
MONTH_ABBR = {name[:3].lower(): i + 1 for i, name in enumerate(
    'January February March April May June July August September October November December'.split())}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def plain(text):
    return ' '.join(unescape(text or '').split())


def get_bytes(url, *, referer=None, limit=2_000_000, timeout=7):
    import ssl
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; ForgeDashboard/1.0)', 'Accept': '*/*'}
    if referer:
        headers['Referer'] = referer
    contexts = (None, ssl._create_unverified_context())
    candidates = [url]
    if url.startswith('http://'):
        candidates.append('https://' + url[len('http://'):])
    elif url.startswith('https://'):
        candidates.append('http://' + url[len('https://'):])
    errors = []
    for candidate in candidates:
        for ctx in contexts:
            try:
                with urlopen(Request(candidate, headers=headers), timeout=timeout, context=ctx) as response:
                    data = response.read(limit + 1)
                    if len(data) > limit:
                        raise ValueError('Upstream payload exceeded limit')
                    return data
            except Exception as error:  # noqa: BLE001 — try next transport
                errors.append(error)
                continue
    raise errors[-1] if errors else ValueError('Upstream fetch failed')


def num(value, positive=False):
    try:
        n = float(str(value).strip().replace(',', '').replace('−', '-'))
        if math.isfinite(n) and (not positive or 0 < n < 10_000_000):
            return n
    except (TypeError, ValueError):
        pass
    return None


def parse_quotes(text):
    rows = dict(re.findall(r'var\s+hq_str_([\w]+)\s*=\s*"([^"\r\n]*)"', text))
    out = {}
    for code in INSTRUMENTS:
        fx = code == 'USDCNY'
        values = rows.get('fx_susdcny' if fx else f'nf_{code}', '').split(',')
        if len(values) < 18:
            continue
        try:
            clock = values[0 if fx else 1]
            hour = clock if fx else f'{clock[:2]}:{clock[2:4]}:{clock[4:6]}'
            stamp = datetime.fromisoformat(values[17] + 'T' + hour).replace(tzinfo=CST)
            if stamp > datetime.now(CST) + timedelta(days=2):
                continue
            last = num(values[8], True)
            previous = num(values[3 if fx else 10], True)
            op, hi, lo = [num(values[k], True) for k in ([5, 6, 7] if fx else [2, 3, 4])]
            if last is None or previous is None:
                continue
            out[code] = {'last': last, 'previous': previous, 'change': round(last - previous, 6),
                         'pct': round((last / previous - 1) * 100, 6), 'asOf': stamp.isoformat(timespec='seconds'),
                         'open': op, 'high': hi, 'low': lo,
                         'settlement': None if fx else num(values[9], True),
                         'volume': None if fx else num(values[14]), 'interest': None if fx else num(values[13])}
        except (ValueError, IndexError):
            continue
    return out


def fetch_quotes():
    symbols = ','.join('fx_susdcny' if code == 'USDCNY' else f'nf_{code}' for code in INSTRUMENTS)
    quotes = parse_quotes(get_bytes(f'https://hq.sinajs.cn/list={symbols}', referer=BASE, limit=80_000).decode('gb18030', 'replace'))
    if not quotes:
        raise ValueError('No valid quote fields')
    return quotes


def parse_history(text, fx=False, today=None):
    today = today or datetime.now(CST).date()
    tail = text.split('var _k=', 1)[-1].strip().rstrip(';')
    data = json.loads(tail[1:-1] if tail.startswith('(') and tail.endswith(')') else tail)
    if fx and isinstance(data, str):
        data = [part.split(',') for part in data.split('|')[-220:]]
        data = [{'d': p[0], 'o': p[1], 'l': p[2], 'h': p[3], 'c': p[4]} for p in data if len(p) >= 5]
    if not isinstance(data, list):
        raise ValueError('Unexpected daily series')
    out = {}
    for row in data:
        if not isinstance(row, dict):
            continue
        try:
            d = date.fromisoformat(row.get('d', ''))
        except (ValueError, TypeError):
            continue
        if not today - timedelta(days=420) <= d <= today + timedelta(days=1):
            continue
        o, h, low, c = [num(row.get(k), True) for k in 'ohlc']
        if None in (o, h, low, c) or h < max(o, c, low) or low > min(o, c):
            continue
        out[str(d)] = {'date': str(d), 'open': o, 'high': h, 'low': low, 'close': c, 'volume': num(row.get('v'))}
    return [out[d] for d in sorted(out)][-175:]


def fetch_history(code):
    fx = code == 'USDCNY'
    if fx:
        url = 'https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20_k=/NewForexService.getDayKLine?symbol=fx_susdcny'
    else:
        url = f'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_k=/InnerFuturesNewService.getDailyKLine?symbol={code}'
    data = parse_history(get_bytes(url, referer=BASE).decode('utf-8', 'replace'), fx)
    if len(data) < 2:
        raise ValueError('No daily candle series')
    return data


NEWS_TOPICS = [
    ('Iron ore', 'inputs'), ('China steel', 'steel'), ('hot rolled coil', 'steel'), ('coking coal China', 'inputs'),
    ('steel tariffs', 'policy'), ('steel anti-dumping Pakistan', 'policy'),
    ('China steel exports', 'steel'), ('China manufacturing PMI', 'macro'),
]
TRUST = {'reuters': 4.5, 'bloomberg': 3.8, 'shanghai metals market': 3.8, 'mysteel': 4, 'bigmint': 3.2,
         'wsj': 3, 'gmk center': 3, 'steel market update': 2.8, 's&p global': 3, 'stonex': 3, 'mining.com': 2.5,
         'business recorder': 3.2, 'profit by pakistan today': 3.4, 'investify': 2.7, 'steelradar': 2.3,
         'steel orbis': 2.8, 'argus media': 3.1, 'financial times': 3, 'yieh corp.': 2.5}


def parse_rss(raw, topic, now=None):
    now = now or datetime.now(timezone.utc)
    if b'<!DOCTYPE' in raw.upper():
        raise ValueError('Unexpected RSS doctype')
    root = ET.fromstring(raw)
    articles = []
    for item in root.findall('./channel/item')[:26]:
        source = plain(item.findtext('source') or item.findtext('{https://www.bing.com/news/search}Source') or 'Bing News')[:70]
        title = plain(item.findtext('title'))[:250]
        suffix = f' - {source}'
        if title.endswith(suffix):
            title = title[:-len(suffix)]
        link = plain(item.findtext('link'))
        if not title or not link.startswith('https://') or len(link) > 1800 or not urlsplit(link).netloc:
            continue
        try:
            published = parsedate_to_datetime(plain(item.findtext('pubDate')))
            if not published.tzinfo:
                published = published.replace(tzinfo=timezone.utc)
            age_hours = (now - published).total_seconds() / 3600
        except (ValueError, TypeError, OverflowError):
            continue
        if not -1 <= age_hours <= (21 if topic == 'macro' else 8) * 24:
            continue
        low = title.lower()
        if re.search(r'\b(jefferies|stock price|seeking alpha|forum|stock to buy|earnings call|why .* stock|fund eased|lithium|rare earth|copper miner)\b', low):
            continue
        primary = re.search(r'\b(steel|iron[ -]ore|coil|coal|rebar|galvalume|pmi|manufacturing|tariff)\b', low)
        if not primary:
            continue
        if re.search(r'\b(anti[ -]dumping|tariff|tariffs|levy|remissions|trade barriers|trade rules)\b', low):
            cat = 'policy'
        elif re.search(r'\b(pmi|factory activity|purchasing managers)\b', low):
            cat = 'macro'
        elif re.search(r'\b(iron[ -]ore|coking coal|coke|scrap)\b', low):
            cat = 'inputs'
        else:
            cat = 'steel' if topic == 'policy' else topic
        trust = max((v for k, v in TRUST.items() if k in source.lower()), default=1)
        score = trust + min(4.2, max(-4, 4.2 - age_hours / 19))
        if re.search(r'\b(china|chinese|pakistan|hrc|coil)\b', low):
            score += 1.7
        if re.search(r'\b(pakistan|steel exports|iron ore futures|china hrc|output)\b', low):
            score += 1.2
        if re.search(r'\b(indonesia|new zealand|quebec|quarterly results)\b', low) and 'china' not in low:
            score -= 1.5
        if 'pakistan' in low and cat == 'policy':
            score += 2.2
        stamp = published.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        articles.append({'id': 'N-' + hashlib.sha256(link.encode()).hexdigest()[:9], 'title': title, 'publisher': source,
                         'url': link, 'publishedAt': stamp, 'category': cat, '_score': score})
    return articles


def news_topic(pair):
    term, category = pair
    # Plus encoding matches the provider's documented RSS search format.
    q = term.replace(' ', '+')
    raw = get_bytes(f'https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en', limit=700_000, timeout=6)
    return parse_rss(raw, category)


def fetch_news():
    rows = []
    with ThreadPoolExecutor(max_workers=len(NEWS_TOPICS)) as pool:
        requests = [pool.submit(news_topic, t) for t in NEWS_TOPICS]
        for f in requests:
            try:
                rows.extend(f.result())
            except (OSError, ValueError, ET.ParseError):
                continue
    if not rows:
        raw = get_bytes('https://www.bing.com/news/search?q=China+steel+iron+ore&format=rss', limit=500_000, timeout=6)
        rows = parse_rss(raw, 'steel')
    scored = sorted(rows, key=lambda n: (n['_score'], n['publishedAt']), reverse=True)
    candidates, tokens_by_title, ids = [], [], set()
    for row in scored:
        tokens = set(re.findall(r'[a-z0-9]{3,}', row['title'].lower())) - {'and', 'the', 'for', 'from', 'with'}
        if row['id'] in ids or any(len(tokens & t) / max(1, len(tokens | t)) >= .76 for t in tokens_by_title):
            continue
        ids.add(row['id']); tokens_by_title.append(tokens); candidates.append(row)
    if not candidates:
        raise ValueError('News feed returned no recent items')
    # Ensure that the first five stories are not all about one market.
    diverse, categories = [], set()
    for entry in candidates:
        cat = entry['category']
        if cat not in categories and candidates.index(entry) < 15:
            diverse.append(entry); categories.add(cat)
    top = sorted(diverse[:4], key=lambda n: n['_score'], reverse=True)
    ordered = top + [r for r in candidates if r not in top]
    # Retain a few stories per topic even when one sector dominates the feed.
    keep = ordered[:26][:]
    for cat in ('steel', 'inputs', 'policy', 'macro'):
        keep.extend([r for r in ordered if r['category'] == cat and r not in keep][:max(0, 4-sum(r['category'] == cat for r in keep))])
    return [{k: v for k, v in row.items() if not k.startswith('_')} for row in keep[:36]]


class TablesAndLinks(HTMLParser):
    """Extract only plain text and table cells from the NBS HTML."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.links, self.tables, self.text = [], [], []
        self.anchor, self.table, self.row, self.cell = None, None, None, None
        self.excluded = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.excluded += 1
        if self.excluded:
            return
        if tag == 'a':
            self.anchor = (dict(attrs).get('href', ''), [])
        elif tag == 'table':
            self.table = []
        elif tag == 'tr' and self.table is not None:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, text):
        if self.excluded:
            return
        if text.strip():
            self.text.append(text)
        if self.anchor is not None:
            self.anchor[1].append(text)
        if self.cell is not None:
            self.cell.append(text)

    def handle_endtag(self, tag):
        if tag in ('script', 'style') and self.excluded:
            self.excluded -= 1
        if self.excluded:
            return
        if tag == 'a' and self.anchor is not None:
            self.links.append((self.anchor[0], plain(' '.join(self.anchor[1])))); self.anchor = None
        elif tag in ('td', 'th') and self.cell is not None and self.row is not None:
            self.row.append(plain(' '.join(self.cell))); self.cell = None
        elif tag == 'tr' and self.row is not None and self.table is not None:
            self.table.append(self.row); self.row = None
        elif tag == 'table' and self.table is not None:
            self.tables.append(self.table); self.table = None


MONTHS = 'January February March April May June July August September October November December'.split()
NBS_PATTERNS = {'pmi': r'Purchasing Managers[’\']? Index for', 'cpi': 'Consumer Price Index in',
                'ppi': r'Industrial Producer Price Index(?:es|ces|s)? in'}


def nbs_links(index_html):
    best = {}
    for href, title in TablesAndLinks(index_html).links:
        url = urljoin(NBS, href)
        if not re.fullmatch(r'https://www\.stats\.gov\.cn/english/PressRelease/\d+/t\d+_\d+\.html', url):
            continue
        for key, prefix in NBS_PATTERNS.items():
            match = re.search(prefix + r'\s+(\w+)\s+(20\d{2})', title, re.I)
            if not match or match[1].title() not in MONTHS:
                continue
            month, year = MONTHS.index(match[1].title()) + 1, int(match[2])
            period = f'{year:04d}-{month:02d}'
            if key not in best or period > best[key]['period']:
                best[key] = {'url': url, 'period': period, 'label': f'{MONTHS[month-1]} {year}', 'source': 'China NBS'}
    return best


def fetch_nbs_detail(key, meta):
    p = TablesAndLinks(get_bytes(meta['url']).decode('utf-8', 'replace'))
    publication = re.search(r'\b(20\d\d-\d\d-\d\d)\s+\d\d:\d\d\b', plain(' '.join(p.text)))
    out = {**meta, 'published': publication[1] if publication else None}
    if key in ('cpi', 'ppi'):
        for table in p.tables:
            for row in table:
                if len(row) >= 3 and (row[0] == 'Consumer Price Index' if key == 'cpi' else 'Producer Price Indexes for Industrial Products' in row[0]):
                    mom, yoy = num(row[1]), num(row[2])
                    if None not in (mom, yoy):
                        return {**out, 'mom': mom, 'yoy': yoy}
    else:
        year, month = map(int, meta['period'].split('-'))
        for table in p.tables:
            if not any('Production Index' in row and 'New Order Index' in row for row in table):
                continue
            named = [row for row in table if len(row) >= 7 and row[0].split('-')[-1].strip() in MONTHS
                     and all(num(x) is not None and 0 <= num(x) <= 100 for x in row[1:7])]
            if len(named) < 2 or named[-1][0].split('-')[-1].strip() != MONTHS[month-1]:
                continue
            series = []
            for row in reversed(named[-13:]):
                if row[0].split('-')[-1].strip() != MONTHS[month-1]:
                    break
                series.append({'period': f'{year:04d}-{month:02d}', 'value': num(row[1])})
                year, month = (year-1, 12) if month == 1 else (year, month-1)
            latest = named[-1]
            if len(series) < 2:
                continue
            new_export, finished = None, None
            for second in p.tables:
                header = next((r for r in second if 'New Export Order Index' in r), None)
                if not header:
                    continue
                ext = next((r for r in reversed(second) if len(r) >= len(header) and r[0].split('-')[-1].strip() == MONTHS[int(meta['period'][-2:])-1]), None)
                if ext:
                    new_export = num(ext[header.index('New Export Order Index')])
                    if 'Finished Goods Inventory Index' in header:
                        finished = num(ext[header.index('Finished Goods Inventory Index')])
                break
            return {**out, 'value': num(latest[1]), 'previous': series[1]['value'], 'series': list(reversed(series)),
                    'production': num(latest[2]), 'orders': num(latest[3]), 'rawInventory': num(latest[4]),
                    'employment': num(latest[5]), 'delivery': num(latest[6]), 'exportOrders': new_export, 'finishedInventory': finished}
    raise ValueError(f'Cannot parse official {key.upper()} table')


def fetch_macro():
    links = nbs_links(get_bytes(NBS).decode('utf-8', 'replace'))
    if len(links) != len(NBS_PATTERNS):
        raise ValueError('Cannot locate latest monthly releases')
    with ThreadPoolExecutor(max_workers=3) as pool:
        pending = {key: pool.submit(fetch_nbs_detail, key, value) for key, value in links.items()}
        return {key: f.result() for key, f in pending.items()}


def gacc_major_export_links(index_html, base=GACC_INDEX):
    """Return [(url, title)] for Major Exports USD tables, newest first when dated."""
    rows = []
    for href, title in TablesAndLinks(index_html).links:
        label = plain(title)
        if 'Major Exports by Quantity and Value' not in label or '(in USD)' not in label:
            continue
        url = urljoin(base, href)
        if not re.fullmatch(r'https?://english\.customs\.gov\.cn/Statics/[a-f0-9\-]+\.html', url, re.I):
            continue
        rows.append((url, label))
    return rows


def parse_gacc_period(title):
    match = re.search(
        r'Major Exports by Quantity and Value,\s*([A-Za-z]{3,9})\s+(20\d{2})\s*\(in USD\)',
        title or '', re.I)
    if not match:
        return None
    month_name, year = match.group(1).title(), int(match.group(2))
    if month_name not in MONTHS:
        short = month_name[:3].lower()
        if short not in MONTH_ABBR:
            return None
        month = MONTH_ABBR[short]
        month_name = MONTHS[month - 1]
    else:
        month = MONTHS.index(month_name) + 1
    return {'year': year, 'month': month, 'period': f'{month_name} {year}',
            'ytdPeriod': f'Jan–{month_name[:3]} {year}', 'key': f'{year:04d}-{month:02d}'}


def parse_gacc_steel_exports(html, *, url=None, title=None):
    """Parse Products, of steel or iron from a GACC Major Exports USD table."""
    parsed = TablesAndLinks(html)
    page_title = title or next((plain(t) for t in re.findall(r'<title>([^<]+)', html, re.I)), '')
    meta = parse_gacc_period(page_title)
    if not meta:
        raise ValueError('Cannot read GACC export period')
    published = None
    blob = plain(' '.join(parsed.text))
    pub = re.search(r'\b(20\d{2})/(\d{1,2})/(\d{1,2})\b', blob)
    if pub:
        published = f'{int(pub[1]):04d}-{int(pub[2]):02d}-{int(pub[3]):02d}'
    steel = None
    for table in parsed.tables:
        for row in table:
            if not row or not GACC_STEEL.search(row[0] or ''):
                continue
            cells = [plain(c).replace('\xa0', '') for c in row]
            if len(cells) < 9:
                continue
            if '10000' not in re.sub(r'[\s,]', '', cells[1] or ''):
                continue
            month_qty, ytd_qty, yoy = num(cells[2]), num(cells[4]), num(cells[8])
            if None in (month_qty, ytd_qty, yoy):
                continue
            steel = {
                **meta,
                'published': published,
                'monthMt': round(month_qty / 100, 4),
                'ytdMt': round(ytd_qty / 100, 4),
                'ytdYoY': yoy,
                'monthValueUsdMn': num(cells[3]),
                'ytdValueUsdMn': num(cells[5]),
                'url': url or GACC_INDEX,
                'source': 'GACC · official table',
            }
            break
        if steel:
            break
    if not steel:
        raise ValueError('Steel export row missing from GACC table')
    return steel


def _exports_history_path():
    return HERE / '.cache' / 'exports-months.json'


def _load_exports_history():
    path = _exports_history_path()
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_exports_history(history):
    path = _exports_history_path()
    try:
        path.parent.mkdir(exist_ok=True)
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(history, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(path)
    except OSError:
        pass


def _prior_month_key(year, month):
    return f'{year - 1:04d}-12' if month == 1 else f'{year:04d}-{month - 1:02d}'


def _discover_prior_export_url(year, month):
    """Best-effort discovery of the previous month's USD Major Exports table."""
    name = MONTHS[month - 1]
    short = name[:3]
    queries = [
        f'site:english.customs.gov.cn "Major Exports by Quantity and Value, {name} {year}" USD',
        f'site:english.customs.gov.cn "Major Exports by Quantity and Value, {short} {year}" (in USD)',
        f'"Major Exports by Quantity and Value, {short} {year} (in USD)" customs',
    ]
    pattern = re.compile(r'https?://english\.customs\.gov\.cn/Statics/[a-f0-9\-]+\.html', re.I)
    for query in queries:
        encoded = query.replace(' ', '+')
        for endpoint in (
            f'https://www.bing.com/search?q={encoded}',
            f'https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en',
        ):
            try:
                raw = get_bytes(endpoint, limit=900_000, timeout=8).decode('utf-8', 'replace')
            except Exception:
                continue
            match = pattern.search(raw)
            if match:
                return match.group(0)
    return None


def fetch_exports():
    index_html = get_bytes(GACC_INDEX, timeout=12).decode('utf-8', 'replace')
    links = gacc_major_export_links(index_html)
    if not links:
        raise ValueError('No GACC Major Exports USD table found')
    url, title = links[0]
    detail = get_bytes(url, referer=GACC_INDEX, timeout=12).decode('utf-8', 'replace')
    current = parse_gacc_steel_exports(detail, url=url, title=title)
    history = _load_exports_history()
    history[current['key']] = current['monthMt']
    month_mom = None
    prior_key = _prior_month_key(current['year'], current['month'])
    if prior_key not in history:
        prior_url = _discover_prior_export_url(
            current['year'] - 1 if current['month'] == 1 else current['year'],
            12 if current['month'] == 1 else current['month'] - 1)
        if prior_url:
            try:
                prior_html = get_bytes(prior_url, referer=GACC_INDEX, timeout=12).decode('utf-8', 'replace')
                prior = parse_gacc_steel_exports(prior_html, url=prior_url)
                history[prior['key']] = prior['monthMt']
            except Exception:
                pass
    prior_mt = history.get(prior_key)
    if prior_mt and prior_mt > 0:
        month_mom = round((current['monthMt'] / prior_mt - 1) * 100, 2)
    _save_exports_history({k: history[k] for k in sorted(history)[-18:]})
    current['monthMoM'] = month_mom
    current['monthYoY'] = None  # Official table publishes YTD YoY, not monthly YoY.
    return current


TRADE_QUERIES = (
    'steel anti-dumping China',
    'China steel tariff duty',
    'steel safeguard investigation',
    'anti-dumping steel Pakistan',
)

COUNTRY_HINTS = (
    ('united states', 'United States'), ('u.s.', 'United States'), ('usa', 'United States'),
    ('european union', 'European Union'), ('eu ', 'European Union'),
    ('united kingdom', 'United Kingdom'), ('uk ', 'United Kingdom'),
    ('south korea', 'South Korea'), ('korea', 'South Korea'),
    ('saudi arabia', 'Saudi Arabia'), ('pakistan', 'Pakistan'), ('malaysia', 'Malaysia'),
    ('vietnam', 'Vietnam'), ('thailand', 'Thailand'), ('indonesia', 'Indonesia'),
    ('australia', 'Australia'), ('canada', 'Canada'), ('india', 'India'),
    ('turkey', 'Turkey'), ('mexico', 'Mexico'), ('brazil', 'Brazil'),
    ('colombia', 'Colombia'), ('japan', 'Japan'), ('taiwan', 'Taiwan'),
    ('china', 'China'),
)


def _trade_jurisdiction(title):
    low = f' {title.lower()} '
    for needle, label in COUNTRY_HINTS:
        if needle in low:
            return label
    return 'Unspecified'


def _trade_status(title):
    low = title.lower()
    if re.search(r'\b(investigat\w*|probe|review)\b', low):
        return 'Investigation'
    if re.search(r'\b(duty|duties|tariff|levy|safeguard|anti[ -]dumping)\b', low):
        return 'Duty reported'
    return 'Policy signal'


def _trade_product(title):
    low = title.lower()
    for label, pattern in (
        ('Hot-rolled coil / flat steel', r'\b(hot[ -]?rolled|hrc|flat[ -]rolled)\b'),
        ('Cold-rolled / coated steel', r'\b(cold[ -]?rolled|galvalume|galvanis|zinc[ -]?coated|coated)\b'),
        ('Wire rod', r'\bwire rod\b'),
        ('Stainless steel', r'\bstainless\b'),
        ('Steel products', r'\bsteel\b'),
    ):
        if re.search(pattern, low):
            return label
    return plain(title)[:90]


def _trade_rate(title):
    match = re.search(r'(\d+(?:\.\d+)?\s*%(?:\s*[–-]\s*\d+(?:\.\d+)?\s*%)?)', title)
    return plain(match.group(1)) if match else '—'


def trade_from_articles(articles):
    """Normalize policy headlines into a deduplicated trade register."""
    rows, url_ids, title_tokens = [], set(), []
    for item in articles:
        title = plain(item.get('title'))
        link = plain(item.get('url'))
        if not title or not link.startswith('https://'):
            continue
        low = title.lower()
        if not re.search(r'\b(anti[ -]dumping|tariff|tariffs|duty|duties|safeguard|levy|trade barrier|section\s*232|investigat\w*|probe)\b', low):
            continue
        if not re.search(r'\b(steel|coil|rebar|wire rod|galvalume|iron)\b', low):
            continue
        stamp = plain(item.get('publishedAt') or '')[:10]
        if not re.fullmatch(r'20\d{2}-\d{2}-\d{2}', stamp):
            continue
        key = hashlib.sha256(link.encode()).hexdigest()[:12]
        tokens = set(re.findall(r'[a-z0-9]{4,}', low)) - {'steel', 'china', 'chinese', 'from', 'with'}
        if key in url_ids or any(len(tokens & prior) / max(1, len(tokens | prior)) >= .72 for prior in title_tokens):
            continue
        url_ids.add(key)
        title_tokens.append(tokens)
        rows.append({
            'country': _trade_jurisdiction(title),
            'product': _trade_product(title),
            'status': _trade_status(title),
            'rate': _trade_rate(title),
            'date': stamp,
            'url': link,
            'publisher': plain(item.get('publisher') or 'News')[:70],
            'title': title[:220],
            'source': 'news',
        })
    rows.sort(key=lambda r: (r['date'], r['country'], r['product']), reverse=True)
    return rows[:24]


def fetch_trade():
    rows = []
    with ThreadPoolExecutor(max_workers=len(TRADE_QUERIES)) as pool:
        jobs = [pool.submit(news_topic, (query, 'policy')) for query in TRADE_QUERIES]
        for job in jobs:
            try:
                rows.extend(job.result())
            except (OSError, ValueError, ET.ParseError):
                continue
    # Merge any already-fetched policy headlines from the news feed cache path is not available here;
    # dedicated queries are enough. Also fold Bing fallback if empty.
    if not rows:
        raw = get_bytes(
            'https://www.bing.com/news/search?q=China+steel+anti-dumping+tariff&format=rss',
            limit=500_000, timeout=6)
        rows = parse_rss(raw, 'policy')
    items = trade_from_articles(rows)
    if not items:
        raise ValueError('Trade policy feed returned no recent items')
    return {'items': items, 'source': 'Policy RSS'}


class FeedStore:
    def __init__(self):
        self.lock = threading.RLock()
        self.data = {}
        self.attempted, self.good, self.pending = {}, {}, {}
        self.pool = ThreadPoolExecutor(max_workers=12, thread_name_prefix='market')
        self.specs = {
            'quotes': (60, fetch_quotes),
            'news': (600, fetch_news),
            'macro': (3600, fetch_macro),
            'exports': (6 * 3600, fetch_exports),
            'trade': (900, fetch_trade),
        }
        self.specs.update({f'history:{i}': (900, lambda i=i: fetch_history(i)) for i in INSTRUMENTS})
        self.cache_path = HERE / '.cache' / 'last-good.json'
        for path in (self.cache_path, HERE / 'data' / 'seed.json'):
            try:
                loaded = json.loads(path.read_text(encoding='utf-8'))
                if isinstance(loaded, dict):
                    self.data = loaded
                    break
            except (ValueError, OSError):
                continue

    def _save(self):
        # Called under the data lock. This path never contains credentials or private imports.
        try:
            self.cache_path.parent.mkdir(exist_ok=True)
            tmp = self.cache_path.with_suffix('.tmp')
            tmp.write_text(json.dumps(self.data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            tmp.replace(self.cache_path)
        except OSError:
            pass

    def _load(self, key, loader):
        try:
            result = loader()
            stamp = now_iso()
            with self.lock:
                if key == 'quotes':
                    for code, quote in result.items():
                        name = f'quote:{code}'
                        old = self.data.get(name, {}).get('value', {}).get('asOf', '')
                        if old > quote['asOf']:
                            self.good[name] = False
                            continue
                        self.data[name] = {'fetchedAt': stamp, 'value': quote}
                        self.good[name] = True
                    for absent in set(INSTRUMENTS) - set(result):
                        self.good[f'quote:{absent}'] = False
                else:
                    self.data[key] = {'fetchedAt': stamp, 'value': result}
                self.good[key] = True
                self._save()
        except Exception as error:
            with self.lock:
                self.good[key] = False
                if key == 'quotes':
                    for code in INSTRUMENTS:
                        self.good[f'quote:{code}'] = False
            logging.info('Feed %s retained its last good value (%s)', key, type(error).__name__)

    def tick(self, manual=False):
        start = time.monotonic()
        jobs = []
        with self.lock:
            for key, (ttl, loader) in self.specs.items():
                if key in self.pending and not self.pending[key].done():
                    jobs.append(self.pending[key]); continue
                cooldown = (18 if key == 'quotes' else 90) if manual and key in ('quotes', 'news') else ttl
                if start - self.attempted.get(key, float('-inf')) >= cooldown:
                    self.attempted[key] = start
                    self.pending[key] = self.pool.submit(self._load, key, loader)
                    jobs.append(self.pending[key])
        return jobs

    def run(self):
        while True:
            self.tick()
            time.sleep(5)

    def status(self, key):
        entry = self.data.get(key, {})
        if not entry:
            state = 'loading' if any(not f.done() for f in self.pending.values()) and key not in self.good else 'unavailable'
        elif not self.good.get(key):
            state = 'cached'
        elif key.startswith('quote:') and datetime.now(CST) - datetime.fromisoformat(entry['value']['asOf']) > timedelta(hours=48):
            state = 'dated'
        elif key.startswith('history:') and (datetime.now(CST).date() - date.fromisoformat(entry['value'][-1]['date'])).days > 5:
            state = 'dated'
        else:
            state = 'current'
        return {'state': state, 'fetchedAt': entry.get('fetchedAt'), 'value': entry.get('value')}

    def snapshot(self):
        with self.lock:
            return {'clock': now_iso(), 'instruments': INSTRUMENTS,
                    'quotes': {i: self.status(f'quote:{i}') for i in INSTRUMENTS},
                    'history': {i: self.status(f'history:{i}') for i in INSTRUMENTS},
                    'news': self.status('news'), 'macro': self.status('macro'),
                    'exports': self.status('exports'), 'trade': self.status('trade')}

    def refresh(self):
        jobs = self.tick(manual=True)
        if jobs:
            wait(jobs, timeout=7)
        return self.snapshot()
