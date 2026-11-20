import json
import unittest
from datetime import date
from unittest.mock import patch

from agent import BriefError, evidence, synthesize, validate
from market import (
    FeedStore, HERE, gacc_major_export_links, nbs_links, parse_gacc_steel_exports,
    parse_history, parse_quotes, trade_from_articles,
)

FIXTURES = HERE / 'tests_fixtures'


class MarketParsers(unittest.TestCase):
    def test_quote_basis(self):
        text = '''var hq_str_nf_HC2701="热轧卷板2701,150000,3109,3121,3094,3112,3111,3112,3112,3106,3116,119,32,1719463,526910,沪,热轧卷板,2026-11-18,1";
var hq_str_fx_susdcny="19:35:01,6.666,6.6662,6.6663,50,6.6667,6.6695,6.6645,6.6661,在岸人民币,-0.0030,-0.0002,0.0050,来源,0,0,,2026-11-18";'''
        result = parse_quotes(text)
        self.assertEqual(result['HC2701']['last'], 3112)
        self.assertEqual(result['HC2701']['previous'], 3116)
        self.assertEqual(result['HC2701']['change'], -4)
        self.assertAlmostEqual(result['USDCNY']['pct'], -0.003, places=5)
        self.assertEqual(result['HC2701']['asOf'], '2026-11-18T15:00:00+08:00')
        self.assertFalse(parse_quotes('var hq_str_nf_I2701="";'))

    def test_fx_low_and_high_are_in_provider_order(self):
        data = parse_history('var _k=("2026-11-17,6.6660,6.6649,6.6670,6.6663,|");', True, date(2026,11,18))
        self.assertEqual((data[0]['low'], data[0]['high']), (6.6649, 6.667))

    def test_history_excludes_bad_dates_and_missing_prices(self):
        data = parse_history('var _k=([{"d":"2026-11-01","o":"30","h":"32","l":"29","c":"31"},'
                             '{"d":"bad","c":10},{"d":"2026-11-02","o":30,"l":29,"h":32,"c":0}]);', today=date(2026,11,18))
        self.assertEqual([b['close'] for b in data], [31])

    def test_official_urls_only(self):
        links = nbs_links('<a href="./202611/t20261103_1965735.html">Purchasing Managers’ Index for October 2026</a>'
                          '<a href="https://example.org/english/PressRelease/202612/t20261201_1234.html">Purchasing Managers’ Index for November 2026</a>')
        self.assertEqual(links['pmi']['period'], '2026-10')
        self.assertTrue(links['pmi']['url'].startswith('https://www.stats.gov.cn/'))

    def test_gacc_index_picks_usd_major_exports(self):
        html = (FIXTURES / 'gacc_statistics_index.html').read_text(encoding='utf-8')
        links = gacc_major_export_links(html)
        self.assertEqual(len(links), 1)
        self.assertIn('22a0a656', links[0][0])
        self.assertIn('USD', links[0][1])

    def test_gacc_steel_row_to_mt(self):
        html = (FIXTURES / 'gacc_major_exports_oct2026_usd.html').read_text(encoding='utf-8')
        row = parse_gacc_steel_exports(html, url='http://example.test/gacc.html')
        self.assertEqual(row['period'], 'October 2026')
        self.assertEqual(row['key'], '2026-10')
        self.assertAlmostEqual(row['monthMt'], 9.854, places=3)
        self.assertAlmostEqual(row['ytdMt'], 95.495, places=3)
        self.assertEqual(row['ytdYoY'], -2.3)
        self.assertEqual(row['published'], '2026-11-10')
        self.assertEqual(row['source'], 'GACC · official table')

    def test_trade_feed_shape_and_dedupe(self):
        articles = [
            {'title': 'Pakistan extends 40.47% anti-dumping duty on Chinese galvalume steel',
             'url': 'https://example.com/a', 'publisher': 'Profit', 'publishedAt': '2026-11-14T08:00:00Z'},
            {'title': 'Pakistan extends 40.47% anti-dumping duty on Chinese galvalume steel coils',
             'url': 'https://example.com/b', 'publisher': 'Profit', 'publishedAt': '2026-11-14T09:00:00Z'},
            {'title': 'Saudi Arabia opens investigation into hot-rolled steel imports',
             'url': 'https://example.com/c', 'publisher': 'Reuters', 'publishedAt': '2026-11-09T12:00:00Z'},
            {'title': 'Tech earnings beat estimates this quarter',
             'url': 'https://example.com/d', 'publisher': 'Wire', 'publishedAt': '2026-11-10T12:00:00Z'},
        ]
        rows = trade_from_articles(articles)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['source'], 'news')
        self.assertIn(rows[0]['status'], {'Duty reported', 'Investigation', 'Policy signal'})
        countries = {r['country'] for r in rows}
        self.assertTrue({'Pakistan', 'Saudi Arabia'} <= countries)
        for row in rows:
            for key in ('country', 'product', 'status', 'rate', 'date', 'url', 'publisher', 'source'):
                self.assertIn(key, row)

    def test_snapshot_exports_and_trade_are_status_objects(self):
        store = FeedStore()
        store.data = json.loads((HERE / 'data' / 'seed.json').read_text(encoding='utf-8'))
        snap = store.snapshot()
        self.assertIsInstance(snap['exports'], dict)
        self.assertIn('state', snap['exports'])
        self.assertIn('value', snap['exports'])
        self.assertNotIn('monthMt', snap['exports'])  # bare constant removed
        self.assertIsInstance(snap['trade'], dict)
        self.assertIn('state', snap['trade'])


