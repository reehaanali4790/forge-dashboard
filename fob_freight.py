"""Indicative China HRC FOB scrapes + free Baltic Dry Index seaway feed."""
from __future__ import annotations

import json
import logging
import math
import re
import ssl
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
BDI_URL = 'https://www.balticdryindex.com/v1/latest'
COMMODITYSCOPE_URL = 'https://commodityscope.com/prices/hot-rolled-coil'
MYSTEEL_URL = 'https://export.mysteel.com/fenxi/'
UA = 'Mozilla/5.0 (compatible; ForgeDashboard/1.0)'


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def num(value, positive=False):
    try:
        n = float(str(value).replace(',', '').replace('$', '').strip())
        if math.isfinite(n) and (not positive or n > 0):
            return n
    except (TypeError, ValueError):
        pass
    return None


def http_get(url, *, limit=2_000_000, timeout=15, accept='*/*'):
    ctx = ssl.create_default_context()
    req = Request(url, headers={'User-Agent': UA, 'Accept': accept})
    with urlopen(req, timeout=timeout, context=ctx) as response:
        raw = response.read(limit + 1)
        if len(raw) > limit:
            raise ValueError('Upstream payload exceeded limit')
        return raw.decode('utf-8', 'replace')


def parse_bdi(payload):
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict) or payload.get('value') is None:
        raise ValueError('Unexpected BDI payload')
    value = num(payload.get('value'), True)
    if value is None:
        raise ValueError('BDI missing value')
    return {
        'index': payload.get('index') or 'BDI',
        'value': value,
        'change': num(payload.get('change')),
        'pct': num(payload.get('pct')),
        'date': payload.get('date'),
        'source': 'balticdryindex.com · free latest',
        'attribution': payload.get('attribution') or 'Value © Baltic Exchange (via BalticDryIndex.com)',
    }


def parse_commodityscope_hrc(html):
    """Extract public HRC FOB China rows from CommodityScope HTML."""
    if not html or 'FOB China' not in html:
        raise ValueError('CommodityScope HTML unexpected')
    rows = []
    # Patterns like: HRC FOB China SAE1006 ... $503.00/mt · 16 Nov 2026
    pattern = re.compile(
        r'HRC\s+FOB\s+China\s+(SAE1006|SS400)[^$]{0,120}\$?\s*([0-9]+(?:\.[0-9]+)?)\s*/\s*mt'
        r'[^0-9]{0,40}(\d{1,2}\s+\w{3}\s+\d{4})?',
        re.I,
    )
    for match in pattern.finditer(html):
        grade = match.group(1).upper()
        price = num(match.group(2), True)
        if price is None:
            continue
        rows.append({
            'symbol': f'HRC-FOB-CN-{grade}',
            'name': f'HRC FOB China {grade}',
            'grade': grade,
            'basis': 'FOB China',
            'unit': 'USD/mt',
            'mid': price,
            'asOf': match.group(3),
            'source': 'commodityscope.com · public scrape',
        })
    # Table-style fallback: Name then $price
    if len(rows) < 2:
        alt = re.compile(
            r'(HRC FOB China (?:SAE1006|SS400))[^$]{0,80}\$([0-9]+(?:\.[0-9]+)?)',
            re.I,
        )
        for match in alt.finditer(html):
            name = re.sub(r'\s+', ' ', match.group(1)).strip()
            grade = 'SAE1006' if 'SAE1006' in name.upper() else 'SS400'
            price = num(match.group(2), True)
            if price is None:
                continue
            key = f'HRC-FOB-CN-{grade}'
            if any(r['symbol'] == key for r in rows):
                continue
            rows.append({
                'symbol': key,
                'name': name,
                'grade': grade,
                'basis': 'FOB China',
                'unit': 'USD/mt',
                'mid': price,
                'asOf': None,
                'source': 'commodityscope.com · public scrape',
            })
    if not rows:
        raise ValueError('No FOB rows parsed from CommodityScope')
    # Prefer unique grades
    seen = {}
    for row in rows:
        seen[row['grade']] = row
    return list(seen.values())


def parse_mysteel_export_fob(html):
    """Parse Mysteel China export FOB board lines (CNY or USD labels vary)."""
    if not html:
        raise ValueError('Empty Mysteel HTML')
    rows = []
    # Example: 热卷 SS400 3mm 481 0天津港 11-20  or ASCII variants
    mapping = [
        (r'热卷\s*SS400[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)', 'HRC', 'SS400', 'CNY/mt'),
        (r'冷卷\s*SPCC[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)', 'CRC', 'SPCC', 'CNY/mt'),
        (r'中厚板\s*SS400[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)', 'Plate', 'SS400', 'CNY/mt'),
        (r'线材\s*SAE1008[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)', 'Wire', 'SAE1008', 'CNY/mt'),
        (r'螺纹钢\s*B500B[^0-9]{0,30}([0-9]+(?:\.[0-9]+)?)', 'Rebar', 'B500B', 'CNY/mt'),
        (r'镀锌\s*SGCC[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)', 'GI', 'SGCC', 'CNY/mt'),
    ]
    for pattern, product, grade, unit in mapping:
        match = re.search(pattern, html)
        if not match:
            continue
        price = num(match.group(1), True)
        if price is None:
            continue
        rows.append({
            'symbol': f'{product}-FOB-CN-{grade}',
            'name': f'{product} FOB China {grade}',
            'grade': grade,
            'product': product,
            'basis': 'FOB China (Mysteel board)',
            'unit': unit,
            'mid': price,
            'asOf': None,
            'source': 'export.mysteel.com · public scrape',
        })
    if not rows:
        raise ValueError('No Mysteel FOB rows')
    return rows


