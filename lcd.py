"""Composite LCD wall snapshot — PSX charts + futures + metals + FOB/BDI + vessels."""
from __future__ import annotations

from market import INSTRUMENTS

LCD_FUTURES = ('HC2701', 'I2701', 'JM2701', 'J2701', 'USDCNY')
VESSEL_LIMIT = 3


def closes_from_bars(bars, points=48):
    if not isinstance(bars, list):
        return []
    out = []
    for row in bars[-points:]:
        if isinstance(row, dict) and row.get('close') is not None:
            out.append(row['close'])
        elif isinstance(row, (list, tuple)) and len(row) >= 2:
            out.append(row[1])
    return out


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
    return closes_from_bars(status.get('value'), points)


def slim_news(status, limit=10):
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
            'title': title[:140],
            'source': (item.get('source') or '')[:40],
            'published': item.get('published') or item.get('date'),
            'topic': item.get('topic') or item.get('category'),
        })
        if len(out) >= limit:
            break
    return out


def slim_psx(snap, histories=None):
    histories = histories or {}
    if not isinstance(snap, dict) or not snap:
        return {'state': 'loading', 'topMomentum': [], 'charts': [], 'breadth': {}, 'ledger': {}}
    momentum = snap.get('momentum') or []
    model = snap.get('model') or []
    ledger = snap.get('ledger') or {}
    cum = ledger.get('cumulative') or {}
    breadth = snap.get('breadth') or {}
    states = snap.get('states') or {}
    charts = []
    for row in (momentum if isinstance(momentum, list) else [])[:5]:
        if not isinstance(row, dict):
            continue
        sym = row.get('symbol')
        bars = histories.get(sym) or []
        charts.append({
            'symbol': sym,
            'name': row.get('name') or row.get('company'),
            'last': row.get('last'),
            'changePct': row.get('weeklyPct') if row.get('weeklyPct') is not None else row.get('pct'),
            'volume': row.get('volume'),
            'spark': closes_from_bars(bars, 40),
            'kind': 'momentum',
        })
    # Fill remaining chart slots from model board if momentum thin
    if len(charts) < 5:
        seen = {c['symbol'] for c in charts}
        for row in (model if isinstance(model, list) else []):
            if not isinstance(row, dict):
                continue
            sym = row.get('symbol')
            if not sym or sym in seen:
                continue
            bars = histories.get(sym) or []
            charts.append({
                'symbol': sym,
                'name': row.get('name') or row.get('company'),
                'last': row.get('last'),
                'changePct': row.get('score') if row.get('score') is not None else row.get('pct'),
                'volume': row.get('volume'),
                'spark': closes_from_bars(bars, 40),
                'kind': 'model',
            })
            seen.add(sym)
            if len(charts) >= 5:
                break
    return {
        'clock': snap.get('clock'),
        'state': states.get('ranks') or ('current' if charts else 'loading'),
        'topMomentum': charts,
        'charts': charts,
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
            'meta': {
                'name': meta.get('name') or code,
                'short': meta.get('short') or code,
                'unit': meta.get('unit'),
                'venue': meta.get('venue'),
            },
            'spark': slim_history(history.get(code), 48),
        }
    return panel


def slim_metals(commodities):
    """Global CFD rates (gold / crude) — wall label as metals & energy, not exchange LME."""
    out = {}
    if not isinstance(commodities, dict):
        return out
    for sym in ('XAUUSD', 'USOIL'):
        row = commodities.get(sym) or {}
        bars = row.get('bars') or []
        closes = []
        for b in bars[-40:]:
            if isinstance(b, dict) and b.get('close') is not None:
                closes.append(b['close'])
        out[sym] = {
            'symbol': sym,
            'name': row.get('name') or sym,
            'unit': row.get('unit'),
            'mid': row.get('mid'),
            'pct': row.get('pct'),
            'state': row.get('state') or 'loading',
            'spark': closes,
            'source': row.get('source') or 'biquote · CFD',
        }
    return out


def trim_vessels(vessels, limit=VESSEL_LIMIT):
    if not isinstance(vessels, dict):
        return vessels
    out = dict(vessels)
    for key in ('arrived', 'transit', 'booked'):
        rows = out.get(key) or []
        out[key] = rows[:limit]
    return out


def compose_overview(server):
    feeds = server.feeds.snapshot()
    with server.psx.lock:
        histories = {s: list(bars) for s, bars in (server.psx.histories or {}).items()}
    psx = slim_psx(server.psx.snapshot(), histories)
    fob = server.fob.snapshot()
    vessels = trim_vessels(server.tradedeck.snapshot(), VESSEL_LIMIT)
    metals = slim_metals(server.commodities.snapshot())
    news = slim_news(feeds.get('news'), 8)
    return {
        'clock': feeds.get('clock'),
        'psx': psx,
        'futures': futures_panel(feeds),
        'metals': metals,
        'fob': fob,
        'vessels': vessels,
        'news': news,
        'ticker': [n['title'] for n in news],
        'disclaimer': {
            'fob': (fob or {}).get('disclaimer')
            or 'FOB scrape + BDI · indicative · not settlement · not advice',
            'cfd': 'China futures via Sina · gold/crude CFD mids · not LME settlement',
        },
    }


def refresh_overview(server):
    server.feeds.refresh()
    server.psx.refresh()
    server.commodities.refresh()
    server.fob.refresh()
    server.tradedeck.refresh()
    return compose_overview(server)
