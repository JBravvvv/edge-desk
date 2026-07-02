#!/usr/bin/env python3
"""
EDGE DESK — Automated Advisor
=============================
Does the work for you. Every run it:
  1. Pulls LIVE data on 100+ liquid stocks (yfinance).
  2. Ranks them by a transparent rules engine and prints an explicit
     BUY / WATCH / AVOID call for each — no scoring or weighting by you.
  3. Tracks YOUR portfolio P&L from a tiny positions list (the only thing
     you edit: ticker, amount invested, entry price) and logs a dated
     snapshot to portfolio_history.csv so you can see results over time.

What it is NOT: a crystal ball. No system predicts winners. This finds and
ranks setups that historically precede momentum, and tells you which ones
are buyable now, which to wait on, and which to avoid. You choose what to
take — willing to win or lose — and the tracker keeps you honest.

Setup:  pip install yfinance pandas numpy
Run:    python edge_desk_advisor.py             # calls + your portfolio
        python edge_desk_advisor.py --loop      # rescan every 15 min
        python edge_desk_advisor.py --top 30    # show more calls

The scoring (each adds points; edit weights freely):
  +Trend (price>50d>200d) +Momentum (1m & 3m up, near highs)
  +Structure (fresh breakout on volume, or pullback to the 50d)
  +Relative strength vs SPY    -Overbought / over-extended
  Liquidity filter: drops anything under ~$20M/day average volume.
"""

import sys
import csv
import os
import json
import time
from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf

# ----------------------------------------------------------------------
# 100+ liquid universe across the themes that are actually moving.
# ----------------------------------------------------------------------
UNIVERSE = [
    # AI compute / semis
    "NVDA", "AVGO", "AMD", "MU", "MRVL", "TSM", "ARM", "ALAB", "CRDO", "SMCI",
    "QCOM", "TXN", "LRCX", "AMAT", "KLAC", "ASML", "ADI", "NXPI", "ON", "MCHP",
    # Power / electrification / nuclear
    "GEV", "VRT", "CEG", "VST", "TLN", "NRG", "ETN", "PWR", "OKLO", "SMR",
    "CCJ", "NEE", "SO", "D", "DUK", "AEP", "EXC", "CEG",
    # Neoclouds / data / AI software
    "NBIS", "CRWV", "PLTR", "NOW", "SNOW", "CRWD", "NET", "DDOG", "MDB", "APP",
    "ORCL", "CRM", "ADBE", "PANW", "ZS", "S", "FTNT", "WDAY", "TEAM", "INTC",
    # Internet / megacap
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NFLX", "UBER", "ABNB", "SHOP",
    # Health / obesity
    "LLY", "NVO", "VKTX", "HIMS", "UNH", "ISRG", "REGN", "VRTX", "AMGN", "MRK",
    # Defense
    "LMT", "RTX", "NOC", "GD", "AVAV", "KTOS", "BAH", "LDOS",
    # Fintech / crypto-adjacent
    "COIN", "HOOD", "SOFI", "CRCL", "PYPL",
    # Industrials / other momentum
    "CAT", "DE", "HON", "GE", "DASH", "NET",
    # Broad ETFs (context / relative strength)
    "QQQ", "SMH", "XLK", "XLE", "XLV", "VOO",
]
UNIVERSE = sorted(set(UNIVERSE))
BENCHMARK = "SPY"

# ----------------------------------------------------------------------
# 100+ liquid crypto (same rules engine, benchmarked vs BTC). yfinance
# uses SYMBOL-USD. Illiquid / too-new names are dropped by the same filters.
# ----------------------------------------------------------------------
CRYPTO_BENCHMARK = "BTC-USD"
CRYPTO_MIN_DOLLAR_VOL = 5_000_000
CRYPTO_UNIVERSE = [f"{s}-USD" for s in [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX", "TRX", "DOT",
    "LINK", "MATIC", "LTC", "BCH", "UNI", "XLM", "ATOM", "XMR", "ETC", "HBAR",
    "FIL", "ICP", "APT", "NEAR", "VET", "ARB", "OP", "MKR", "AAVE", "GRT",
    "ALGO", "QNT", "EGLD", "SAND", "MANA", "AXS", "THETA", "FTM", "XTZ", "EOS",
    "FLOW", "CHZ", "KAVA", "MINA", "ZEC", "DASH", "ENJ", "BAT", "ZIL", "COMP",
    "CRV", "SNX", "YFI", "SUSHI", "LDO", "RUNE", "INJ", "SEI", "SUI", "TIA",
    "STX", "IMX", "RNDR", "FET", "GALA", "JUP", "PYTH", "ONDO", "STRK", "JTO",
    "BLUR", "ENS", "DYDX", "GMX", "APE", "LRC", "CVX", "ROSE", "KSM", "ZRX",
    "ANKR", "SKL", "BAND", "KNC", "STORJ", "GLM", "CELO", "IOTA", "NEO", "WAVES",
    "KDA", "RVN", "ZEN", "HOT", "DGB", "IOTX", "ONE", "CFX", "WOO", "GMT",
    "MASK", "PEPE", "SHIB", "FLOKI", "BONK", "WIF", "TON", "CKB", "AR", "OSMO",
]]

