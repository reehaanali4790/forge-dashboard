# From the Steel Market Update to Forge

**Reference:** *Perfect Craft — Steel Market Presentation & Updates*, 17 November 2026, 29 slides. Page numbers below refer to the supplied PDF.

## What the deck does

The deck starts with a view on the China steel cycle, backs it with economic and trade data, then works down from exchange and currency benchmarks to the actual offers a Pakistani buyer sees. It ends with a way to reason from raw-material moves to steel cost. The dashboard should preserve that decision sequence, not just reproduce the slide styling.

| Slides | What the report covers | Dashboard treatment |
|---|---|---|
| 1–6 | China demand, supply and mill economics; HRC output and inventories; coke and coal; three near-term catalysts: winter production controls, restocking and trade barriers | Put a source-linked market brief after the price board and newswire. Keep the slide commentary dated, separate from observations and conditional outlook. |
| 7–8 | China finished-steel exports and regional mix; manufacturing PMI and sub-indexes. Macro framing in slide 3 also uses CPI and PPI. | Show official monthly PMI, production, new orders, CPI and PPI by the latest available release; preserve the exports baseline with its period and publication link. Correct the slide's ambiguous order labels: the official October NBS tables show 49.4 for new orders and 48.7 for new export orders. For exports, show a separately sourced October update alongside the deck's January–September snapshot. |
| 9 | By-jurisdiction anti-dumping measures and investigations | Keep a dated, filterable report register next to the Policy news filter. Investigations are not duties; use the relevant authority to confirm applicability, dates and exclusions. |
| 10 | USD benchmark comparison for HRC, wire rod, GP and scrap sourced to The Helper / MS Trishmir Imports | Label it as the report's benchmark table. The slide says “LME”, but it does not establish that these are official exchange settlements. Do not treat them as a live LME feed. |
| 11–15 | RMB per USD; HRC, coke, coking coal and iron ore price trends | Poll Sina Finance for onshore USD/CNY and exact Jan 2027 contracts, with daily history and source timestamps. Render futures in CNY/t, not as USD FOB offers. Use prior settlement for futures quote changes and prior close for FX. Do not stitch contracts without labeling a roll. |
| 16–24 | Pakistan PKR local rates and USD indenter asks by grade, thickness and mill | Preserve verified sample observations and missing cells. Allow a team to import its current price sheet. Never fill blank quotes from a futures series. The PDF remains the full historical reference. |
| 25–28 | Input mass balance, theoretical steel cost sensitivity and a spot-market rule of thumb | Show the input breakdown and build a scenario calculator. Default to the deck's illustrative $100/t ore, $200/t coal and $600/t finished steel, with the rounded 1.5t and 0.8t sensitivity factors. Separate that approximation from slide 26's physical mass balance (1.48t ore, 0.84t combined metallurgical coal, 0.29t limestone, 0.14t scrap). Do not price coke again in that coal-based model. Pass-through is an assumption, not a forecast. |
| 29 | Close | Keep the original user PDF in the workspace uploads for audit rather than serving the whole document through the dashboard preview. |

## Build plan

1. **Data:** Fetch fixed, allowlisted Sina quotes and daily histories server-side; normalize contract, currency, unit, price basis and upstream date. Fetch and deduplicate topic-specific news feeds. Check the official NBS release index on its slower, monthly cadence. Cache independently, keep last-known-good data and label freshness honestly. Set up authorized suppliers, exchange licences and release-specific adapters before calling any currently manual series live.
2. **Analysis:** Compute changes and window ranges in code, with price comparisons defined explicitly. Rank recent headlines by relevance and topic, then give OpenRouter only the whitelisted evidence. Request structured facts, interpretations and conditional watch items with source IDs. Validate the shape and references. Without an API key, publish a deterministic brief from the same numbers and linked headlines. This workflow does not need a general-purpose agent or a separate Hermes service.
3. **Interface:** Build one responsive page: current quotes → interactive chart and news → agent brief → China fundamentals → Pakistan sourcing and trade → cost scenarios. Include source links, timezone, current/cached/archived labels, and import validation. The licensed rates and PDF snapshot stay distinct from market data.
4. **Production:** Use licensed providers for redistributing prices, an official exchange holiday/contract-roll calendar, a database plus authenticated uploads and audit history, and a scheduler with monitoring. Store any shared OpenRouter credential in a server secret manager behind app authentication. For this workspace preview, use a session-only key via Agent setup, with on-demand requests rather than a paid unattended job.

## Definition of done

A user can switch symbols and chart horizons, inspect a date and close, filter and open sourced headlines, compare news and data without conflating them, import a fresh price sheet, and test cost sensitivities. If a source goes down, the dashboard either displays dated cached data or says it's unavailable; it does not generate market prices. An AI brief is only labeled as such if OpenRouter returns a usable source-linked result.