def load_seed():
    path = HERE / 'data' / 'fob-seed.json'
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {
            'products': [
                {'symbol': 'HRC-FOB-CN-SS400', 'name': 'HRC FOB China SS400', 'grade': 'SS400',
                 'basis': 'FOB China', 'unit': 'USD/mt', 'mid': 476.0, 'asOf': '2026-11-16',
                 'source': 'seed · CommodityScope snapshot'},
                {'symbol': 'HRC-FOB-CN-SAE1006', 'name': 'HRC FOB China SAE1006', 'grade': 'SAE1006',
                 'basis': 'FOB China', 'unit': 'USD/mt', 'mid': 503.0, 'asOf': '2026-11-16',
                 'source': 'seed · CommodityScope snapshot'},
            ],
            'bdi': {'index': 'BDI', 'value': 2901, 'change': -13, 'pct': -0.45, 'date': '2026-11-19',
                    'source': 'seed'},
        }


class FobFreightStore:
    def __init__(self):
        self.lock = threading.RLock()
        self.data = {}
        self.fetched = {}
        self.attempted = {}
        self.cache_path = HERE / '.cache' / 'fob-last-good.json'
        self._load()

    def _load(self):
        try:
            loaded = json.loads(self.cache_path.read_text(encoding='utf-8'))
            if isinstance(loaded, dict):
                self.data = loaded.get('data') or {}
                self.fetched = loaded.get('fetched') or {}
        except (OSError, ValueError):
            pass

    def _save(self):
        try:
            self.cache_path.parent.mkdir(exist_ok=True)
            payload = {'data': self.data, 'fetched': self.fetched}
            tmp = self.cache_path.with_suffix('.tmp')
            tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            tmp.replace(self.cache_path)
        except OSError:
            pass

    def _refresh_bdi(self):
        raw = http_get(BDI_URL, accept='application/json')
        return parse_bdi(raw)

    def _refresh_fob(self):
        try:
            html = http_get(COMMODITYSCOPE_URL, accept='text/html')
            return parse_commodityscope_hrc(html), 'commodityscope'
        except Exception as err:
            logging.info('CommodityScope FOB failed (%s)', type(err).__name__)
        try:
            html = http_get(MYSTEEL_URL, accept='text/html')
            return parse_mysteel_export_fob(html), 'mysteel'
        except Exception as err:
            logging.info('Mysteel FOB failed (%s)', type(err).__name__)
        seed = load_seed()
        return seed.get('products') or [], 'seed'

    def tick(self, manual=False):
        start = time.monotonic()
        ttl = 20 if manual else 600
        if start - self.attempted.get('all', float('-inf')) < ttl and not manual:
            return
        self.attempted['all'] = start
        products, provider = self._refresh_fob()
        try:
            bdi = self._refresh_bdi()
            bdi_state = 'current'
        except Exception as err:
            logging.info('BDI fetch failed (%s)', type(err).__name__)
            bdi = (self.data.get('bdi') if self.data else None) or load_seed().get('bdi')
            bdi_state = 'cached' if self.data.get('bdi') else 'seed'
        entry = {
            'products': products,
            'bdi': bdi,
            'provider': provider,
            'state': 'current' if provider != 'seed' else 'seed',
            'bdiState': bdi_state,
            'disclaimer': 'FOB scrape + BDI · indicative · not licensed settlement · not advice',
            'asOf': now_iso(),
        }
        with self.lock:
            self.data = entry
            self.fetched['all'] = now_iso()
            self._save()

    def run(self):
        try:
            self.tick(manual=True)
        except Exception:
            logging.info('FOB initial tick failed')
        while True:
            try:
                self.tick()
            except Exception:
                logging.info('FOB tick error')
            time.sleep(30)

    def snapshot(self):
        with self.lock:
            if self.data:
                return {**self.data, 'fetchedAt': self.fetched.get('all')}
        seed = load_seed()
        return {
            'products': seed.get('products') or [],
            'bdi': seed.get('bdi'),
            'provider': 'seed',
            'state': 'loading',
            'bdiState': 'loading',
            'disclaimer': 'FOB scrape + BDI · indicative · not licensed settlement · not advice',
            'asOf': None,
            'fetchedAt': None,
        }

    def refresh(self):
        self.tick(manual=True)
        return self.snapshot()