# Display names (ticker -> company/coin). Missing tickers fall back to the symbol.
NAMES = {
    "NVDA": "NVIDIA", "AVGO": "Broadcom", "AMD": "Advanced Micro Devices", "MU": "Micron",
    "MRVL": "Marvell", "TSM": "TSMC", "ARM": "Arm Holdings", "ALAB": "Astera Labs",
    "CRDO": "Credo", "SMCI": "Super Micro", "QCOM": "Qualcomm", "TXN": "Texas Instruments",
    "LRCX": "Lam Research", "AMAT": "Applied Materials", "KLAC": "KLA Corp", "ASML": "ASML",
    "ADI": "Analog Devices", "NXPI": "NXP Semi", "ON": "ON Semi", "MCHP": "Microchip",
    "GEV": "GE Vernova", "VRT": "Vertiv", "CEG": "Constellation Energy", "VST": "Vistra",
    "TLN": "Talen Energy", "NRG": "NRG Energy", "ETN": "Eaton", "PWR": "Quanta Services",
    "OKLO": "Oklo", "SMR": "NuScale Power", "CCJ": "Cameco", "NEE": "NextEra Energy",
    "SO": "Southern Co", "D": "Dominion Energy", "DUK": "Duke Energy", "AEP": "American Electric",
    "EXC": "Exelon", "NBIS": "Nebius", "CRWV": "CoreWeave", "PLTR": "Palantir", "NOW": "ServiceNow",
    "SNOW": "Snowflake", "CRWD": "CrowdStrike", "NET": "Cloudflare", "DDOG": "Datadog",
    "MDB": "MongoDB", "APP": "AppLovin", "ORCL": "Oracle", "CRM": "Salesforce", "ADBE": "Adobe",
    "PANW": "Palo Alto Networks", "ZS": "Zscaler", "S": "SentinelOne", "FTNT": "Fortinet",
    "WDAY": "Workday", "TEAM": "Atlassian", "INTC": "Intel", "AAPL": "Apple", "MSFT": "Microsoft",
    "GOOGL": "Alphabet", "AMZN": "Amazon", "META": "Meta Platforms", "TSLA": "Tesla",
    "NFLX": "Netflix", "UBER": "Uber", "ABNB": "Airbnb", "SHOP": "Shopify", "PINS": "Pinterest",
    "RBLX": "Roblox", "LLY": "Eli Lilly", "NVO": "Novo Nordisk", "VKTX": "Viking Therapeutics",
    "HIMS": "Hims & Hers", "UNH": "UnitedHealth", "ISRG": "Intuitive Surgical", "REGN": "Regeneron",
    "VRTX": "Vertex Pharma", "AMGN": "Amgen", "MRK": "Merck", "BSX": "Boston Scientific",
    "MDT": "Medtronic", "LMT": "Lockheed Martin", "RTX": "RTX Corp", "NOC": "Northrop Grumman",
    "GD": "General Dynamics", "AVAV": "AeroVironment", "KTOS": "Kratos", "BAH": "Booz Allen",
    "LDOS": "Leidos", "COIN": "Coinbase", "HOOD": "Robinhood", "SOFI": "SoFi", "CRCL": "Circle",
    "PYPL": "PayPal", "CAT": "Caterpillar", "DE": "Deere", "HON": "Honeywell", "GE": "GE Aerospace",
    "DASH": "DoorDash", "EMR": "Emerson", "PH": "Parker Hannifin", "ROK": "Rockwell", "SPY": "S&P 500 ETF",
    "SMH": "Semiconductor ETF", "VOO": "Vanguard S&P 500", "WEN": "Wendy's",
}
CRYPTO_NAMES = {
    "BTC": "Bitcoin", "ETH": "Ethereum", "BNB": "BNB", "SOL": "Solana", "XRP": "XRP",
    "ADA": "Cardano", "DOGE": "Dogecoin", "AVAX": "Avalanche", "TRX": "TRON", "DOT": "Polkadot",
    "LINK": "Chainlink", "MATIC": "Polygon", "LTC": "Litecoin", "BCH": "Bitcoin Cash", "UNI": "Uniswap",
    "XLM": "Stellar", "ATOM": "Cosmos", "XMR": "Monero", "ETC": "Ethereum Classic", "HBAR": "Hedera",
    "FIL": "Filecoin", "ICP": "Internet Computer", "APT": "Aptos", "NEAR": "NEAR Protocol",
    "VET": "VeChain", "ARB": "Arbitrum", "OP": "Optimism", "MKR": "Maker", "AAVE": "Aave", "GRT": "The Graph",
    "ALGO": "Algorand", "QNT": "Quant", "EGLD": "MultiversX", "SAND": "The Sandbox", "MANA": "Decentraland",
    "AXS": "Axie Infinity", "THETA": "Theta", "FTM": "Fantom", "XTZ": "Tezos", "EOS": "EOS",
    "FLOW": "Flow", "CHZ": "Chiliz", "KAVA": "Kava", "MINA": "Mina", "ZEC": "Zcash", "DASH": "Dash",
    "ENJ": "Enjin", "BAT": "Basic Attention", "ZIL": "Zilliqa", "COMP": "Compound", "CRV": "Curve",
    "SNX": "Synthetix", "YFI": "yearn.finance", "SUSHI": "SushiSwap", "LDO": "Lido", "RUNE": "THORChain",
    "INJ": "Injective", "SEI": "Sei", "SUI": "Sui", "TIA": "Celestia", "STX": "Stacks", "IMX": "Immutable",
    "RNDR": "Render", "FET": "Fetch.ai", "GALA": "Gala", "JUP": "Jupiter", "PYTH": "Pyth", "ONDO": "Ondo",
    "STRK": "Starknet", "JTO": "Jito", "BLUR": "Blur", "ENS": "ENS", "DYDX": "dYdX", "GMX": "GMX",
    "APE": "ApeCoin", "LRC": "Loopring", "CVX": "Convex", "ROSE": "Oasis", "KSM": "Kusama", "ZRX": "0x",
    "ANKR": "Ankr", "SKL": "SKALE", "BAND": "Band", "KNC": "Kyber", "STORJ": "Storj", "GLM": "Golem",
    "CELO": "Celo", "IOTA": "IOTA", "NEO": "Neo", "WAVES": "Waves", "KDA": "Kadena", "RVN": "Ravencoin",
    "ZEN": "Horizen", "HOT": "Holo", "DGB": "DigiByte", "IOTX": "IoTeX", "ONE": "Harmony", "CFX": "Conflux",
    "WOO": "WOO", "GMT": "STEPN", "MASK": "Mask Network", "PEPE": "Pepe", "SHIB": "Shiba Inu",
    "FLOKI": "Floki", "BONK": "Bonk", "WIF": "dogwifhat", "TON": "Toncoin", "CKB": "Nervos", "AR": "Arweave",
    "OSMO": "Osmosis",
}


