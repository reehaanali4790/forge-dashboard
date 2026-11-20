"""Pakistan Stock Exchange adapters: DPS snapshots, ranking, model scores, paper ledger."""
from __future__ import annotations

import json
import logging
import math
import re
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
PKT = timezone(timedelta(hours=5), 'PKT')
DPS = 'https://dps.psx.com.pk'
NOTIONAL = 100.0  # PKR notional per name in paper cohorts
WEEK_BARS = 5
TOP_VOLUME = 50
TOP_N = 5


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def plain(text):
    return ' '.join(unescape(text or '').split())


def num(value, positive=False):
    try:
        n = float(str(value).strip().replace(',', '').replace('%', '').replace('−', '-'))
        if math.isfinite(n) and (not positive or 0 < n < 1e12):
            return n
    except (TypeError, ValueError):
        pass
    return None


def dps_get(path, *, token=None, data=None, limit=3_000_000, timeout=14):
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; ForgeDashboard/1.0)',
        'Accept': '*/*',
        'Referer': DPS + '/',
    }
    if token:
        headers['X-Req-Id'] = token
        headers['X-Requested-With'] = 'XMLHttpRequest'
    body = None
    if data is not None:
        body = urlencode(data).encode() if isinstance(data, dict) else data
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        headers['X-Requested-With'] = 'XMLHttpRequest'
    ctx = ssl._create_unverified_context()
    req = Request(DPS + path, data=body, headers=headers)
    with urlopen(req, timeout=timeout, context=ctx) as response:
        raw = response.read(limit + 1)
        if len(raw) > limit:
            raise ValueError('Upstream payload exceeded limit')
        return raw, response.headers.get('Content-Type', '')


def extract_dps_token(html):
    match = re.search(r'window\.__ps\s*=\s*(\{.*?\});', html, re.S)
    if not match:
        match = re.search(r'"_k"\s*:\s*"([^"]+)"', html)
        return match.group(1) if match else None
    key = re.search(r'"_k"\s*:\s*"([^"]+)"', match.group(1))
    return key.group(1) if key else None


def fetch_dps_token():
    raw, _ = dps_get('/', timeout=16)
    token = extract_dps_token(raw.decode('utf-8', 'replace'))
    if not token:
        raise ValueError('DPS auth token missing')
    return token


def parse_market_watch(html):
    """Parse DPS market-watch HTML table into quote rows."""
    rows = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.I | re.S):
        cells = [plain(re.sub(r'<[^>]+>', '', c)) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.I | re.S)]
        if len(cells) < 11 or cells[0].upper() in ('SYMBOL', ''):
            continue
        symbol = cells[0].upper()
        if not re.fullmatch(r'[A-Z0-9]{2,12}', symbol):
            continue
        listed = (cells[2] or '').upper()
        # Prefer equities that appear on ALLSHR / KSE boards; skip pure index rows.
        if listed in ('',) and not cells[1]:
            continue
        volume = num(cells[10])
        last = num(cells[7], True)
        if volume is None or last is None or volume <= 0:
            continue
        rows.append({
            'symbol': symbol,
            'sector': cells[1][:40],
            'listed': listed[:40],
            'ldcp': num(cells[3], True),
            'open': num(cells[4], True),
            'high': num(cells[5], True),
            'low': num(cells[6], True),
            'last': last,
            'change': num(cells[8]),
            'pct': num(cells[9]),
            'volume': volume,
        })
    if not rows:
        raise ValueError('Market watch returned no equity rows')
    return rows


def fetch_market_watch(token=None):
    token = token or fetch_dps_token()
    raw, _ = dps_get('/market-watch', token=token, timeout=18)
    return parse_market_watch(raw.decode('utf-8', 'replace')), token


