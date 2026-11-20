import json
import unittest
from datetime import date, timedelta
from pathlib import Path

from psx import (
    HERE, extract_dps_token, parse_eod_series, parse_market_watch,
    rank_momentum, score_model, update_ledger, weekly_return, save_ledger,
)

FIX = HERE / 'tests_fixtures'


def make_bars(n=30, start=100.0, step=1.0):
    base = date(2026, 10, 20)
    bars, px = [], start
    for i in range(n):
        px = start + i * step
        d = str(base + timedelta(days=i))
        bars.append({'date': d, 'open': px - 0.5, 'high': px + 1, 'low': px - 1, 'close': px, 'volume': 1000 + i * 50})
    return bars


class PsxParsers(unittest.TestCase):
    def test_token_extract(self):
        html = (FIX / 'psx_home_token.html').read_text(encoding='utf-8')
        token = extract_dps_token(html)
        self.assertTrue(token and len(token) > 10)

    def test_market_watch_parse(self):
        html = (FIX / 'psx_market_watch_sample.html').read_text(encoding='utf-8')
        rows = parse_market_watch(html)
        self.assertGreaterEqual(len(rows), 3)
        self.assertIn('symbol', rows[0])
        self.assertGreater(rows[0]['volume'], 0)
        self.assertGreater(rows[0]['last'], 0)

    def test_eod_parse(self):
        payload = json.loads((FIX / 'psx_eod_sample.json').read_text(encoding='utf-8'))
        bars = parse_eod_series(payload, today=date(2026, 11, 19))
        self.assertGreaterEqual(len(bars), 20)
        self.assertIn('close', bars[-1])
        self.assertTrue(bars[0]['date'] <= bars[-1]['date'])


class PsxRankingModel(unittest.TestCase):
    def test_weekly_return_and_rank(self):
        watch = [
            {'symbol': 'AAA', 'volume': 9_000_000, 'last': 10, 'pct': 1, 'sector': '1', 'listed': 'ALLSHR',
             'ldcp': 10, 'open': 10, 'high': 11, 'low': 9, 'change': 0.1},
            {'symbol': 'BBB', 'volume': 8_000_000, 'last': 20, 'pct': -1, 'sector': '1', 'listed': 'ALLSHR',
             'ldcp': 20, 'open': 20, 'high': 21, 'low': 19, 'change': -0.2},
            {'symbol': 'CCC', 'volume': 7_000_000, 'last': 30, 'pct': 0.5, 'sector': '1', 'listed': 'ALLSHR',
             'ldcp': 30, 'open': 30, 'high': 31, 'low': 29, 'change': 0.1},
            {'symbol': 'DDD', 'volume': 100, 'last': 5, 'pct': 50, 'sector': '1', 'listed': 'ALLSHR',
             'ldcp': 5, 'open': 5, 'high': 6, 'low': 4, 'change': 1},
        ]
        histories = {
            'AAA': make_bars(20, 100, 2),   # strong weekly
            'BBB': make_bars(20, 100, 0.2),
            'CCC': make_bars(20, 100, -1),  # weak
            'DDD': make_bars(20, 10, 5),    # high return but low volume — excluded from top 50 cut in practice; still in list of 4
        }
        # Force only top-3 by volume into ranking by using small universe
        result = rank_momentum(watch, histories)
        self.assertEqual(len(result['topVolume']), 4)
        self.assertEqual(result['momentum'][0]['symbol'], 'DDD')  # highest weekly among those with history
        self.assertIsNotNone(weekly_return(histories['AAA']))

    def test_model_scores_finite(self):
        histories = {f'S{i}': make_bars(40, 50 + i, 0.4 + i * 0.05) for i in range(8)}
        watch = {f'S{i}': {'symbol': f'S{i}', 'last': 60, 'volume': 10000, 'pct': 1, 'sector': 'x'} for i in range(8)}
        out = score_model(histories, watch)
        self.assertEqual(len(out['model']), 5)
        for row in out['model']:
            self.assertTrue(abs(row['predictedWeeklyPct']) < 500)
            self.assertIn('bandPct', row)


class PsxLedger(unittest.TestCase):
    def setUp(self):
        self._path = HERE / '.cache' / 'psx-ledger-test.json'
        # Redirect ledger file via monkeypatch of path helper
        import psx
        self._orig = psx._ledger_path
        psx._ledger_path = lambda: self._path
        if self._path.exists():
            self._path.unlink()

    def tearDown(self):
        import psx
        psx._ledger_path = self._orig
        if self._path.exists():
            self._path.unlink()

    def test_cohort_open_and_close_pnl(self):
        import psx
        watch = {'AAA': {'symbol': 'AAA', 'last': 100}, 'BBB': {'symbol': 'BBB', 'last': 50}}
        histories = {
            'AAA': make_bars(10, 100, 0),
            'BBB': make_bars(10, 50, 0),
        }
        # Force previous week open cohort
        save_ledger({
            'cohorts': [{
                'week': '2020-W01',
                'status': 'open',
                'openedAt': '2020-01-01T00:00:00Z',
                'momentum': [{'symbol': 'AAA', 'entry': 100, 'entryDate': '2020-01-01'}],
                'model': [{'symbol': 'BBB', 'entry': 50, 'entryDate': '2020-01-01'}],
                'notionalPerName': 100,
            }],
            'cumulative': {'momentumPct': 0.0, 'modelPct': 0.0, 'momentumPkr': 0.0, 'modelPkr': 0.0},
        })
        # Bump last closes
        histories['AAA'][-1]['close'] = 110
        histories['BBB'][-1]['close'] = 45
        mom = [{'symbol': 'AAA', 'last': 110, 'asOf': histories['AAA'][-1]['date']}]
        model = [{'symbol': 'BBB', 'last': 45, 'asOf': histories['BBB'][-1]['date']}]
        led = update_ledger(mom, model, histories, watch)
        closed = [c for c in led['cohorts'] if c['week'] == '2020-W01'][0]
        self.assertEqual(closed['status'], 'closed')
        self.assertAlmostEqual(closed['momentumAvgPct'], 10.0, places=1)
        self.assertAlmostEqual(closed['modelAvgPct'], -10.0, places=1)
        self.assertGreater(led['cumulative']['momentumPct'], 0)


if __name__ == '__main__':
    unittest.main()
