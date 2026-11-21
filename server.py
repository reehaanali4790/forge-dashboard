"""Small, dependency-free HTTP server for the Forge dashboard."""
import argparse
import json
import logging
import mimetypes
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from agent import BriefError, synthesize
from commodities import SYMBOLS as COMMODITY_SYMBOLS, CommodityStore
from envconfig import agent_status, load_dotenv
from fob_freight import FobFreightStore
from lcd import compose_overview, refresh_overview
from market import FeedStore, HERE
from psx import PsxStore
from tradedeck import TradeDeckStore

STATIC = HERE / 'static'


def psx_overview(server):
    snap = server.psx.snapshot()
    snap['commodities'] = server.commodities.snapshot()
    return snap


def with_agent(snapshot):
    out = dict(snapshot)
    out['agent'] = agent_status()
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = 'Forge/1.0'
    sys_version = ''

    def log_message(self, form, *args):
        # Do not log URLs, headers, uploaded information, or inference requests.
        pass

    def send_content(self, content, mime, status=200, *, cache='no-store', extra=()):
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'",
        )
        for key, value in extra:
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            try:
                self.wfile.write(content)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def json_response(self, obj, status=200):
        self.send_content(
            json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8'),
            'application/json; charset=utf-8',
            status,
        )

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parts = urlsplit(self.path)
        path = parts.path
        if path == '/api/overview':
            self.json_response(with_agent(self.server.feeds.snapshot()))
            return
        if path == '/api/psx/overview':
            self.json_response(psx_overview(self.server))
            return
        if path == '/api/lcd/overview':
            self.json_response(compose_overview(self.server))
            return
        if path == '/api/psx/commodity':
            symbol = (parse_qs(parts.query).get('symbol') or [''])[0].upper().strip()
            if symbol not in COMMODITY_SYMBOLS:
                self.json_response({'error': 'Use symbol XAUUSD or USOIL.'}, 400)
                return
            try:
                self.json_response(self.server.commodities.get(symbol))
            except Exception:
                self.json_response({'error': 'Commodity feed unavailable.'}, 502)
            return
        if path == '/api/psx/history':
            symbol = (parse_qs(parts.query).get('symbol') or [''])[0].upper().strip()
            if not re.fullmatch(r'[A-Z0-9]{2,12}', symbol):
                self.json_response({'error': 'Provide a valid PSX symbol.'}, 400)
                return
            try:
                self.json_response(self.server.psx.history(symbol))
            except Exception:
                self.json_response({'error': 'History unavailable for this symbol.'}, 502)
            return
        if path == '/health':
            status = agent_status()
            self.json_response({'ok': True, 'agentReady': status['ready'], 'provider': status['provider']})
            return
        if path == '/report-blueprint.md':
            self.send_content(
                (HERE / 'REPORT-BLUEPRINT.md').read_bytes(),
                'text/markdown; charset=utf-8',
                extra=(('Content-Disposition', 'attachment; filename="Forge-report-blueprint.md"'),),
            )
            return
        if path in ('/', '/index.html'):
            rel = 'index.html'
        elif path in ('/psx', '/psx.html'):
            rel = 'psx.html'
        elif path in ('/lcd', '/lcd.html'):
            rel = 'lcd.html'
        elif path in ('/app.js', '/style.css', '/reference.json', '/favicon.svg', '/psx.js', '/psx.css',
                      '/lcd.js', '/lcd.css', '/theme.css', '/theme.js', '/charts.js'):
            rel = path[1:]
        elif path.startswith('/assets/') and '/' not in path[len('/assets/'):]:
            rel = path[1:]
        elif path.startswith('/vendor/') and '/' not in path[len('/vendor/'):]:
            rel = path[1:]
        else:
            self.json_response({'error': 'Not found'}, 404)
            return
        file = (STATIC / rel).resolve()
        if not file.is_relative_to(STATIC) or not file.is_file():
            self.json_response({'error': 'Not found'}, 404)
            return
        mime = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        self.send_content(
            file.read_bytes(),
            mime + ('; charset=utf-8' if mime.startswith('text/') else ''),
            cache='public, max-age=3600' if rel.startswith(('assets/', 'vendor/')) else 'no-cache',
        )

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in ('/api/brief', '/api/refresh', '/api/psx/refresh', '/api/lcd/refresh'):
            self.json_response({'error': 'Not found'}, 404)
            return
        if self.headers.get('Sec-Fetch-Site') == 'cross-site' or self.headers.get_content_type() != 'application/json':
            self.json_response({'error': 'Send a same-origin JSON request.'}, 403)
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            length = -1
        if not 1 <= length <= 4096:
            self.json_response({'error': 'Invalid request size.'}, 400)
            return
        try:
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            self.json_response({'error': 'Invalid request.'}, 400)
            return
        if path == '/api/refresh':
            self.json_response(with_agent(self.server.feeds.refresh()))
            return
        if path == '/api/psx/refresh':
            self.server.psx.refresh()
            self.server.commodities.refresh()
            self.json_response(psx_overview(self.server))
            return
        if path == '/api/lcd/refresh':
            self.json_response(refresh_overview(self.server))
            return
        try:
            self.json_response(synthesize(self.server.feeds.snapshot(), body))
        except BriefError as error:
            self.json_response({'error': str(error)}, error.status)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', default=3000, type=int)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    load_dotenv()
    status = agent_status()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.feeds = FeedStore()
    server.psx = PsxStore()
    server.commodities = CommodityStore()
    server.fob = FobFreightStore()
    server.tradedeck = TradeDeckStore()
    threading.Thread(target=server.feeds.run, daemon=True).start()
    threading.Thread(target=server.psx.run, daemon=True).start()
    threading.Thread(target=server.commodities.run, daemon=True).start()
    threading.Thread(target=server.fob.run, daemon=True).start()
    threading.Thread(target=server.tradedeck.run, daemon=True).start()
    ready = 'ready' if status['ready'] else 'not configured'
    print(f'Forge Steel Market Desk listening at http://{args.host}:{args.port}', flush=True)
    print(f'PSX + commodities LCD · http://{args.host}:{args.port}/psx', flush=True)
    print(f'64\" wall board · http://{args.host}:{args.port}/lcd', flush=True)
    print(f'AI brief · {status["provider"]} · {ready} · model {status["model"]}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