def _why(a: dict, horizon: str) -> str:
    """A short, honest reason for the given horizon."""
    up = a["price"] > a["sma50"] > a["sma200"]
    if horizon == "long":
        if up and a["ret3m"] > 0:
            return "strong uptrend, leading the market"
        if up:
            return "steady long-term uptrend"
        if a["above50"] > 22:
            return "stretched above its trend"
        if a["price"] < a["sma200"]:
            return "below its long-term trend"
        return "basing — no long-term trend yet"
    if a["rsi"] > 78:
        return "overbought — risky to chase"
    if a["setup"] == "Breakout":
        return "fresh breakout on volume"
    if a["ret1m"] > 0 and a["rsi"] < 72:
        return "short-term momentum building"
    if a["ret1m"] < -5:
        return "fading over the last month"
    return "range-bound short-term"


def call_obj(a: dict, ticker: str, name_map: dict) -> dict:
    """Enriched per-name entry for the app snapshot (both horizons + detail stats)."""
    return {
        "t": ticker, "name": name_map.get(ticker, ticker),
        "p": round(a["price"], 2), "chg": round(a["chg"], 2), "setup": a["setup"],
        "ss": a["score_short"], "sl": a["score_long"],
        "vs": verdict_h(a["score_short"]), "vl": verdict_h(a["score_long"]),
        "ws": _why(a, "short"), "wl": _why(a, "long"),
        "rsi": round(a["rsi"]), "r1m": round(a["ret1m"], 1), "r3m": round(a["ret3m"], 1),
        "hi": round(a["hi52"], 4), "lo": round(a["lo52"], 4),
        "dvol": round(a["dollar_vol"]), "vol": round(a["vol"]), "spark": a["spark"],
    }


