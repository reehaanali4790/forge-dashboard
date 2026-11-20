import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from commodities import (
    SYMBOLS, CommodityStore, parse_biquote_ohlc, parse_biquote_tick,
)

FIX = Path(__file__).resolve().parent / 'tests_fixtures'


class BiquoteParsers(unittest.TestCase):
    def test_xau_tick(self):
        payload = json.loads((FIX / 'biquote_xauusd_tick.json').read_text(encoding='utf-8'))
        row = parse_biquote_tick(payload, SYMBOLS['XAUUSD'])
        self.assertEqual(row['symbol'], 'XAUUSD')
        self.assertAlmostEqual(row['mid'], 3573.22)
        self.assertAlmostEqual(row['pct'], -4.47)
        self.assertEqual(row['unit'], 'USD/oz')
        self.assertIn('CFD', row['source'])

    def test_usoil_tick(self):
        payload = json.loads((FIX / 'biquote_usoil_tick.json').read_text(encoding='utf-8'))
        row = parse_biquote_tick(payload, SYMBOLS['USOIL'])
        self.assertEqual(row['symbol'], 'USOIL')
        self.assertAlmostEqual(row['mid'], 90.20)
        self.assertAlmostEqual(row['pct'], 1.11)
        self.assertEqual(row['accent'], 'oil')

    def test_ohlc_sorts_oldest_first(self):
        payload = json.loads((FIX / 'biquote_xauusd_ohlc.json').read_text(encoding='utf-8'))
        bars = parse_biquote_ohlc(payload)
        self.assertGreaterEqual(len(bars), 4)
        self.assertTrue(bars[0]['time'] < bars[-1]['time'])
        self.assertIn('close', bars[-1])
        self.assertAlmostEqual(bars[-1]['close'], 3573.22)

    def test_tick_rejects_empty(self):
        with self.assertRaises(ValueError):
            parse_biquote_tick({}, SYMBOLS['XAUUSD'])

    def test_ohlc_rejects_short(self):
        with self.assertRaises(ValueError):
            parse_biquote_ohlc({'bars': [{'openTime': '2026-11-20T01:00:00Z', 'open': 1, 'high': 2, 'low': 0.5, 'close': 1.5}]})


class CommodityStoreSnapshot(unittest.TestCase):
    def test_snapshot_keys_and_loading(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CommodityStore()
            store.cache_path = Path(tmp) / 'commodities-last-good.json'
            store.data = {}
            store.good = {}
            store.fetched = {}
            snap = store.snapshot()
            self.assertIn('XAUUSD', snap)
            self.assertIn('USOIL', snap)
            self.assertEqual(snap['XAUUSD']['state'], 'loading')
            self.assertEqual(snap['USOIL']['state'], 'loading')

    def test_snapshot_current_after_inject(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CommodityStore()
            store.cache_path = Path(tmp) / 'commodities-last-good.json'
            tick = parse_biquote_tick(
                json.loads((FIX / 'biquote_xauusd_tick.json').read_text(encoding='utf-8')),
                SYMBOLS['XAUUSD'],
            )
            bars = parse_biquote_ohlc(
                json.loads((FIX / 'biquote_xauusd_ohlc.json').read_text(encoding='utf-8')),
            )
            store.data = {'XAUUSD': {**tick, 'bars': bars, 'state': 'current'}}
            store.good = {'XAUUSD': True}
            store.fetched = {'XAUUSD': '2026-11-20T09:00:00Z'}
            snap = store.snapshot()
            self.assertEqual(snap['XAUUSD']['state'], 'current')
            self.assertAlmostEqual(snap['XAUUSD']['mid'], 3573.22)
            self.assertGreaterEqual(len(snap['XAUUSD']['bars']), 4)
            self.assertEqual(snap['USOIL']['state'], 'loading')

    def test_refresh_one_merges_tick_and_ohlc(self):
        tick = parse_biquote_tick(
            json.loads((FIX / 'biquote_xauusd_tick.json').read_text(encoding='utf-8')),
            SYMBOLS['XAUUSD'],
        )
        bars = parse_biquote_ohlc(
            json.loads((FIX / 'biquote_xauusd_ohlc.json').read_text(encoding='utf-8')),
        )
        with tempfile.TemporaryDirectory() as tmp:
            store = CommodityStore()
            store.cache_path = Path(tmp) / 'commodities-last-good.json'
            with patch('commodities.fetch_biquote_tick', return_value=tick), \
                 patch('commodities.fetch_biquote_ohlc', return_value=bars):
                entry = store._refresh_one('XAUUSD', with_ohlc=True)
            self.assertEqual(entry['symbol'], 'XAUUSD')
            self.assertEqual(entry['state'], 'current')
            self.assertEqual(len(entry['bars']), len(bars))
            snap = store.snapshot()
            self.assertEqual(snap['XAUUSD']['state'], 'current')


if __name__ == '__main__':
    unittest.main()
