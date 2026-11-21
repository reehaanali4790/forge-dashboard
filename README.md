# Forge — Steel Market Dashboard

Forge turns the **17 November 2026 Perfect Craft Steel Market Update** into a responsive, single-page report on live feed and OpenRouter brief APIs. The UI is an exchange-desk design system — flat surfaces, hairline borders, tabular numerals, one accent, directional green/red — with fully developed **light and dark modes** and candlestick/area charts from the vendored TradingView Lightweight Charts engine. Open **Forge Steel Market Dashboard** in the Arena Live Preview, or run it locally from this directory:

```sh
python3 server.py --port 3000
```

Then visit `http://127.0.0.1:3000`. Python 3.10+ and outbound HTTPS are required; there are no package installs. Use `--host 0.0.0.0` only when the environment provides an appropriate preview proxy or authenticated network boundary.

### Production (Docker)

Isolated Compose stack on host port **3200** (does not join other project networks):

```sh
docker compose -p forge-dashboard up -d --build
```

Live: `http://38.60.176.61:3200` · PSX LCD: `http://38.60.176.61:3200/psx` · 64″ wall: `http://38.60.176.61:3200/lcd`

CI: push to `main` runs unit tests on GitHub-hosted runners, then a **self-hosted** `forge-vps` runner on this box syncs `/opt/forge-dashboard` and restarts only the `forge-dashboard` compose project (other stacks untouched).

**[Report blueprint](REPORT-BLUEPRINT.md)** maps the 29 slides to the dashboard and describes the next steps for a team deployment.

## Using the report