def market_gauge(rows: list, bench3m: float) -> dict:
    """A 0-100 risk-on/off reading from breadth + benchmark momentum + average RSI."""
    if not rows:
        return {"value": 50, "label": "—"}
    breadth = 100.0 * sum(1 for r in rows if r["above50"] > 0) / len(rows)
    mom = max(0.0, min(100.0, 50 + bench3m * 2))
    heat = max(0.0, min(100.0, sum(r["rsi"] for r in rows) / len(rows)))
    g = round(0.45 * breadth + 0.30 * mom + 0.25 * heat)
    label = ("Risk-off" if g < 25 else "Cautious" if g < 45 else
             "Balanced" if g < 65 else "Risk-on" if g < 82 else "Frothy")
    return {"value": g, "label": label, "breadth": round(breadth)}

# Curated entry ranges (BUY triggers when price enters the range). entry=None => no trigger.
WATCHLIST = {
    "GEV":  {"entry": (1010, 1060), "stop": 945},
    "VRT":  {"entry": (285, 308),   "stop": 262},
    "CEG":  {"entry": (248, 262),   "stop": 235},
    "NBIS": {"entry": (230, 250),   "stop": 208},
    "PLTR": {"entry": (106, 116),   "stop": 98},
    "LLY":  {"entry": (1100, 1150), "stop": 1040},
}

# >>> YOUR TRADES <<<  Keep them private: put real fills in positions.json (git-ignored),
# which overrides this. The committed default is empty so nothing personal is published.
# positions.json format:  {"NBIS": {"name": "Nebius", "invested": 239.50, "entry": 239.50}}
POSITIONS = {}
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "positions.json")) as _pf:
        POSITIONS.update(json.load(_pf))
except Exception:
    pass

MIN_DOLLAR_VOL = 20_000_000
POLL_SECONDS = 900
TOP_N = 20

G, R, Y, B, C, DIM, RST = "\033[92m", "\033[91m", "\033[93m", "\033[1m", "\033[96m", "\033[2m", "\033[0m"
VC = {"BUY": G, "WATCH": Y, "AVOID": R}


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    ag = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    al = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    return 100 - (100 / (1 + ag / al))


def _spark(close, n: int = 24) -> list:
    """A small downsampled price series (~last 90 bars) for the detail-page chart."""
    s = close.iloc[-90:]
    if len(s) > n:
        idx = sorted(set(int(i) for i in np.linspace(0, len(s) - 1, n)))
        s = s.iloc[idx]
    return [round(float(x), 4) for x in s.tolist()]


def verdict_h(sc: int) -> str:
    """Buy/Watch/Avoid from a 0-10 horizon score."""
    return "BUY" if sc >= 7 else "WATCH" if sc >= 4 else "AVOID"


