"""TradeDeck VIEWER client — JWT login + arrivals bucketing for LCD wall."""
from __future__ import annotations

import json
import logging
import math
import os
import ssl
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
UA = 'Mozilla/5.0 (compatible; ForgeDashboard/1.0)'
ON_PORT = frozenset({'on port', 'berth', 'at berth', 'discharging', 'alongside'})


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def num(value):
    try:
        n = float(value)
        if math.isfinite(n):
            return n
    except (TypeError, ValueError):
        pass
    return None


def tile_from_arrival(item):
    days = item.get('days_to_arrival')
    try:
        days_i = int(days) if days is not None else None
    except (TypeError, ValueError):
        days_i = None
    status = (item.get('status') or item.get('vessel_status') or '').strip()
    buyer = (
        item.get('booked_by')
        or item.get('importer_name')
        or item.get('indentor')
        or item.get('hoa')
        or '—'
    )
    return {
        'id': item.get('shipment_id') or item.get('lot_number') or item.get('vessel_name'),
        'vessel': item.get('vessel_name') or '—',
        'voyage': item.get('voyage_number') or '—',
        'eta': item.get('eta'),
        'etd': item.get('etd') or item.get('delivery_date'),
        'port': item.get('port_of_discharge') or '—',
        'qtyMt': num(item.get('quantity_mt') or item.get('invoice_qty_mt')),
        'buyer': buyer,
        'hoa': item.get('hoa') or '—',
        'status': status or '—',
        'days': days_i,
        'lc': item.get('lc_number'),
        'lot': item.get('lot_number'),
    }


def bucket_arrivals(items, limit=4):
    """Map arrivals into recently arrived / in transit / booked columns."""
    arrived, transit, booked = [], [], []
    for raw in items or []:
        if not isinstance(raw, dict):
            continue
        tile = tile_from_arrival(raw)
        days = tile['days']
        status_l = (tile['status'] or '').lower()
        vessel_status = (raw.get('vessel_status') or '').lower()
        on_port = vessel_status in ON_PORT or any(k in status_l for k in ('on port', 'berth'))
        early = status_l in ('pending', 'copy_docs_received', 'docs_pending', 'booked', '')
        has_buyer = bool(raw.get('booked_by') or raw.get('indentor') or raw.get('hoa'))

        if days is not None and days < 0 or on_port:
            arrived.append(tile)
        elif days is not None and days >= 0:
            transit.append(tile)
            if early and has_buyer:
                booked.append(tile)
        elif early:
            booked.append(tile)

    arrived.sort(key=lambda t: (t.get('eta') or ''), reverse=True)
    transit.sort(key=lambda t: (t.get('eta') or ''))
    # Booked: prefer pending nomination / early workflow, soonest ETA
    booked.sort(key=lambda t: (t.get('eta') or '9999'))

    # If booked thin, fill from transit without on-port (pending shipments)
    if len(booked) < limit:
        seen = {t.get('id') for t in booked}
        for t in transit:
            if t.get('id') in seen:
                continue
            booked.append(t)
            seen.add(t.get('id'))
            if len(booked) >= limit:
                break

    return {
        'arrived': arrived[:limit],
        'transit': transit[:limit],
        'booked': booked[:limit],
        'counts': {
            'arrived': len(arrived),
            'transit': len(transit),
            'booked': len(booked),
        },
    }