- **Light / dark mode:** The sun/moon button in the app bar switches theme on every page and remembers the choice; with no stored choice the page follows the operating system. Tokens live in `static/theme.css`, and `static/theme.js` applies the theme before first paint so there is no flash. Charts read the same tokens through `ForgeTheme.colors()`, so canvases repaint with the DOM.
- **Layout:** The app bar carries section navigation, feed status and actions; a live tape under it shows all five China contracts plus gold and crude (click an item to load it in the chart). Content is then split into Overview, Markets, Intelligence, Sourcing, PSX and Cost lab.
- **Markets:** Click a quote card or select a chart contract. Switch the chart period, choose line or candlesticks, hover or use arrow keys to inspect points, and download the window as CSV. The four cards cover HRC, ore, coking coal, and FX; the chart selector also includes coke.
- **Market wire:** Filter by steel, inputs, policy, or macro. Open publisher coverage from each headline; sourcing includes the dated trade register and a shortcut to policy news.
- **Market brief:** The deterministic brief is always available with data. For AI synthesis, copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` (default) and optionally `NVIDIA_API_KEY`. With a server key configured, **Generate AI brief** works without pasting a key in the browser. Agent setup can still override provider/model for the tab. Do not commit `.env` or paste keys into chat. Provider charges depend on the chosen model.
- **China fundamentals:** Official NBS PMI/CPI/PPI plus finished-steel exports scraped from the GACC English “(5) Major Exports” USD table (Products of steel or iron).
- **Price book:** Live Local / Indenter / Benchmark books are **CSV imports only** (no free public API for Pakistan PKR or indenter USD offers). PDF commercial sheets sit under **Archive · 17 Nov** and are never shown as live. Header: `book,product,spec,currency,price,date,source`. Book/currency pairs: `local`/`PKR`, `indenter`/`USD`, `benchmark`/`USD`. Dates are `YYYY-MM-DD`. Imports stay in the browser.
- **PSX board:** Report section **PSX** and the full-screen terminal at `/psx`. Momentum Top 5 (volume→weekly), model Top 5, charts, paper ledger, plus **XAUUSD / USOIL** CFD mids from [biquote.io](https://biquote.io) (server-polled; not exchange settlement). Screens are not trade tickets. All three pages (`/`, `/psx`, `/lcd`) share one design system from `static/theme.css`; `/psx` is the denser terminal twin.
- **64″ wall (`/lcd`):** Full-bleed two-row board for a ~16:9 wall display. Row 1: PSX momentum + Sina futures (HC/I/JM/J/USDCNY) + China HRC FOB scrape with Baltic Dry Index. Row 2: TradeDeck vessel columns (arrived / in transit / booked ×4) + news wire. Polled via `GET /api/lcd/overview` so CSP stays `connect-src 'self'`. Press **F** for fullscreen.
- **Cost lab:** Illustrative scenario only (defaults are not a live price). Preset or custom ore/coal shocks, pass-through, and base prices. Not a forecast.

## Data and agent workflow

| Data | Refresh | Notes |
|---|---:|---|
| Sina futures and onshore USD/CNY | 60 sec | `HC2701`, `I2701`, `JM2701`, `J2701`, `USDCNY`. Provider stamps in China time. Displayed futures deltas use prior settlement; FX uses prior close. Not tick real-time and no automatic roll. |
| Sina daily OHLC | 15 min | Independent per instrument. Latest daily bar may be provisional; the chart window compares daily closes, not prior settlement. |
| Topic RSS | 10 min | Google News; Bing is a fallback. Rank, classify, and deduplicate headlines. Treat headlines as attributed evidence, not the article or proven causes. |
| China NBS | 1 hour | Discover and validate latest PMI, CPI and PPI tables. Figures are monthly and show their period. |
| GACC steel exports | ~6 hours | Official English Major Exports USD table → month Mt, YTD Mt, YTD YoY; MoM when a prior month table/history is available. |
| Trade remedies | 15 min | Policy RSS normalized into a live register. Slide-9 PDF list is archive-only. Verify measures with the authority. |
| Commercial price sheets | CSV / archive | Live books = browser CSV imports. PDF transcriptions = Archive · 17 Nov only. Not an LME or Helper/Trishmir live feed. |
| PSX board (`/psx` + `#psx`) | ~90s watch / ~15 min ranks | DPS Data Portal (`dps.psx.com.pk`) via rotating `X-Req-Id`. Top 50 by volume → Top 5 weekly + ridge model scores + paper P&L ledger. Snapshots, not ticks. **Not investment advice.** Commercial redistribution of PSX data requires a PSX license. |
| Gold & crude (XAUUSD / USOIL) | ~45s ticks / ~10 min OHLC | Free [biquote.io](https://biquote.io) CFD mid/bid/ask + 1h OHLC via Forge `commodities.py` (urllib allowlist; CSP stays `connect-src 'self'`). Last-good cache: `.cache/commodities-last-good.json`. Labelled **CFD mid · not advice** — MT5/OTC snapshot, not a settlement tape. Hourly candlesticks on `/psx`; compact strip on `#psx`. |
| China HRC FOB + BDI (`/lcd`) | ~10 min | **FOB:** public scrape of [CommodityScope HRC FOB China](https://commodityscope.com/prices/hot-rolled-coil) (SAE1006 / SS400 USD/mt) with Mysteel export board fallback; last-good `.cache/fob-last-good.json` + `data/fob-seed.json`. **Seaway:** free `GET https://www.balticdryindex.com/v1/latest` (no key). Label: **indicative scrape · not licensed Fastmarkets/Mysteel feed · not settlement / not advice**. Paid Fastmarkets / Metals-API / Mysteel login feeds are out of scope. |
| TradeDeck vessels (`/lcd`) | ~90s | Server VIEWER login via `TRADEDECK_BASE` / `TRADEDECK_USER` / `TRADEDECK_PASSWORD` in `.env` → JWT Bearer → `GET /api/dashboard/arrivals` on the public edge (`http://38.60.176.61`). Buckets: arrived (`days_to_arrival < 0` / on port), in transit (`>= 0`), booked (pending / `booked_by`). Password never reaches the browser. Without VIEWER creds, vessel columns stay empty (`state: unconfigured`). |

The service collects allowlisted feeds in parallel, normalizes field types, and keeps last-known-good results (bootstrapped by a dated provider snapshot in `data/seed.json`; runtime cache is `.cache/last-good.json`). Failed pulls retain the previous timestamp and are marked cached or unavailable. The original user PDF is not hosted by the app; it stays in the conversation uploads.

### TradeDeck VIEWER on the VPS

Put credentials only in `/opt/forge-dashboard/.env` (and local `.env` for dev) — never in git:

```env
TRADEDECK_BASE=http://38.60.176.61
TRADEDECK_USER=your_viewer_user
TRADEDECK_PASSWORD=your_viewer_password
```

Redeploy/restart the `forge-dashboard` compose project after editing. Confirm `http://38.60.176.61:3200/lcd` shows DECK feed green and vessel tiles populated.

On an AI request, `agent.py` builds an evidence set of quotes, computed close-window returns, monthly releases, and ranked headlines. It asks OpenRouter for JSON observations and conditional watch items. Structure and source IDs are checked, and the UI resolves IDs to the original links. This is source-link validation, not a guarantee that all model interpretations are accurate. No system runs trading, sends alerts, or makes paid API calls automatically. The pipeline uses OpenRouter directly rather than running a separate Hermes agent.

## Checks and production handoff

```sh
python3 -m unittest -v test_market test_psx test_commodities test_lcd
```


The running build was also checked in desktop and mobile Chromium: symbol switching, ranges, candlesticks, keyboard hover, chart download, headline filters, source dialogs, CSV import/persistence, trade views, calculated scenarios, refresh and the mock AI workflow.

For production: review market-data redistribution terms and replace public web endpoints with licensed or authorized feeds where needed; add a contract/holiday calendar, an authenticated quote store and audit log, an official trade and customs update process, and a budget-controlled job scheduler. If using a shared LLM key, put it in a secret manager behind app authentication instead of adding it to this project. The bundled fonts are redistributed under their included SIL Open Font Licenses, and `static/vendor/lightweight-charts.js` (TradingView Lightweight Charts v4.2.3) under the Apache 2.0 license in `licenses/`.