def analyze(df: pd.DataFrame, bench_ret3m: float) -> "dict | None":
    close = df["Close"].dropna()
    if len(close) < 200:
        return None
    vol = df["Volume"].reindex(close.index).fillna(0)
    price = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) > 1 else price
    chg = (price / prev - 1) * 100 if prev else 0.0
    r = float(rsi(close).iloc[-1])
    sma50 = float(close.rolling(50).mean().iloc[-1])
    sma200 = float(close.rolling(200).mean().iloc[-1])
    hi52 = float(close.rolling(252, min_periods=1).max().iloc[-1])
    lo52 = float(close.rolling(252, min_periods=1).min().iloc[-1])
    from_high = (price / hi52 - 1) * 100
    ret1m = (price / float(close.iloc[-22]) - 1) * 100 if len(close) > 22 else 0.0
    ret3m = (price / float(close.iloc[-64]) - 1) * 100 if len(close) > 64 else 0.0
    rets = close.pct_change().dropna()
    volp = float(rets.iloc[-30:].std() * np.sqrt(252) * 100) if len(rets) >= 5 else 0.0  # annualized vol %
    avgvol = float(vol.rolling(50).mean().iloc[-1]) or 1.0
    dollar_vol = avgvol * price
    prev20high = float(close.iloc[-21:-1].max())
    above50 = (price / sma50 - 1) * 100

    breakout = price > prev20high and float(vol.iloc[-1]) > 1.5 * avgvol
    pullback = (0 <= above50 <= 4) and (38 <= r <= 62) and price > sma200
    extended = above50 > 18

    # medium/default score — drives the console output + entry-range alerts
    score = 0
    if price > sma50 > sma200:
        score += 3
    elif price > sma50:
        score += 1
    if ret3m > 0 and ret1m > 0:
        score += 2
    if from_high > -5:
        score += 1
    if ret3m > bench_ret3m:
        score += 1
    setup = "Momentum" if score >= 3 else "Weak"
    if breakout:
        score += 2
        setup = "Breakout"
    elif pullback:
        score += 2
        setup = "Pullback"
    if extended:
        score -= 2
        setup = "Extended"
    if r > 78:
        score -= 1
    score = max(0, score)

    # long-term tilt: sustained trend + relative strength; penalize froth + high vol
    sl = 0
    if price > sma50 > sma200:
        sl += 3
    elif price > sma50:
        sl += 1
    if ret3m > bench_ret3m:
        sl += 2
    if ret3m > 0:
        sl += 1
    if from_high > -20:
        sl += 1
    if pullback:
        sl += 1
    if above50 > 22:
        sl -= 2
    if volp > 60:
        sl -= 1
    score_long = max(0, min(10, sl))

    # short-term tilt: recent momentum + breakouts; penalize overbought + weakness
    ss = 0
    if ret1m > 0:
        ss += 2
    if breakout:
        ss += 2
    if from_high > -3:
        ss += 1
    if 55 <= r <= 72:
        ss += 2
    if price > sma50:
        ss += 1
    if pullback:
        ss += 1
    if r > 78:
        ss -= 2
    if ret1m < -5:
        ss -= 2
    score_short = max(0, min(10, ss))

    return {"price": price, "chg": chg, "rsi": r, "score": score, "setup": setup,
            "from_high": from_high, "ret1m": ret1m, "ret3m": ret3m, "above50": above50,
            "dollar_vol": dollar_vol, "hi52": hi52, "lo52": lo52, "vol": volp,
            "sma50": sma50, "sma200": sma200, "spark": _spark(close),
            "score_short": score_short, "score_long": score_long}


def verdict(ticker: str, a: dict) -> tuple:
    entry = WATCHLIST.get(ticker, {}).get("entry")
    price, setup, sc = a["price"], a["setup"], a["score"]
    if entry and entry[0] <= price <= entry[1] and setup != "Weak":
        return "BUY", "in entry range"
    if setup == "Weak" or sc <= 2:
        return "AVOID", "downtrend / no momentum"
    if setup == "Extended":
        return "WATCH", "extended — wait for pullback"
    if sc >= 7 and setup in ("Momentum", "Pullback", "Breakout"):
        return "BUY", f"{setup.lower()} in uptrend"
    if sc >= 4:
        return "WATCH", f"{setup.lower()}, building"
    return "AVOID", "weak setup"


def fetch(tickers) -> pd.DataFrame:
    return yf.download(list(tickers), period="1y", interval="1d", auto_adjust=True,
                       group_by="ticker", progress=False, threads=True)