def parse_eod_series(payload, *, today=None):
    """Parse DPS timeseries/eod JSON: [ts, close, volume, open]."""
    today = today or datetime.now(PKT).date()
    if isinstance(payload, (bytes, bytearray)):
        payload = json.loads(payload.decode('utf-8'))
    if not isinstance(payload, dict) or payload.get('status') not in (1, '1', True):
        raise ValueError('Unexpected EOD payload')
    data = payload.get('data')
    if not isinstance(data, list) or len(data) < 2:
        raise ValueError('EOD series too short')
    out = {}
    for row in data:
        if not isinstance(row, (list, tuple)) or len(row) < 4:
            continue
        try:
            stamp = datetime.fromtimestamp(int(row[0]), tz=PKT).date()
        except (TypeError, ValueError, OSError, OverflowError):
            continue
        if stamp > today + timedelta(days=1) or stamp < today - timedelta(days=900):
            continue
        close, volume, op = num(row[1], True), num(row[2]), num(row[3], True)
        if close is None or op is None:
            continue
        hi = max(op, close)
        lo = min(op, close)
        out[str(stamp)] = {
            'date': str(stamp),
            'open': op,
            'high': hi,
            'low': lo,
            'close': close,
            'volume': volume,
        }
    bars = [out[d] for d in sorted(out)]
    if len(bars) < 2:
        raise ValueError('EOD series too short after filter')
    return bars


def fetch_eod(symbol, token=None):
    token = token or fetch_dps_token()
    sym = symbol.upper().strip()
    if not re.fullmatch(r'[A-Z0-9]{2,12}', sym):
        raise ValueError('Invalid symbol')
    raw, _ = dps_get(f'/timeseries/eod/{sym}', token=token, timeout=16)
    return parse_eod_series(raw), token


def parse_historical_html(html):
    """Parse DPS historical HTML table (DATE OPEN HIGH LOW CLOSE VOLUME)."""
    months = {m: i for i, m in enumerate(
        'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(), 1)}
    bars = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.I | re.S):
        cells = [plain(re.sub(r'<[^>]+>', '', c)) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.I | re.S)]
        if len(cells) < 6 or cells[0].upper().startswith('DATE'):
            continue
        dm = re.match(r'([A-Za-z]{3})\s+(\d{1,2}),\s*(20\d{2})', cells[0])
        if not dm or dm.group(1)[:3].title() not in months and dm.group(1)[:3] not in months:
            # try titled month keys
            key = dm.group(1)[:3].title() if dm else ''
            if key not in months:
                continue
        month = months[dm.group(1)[:3].title()]
        day, year = int(dm.group(2)), int(dm.group(3))
        try:
            d = date(year, month, day)
        except ValueError:
            continue
        o, h, low, c = [num(cells[i], True) for i in range(1, 5)]
        vol = num(cells[5])
        if None in (o, h, low, c):
            continue
        bars[str(d)] = {'date': str(d), 'open': o, 'high': h, 'low': low, 'close': c, 'volume': vol}
    series = [bars[k] for k in sorted(bars)]
    if len(series) < 2:
        raise ValueError('Historical table empty')
    return series


def weekly_return(bars, sessions=WEEK_BARS):
    if not bars or len(bars) <= sessions:
        return None
    a, b = bars[-(sessions + 1)]['close'], bars[-1]['close']
    if not a:
        return None
    return round((b / a - 1) * 100, 4)


def rank_momentum(watch_rows, histories):
    """Top 50 by volume → Top 5 by weekly return. histories: symbol -> bars."""
    ranked = sorted(watch_rows, key=lambda r: r['volume'], reverse=True)[:TOP_VOLUME]
    scored = []
    for row in ranked:
        bars = histories.get(row['symbol']) or []
        wr = weekly_return(bars)
        if wr is None:
            continue
        scored.append({
            **row,
            'weeklyPct': wr,
            'bars': len(bars),
            'asOf': bars[-1]['date'] if bars else None,
        })
    scored.sort(key=lambda r: (r['weeklyPct'], r['volume']), reverse=True)
    top = scored[:TOP_N]
    return {
        'topVolume': [{'symbol': r['symbol'], 'volume': r['volume'], 'last': r['last'], 'pct': r['pct']} for r in ranked],
        'momentum': [{k: v for k, v in r.items() if k != 'bars'} for r in top],
        'scoredCount': len(scored),
    }


