"""Free CFD commodity quotes via biquote.io (XAUUSD, USOIL) — no API key."""
from __future__ import annotations

import json
import logging
import math
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
BIQUOTE = 'https://biquote.io'
SYMBOLS = {
    'XAUUSD': {'name': 'Gold', 'short': 'XAU', 'unit': 'USD/oz', 'accent': 'gold'},
    'USOIL': {'name': 'Crude oil', 'short': 'Oil', 'unit': 'USD/bbl', 'accent': 'oil'},
}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def num(value, positive=False):
    try:
        n = float(value)
        if math.isfinite(n) and (not positive or n > 0):
            return n
    except (TypeError, ValueError):
        pass
    return None


def biquote_get(path, *, limit=1_500_000, timeout=12):
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; ForgeDashboard/1.0)',
        'Accept': 'application/json',
    }
    ctx = ssl.create_default_context()
    req = Request(BIQUOTE + path, headers=headers)
    with urlopen(req, timeout=timeout, context=ctx) as response:
        raw = response.read(limit + 1)
        if len(raw) > limit:
            raise ValueError('Upstream payload exceeded limit')
        return json.loads(raw.decode('utf-8'))


def parse_biquote_tick(payload, meta):
    if not isinstance(payload, dict) or not payload.get('symbol'):
        raise ValueError('Unexpected biquote tick')
    mid = num(payload.get('mid')) or num(payload.get('bid')) or num(payload.get('ask'))
    if mid is None:
        raise ValueError('No mid price')
    return {
        'symbol': str(payload['symbol']).upper(),
        'name': meta['name'],
        'short': meta['short'],
        'unit': meta['unit'],
        'accent': meta['accent'],
        'mid': mid,
        'bid': num(payload.get('bid')),
        'ask': num(payload.get('ask')),
        'high': num(payload.get('high'), True),
        'low': num(payload.get('low'), True),
        'pct': num(payload.get('dayDiffPercent')),
        'direction': payload.get('direction'),
        'marketState': payload.get('marketState') or 'unknown',
        'stale': bool(payload.get('stale')),
        'asOf': payload.get('timestamp') or payload.get('lastQuoteAt') or now_iso(),
        'source': 'biquote · CFD mid',
        'provider': payload.get('source') or 'biquote.io',
        'url': f'{BIQUOTE}/api/{payload["symbol"]}',
    }


def parse_biquote_ohlc(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get('bars'), list):
        raise ValueError('Unexpected biquote OHLC')
    bars = []
    for row in payload['bars']:
        if not isinstance(row, dict):
            continue
        o, h, low, c = [num(row.get(k), True) for k in ('open', 'high', 'low', 'close')]
        if None in (o, h, low, c):
            continue
        stamp = row.get('openTime') or ''
        date = stamp[:10] if isinstance(stamp, str) and len(stamp) >= 10 else None
        if not date:
            continue
        bars.append({
            'date': date,
            'time': stamp,
            'open': o,
            'high': h,
            'low': low,
            'close': c,
            'volume': num(row.get('tickVolume')) or num(row.get('volume')) or 0,
            'isOpen': bool(row.get('isOpen')),
        })
    # API returns newest-first
    bars.sort(key=lambda b: b['time'])
    if len(bars) < 2:
        raise ValueError('OHLC too short')
    return bars


def fetch_biquote_tick(symbol):
    sym = symbol.upper().strip()
    if sym not in SYMBOLS:
        raise ValueError('Unsupported commodity symbol')
    return parse_biquote_tick(biquote_get(f'/api/{sym}'), SYMBOLS[sym])


def fetch_biquote_ohlc(symbol, *, interval='1h', limit=180):
    sym = symbol.upper().strip()
    if sym not in SYMBOLS:
        raise ValueError('Unsupported commodity symbol')
    if interval not in ('1m', '5m', '15m', '30m', '1h', '4h', '1d'):
        raise ValueError('Invalid interval')
    limit = max(20, min(int(limit), 500))
    payload = biquote_get(f'/api/{sym}/ohlc?interval={interval}&limit={limit}')
    return parse_biquote_ohlc(payload)


class CommodityStore:
    """Background biquote ticks + OHLC for XAUUSD and USOIL."""

    def __init__(self):
        self.lock = threading.RLock()
        self.data = {}
        self.good = {}
        self.fetched = {}
        self.attempted = {}
        self.cache_path = HERE / '.cache' / 'commodities-last-good.json'
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
            slim = {}
            for sym, entry in self.data.items():
                slim[sym] = {**entry, 'bars': (entry.get('bars') or [])[-120:]}
            payload = {'data': slim, 'fetched': self.fetched}
            tmp = self.cache_path.with_suffix('.tmp')
            tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            tmp.replace(self.cache_path)
        except OSError:
            pass

    def _refresh_one(self, symbol, with_ohlc=True):
        tick = fetch_biquote_tick(symbol)
        bars = None
        if with_ohlc:
            try:
                bars = fetch_biquote_ohlc(symbol, interval='1h', limit=180)
            except Exception:
                bars = (self.data.get(symbol) or {}).get('bars')
        else:
            bars = (self.data.get(symbol) or {}).get('bars')
        entry = {**tick, 'bars': bars or [], 'state': 'current'}
        with self.lock:
            self.data[symbol] = entry
            self.good[symbol] = True
            self.fetched[symbol] = now_iso()
            self._save()
        return entry

    def tick(self, manual=False):
        start = time.monotonic()
        quote_ttl = 15 if manual else 45
        ohlc_ttl = 60 if manual else 600
        need_ohlc = start - self.attempted.get('ohlc', float('-inf')) >= ohlc_ttl
        if start - self.attempted.get('quotes', float('-inf')) < quote_ttl and not manual:
            return
        self.attempted['quotes'] = start
        if need_ohlc or manual:
            self.attempted['ohlc'] = start
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self._refresh_one, sym, need_ohlc or manual) for sym in SYMBOLS]
            for fut in as_completed(futures):
                try:
                    fut.result()
                except Exception as error:
                    logging.info('Commodity refresh failed (%s)', type(error).__name__)
                    with self.lock:
                        for sym in SYMBOLS:
                            if sym in self.data:
                                self.data[sym]['state'] = 'cached'
                                self.good[sym] = False

    def run(self):
        try:
            self.tick(manual=True)
        except Exception:
            logging.info('Commodity initial tick failed')
        while True:
            try:
                self.tick()
            except Exception:
                logging.info('Commodity tick error')
            time.sleep(8)

    def snapshot(self):
        with self.lock:
            out = {}
            for sym, meta in SYMBOLS.items():
                entry = self.data.get(sym)
                if not entry:
                    out[sym] = {
                        'symbol': sym,
                        'name': meta['name'],
                        'unit': meta['unit'],
                        'accent': meta['accent'],
                        'state': 'loading',
                        'mid': None,
                        'bars': [],
                        'source': 'biquote · CFD mid',
                    }
                else:
                    state = 'current' if self.good.get(sym) else 'cached'
                    out[sym] = {**entry, 'state': state, 'fetchedAt': self.fetched.get(sym)}
            return out

    def get(self, symbol):
        sym = (symbol or '').upper().strip()
        if sym not in SYMBOLS:
            raise ValueError('Unsupported commodity')
        with self.lock:
            entry = self.data.get(sym)
            if entry and entry.get('bars'):
                return entry
        return self._refresh_one(sym, with_ohlc=True)

    def refresh(self):
        self.tick(manual=True)
        return self.snapshot()