class TradeDeckStore:
    def __init__(self):
        self.lock = threading.RLock()
        self.token = None
        self.token_at = 0.0
        self.data = {}
        self.fetched = {}
        self.attempted = {}
        self.error = None
        self.cache_path = HERE / '.cache' / 'tradedeck-last-good.json'
        self._load()

    def configured(self):
        return bool(self.base() and self.user() and self.password())

    def base(self):
        return (os.environ.get('TRADEDECK_BASE') or '').rstrip('/')

    def user(self):
        return (os.environ.get('TRADEDECK_USER') or '').strip()

    def password(self):
        return (os.environ.get('TRADEDECK_PASSWORD') or '').strip()

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

    def _request(self, method, path, *, data=None, form=None, auth=True, timeout=20):
        base = self.base()
        if not base:
            raise RuntimeError('TRADEDECK_BASE not set')
        url = base + path
        headers = {'User-Agent': UA, 'Accept': 'application/json'}
        body = None
        if form is not None:
            body = urlencode(form).encode('utf-8')
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
        elif data is not None:
            body = json.dumps(data).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        if auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        ctx = ssl.create_default_context()
        req = Request(url, data=body, headers=headers, method=method)
        try:
            with urlopen(req, timeout=timeout, context=ctx) as response:
                raw = response.read(4_000_000)
                if not raw:
                    return {}
                return json.loads(raw.decode('utf-8'))
        except HTTPError as err:
            detail = err.read(2000).decode('utf-8', 'replace') if err.fp else ''
            raise HTTPError(err.url, err.code, detail or err.reason, err.headers, None) from err

    def login(self, force=False):
        if not self.configured():
            raise RuntimeError('TradeDeck VIEWER credentials not configured')
        if self.token and not force and time.monotonic() - self.token_at < 50 * 60:
            return self.token
        payload = self._request(
            'POST',
            '/api/auth/login',
            form={'username': self.user(), 'password': self.password()},
            auth=False,
        )
        token = payload.get('access_token')
        if not token:
            raise RuntimeError('TradeDeck login missing access_token')
        with self.lock:
            self.token = token
            self.token_at = time.monotonic()
        return token

    def _authed_get(self, path):
        self.login()
        try:
            return self._request('GET', path)
        except HTTPError as err:
            if err.code == 401:
                self.login(force=True)
                return self._request('GET', path)
            raise

    def fetch_boards(self):
        arrivals = self._authed_get('/api/dashboard/arrivals')
        items = arrivals.get('items') if isinstance(arrivals, dict) else []
        boards = bucket_arrivals(items, limit=4)
        return {
            **boards,
            'rawCount': arrivals.get('count') if isinstance(arrivals, dict) else len(items or []),
            'asOf': now_iso(),
            'configured': True,
            'state': 'current',
        }

    def tick(self, manual=False):
        start = time.monotonic()
        ttl = 15 if manual else 90
        if start - self.attempted.get('all', float('-inf')) < ttl and not manual:
            return
        self.attempted['all'] = start
        if not self.configured():
            with self.lock:
                self.error = 'missing_credentials'
                if not self.data:
                    self.data = {
                        'arrived': [], 'transit': [], 'booked': [],
                        'counts': {'arrived': 0, 'transit': 0, 'booked': 0},
                        'rawCount': 0, 'asOf': None, 'configured': False, 'state': 'unconfigured',
                    }
            return
        try:
            boards = self.fetch_boards()
            with self.lock:
                self.data = boards
                self.fetched['all'] = now_iso()
                self.error = None
                self._save()
        except (HTTPError, URLError, RuntimeError, ValueError, OSError) as err:
            logging.info('TradeDeck tick failed (%s)', type(err).__name__)
            with self.lock:
                self.error = type(err).__name__
                if self.data:
                    self.data = {**self.data, 'state': 'cached', 'error': self.error}
                else:
                    self.data = {
                        'arrived': [], 'transit': [], 'booked': [],
                        'counts': {'arrived': 0, 'transit': 0, 'booked': 0},
                        'rawCount': 0, 'asOf': None, 'configured': True,
                        'state': 'error', 'error': self.error,
                    }

    def run(self):
        try:
            self.tick(manual=True)
        except Exception:
            logging.info('TradeDeck initial tick failed')
        while True:
            try:
                self.tick()
            except Exception:
                logging.info('TradeDeck tick error')
            time.sleep(20)

    def snapshot(self):
        with self.lock:
            if self.data:
                return {**self.data, 'fetchedAt': self.fetched.get('all'), 'error': self.error}
        return {
            'arrived': [], 'transit': [], 'booked': [],
            'counts': {'arrived': 0, 'transit': 0, 'booked': 0},
            'rawCount': 0, 'asOf': None,
            'configured': self.configured(),
            'state': 'loading' if self.configured() else 'unconfigured',
            'fetchedAt': None, 'error': self.error,
        }

    def refresh(self):
        self.tick(manual=True)
        return self.snapshot()