def _features(bars, i):
    """Feature vector at index i using only past bars (no look-ahead)."""
    if i < 10:
        return None
    c = bars[i]['close']
    if not c:
        return None
    r1 = (c / bars[i - 1]['close'] - 1) if bars[i - 1]['close'] else 0
    r5 = (c / bars[i - 5]['close'] - 1) if bars[i - 5]['close'] else 0
    r10 = (c / bars[i - 10]['close'] - 1) if bars[i - 10]['close'] else 0
    vols = [bars[j]['volume'] or 0 for j in range(i - 9, i + 1)]
    mean = sum(vols) / len(vols)
    var = sum((v - mean) ** 2 for v in vols) / len(vols)
    z = ((bars[i]['volume'] or 0) - mean) / math.sqrt(var) if var > 1e-9 else 0
    rng = ((bars[i]['high'] or c) - (bars[i]['low'] or c)) / c
    return [r1, r5, r10, z, rng]


def _ridge_fit(xs, ys, l2=0.08):
    """Solve (X'X + λI) β = X'y with intercept column; pure Python Gaussian elim."""
    n = len(xs)
    if n < 12:
        raise ValueError('Not enough training rows')
    p = len(xs[0]) + 1
    xtx = [[0.0] * p for _ in range(p)]
    xty = [0.0] * p
    for x, y in zip(xs, ys):
        row = [1.0, *x]
        for i in range(p):
            xty[i] += row[i] * y
            for j in range(p):
                xtx[i][j] += row[i] * row[j]
    for i in range(1, p):  # do not shrink intercept
        xtx[i][i] += l2
    # Gaussian elimination
    a = [xtx[i][:] + [xty[i]] for i in range(p)]
    for col in range(p):
        pivot = max(range(col, p), key=lambda r: abs(a[r][col]))
        if abs(a[pivot][col]) < 1e-12:
            raise ValueError('Singular design')
        a[col], a[pivot] = a[pivot], a[col]
        div = a[col][col]
        for j in range(col, p + 1):
            a[col][j] /= div
        for r in range(p):
            if r == col:
                continue
            factor = a[r][col]
            for j in range(col, p + 1):
                a[r][j] -= factor * a[col][j]
    return [a[i][p] for i in range(p)]


def _predict(beta, x):
    return beta[0] + sum(b * v for b, v in zip(beta[1:], x))


def score_model(histories, watch_by_symbol):
    """Fit ridge on pooled top-volume histories; score latest bar for each symbol."""
    xs, ys = [], []
    for bars in histories.values():
        if len(bars) < 20:
            continue
        for i in range(10, len(bars) - WEEK_BARS):
            feat = _features(bars, i)
            if not feat:
                continue
            forward = bars[i + WEEK_BARS]['close'] / bars[i]['close'] - 1
            if not math.isfinite(forward):
                continue
            xs.append(feat)
            ys.append(forward)
    if len(xs) < 40:
        raise ValueError('Insufficient pooled history for model')
    # Cap training size for speed
    if len(xs) > 4000:
        step = len(xs) // 4000
        xs = xs[::step]
        ys = ys[::step]
    beta = _ridge_fit(xs, ys)
    scored = []
    for symbol, bars in histories.items():
        if len(bars) < 12:
            continue
        feat = _features(bars, len(bars) - 1)
        if not feat:
            continue
        pred = _predict(beta, feat) * 100
        quote = watch_by_symbol.get(symbol) or {}
        scored.append({
            'symbol': symbol,
            'predictedWeeklyPct': round(pred, 3),
            'last': quote.get('last') or bars[-1]['close'],
            'volume': quote.get('volume') or bars[-1].get('volume'),
            'pct': quote.get('pct'),
            'asOf': bars[-1]['date'],
            'sector': quote.get('sector'),
        })
    scored.sort(key=lambda r: r['predictedWeeklyPct'], reverse=True)
    # residual std as crude confidence band
    resid = [_predict(beta, x) - y for x, y in zip(xs[-800:], ys[-800:])]
    sigma = math.sqrt(sum(r * r for r in resid) / max(1, len(resid))) * 100
    top = scored[:TOP_N]
    for row in top:
        row['bandPct'] = round(sigma, 2)
    return {'model': top, 'trainRows': len(xs), 'sigmaPct': round(sigma, 2)}


def _ledger_path():
    return HERE / '.cache' / 'psx-ledger.json'


def load_ledger():
    path = _ledger_path()
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(data, dict) and isinstance(data.get('cohorts'), list):
            return data
    except (OSError, ValueError):
        pass
    return {'cohorts': [], 'cumulative': {'momentumPct': 0.0, 'modelPct': 0.0, 'momentumPkr': 0.0, 'modelPkr': 0.0}}


