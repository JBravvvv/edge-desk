# Edge Desk — Project Guide

This file gives you (Claude Code) the full context for this project. Read it first.

## What this is
Edge Desk is a personal equity-research and portfolio-tracking tool for a retail investor. Two pieces:

1. **`edge-desk.jsx`** — a single-file React web app (the dashboard). Tabs:
   - **Overview** — macro regime + sector-momentum read (read-only snapshots).
   - **Signals** — a ranked list of Buy / Watch / Avoid calls with entry zone, stop, and reason.
   - **Universe** — 100+ tracked stocks grouped by theme, plus a box to paste the advisor's live export and rank them.
   - **Portfolio** — a trade log. The only inputs are amount invested and entry price; it computes P&L and a win/loss record.
   - **Sizer** — stop-based position sizing + R-multiples.
   - **Analyst** — paste-and-map analysis using the Claude API (no web search in-app).

2. **`edge_desk_advisor.py`** — a Python script (the live engine). Scans 100+ liquid stocks via yfinance, ranks them with a transparent rules engine (trend, momentum, breakout/pullback structure, relative strength vs SPY; penalizes overbought/over-extended; liquidity filter), prints explicit BUY/WATCH/AVOID calls, tracks the user's P&L from a small `POSITIONS` dict, and appends dated snapshots to `portfolio_history.csv`.

## The core architecture decision (important — don't undo this)
As a Claude.ai **artifact**, the web app is sandboxed and **cannot fetch live market data**. As the **hosted home-screen app** (`edge-desk-app/`, deployed to a real HTTPS host) it is **not** sandboxed and **can** fetch. So:
- As a chat **artifact**: dashboard + trade log + a dated snapshot; it does **not** auto-update. Don't add *fake* refresh here — be honest about the limit.
- As the **hosted app**: it pulls `data.json` (the advisor's published snapshot) on open, on a timer, and on demand, showing a live "Updated" time. This refresh is **real, not fake** — the data is 100% the advisor's own output. This is allowed and intended.
- The **advisor script** is the only piece that fetches market data. `--export` prints a JSON array (paste into the **Universe** tab); `--snapshot [path]` writes the richer `data.json` the hosted app reads. Re-running it *is* the refresh.
- The hosted app auto-updates because a scheduled job (`.github/workflows/deploy.yml`) re-runs `--snapshot` during market hours and redeploys. Still never fabricate prices/levels/scores — always from the advisor.

## How to run the advisor
```bash
pip install yfinance pandas numpy
python edge_desk_advisor.py            # ranked calls + portfolio P&L
python edge_desk_advisor.py --loop     # rescan every 15 min
python edge_desk_advisor.py --top 30   # show more calls
python edge_desk_advisor.py --export   # JSON to paste into the website Universe tab
python edge_desk_advisor.py --snapshot # writes edge-desk-app/data.json (the hosted app's live feed)
```
The user edits only the `POSITIONS` dict at the top of the script (ticker → invested $, entry price). It is seeded with their real trade: NBIS, 1 share @ $239.50.

## About the user — tailor to this
- **Non-technical.** Explain in plain language and **do the setup and commands for them** rather than instructing them to run things. Running a raw script was confusing for them; that's exactly the friction Claude Code should remove.
- Small account: about $750 to deploy, plus existing holdings (VOO, NBIS 1 share, WEN, BTC).
- Thinks in betting/quant terms — expected value, Kelly criterion, R-multiples, bankroll management. Use that framing.
- Mobile-first for the web app: keep it responsive and touch-friendly.
- Design system to preserve if you edit the UI: emerald `#0E7A57` / ink `#131A26`, Fraunces serif display + Inter body, soft white cards, tabular-nums for figures.

## Guardrails
- This is an **informational** tool, **not investment advice**. Keep that framing in outputs.
- **Never fabricate stock prices, levels, or scores.** If current data is needed, fetch it (web or yfinance) — do not invent numbers for names you haven't checked. The website's Signals list is a hand-verified snapshot; the advisor computes everything live.
- The calls are setups that match criteria, not predictions. Track outcomes honestly (the win/loss record exists for that reason).

## Good next steps (already discussed with the user)
- An equity-curve chart script that reads `portfolio_history.csv` to visualize performance over time.
- Refresh/expand the curated Signals set with freshly verified names.
- Optionally deploy the website to a real URL (e.g., a static host) so it isn't only an artifact.

## Files
- `edge-desk.jsx` — canonical web app (React, single file). Runs as a Claude artifact, and is the source for the home-screen build.
- `edge-desk-app/` — the installable home-screen app (PWA). `app.jsx` is **auto-generated from edge-desk.jsx by `build.py`** (don't edit directly — run `python3 edge-desk-app/build.py` after editing the source). Also holds `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`, `vendor/` (React + transpiler, bundled for offline), and `data.json` (the live feed the app pulls).
- `edge_desk_advisor.py` — the live scanner + P&L tracker. `--snapshot` publishes `data.json`.
- `.github/workflows/deploy.yml` — deploys the app to GitHub Pages and refreshes `data.json` on a schedule (the "auto-refresh during the day" engine).
- `portfolio_history.csv` — created by the advisor on first run.
