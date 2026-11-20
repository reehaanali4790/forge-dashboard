import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fob_freight import parse_bdi, parse_commodityscope_hrc, parse_mysteel_export_fob, FobFreightStore
from lcd import compose_overview, slim_psx
from tradedeck import bucket_arrivals, tile_from_arrival, TradeDeckStore

FIX = Path(__file__).resolve().parent / 'tests_fixtures'


class FobParsers(unittest.TestCase):
    def test_bdi_latest(self):
        payload = json.loads((FIX / 'bdi_latest.json').read_text(encoding='utf-8'))
        row = parse_bdi(payload)
        self.assertEqual(row['index'], 'BDI')
        self.assertEqual(row['value'], 2901)
        self.assertEqual(row['change'], -13)
        self.assertIn('Baltic', row['attribution'])

    def test_commodityscope_hrc(self):
        html = (FIX / 'commodityscope_hrc.html').read_text(encoding='utf-8')
        rows = parse_commodityscope_hrc(html)
        grades = {r['grade'] for r in rows}
        self.assertIn('SAE1006', grades)
        self.assertIn('SS400', grades)
        sae = next(r for r in rows if r['grade'] == 'SAE1006')
        self.assertAlmostEqual(sae['mid'], 503.0)
        self.assertIn('commodityscope', sae['source'])

    def test_mysteel_export(self):
        html = (FIX / 'mysteel_export_fob.html').read_text(encoding='utf-8')
        rows = parse_mysteel_export_fob(html)
        products = {r['product'] for r in rows}
        self.assertIn('HRC', products)
        self.assertIn('CRC', products)
        self.assertTrue(all(r['unit'] == 'CNY/mt' for r in rows))

    def test_bdi_rejects_empty(self):
        with self.assertRaises(ValueError):
            parse_bdi({})


class TradeDeckBuckets(unittest.TestCase):
    def setUp(self):
        self.items = json.loads((FIX / 'tradedeck_arrivals.json').read_text(encoding='utf-8'))['items']

    def test_bucket_sizes(self):
        boards = bucket_arrivals(self.items, limit=4)
        self.assertEqual(len(boards['arrived']), 2)
        self.assertEqual(len(boards['transit']), 4)
        self.assertEqual(len(boards['booked']), 4)
        self.assertEqual(boards['arrived'][0]['vessel'], 'MV STEEL WAVE')
        self.assertEqual(boards['transit'][0]['vessel'], 'MV ORE PATH')
        self.assertEqual(boards['booked'][0]['buyer'], 'Buyer Alpha')

    def test_tile_fields(self):
        tile = tile_from_arrival(self.items[0])
        self.assertEqual(tile['vessel'], 'MV STEEL WAVE')
        self.assertEqual(tile['days'], -2)
        self.assertEqual(tile['port'], 'Karachi')
        self.assertAlmostEqual(tile['qtyMt'], 12500)

    def test_unconfigured_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = TradeDeckStore()
            store.cache_path = Path(tmp) / 'td.json'
            with patch.dict('os.environ', {'TRADEDECK_BASE': '', 'TRADEDECK_USER': '', 'TRADEDECK_PASSWORD': ''}, clear=False):
                store.tick(manual=True)
                snap = store.snapshot()
            self.assertFalse(snap['configured'])
            self.assertEqual(snap['state'], 'unconfigured')


class LcdCompose(unittest.TestCase):
    def test_slim_psx_empty(self):
        out = slim_psx({})
        self.assertEqual(out['state'], 'loading')
        self.assertEqual(out['topMomentum'], [])

    def test_slim_psx_momentum(self):
        out = slim_psx({
            'momentum': [
                {'symbol': 'ENGRO', 'name': 'Engro', 'last': 350, 'weeklyPct': 4.2, 'volume': 1e6},
            ],
            'breadth': {'advancers': 10, 'decliners': 5, 'unchanged': 2, 'symbols': 17},
            'ledger': {'cumulative': {'momentumPct': 1.5, 'modelPct': 0.8}},
            'states': {'ranks': 'current'},
        })
        self.assertEqual(out['topMomentum'][0]['symbol'], 'ENGRO')
        self.assertAlmostEqual(out['topMomentum'][0]['changePct'], 4.2)
        self.assertEqual(out['breadth']['advancers'], 10)

    def test_compose_overview_keys(self):
        server = MagicMock()
        server.feeds.snapshot.return_value = {
            'clock': '2026-11-20T00:00:00Z',
            'instruments': {},
            'quotes': {},
            'history': {},
            'news': {'state': 'current', 'value': [{'title': 'Steel scrap firm', 'source': 'Wire'}]},
        }
        server.psx.snapshot.return_value = {
            'momentum': [{'symbol': 'LUCK', 'last': 900, 'weeklyPct': 2.1}],
            'breadth': {'advancers': 1, 'decliners': 0, 'unchanged': 0, 'symbols': 1},
            'ledger': {'cumulative': {}},
            'states': {'ranks': 'current'},
        }
        server.fob.snapshot.return_value = {
            'products': [], 'bdi': {'value': 2901}, 'disclaimer': 'test', 'state': 'seed',
        }
        server.tradedeck.snapshot.return_value = {
            'arrived': [], 'transit': [], 'booked': [], 'configured': False, 'state': 'unconfigured',
        }
        out = compose_overview(server)
        self.assertIn('psx', out)
        self.assertIn('futures', out)
        self.assertIn('fob', out)
        self.assertIn('vessels', out)
        self.assertIn('news', out)
        self.assertEqual(out['ticker'][0], 'Steel scrap firm')


class FobStoreSeed(unittest.TestCase):
    def test_snapshot_seed_when_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = FobFreightStore()
            store.cache_path = Path(tmp) / 'fob.json'
            store.data = {}
            snap = store.snapshot()
            self.assertTrue(snap['products'])
            self.assertIn('bdi', snap)


if __name__ == '__main__':
    unittest.main()
