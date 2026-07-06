#!/usr/bin/env python3
"""Build descriptions.json — a static, one-time-ish map of company/coin
descriptions the app shows on each ticker's detail page.

Descriptions don't change day to day, so this is NOT part of the 15-min refresh
loop. Run it occasionally (or when the universe changes):

    python3 edge-desk-app/build_descriptions.py

Source is yfinance's own `longBusinessSummary` / `description` (real Yahoo data,
not fabricated), plus sector/industry. Writes edge-desk-app/descriptions.json:

    { "AAPL": {"desc": "...", "sector": "...", "industry": "..."},
      "BTC-USD": {"desc": "..."}, ... }
"""
import json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yfinance as yf
from edge_desk_advisor import UNIVERSE, CRYPTO_UNIVERSE, NAMES, CRYPTO_NAMES

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "descriptions.json")


def clean(txt: str, limit: int = 900) -> str:
    if not txt:
        return ""
    txt = " ".join(txt.split())
    if len(txt) > limit:
        cut = txt[:limit].rsplit(". ", 1)[0]
        txt = (cut + ".") if cut else (txt[:limit].rstrip() + "…")
    return txt


def fetch(symbol: str) -> dict:
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception as e:
        print(f"  ! {symbol}: {e}")
        return {}
    desc = clean(info.get("longBusinessSummary") or info.get("description") or "")
    out = {}
    if desc:
        out["desc"] = desc
    if info.get("sector"):
        out["sector"] = info["sector"]
    if info.get("industry"):
        out["industry"] = info["industry"]
    if info.get("website"):
        out["site"] = info["website"]
    return out


def main():
    existing = {}
    if os.path.exists(OUT):
        try:
            existing = json.load(open(OUT))
        except Exception:
            existing = {}

    result = dict(existing)
    stocks = [t for t in UNIVERSE]
    coins = list(CRYPTO_UNIVERSE)
    allsyms = stocks + coins
    print(f"Fetching descriptions for {len(allsyms)} symbols…")
    for i, sym in enumerate(allsyms, 1):
        # Skip ones we already have a description for (idempotent, resumable).
        if result.get(sym, {}).get("desc"):
            continue
        d = fetch(sym)
        if d:
            result[sym] = d
            print(f"  [{i}/{len(allsyms)}] {sym}: {len(d.get('desc',''))} chars")
        else:
            print(f"  [{i}/{len(allsyms)}] {sym}: (none)")
        time.sleep(0.3)
        # Save progress periodically so a mid-run failure isn't total loss.
        if i % 20 == 0:
            json.dump(result, open(OUT, "w"), indent=0)

    json.dump(result, open(OUT, "w"), indent=0)
    have = sum(1 for v in result.values() if v.get("desc"))
    print(f"Done. {have}/{len(allsyms)} have descriptions → {OUT}")


if __name__ == "__main__":
    main()