def save_ledger(ledger):
    path = _ledger_path()
    path.parent.mkdir(exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(ledger, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    tmp.replace(path)


def _iso_week_key(d=None):
    d = d or datetime.now(PKT).date()
    y, w, _ = d.isocalendar()
    return f'{y}-W{w:02d}'


def _mark_legs(legs, histories):
    results = []
    total_pct = 0.0
    for leg in legs:
        bars = histories.get(leg['symbol']) or []
        if not bars:
            results.append({**leg, 'exit': None, 'returnPct': None})
            continue
        exit_px = bars[-1]['close']
        entry = leg.get('entry')
        if not entry:
            results.append({**leg, 'exit': exit_px, 'returnPct': None})
            continue
        ret = (exit_px / entry - 1) * 100
        results.append({**leg, 'exit': exit_px, 'returnPct': round(ret, 3), 'exitDate': bars[-1]['date']})
        total_pct += ret
    n = len([r for r in results if r.get('returnPct') is not None]) or 1
    avg = total_pct / n
    return results, round(avg, 3), round(avg / 100 * NOTIONAL * n, 2)


def update_ledger(momentum, model, histories, watch_by_symbol):
    """Open weekly cohorts and settle the prior open cohort when the ISO week rolls."""
    ledger = load_ledger()
    week = _iso_week_key()
    # Settle oldest open cohort from a previous week
    for cohort in ledger['cohorts']:
        if cohort.get('status') != 'open':
            continue
        if cohort.get('week') == week:
            continue
        mom_legs, mom_avg, mom_pkr = _mark_legs(cohort.get('momentum') or [], histories)
        mod_legs, mod_avg, mod_pkr = _mark_legs(cohort.get('model') or [], histories)
        cohort['momentum'] = mom_legs
        cohort['model'] = mod_legs
        cohort['momentumAvgPct'] = mom_avg
        cohort['modelAvgPct'] = mod_avg
        cohort['momentumPkr'] = mom_pkr
        cohort['modelPkr'] = mod_pkr
        cohort['status'] = 'closed'
        cohort['closedAt'] = now_iso()
        ledger['cumulative']['momentumPct'] = round(ledger['cumulative'].get('momentumPct', 0) + mom_avg, 3)
        ledger['cumulative']['modelPct'] = round(ledger['cumulative'].get('modelPct', 0) + mod_avg, 3)
        ledger['cumulative']['momentumPkr'] = round(ledger['cumulative'].get('momentumPkr', 0) + mom_pkr, 2)
        ledger['cumulative']['modelPkr'] = round(ledger['cumulative'].get('modelPkr', 0) + mod_pkr, 2)

    if not any(c.get('week') == week for c in ledger['cohorts']):
        def legs(rows):
            out = []
            for r in rows[:TOP_N]:
                px = (watch_by_symbol.get(r['symbol']) or {}).get('last') or r.get('last')
                out.append({'symbol': r['symbol'], 'entry': px, 'entryDate': r.get('asOf')})
            return out

        ledger['cohorts'].append({
            'week': week,
            'openedAt': now_iso(),
            'status': 'open',
            'momentum': legs(momentum),
            'model': legs(model),
            'notionalPerName': NOTIONAL,
        })
    # Keep last 26 cohorts
    ledger['cohorts'] = ledger['cohorts'][-26:]
    closed = [c for c in ledger['cohorts'] if c.get('status') == 'closed']
    hits_m = sum(1 for c in closed if (c.get('momentumAvgPct') or 0) > 0)
    hits_d = sum(1 for c in closed if (c.get('modelAvgPct') or 0) > 0)
    ledger['hitRate'] = {
        'momentum': round(hits_m / len(closed), 3) if closed else None,
        'model': round(hits_d / len(closed), 3) if closed else None,
        'closedCohorts': len(closed),
    }
    save_ledger(ledger)
    return ledger


def market_breadth(watch_rows):
    up = sum(1 for r in watch_rows if (r.get('pct') or 0) > 0)
    down = sum(1 for r in watch_rows if (r.get('pct') or 0) < 0)
    flat = len(watch_rows) - up - down
    vol = sum(r.get('volume') or 0 for r in watch_rows)
    return {'symbols': len(watch_rows), 'advancers': up, 'decliners': down, 'unchanged': flat, 'volume': vol}


class PsxStore:
    """Background PSX feed: watch → histories → momentum/model → ledger."""

    def __init__(self):
        self.lock = threading.RLock()
        self.token = None
        self.token_at = 0.0
        self.watch = []
        self.histories = {}
        self.overview = {}
        self.good = {'watch': False, 'histories': False, 'ranks': False}
        self.fetched = {}
        self.attempted = {}
        self.pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix='psx')
        self.cache_path = HERE / '.cache' / 'psx-last-good.json'
        self._load_cache()

    def _load_cache(self):
        try:
            data = json.loads(self.cache_path.read_text(encoding='utf-8'))
            if isinstance(data, dict):
                self.overview = data.get('overview') or {}
                self.watch = data.get('watch') or []
                self.histories = data.get('histories') or {}
                self.fetched = data.get('fetched') or {}
        except (OSError, ValueError):
            pass

    def _save_cache(self):
        try:
            self.cache_path.parent.mkdir(exist_ok=True)
            # Persist only recent bars to keep file small
            hist = {s: bars[-120:] for s, bars in self.histories.items()}
            payload = {
                'overview': self.overview,
                'watch': self.watch,
                'histories': hist,
                'fetched': self.fetched,
            }
            tmp = self.cache_path.with_suffix('.tmp')
            tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            tmp.replace(self.cache_path)
        except OSError:
            pass

    def _ensure_token(self, force=False):
        if not force and self.token and time.monotonic() - self.token_at < 25 * 60:
            return self.token
        self.token = fetch_dps_token()
        self.token_at = time.monotonic()
        return self.token

    def _fetch_watch(self):
        try:
            token = self._ensure_token()
            try:
                rows, token = fetch_market_watch(token)
            except Exception:
                token = self._ensure_token(force=True)
                rows, token = fetch_market_watch(token)
            with self.lock:
                self.token = token
                self.watch = rows
                self.good['watch'] = True
                self.fetched['watch'] = now_iso()
        except Exception as error:
            with self.lock:
                self.good['watch'] = False
            logging.info('PSX watch retained last good (%s)', type(error).__name__)

    def _fetch_histories(self, symbols):
        token = self._ensure_token()
        updated = {}

        def one(sym):
            try:
                bars, _ = fetch_eod(sym, token=token)
                return sym, bars
            except Exception:
                return sym, None

        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(one, s) for s in symbols]
            for fut in as_completed(futures):
                sym, bars = fut.result()
                if bars:
                    updated[sym] = bars
        with self.lock:
            self.histories.update(updated)
            # Drop histories for symbols no longer needed
            keep = set(symbols) | {r['symbol'] for r in (self.overview.get('momentum') or [])}
            keep |= {r['symbol'] for r in (self.overview.get('model') or [])}
            self.histories = {s: self.histories[s] for s in self.histories if s in keep}
            self.good['histories'] = bool(updated) or bool(self.histories)
            self.fetched['histories'] = now_iso()

    def _recompute(self):
        with self.lock:
            watch = list(self.watch)
            histories = dict(self.histories)
        if not watch:
            return
        by_sym = {r['symbol']: r for r in watch}
        top_vol_syms = [r['symbol'] for r in sorted(watch, key=lambda x: x['volume'], reverse=True)[:TOP_VOLUME]]
        # Ensure histories for volume leaders
        missing = [s for s in top_vol_syms if s not in histories or len(histories[s]) < 12]
        if missing:
            self._fetch_histories(missing[:TOP_VOLUME])
            with self.lock:
                histories = dict(self.histories)
        try:
            ranked = rank_momentum(watch, histories)
        except Exception as error:
            logging.info('PSX rank failed (%s)', type(error).__name__)
            ranked = {'momentum': [], 'topVolume': [], 'scoredCount': 0}
        try:
            model = score_model({s: histories[s] for s in top_vol_syms if s in histories}, by_sym)
        except Exception as error:
            logging.info('PSX model failed (%s)', type(error).__name__)
            model = {'model': [], 'trainRows': 0, 'sigmaPct': None}
        try:
            ledger = update_ledger(ranked.get('momentum') or [], model.get('model') or [], histories, by_sym)
        except Exception as error:
            logging.info('PSX ledger failed (%s)', type(error).__name__)
            ledger = load_ledger()
        # Track membership changes on momentum board
        prev = {r['symbol'] for r in (self.overview.get('momentum') or [])}
        now = {r['symbol'] for r in (ranked.get('momentum') or [])}
        overview = {
            'clock': now_iso(),
            'tz': 'Asia/Karachi',
            'disclaimer': 'Screens and model scores are not investment advice. DPS snapshots are polled, not ticks. Paper P&L only.',
            'source': 'Pakistan Stock Exchange Data Portal (dps.psx.com.pk)',
            'breadth': market_breadth(watch),
            'momentum': ranked.get('momentum') or [],
            'model': model.get('model') or [],
            'modelMeta': {'trainRows': model.get('trainRows'), 'sigmaPct': model.get('sigmaPct')},
            'topVolumeCount': len(ranked.get('topVolume') or []),
            'boardDelta': {'entered': sorted(now - prev), 'exited': sorted(prev - now)},
            'ledger': {
                'cumulative': ledger.get('cumulative'),
                'hitRate': ledger.get('hitRate'),
                'latest': ledger['cohorts'][-1] if ledger.get('cohorts') else None,
                'recentClosed': [c for c in ledger.get('cohorts', []) if c.get('status') == 'closed'][-4:],
            },
            'fetchedAt': {
                'watch': self.fetched.get('watch'),
                'histories': self.fetched.get('histories'),
                'ranks': now_iso(),
            },
            'states': {
                'watch': 'current' if self.good.get('watch') else ('cached' if watch else 'unavailable'),
                'histories': 'current' if self.good.get('histories') else ('cached' if histories else 'unavailable'),
                'ranks': 'current' if ranked.get('momentum') else 'unavailable',
            },
        }
        with self.lock:
            self.overview = overview
            self.good['ranks'] = bool(ranked.get('momentum'))
            self.fetched['ranks'] = now_iso()
            self._save_cache()

    def tick(self, manual=False):
        start = time.monotonic()
        watch_ttl = 20 if manual else 90
        hist_ttl = 60 if manual else 900
        if start - self.attempted.get('watch', float('-inf')) >= watch_ttl:
            self.attempted['watch'] = start
            self._fetch_watch()
        if start - self.attempted.get('ranks', float('-inf')) >= hist_ttl or manual:
            self.attempted['ranks'] = start
            self._recompute()

    def run(self):
        # Warm once quickly, then loop.
        try:
            self.tick(manual=True)
        except Exception:
            logging.info('PSX initial tick failed')
        while True:
            try:
                self.tick()
            except Exception:
                logging.info('PSX tick error')
            time.sleep(8)

    def snapshot(self):
        with self.lock:
            return dict(self.overview) if self.overview else {
                'clock': now_iso(),
                'disclaimer': 'Screens and model scores are not investment advice.',
                'source': 'Pakistan Stock Exchange Data Portal (dps.psx.com.pk)',
                'breadth': None,
                'momentum': [],
                'model': [],
                'ledger': load_ledger(),
                'states': {'watch': 'loading', 'histories': 'loading', 'ranks': 'loading'},
            }

    def history(self, symbol):
        sym = (symbol or '').upper().strip()
        with self.lock:
            if sym in self.histories:
                return {'symbol': sym, 'bars': self.histories[sym][-180:], 'state': 'current' if self.good.get('histories') else 'cached'}
            allowed = {r['symbol'] for r in self.watch[:TOP_VOLUME]}
            allowed |= {r['symbol'] for r in (self.overview.get('momentum') or [])}
            allowed |= {r['symbol'] for r in (self.overview.get('model') or [])}
        if sym not in allowed and self.watch:
            # Allow any watch symbol but fetch on demand once
            pass
        try:
            bars, _ = fetch_eod(sym, token=self._ensure_token())
            with self.lock:
                self.histories[sym] = bars
            return {'symbol': sym, 'bars': bars[-180:], 'state': 'current'}
        except Exception:
            with self.lock:
                bars = self.histories.get(sym)
            if bars:
                return {'symbol': sym, 'bars': bars[-180:], 'state': 'cached'}
            raise

    def refresh(self):
        self.tick(manual=True)
        return self.snapshot()
