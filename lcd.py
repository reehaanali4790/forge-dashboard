"""Composite LCD wall snapshot — PSX + futures + FOB/BDI + TradeDeck + news."""
from __future__ import annotations

from market import INSTRUMENTS

LCD_FUTURES = ('HC2701', 'I2701', 'JM2701', 'J2701', 'USDCNY')


def slim_quote(status):
    if not isinstance(status, dict):
        return {'state': 'loading'}
    data = status.get('value') if isinstance(status.get('value'), dict) else {}
    return {
        'state': status.get('state') or 'loading',
        'fetchedAt': status.get('fetchedAt'),
        'last': data.get('last'),
        'change': data.get('change'),
        'changePct': data.get('pct'),
        'open': data.get('open'),
        'high': data.get('high'),
        'low': data.get('low'),
        'prevClose': data.get('previous'),
        'asOf': data.get('asOf'),
    }


def slim_history(status, points=48):
    if not isinstance(status, dict):
        return []
    data = status.get('value')
    if not isinstance(data, list):
        return []
    closes = []
    for row in data[-points:]:
        if isinstance(row, dict) and row.get('close') is not None:
            closes.append(row['close'])
        elif isinstance(row, (list, tuple)) and len(row) >= 2:
            closes.append(row[1])
    return closes


def slim_news(status, limit=12):
    if not isinstance(status, dict):
        return []
    data = status.get('value')
    items = data if isinstance(data, list) else (data.get('items') if isinstance(data, dict) else [])
    out = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        title = (item.get('title') or '').strip()
        if not title:
            continue
        out.append({
            'title': title[:160],
            'source': (item.get('source') or '')[:40],
            'published': item.get('published') or item.get('date'),
            'topic': item.get('topic') or item.get('category'),
        })
        if len(out) >= limit:
            break
    return out


def slim_psx(snap):
    if not isinstance(snap, dict) or not snap:
        return {'state': 'loading', 'topMomentum': [], 'breadth': {}, 'ledger': {}, 'spark': []}
    momentum = snap.get('momentum') or []
    ledger = snap.get('ledger') or {}
    cum = ledger.get('cumulative') or {}
    breadth = snap.get('breadth') or {}
    states = snap.get('states') or {}
    top = []
    for row in (momentum if isinstance(momentum, list) else [])[:5]:
        if not isinstance(row, dict):
            continue
        top.append({
            'symbol': row.get('symbol'),
            'name': row.get('name') or row.get('company'),
            'last': row.get('last'),
            'changePct': row.get('weeklyPct') if row.get('weeklyPct') is not None else row.get('pct'),
            'volume': row.get('volume'),
        })
    return {
        'clock': snap.get('clock'),
        'state': states.get('ranks') or ('current' if top else 'loading'),
        'topMomentum': top,
        'breadth': {
            'advancers': breadth.get('advancers'),
            'decliners': breadth.get('decliners'),
            'unchanged': breadth.get('unchanged'),
            'symbols': breadth.get('symbols'),
            'volume': breadth.get('volume'),
        },
        'ledger': {
            'momentumPct': cum.get('momentumPct'),
            'modelPct': cum.get('modelPct'),
            'momentumPkr': cum.get('momentumPkr'),
            'modelPkr': cum.get('modelPkr'),
            'hitRate': ledger.get('hitRate'),
        },
        'spark': [r.get('changePct') for r in top if r.get('changePct') is not None],
        'fetchedAt': (snap.get('fetchedAt') or {}).get('ranks') if isinstance(snap.get('fetchedAt'), dict) else snap.get('fetchedAt'),
        'disclaimer': snap.get('disclaimer'),
    }


def futures_panel(feeds):
    quotes = feeds.get('quotes') or {}
    history = feeds.get('history') or {}
    instruments = feeds.get('instruments') or INSTRUMENTS
    panel = {}
    for code in LCD_FUTURES:
        meta = instruments.get(code) or {}
        panel[code] = {
            **slim_quote(quotes.get(code)),
            'meta': {'name': meta.get('name') or code, 'unit': meta.get('unit')},
            'spark': slim_history(history.get(code), 36),
        }
    return panel


def compose_overview(server):
    feeds = server.feeds.snapshot()
    psx = slim_psx(server.psx.snapshot())
    fob = server.fob.snapshot()
    vessels = server.tradedeck.snapshot()
    news = slim_news(feeds.get('news'), 14)
    return {
        'clock': feeds.get('clock'),
        'psx': psx,
        'futures': futures_panel(feeds),
        'fob': fob,
        'vessels': vessels,
        'news': news,
        'ticker': [n['title'] for n in news],
        'disclaimer': {
            'fob': (fob or {}).get('disclaimer')
            or 'FOB scrape + BDI · indicative · not settlement · not advice',
            'cfd': 'Futures quotes via Sina · CFD commodities not physical FOB',
        },
    }


def refresh_overview(server):
    server.feeds.refresh()
    server.psx.refresh()
    server.fob.refresh()
    server.tradedeck.refresh()
    return compose_overview(server)