def rank_crypto():
    """Rank the crypto universe with the same engine, benchmarked vs BTC."""
    uni = sorted(set(CRYPTO_UNIVERSE) | {CRYPTO_BENCHMARK})
    data = fetch(uni)

    def frame(t):
        try:
            return data[t] if len(uni) > 1 else data
        except Exception:
            return None

    b, b3 = frame(CRYPTO_BENCHMARK), 0.0
    if b is not None:
        bc = b["Close"].dropna()
        if len(bc) > 64:
            b3 = (float(bc.iloc[-1]) / float(bc.iloc[-64]) - 1) * 100
    rows = []
    for t in CRYPTO_UNIVERSE:
        f = frame(t)
        if f is None or getattr(f, "empty", True):
            continue
        a = analyze(f, b3)
        if a and a["dollar_vol"] >= CRYPTO_MIN_DOLLAR_VOL:
            v, why = verdict(t, a)
            a.update(ticker=t, verdict=v, why=why)
            rows.append(a)
    rows.sort(key=lambda x: ({"BUY": 0, "WATCH": 1, "AVOID": 2}[x["verdict"]], -x["score"]))
    return rows, b3


def run(top_n: int = TOP_N, export: bool = False, snapshot=None) -> None:
    universe = sorted(set(UNIVERSE) | set(WATCHLIST) | set(POSITIONS) | {BENCHMARK})
    data = fetch(universe)

    def frame(t):
        try:
            return data[t] if len(universe) > 1 else data
        except Exception:
            return None

    bench, bench_ret3m = frame(BENCHMARK), 0.0
    if bench is not None:
        bc = bench["Close"].dropna()
        if len(bc) > 64:
            bench_ret3m = (float(bc.iloc[-1]) / float(bc.iloc[-64]) - 1) * 100

    # ---- rank the universe + assign verdicts ----
    rows = []
    for t in UNIVERSE:
        f = frame(t)
        if f is None or f.empty:
            continue
        a = analyze(f, bench_ret3m)
        if a and a["dollar_vol"] >= MIN_DOLLAR_VOL:
            v, why = verdict(t, a)
            a.update(ticker=t, verdict=v, why=why)
            rows.append(a)
    order = {"BUY": 0, "WATCH": 1, "AVOID": 2}
    rows.sort(key=lambda x: (order[x["verdict"]], -x["score"]))

    if export:
        print(json.dumps([{"t": r["ticker"], "v": r["verdict"], "s": r["score"],
                           "p": round(r["price"], 2), "setup": r["setup"]} for r in rows]))
        return

    # --- rich snapshot for the app (the website pulls this as data.json) ---
    if snapshot is not None:
        pos = []
        for t in POSITIONS:
            pf = frame(t)
            if pf is None or getattr(pf, "empty", True):
                continue
            pc = pf["Close"].dropna()
            if len(pc):
                pos.append({"t": t, "p": round(float(pc.iloc[-1]), 2)})
        payload = {
            "updated": datetime.now().astimezone().isoformat(timespec="minutes"),
            "spy3m": round(bench_ret3m, 1),
            "market": market_gauge(rows, bench_ret3m),
            "calls": [call_obj(r, r["ticker"], NAMES) for r in rows],
            "positions": pos,
        }
        crows, cb3 = rank_crypto()
        payload["crypto"] = {
            "bench3m": round(cb3, 1),
            "market": market_gauge(crows, cb3),
            "calls": [call_obj(r, r["ticker"].replace("-USD", ""), CRYPTO_NAMES) for r in crows],
        }
        text = json.dumps(payload)
        if snapshot in (True, "-"):
            print(text)
        else:
            os.makedirs(os.path.dirname(snapshot) or ".", exist_ok=True)
            with open(snapshot, "w") as fh:
                fh.write(text)
            print(f"Wrote {snapshot} — {len(payload['calls'])} calls, "
                  f"{len(pos)} positions, updated {payload['updated']}")
        return

    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    buys = sum(r["verdict"] == "BUY" for r in rows)
    print(f"\n{B}EDGE DESK — automated calls{RST}  {DIM}{stamp} · SPY 3m {bench_ret3m:+.1f}% · "
          f"{len(rows)} liquid names · {G}{buys} BUY{RST}{DIM}{RST}")
    print(f"{DIM}{'CALL':<7}{'TICKER':<7}{'PRICE':>9}{'/10':>4}  {'SETUP':<10}{'RSI':>4}{'frHIGH':>8}{'3M':>7}  WHY{RST}")
    print(f"{DIM}{'-'*84}{RST}")
    for d in rows[:top_n]:
        vc = VC[d["verdict"]]
        print(f"{vc}{d['verdict']:<7}{RST}{B}{d['ticker']:<7}{RST}{d['price']:>9.2f}{d['score']:>4}  "
              f"{d['setup']:<10}{d['rsi']:>4.0f}{d['from_high']:>+7.1f}%{d['ret3m']:>+6.1f}%  {DIM}{d['why']}{RST}")

    # ---- entry-range alerts ----
    alerts = [(t, frame(t)) for t in WATCHLIST]
    fired = []
    for t, f in alerts:
        if f is None or f.empty:
            continue
        price = float(f["Close"].dropna().iloc[-1])
        e, s = WATCHLIST[t]["entry"], WATCHLIST[t]["stop"]
        if e and e[0] <= price <= e[1]:
            fired.append((t, price, e, s))
    if fired:
        print(f"\n{G}{'='*84}{RST}")
        for t, price, e, s in fired:
            print(f"{G}🚨 ENTRY: {t} @ ${price:.2f} inside range ({e[0]:.0f}-{e[1]:.0f}) | stop ${s:.0f}{RST}")
        print(f"{G}{'='*84}{RST}")

    # ---- your portfolio ----
    print(f"\n{B}YOUR PORTFOLIO{RST}")
    if not POSITIONS:
        print(f"{DIM}No positions yet. Add them to POSITIONS at the top (ticker, invested $, entry price).{RST}")
        return
    print(f"{DIM}{'TICKER':<9}{'INVESTED':>10}{'ENTRY':>10}{'NOW':>10}{'VALUE':>11}{'P&L':>11}{'P&L%':>8}{RST}")
    print(f"{DIM}{'-'*70}{RST}")
    tot_inv = tot_val = 0.0
    w = l = 0
    for t, pos in POSITIONS.items():
        f = frame(t)
        if f is None or f.empty:
            print(f"{Y}{t:<9} no data{RST}")
            continue
        price = float(f["Close"].dropna().iloc[-1])
        inv, entry = float(pos["invested"]), float(pos["entry"])
        shares = inv / entry if entry > 0 else 0.0
        val = shares * price
        pl = val - inv
        plpct = pl / inv * 100 if inv else 0.0
        tot_inv += inv
        tot_val += val
        w, l = (w + 1, l) if pl >= 0 else (w, l + 1)
        plc = G if pl >= 0 else R
        print(f"{B}{t:<9}{RST}{inv:>10.2f}{entry:>10.2f}{price:>10.2f}{val:>11.2f}"
              f"{plc}{pl:>+11.2f}{plpct:>+7.1f}%{RST}")
    tot_pl = tot_val - tot_inv
    tot_pct = tot_pl / tot_inv * 100 if tot_inv else 0.0
    plc = G if tot_pl >= 0 else R
    print(f"{DIM}{'-'*70}{RST}")
    print(f"{B}{'TOTAL':<9}{RST}{tot_inv:>10.2f}{'':>20}{tot_val:>11.2f}{plc}{tot_pl:>+11.2f}{tot_pct:>+7.1f}%{RST}"
          f"   {DIM}record {G}{w}W{RST}{DIM}-{R}{l}L{RST}")

    # ---- log a snapshot for the over-time chart ----
    fn = "portfolio_history.csv"
    new = not os.path.exists(fn)
    with open(fn, "a", newline="") as fh:
        wcsv = csv.writer(fh)
        if new:
            wcsv.writerow(["datetime", "invested", "value", "pl", "pl_pct"])
        wcsv.writerow([stamp, round(tot_inv, 2), round(tot_val, 2), round(tot_pl, 2), round(tot_pct, 2)])
    print(f"{DIM}Snapshot appended to {fn} ({'created' if new else 'updated'}).{RST}")


def main() -> None:
    args = sys.argv[1:]
    top_n = TOP_N
    if "--top" in args:
        try:
            top_n = int(args[args.index("--top") + 1])
        except (IndexError, ValueError):
            pass
    if "--snapshot" in args:
        i = args.index("--snapshot")
        path = args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith("-") else "edge-desk-app/data.json"
        run(top_n, snapshot=path)
        return
    if "--loop" not in args:
        run(top_n, export="--export" in args)
        return
    print(f"{B}Advisor running — every {POLL_SECONDS // 60} min. Ctrl-C to stop.{RST}")
    try:
        while True:
            run(top_n)
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print(f"\n{DIM}Stopped.{RST}")


if __name__ == "__main__":
    main()