class AgentChecks(unittest.TestCase):
    def snapshot(self):
        store = FeedStore()
        store.data = json.loads((HERE/'data'/'seed.json').read_text())
        return store.snapshot()

    def test_evidence_is_dated_and_whitelisted(self):
        context, refs = evidence(self.snapshot(), 'HC2701')
        self.assertEqual(context[0]['ref'], 'Q-HC2701')
        self.assertEqual(context[0]['comparisonBasis'], 'prior settlement')
        self.assertEqual(context[0]['feedState'], 'cached')
        self.assertEqual(refs['R-DECK']['url'], '#report-lens')
        self.assertTrue(any('headlineOnly' in item for item in context))

    def test_bad_references_are_rejected(self):
        with self.assertRaises(ValueError):
            validate({'headline':'Example', 'observations':[{'text':'a','refs':['fake']}],
                      'watch':[{'label':'b','text':'test','refs':['fake']}]}, {'Q-HC2701':{'url':'https://finance.sina.com.cn/'}})

    def test_key_validation_happens_before_upstream(self):
        with patch.dict('os.environ', {'OPENROUTER_API_KEY': '', 'BRIEF_PROVIDER': 'openrouter'}, clear=False):
            with self.assertRaises(BriefError) as caught:
                synthesize(self.snapshot(), {'key': 'bad'})
            self.assertEqual(caught.exception.status, 400)

    def test_upstream_shape_with_mock(self):
        data = {'headline':'Example brief', 'observations':[{'text':'HRC data were fetched.','refs':['Q-HC2701']}],
                'watch':[{'label':'Trade','text':'Watch new releases.','refs':['R-DECK']}]}
        with patch.dict('os.environ', {'OPENROUTER_API_KEY': '', 'BRIEF_PROVIDER': 'openrouter'}, clear=False):
            with patch('agent.build_opener') as build:
                http = build.return_value.open.return_value.__enter__.return_value
                http.read.return_value = json.dumps({'choices':[{'message':{'content':json.dumps(data)}}]}).encode()
                result = synthesize(self.snapshot(), {'key':'sk-or-local-testing-value-not-real'})
                req = build.return_value.open.call_args.args[0]
                self.assertEqual(req.host, 'openrouter.ai')
                self.assertNotIn('sk-or-', req.data.decode())
                self.assertEqual(result['headline'], data['headline'])
                self.assertEqual(set(result['refs']), {'Q-HC2701','R-DECK'})


if __name__ == '__main__':
    unittest.main()
