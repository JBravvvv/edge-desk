import React, { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   EDGE DESK — automated calls + trade log
   You don't score or weight anything. Read the calls, log what you buy.
   Calls are a dated snapshot; the Python advisor is the live engine.
   ============================================================ */

const NAV = [
  ["overview", "Overview"],
  ["signals", "Signals"],
  ["universe", "Universe"],
  ["portfolio", "Portfolio"],
  ["sizer", "Sizer"],
  ["analyst", "Analyst"],
];

const ASOF = "Jun 29, 2026";

/* My ranked calls (a snapshot — the advisor script refreshes these live). */
const SIGNALS = [
  { ticker: "GEV", name: "GE Vernova", theme: "Power · grid · nuclear", verdict: "BUY", score: 8, price: 1100, entry: [1010, 1060], stop: 945,
    reason: "$163B backlog, orders +71%, lowest beta of the AI names. Pulled back from highs — accumulate toward the 50-day." },
  { ticker: "VRT", name: "Vertiv", theme: "AI power & cooling", verdict: "BUY", score: 8, price: 306, entry: [285, 308], stop: 262,
    reason: "+177% YoY, backlog +81%, guidance raised twice. The cleanest picks-and-shovels; last week's AI selloff handed a better entry." },
  { ticker: "CEG", name: "Constellation Energy", theme: "Nuclear power", verdict: "BUY", score: 7, price: 260, entry: [248, 262], stop: 235,
    reason: "Beaten to near its 52-wk low (~$240) on a guidance wobble. Beta 0.67, new Walmart nuclear deal, Street target ~$360. Contrarian value." },
  { ticker: "VST", name: "Vistra", theme: "Power · IPP", verdict: "WATCH", score: 7, price: 163, entry: [150, 165], stop: 138,
    reason: "Cheap on growth (PEG ~0.5), raised 2026 EBITDA guide to $6.8B. Strong power-demand play — let it base before adding." },
  { ticker: "LLY", name: "Eli Lilly", theme: "Obesity · GLP-1", verdict: "WATCH", score: 7, price: 1230, entry: [1100, 1150], stop: 1040,
    reason: "All-time high on the Medicare GLP-1 coverage launch. Low-beta ballast (~0.4), but chasing an ATH is a poor entry — wait for a pullback." },
  { ticker: "NBIS", name: "Nebius", theme: "Neocloud", verdict: "WATCH", score: 6, price: 261, entry: [230, 250], stop: 208,
    reason: "Hypergrowth (+684% rev) but popped +9% to near its 52-wk high and trades above analyst targets. Extended — wait for the dip." },
  { ticker: "PLTR", name: "Palantir", theme: "AI software · defense", verdict: "WATCH", score: 6, price: 116, entry: [106, 116], stop: 98,
    reason: "Down ~39% YTD, near its 52-wk low, bouncing on a fresh Nvidia deal. A contrarian recovery bet with tight, defined risk." },
  { ticker: "CRWV", name: "CoreWeave", theme: "Neocloud", verdict: "AVOID", score: 3, price: 95, entry: null, stop: null,
    reason: "Heavy leverage — interest ~26% of revenue — and down ~32% from its May high. Balance-sheet risk if rates stay high. Pass for now." },
];

const UNIVERSE = [
  { theme: "AI compute · semis", names: ["NVDA", "AVGO", "AMD", "MU", "MRVL", "TSM", "ARM", "ALAB", "CRDO", "SMCI", "QCOM", "TXN", "LRCX", "AMAT", "KLAC", "ASML", "ADI", "NXPI", "ON", "MCHP"] },
  { theme: "Power · electrification · nuclear", names: ["GEV", "VRT", "CEG", "VST", "TLN", "NRG", "ETN", "PWR", "OKLO", "SMR", "CCJ", "NEE", "SO", "D", "DUK", "AEP", "EXC"] },
  { theme: "Neoclouds · data · AI software", names: ["NBIS", "CRWV", "PLTR", "NOW", "SNOW", "CRWD", "NET", "DDOG", "MDB", "APP", "ORCL", "CRM", "ADBE", "PANW", "ZS", "S", "FTNT", "WDAY", "TEAM", "INTC"] },
  { theme: "Internet · megacap", names: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NFLX", "UBER", "ABNB", "SHOP", "PINS", "RBLX"] },
  { theme: "Health · obesity", names: ["LLY", "NVO", "VKTX", "HIMS", "UNH", "ISRG", "REGN", "VRTX", "AMGN", "MRK", "BSX", "MDT"] },
  { theme: "Defense", names: ["LMT", "RTX", "NOC", "GD", "AVAV", "KTOS", "BAH", "LDOS"] },
  { theme: "Fintech · crypto-adjacent", names: ["COIN", "HOOD", "SOFI", "CRCL", "PYPL"] },
  { theme: "Industrials · other", names: ["CAT", "DE", "HON", "GE", "DASH", "EMR", "PH", "ROK"] },
];

/* Neutral demo seeds for a fresh install. Your real trades persist privately in
   this device's storage; they are never part of the published code. */
const SEED_POSITIONS = [
  { id: "nbis", ticker: "NBIS", name: "Nebius", invested: 250, entry: 240, current: 240 },
  { id: "voo", ticker: "VOO", name: "Vanguard S&P 500", invested: 500, entry: 0, current: 0 },
];

const SEED_MACRO = [
  { id: "capex", label: "AI capex supercycle", detail: "Hyperscaler capex ~$754B in 2026 (+83%). About half of S&P earnings growth.", state: "on" },
  { id: "fed", label: "Fed — cuts over, hike risk", detail: "Held 3.50–3.75%. Dot-plot median ~3.8% by year-end. A hike is priced for October.", state: "off" },
  { id: "energy", label: "Energy-led inflation shock", detail: "Iran conflict and Hormuz risk. 2026 PCE revised to 3.6%. Sentiment at a record low.", state: "off" },
  { id: "narrow", label: "Narrow tape + tariffs", detail: "Roughly 17% of the S&P is beating the index. 10% global tariff expires late July.", state: "mixed" },
];

const SEED_SECTORS = [
  { id: "power", name: "Power & electrification", m: 95 },
  { id: "semis", name: "Semis / AI compute", m: 92 },
  { id: "neocloud", name: "Neoclouds", m: 88 },
  { id: "nuclear", name: "Nuclear / IPPs", m: 80 },
  { id: "aisoft", name: "AI software", m: 74 },
  { id: "defense", name: "Defense-tech", m: 70 },
  { id: "obesity", name: "Obesity / GLP-1", m: 66 },
  { id: "energy", name: "Energy (traditional)", m: 58 },
];

const STATE_CYCLE = ["on", "mixed", "off"];
const STATE_META = {
  on: { label: "Risk-on", color: "#138A5E", bg: "#E7F4EE" },
  mixed: { label: "Mixed", color: "#B5852F", bg: "#F7F0E2" },
  off: { label: "Risk-off", color: "#CC3B3B", bg: "#FBEAEA" },
};
const VERDICT = {
  BUY: { color: "#0E7A57", bg: "#E7F4EE" },
  WATCH: { color: "#B5852F", bg: "#F7F0E2" },
  AVOID: { color: "#CC3B3B", bg: "#FBEAEA" },
};
const V_ORDER = { BUY: 0, WATCH: 1, AVOID: 2 };

const uid = () => Math.random().toString(36).slice(2, 9);
const num = (x) => Number(x) || 0;
const usd0 = (n) => `$${num(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const usd2 = (n) => `$${num(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* storage */
const KEY = (k) => `edgedesk:${k}`;
async function load(k, fb) { try { const r = await window.storage.get(KEY(k)); if (r && r.value) return JSON.parse(r.value); } catch (e) {} return fb; }
async function save(k, v) { try { await window.storage.set(KEY(k), JSON.stringify(v)); } catch (e) {} }
async function wipe() { try { await window.storage.delete(KEY("positions")); } catch (e) {} }

/* Claude (no web search — works in-app on pasted data) */
async function callClaude(prompt) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 60000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      signal: c.signal,
    });
    if (!res.ok) { let d = ""; try { const j = await res.json(); d = (j && j.error && j.error.message) || ""; } catch (_) {} throw new Error(`HTTP ${res.status}${d ? " — " + d.slice(0, 100) : ""}`); }
    const data = await res.json();
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
    if (!text.trim()) throw new Error("empty response");
    return text;
  } catch (e) { if (e.name === "AbortError") throw new Error("timed out"); throw e; } finally { clearTimeout(timer); }
}
function parseJSON(text) {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.search(/[[{]/); if (start < 0) throw new Error("no structured data");
  const close = clean[start] === "[" ? "]" : "}"; const end = clean.lastIndexOf(close);
  return JSON.parse(end > start ? clean.slice(start, end + 1) : clean.slice(start));
}

const rankedSignals = () => [...SIGNALS].sort((a, b) => V_ORDER[a.verdict] - V_ORDER[b.verdict] || b.score - a.score);

/* ======================= live data ======================= */
/* The app is a client. During the day the advisor (run on a schedule) publishes
   a small snapshot to data.json; we pull it on open, on a timer, and on demand.
   All numbers come from that advisor export — nothing is invented here. If the
   file is missing (e.g. running as a chat artifact), we fall back to the
   hand-verified snapshot and say so honestly in the header. */
/* Live feed: a refresher job force-pushes a fresh snapshot to the `data` branch
   every ~15 min during market hours; raw.githubusercontent serves it with CORS.
   Falls back to the Pages-bundled copy when offline / first paint. */
const DATA_URL = "https://raw.githubusercontent.com/JBravvvv/edge-desk/data/data.json";
const DATA_FALLBACK = "data.json";
const REFRESH_MS = 60000;

const fmtClock = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return "";
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "p" : "a"; h = h % 12 || 12;
  return `${h}:${m}${ap}`;
};

function useLiveData() {
  const [d, setD] = useState({ status: "idle", updated: null, calls: null, positions: null, crypto: null });
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (manual) => {
    if (manual) setBusy(true);
    const started = Date.now();
    const grab = async (url) => { const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" }); if (!res.ok) throw new Error(String(res.status)); return res.json(); };
    try {
      let j;
      try { j = await grab(DATA_URL); } catch (_) { j = await grab(DATA_FALLBACK); }
      setD({ status: "live", updated: j.updated || null, calls: Array.isArray(j.calls) ? j.calls : null, positions: Array.isArray(j.positions) ? j.positions : null, crypto: j.crypto || null });
    } catch (e) { setD((s) => ({ status: s.updated ? "live" : "snapshot", updated: s.updated, calls: s.calls, positions: s.positions, crypto: s.crypto })); }
    if (manual) {
      const el = Date.now() - started;                 // keep the spin visible for at least a beat
      if (el < 650) await new Promise((r) => setTimeout(r, 650 - el));
      setBusy(false);
    }
  }, []);
  useEffect(() => { refresh(); const id = setInterval(() => refresh(), REFRESH_MS); return () => clearInterval(id); }, [refresh]);
  return { ...d, busy, refresh };
}

/* Company/coin descriptions are static (they don't change intraday), so they
   ship bundled with the app and load once. Keyed by ticker; coins use SYM-USD. */
function useDescriptions() {
  const [map, setMap] = useState({});
  useEffect(() => {
    let live = true;
    fetch("descriptions.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => { if (live && j && typeof j === "object") setMap(j); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return map;
}

/* iOS-style interactive swipe-back. Attach the returned ref to a full-screen
   pushed panel; a drag starting from the left edge follows the finger and, past
   a threshold (or a quick flick), calls onBack. Vertical drags fall through to
   normal scrolling, so it never fights the page. */
function useSwipeBack(onBack) {
  const ref = useRef(null);
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const EDGE = 44;                                   // only start from the left edge
    const width = () => el.clientWidth || window.innerWidth || 360;
    let startX = 0, startY = 0, startT = 0, dx = 0, active = false, decided = false, horiz = false;
    const paint = (x, anim) => {
      el.style.transition = anim ? "transform .24s cubic-bezier(.22,.61,.36,1)" : "none";
      el.style.transform = x ? `translateX(${x}px)` : "";
      el.style.boxShadow = x ? "-14px 0 34px rgba(15,23,38,.20)" : "";
    };
    const onStart = (e) => {
      const t = e.touches[0];
      if (!t || t.clientX > EDGE) return;
      startX = t.clientX; startY = t.clientY; startT = Date.now();
      dx = 0; active = true; decided = false; horiz = false;
    };
    const onMove = (e) => {
      if (!active) return;
      const t = e.touches[0];
      const mx = t.clientX - startX, my = t.clientY - startY;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decided = true; horiz = Math.abs(mx) > Math.abs(my);
        if (!horiz) { active = false; return; }         // vertical → let it scroll
      }
      dx = Math.max(0, mx);
      e.preventDefault();
      paint(dx, false);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      const vx = dx / Math.max(1, Date.now() - startT);  // px per ms
      if (dx > width() * 0.33 || (dx > 60 && vx > 0.4)) {
        el.style.transition = "transform .2s ease-out";
        el.style.transform = `translateX(${width()}px)`;
        setTimeout(() => cb.current && cb.current(), 180);
      } else if (dx > 0) {
        paint(0, true);
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);
  return ref;
}

/* Build a ticker→price map from whatever the live feed carries. */
const livePriceMap = (live) => {
  const map = {};
  (live.calls || []).forEach((c) => { const t = (c.t || c.ticker || "").toUpperCase(); const p = Number(c.p ?? c.price); if (t && p) map[t] = p; });
  ((live.crypto && live.crypto.calls) || []).forEach((c) => { const t = (c.t || "").toUpperCase(); const p = Number(c.p); if (t && p) map[t] = p; });
  (live.positions || []).forEach((c) => { const t = (c.t || c.ticker || "").toUpperCase(); const p = Number(c.p ?? c.price ?? c.current); if (t && p) map[t] = p; });
  return map;
};

/* Crypto-aware price format: coins span from $100k to $0.00001. */
const cUsd = (n) => { n = Number(n) || 0; return n >= 1 ? usd2(n) : ("$" + n.toPrecision(3)); };

/* Resolve the active strategy's verdict/score/reason from a call (falls back to
   the older single-score shape while a fresh snapshot is still propagating). */
const pick = (c, strat) => strat === "short"
  ? { v: (c.vs || c.v || "WATCH"), s: (c.ss ?? c.s ?? 0), w: (c.ws || "") }
  : { v: (c.vl || c.v || "WATCH"), s: (c.sl ?? c.s ?? 0), w: (c.wl || "") };

/* ======================= icons (inline, offline-safe) ======================= */
const Ic = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="ic">{p}</svg>;
const IconOverview = () => Ic(<><path d="M4 14a8 8 0 0 1 16 0" /><path d="M12 14l3.5-3" /><circle cx="12" cy="14" r="1.3" fill="currentColor" stroke="none" /></>);
const IconSignals = () => Ic(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.3" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></>);
const IconUniverse = () => Ic(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.7 3 2.7 15 0 18M12 3c-2.7 3-2.7 15 0 18" /></>);
const IconPortfolio = () => Ic(<><rect x="3" y="6" width="18" height="13" rx="2.4" /><path d="M3 10.5h18" /><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" /></>);
const IconSizer = () => Ic(<><rect x="5" y="2.5" width="14" height="19" rx="2.4" /><path d="M8.5 6.5h7" /><path d="M9 11h.01M12 11h.01M15 11h.01M9 14.5h.01M12 14.5h.01M15 18h.01M9 18h3" /></>);
const IconAnalyst = () => Ic(<path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4z" />);
const IconRefresh = () => Ic(<path d="M20 11a8 8 0 1 0-2.4 5.7M20 4.5V11h-6.5" />);

const BAR = [
  ["overview", "Overview", IconOverview],
  ["signals", "Signals", IconSignals],
  ["universe", "Universe", IconUniverse],
  ["portfolio", "Portfolio", IconPortfolio],
  ["sizer", "Sizer", IconSizer],
];

/* ======================= app ======================= */
export default function EdgeDesk() {
  const [tab, setTab] = useState("overview");
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState("stocks");
  const [strat, setStrat] = useState("long");
  const [sel, setSel] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [positions, setPositions] = useState(SEED_POSITIONS);
  const live = useLiveData();
  const descriptions = useDescriptions();
  const priceMap = livePriceMap(live);

  useEffect(() => {
    (async () => {
      setPositions(await load("positions", SEED_POSITIONS));
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) save("positions", positions); }, [positions, loaded]);

  // Mark held positions to live prices as fresh snapshots arrive — 'current' only,
  // never the user's invested/entry inputs.
  useEffect(() => {
    if (!loaded || !Object.keys(priceMap).length) return;
    setPositions((ps) => ps.map((p) => { const lp = priceMap[(p.ticker || "").toUpperCase()]; return lp && lp !== num(p.current) ? { ...p, current: lp } : p; }));
  }, [live.updated, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusMeta = live.status === "live" ? { cls: "live", txt: `Live · ${fmtClock(live.updated)}` }
    : live.status === "loading" ? { cls: "load", txt: "Refreshing…" }
    : { cls: "snap", txt: "Snapshot" };

  const regimeScore = SEED_MACRO.filter((m) => m.state === "on").length - SEED_MACRO.filter((m) => m.state === "off").length;
  const regime = regimeScore > 0 ? STATE_META.on : regimeScore < 0 ? STATE_META.off : STATE_META.mixed;

  const go = (t) => { setTab(t); setMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const reset = () => { if (window.confirm("Reset your trade log to the defaults? This can't be undone.")) { wipe().then(() => { setPositions(SEED_POSITIONS); setMenu(false); }); } };

  const logTrade = (sig) => {
    const entry = sig.entry ? ((sig.entry[0] + sig.entry[1]) / 2) : sig.price;
    setPositions((p) => [...p, { id: uid(), ticker: sig.ticker, name: sig.name, invested: 0, entry: Number(entry.toFixed(2)), current: sig.price }]);
    go("portfolio");
  };
  const addPosition = (ticker, name) => { setPositions((p) => [...p, { id: uid(), ticker, name: name || ticker, invested: 0, entry: 0, current: 0 }]); go("portfolio"); };
  const openDetail = (t, crypto) => setSel({ t, crypto: !!crypto });

  return (
    <div className="app">
      <style>{CSS}</style>

      <header className="appbar">
        <button className="brand" onClick={() => go("overview")} aria-label="Edge Desk home">
          <span className="brand-mark" /><span className="brand-name">Edge<span className="brand-thin">Desk</span></span>
        </button>
        <div className="appbar-right">
          <span className={`live live-${statusMeta.cls} live-static`}>
            <span className="live-dot" /><span className="live-txt num">{statusMeta.txt}</span>
          </span>
          <button className={`iconbtn refresh-btn ${live.busy ? "spinning" : ""}`} onClick={() => live.refresh(true)} aria-label="Refresh now"><IconRefresh /></button>
          <button className="iconbtn burger" onClick={() => setMenu(true)} aria-label="More"><span /><span /><span /></button>
        </div>
      </header>

      <div className="assetbar">
        <div className="seg2" role="tablist" aria-label="Asset class">
          <button className={`seg2-btn ${mode === "stocks" ? "seg2-on" : ""}`} onClick={() => setMode("stocks")} role="tab" aria-selected={mode === "stocks"}>Stocks</button>
          <button className={`seg2-btn ${mode === "crypto" ? "seg2-on" : ""}`} onClick={() => setMode("crypto")} role="tab" aria-selected={mode === "crypto"}>Crypto</button>
        </div>
        <div className="seg2" role="tablist" aria-label="Strategy">
          <button className={`seg2-btn ${strat === "short" ? "seg2-on" : ""}`} onClick={() => setStrat("short")} role="tab" aria-selected={strat === "short"}>Day trade</button>
          <button className={`seg2-btn ${strat === "long" ? "seg2-on" : ""}`} onClick={() => setStrat("long")} role="tab" aria-selected={strat === "long"}>Long term</button>
        </div>
      </div>

      {menu && (
        <div className="menu" onClick={() => setMenu(false)}>
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="menu-top">
              <span className="brand-name dark"><span className="brand-mark" />Edge<span className="brand-thin">Desk</span></span>
              <button className="menu-x" onClick={() => setMenu(false)} aria-label="Close menu">×</button>
            </div>
            <div className="menu-reg">
              <span className="regime" style={{ background: regime.bg }}><span className="regime-dot" style={{ background: regime.color }} /><span className="regime-txt" style={{ color: regime.color }}>{regime.label}</span></span>
              <span className={`live live-${statusMeta.cls} live-static`}><span className="live-dot" /><span className="live-txt num">{statusMeta.txt}</span></span>
            </div>
            <div className="menu-rows">
              <button className={`menu-row ${tab === "about" ? "menu-row-on" : ""}`} onClick={() => go("about")}><span>How it works</span><span className="menu-arrow">›</span></button>
              <button className={`menu-row ${tab === "analyst" ? "menu-row-on" : ""}`} onClick={() => go("analyst")}><span>Analyst</span><span className="menu-arrow">›</span></button>
            </div>
            <button className="menu-reset" onClick={reset}>Reset trade log to defaults</button>
            <p className="menu-note">Informational tool — not investment advice. Calls are setups that match criteria, not predictions. You decide what to trade.</p>
          </div>
        </div>
      )}

      <main className="main">
        {tab === "overview" && <Overview regime={regime} go={go} live={live} mode={mode} strat={strat} onOpen={openDetail} />}
        {tab === "signals" && <Signals onLog={logTrade} priceMap={priceMap} mode={mode} strat={strat} live={live} onOpen={openDetail} />}
        {tab === "universe" && <Universe onLog={logTrade} live={live} mode={mode} strat={strat} onOpen={openDetail} />}
        {tab === "portfolio" && <Portfolio positions={positions} setPositions={setPositions} live={live} />}
        {tab === "sizer" && <div className="wrap"><Sizer /></div>}
        {tab === "analyst" && <div className="wrap"><Analyst onAdd={(it) => addPosition(it.ticker, it.company || it.name)} /></div>}
        {tab === "about" && <About go={go} />}
      </main>

      {sel && <DetailView sel={sel} live={live} strat={strat} desc={descriptions[sel.crypto ? `${sel.t}-USD` : (sel.t || "").toUpperCase()] || null} onClose={() => setSel(null)} onLog={logTrade} />}

      <nav className="tabbar">
        {BAR.map(([k, l, Icon]) => (
          <button key={k} className={`tabbtn ${tab === k ? "tabbtn-on" : ""}`} onClick={() => go(k)} aria-label={l}>
            <Icon /><span className="tabbtn-l">{l}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ======================= overview ======================= */
function Overview({ regime, go, live = {}, mode = "stocks", strat = "long", onOpen }) {
  const isCrypto = mode === "crypto";
  const feed = isCrypto ? ((live.crypto && live.crypto.calls) || []) : (live.calls || []);
  const ord = { BUY: 0, WATCH: 1, AVOID: 2 };
  const ranked = [...feed].sort((a, b) => { const pa = pick(a, strat), pb = pick(b, strat); return (ord[pa.v] ?? 1) - (ord[pb.v] ?? 1) || (pb.s - pa.s); });
  const live3 = ranked.slice(0, 3).map((c) => { const P = pick(c, strat); return { ticker: c.t, theme: c.name || c.setup, score: P.s, verdict: P.v, crypto: isCrypto }; });
  const buys = (!isCrypto && live3.length === 0)
    ? rankedSignals().filter((s) => s.verdict === "BUY").slice(0, 3).map((s) => ({ ticker: s.ticker, theme: s.name, score: s.score, verdict: s.verdict, crypto: false }))
    : live3;
  const market = isCrypto ? (live.crypto && live.crypto.market) : live.market;

  return (
    <div>
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-kicker">Automated market intelligence</span>
          <h1 className="hero-title">I do the scanning. You pick your spots.</h1>
          <p className="hero-sub">Ranked buy / watch / avoid calls across the market, the macro regime that frames them, and a trade log that tracks every position you take.</p>
          <div className="hero-cta">
            <button className="btn" onClick={() => go("signals")}>See today's calls</button>
            <button className="btn btn-light" onClick={() => go("portfolio")}>Track my trades</button>
          </div>
          <div className="hero-regime"><span className="regime-dot lg" style={{ background: regime.color }} />Today's read: <strong style={{ color: "#fff" }}>{regime.label}</strong>{live.status === "live" && <span className="hero-live"> · live {fmtClock(live.updated)}</span>}</div>
        </div>
      </section>

      <div className="wrap">
        {market && <MarketGauge market={market} label={isCrypto ? "Crypto" : "Market"} />}
        <Section eyebrow="Top calls" title={isCrypto ? "Top crypto right now" : "Highest-conviction names"} date={isCrypto ? null : ASOF} sub={`Strongest ${strat === "short" ? "short-term" : "long-term"} setups right now. Tap any name for detail.`}>
          <div className="tops">
            {buys.length === 0 && <Empty>No standout {isCrypto ? "coins" : "names"} right now — the ranking refreshes through the day.</Empty>}
            {buys.map((s) => { const vm = VERDICT[s.verdict] || VERDICT.BUY; return (
              <button key={s.ticker} className="card top-card" onClick={() => (onOpen ? onOpen(s.ticker, s.crypto) : go("signals"))}>
                <span className="verdict" style={{ background: vm.bg, color: vm.color }}>{s.verdict || "BUY"}</span>
                <div className="top-meta"><span className="top-tkr">{s.ticker}</span><span className="top-theme">{s.theme}</span></div>
                <span className="top-score num">{s.score}/10</span>
              </button>
            ); })}
          </div>
        </Section>

        {!isCrypto && (<>
        <Section eyebrow="Macro" title="The regime" date={ASOF} sub="My current read on the forces framing every call — read-only, not a guess you adjust. It updates when the analysis refreshes.">
          <div className="macro-grid">
            {SEED_MACRO.map((m) => { const meta = STATE_META[m.state]; return (
              <div key={m.id} className="card macro-card" style={{ borderTopColor: meta.color }}>
                <div className="macro-top"><span className="macro-label">{m.label}</span><span className="pill" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span></div>
                <p className="macro-detail">{m.detail}</p>
              </div>
            ); })}
          </div>
        </Section>

        <Section eyebrow="Flows" title="Sector momentum" sub="My read on where institutional capital is leaning — read-only. The advisor re-scores this from live data when you run it.">
          <div className="card heat">
            {[...SEED_SECTORS].sort((a, b) => b.m - a.m).map((s) => (
              <div key={s.id} className="heat-row">
                <span className="heat-name">{s.name}</span>
                <span className="heat-track"><span className="heat-fill" style={{ width: `${s.m}%`, background: heatColor(s.m) }} /></span>
                <span className="heat-val num">{s.m}</span>
              </div>
            ))}
          </div>
        </Section>
        </>)}
      </div>
    </div>
  );
}

/* ======================= signals ======================= */
function Signals({ onLog, priceMap = {}, mode = "stocks", live = {}, strat = "long", onOpen }) {
  if (mode === "crypto") {
    const ordc = { BUY: 0, WATCH: 1, AVOID: 2 };
    const crows = [...((live.crypto && live.crypto.calls) || [])].sort((a, b) => { const pa = pick(a, strat), pb = pick(b, strat); return (ordc[pa.v] ?? 1) - (ordc[pb.v] ?? 1) || (pb.s - pa.s); }).slice(0, 40);
    const cb = live.crypto && typeof live.crypto.bench3m === "number" ? live.crypto.bench3m : null;
    return (
      <div className="wrap">
        <div className="page-head"><div><h1 className="page-title">Signals</h1><p className="page-sub">Live crypto ranking — same engine as stocks, benchmarked vs Bitcoin{cb != null ? ` (BTC 3m ${cb >= 0 ? "+" : ""}${cb}%)` : ""}. {strat === "short" ? "Day-trade" : "Long-term"} view. Tap a coin for detail.</p></div></div>
        {crows.length === 0
          ? <Empty>No crypto signals yet — the feed refreshes through the day. When crypto is weak, expect mostly Watch and Avoid.</Empty>
          : <div className="sig-list">
              {crows.map((d) => { const P = pick(d, strat); const m = VERDICT[P.v] || VERDICT.WATCH; return (
                <div key={d.t} className="card sig-card sig-tap" onClick={() => onOpen && onOpen(d.t, true)}>
                  <div className="sig-top">
                    <span className="verdict" style={{ background: m.bg, color: m.color }}>{P.v}</span>
                    <span className="sig-tkr num">{d.t}</span>
                    <span className="sig-co">{d.name || d.setup}</span>
                    <span className="sig-gem"><b className="num" style={{ color: m.color }}>{P.s}</b><span>/10</span></span>
                  </div>
                  <div className="sig-levels">
                    <div className="sig-lev"><span className="sig-lk">Now</span><b className="num sig-lv">{cUsd(d.p)}<span className="sig-livedot" /></b></div>
                  </div>
                  <p className="sig-reason">{P.w || d.why}</p>
                  <button className="btn-ghost sig-log" onClick={(e) => { e.stopPropagation(); onLog({ ticker: d.t, name: d.name || d.t, entry: null, price: Number(d.p) || 0 }); }}>Log this trade →</button>
                </div>
              ); })}
            </div>}
      </div>
    );
  }
  // Hand-verified entry/stop/thesis for the curated names, keyed by ticker.
  const PLAN = Object.fromEntries(SIGNALS.map((s) => [s.ticker, s]));
  const liveCalls = live.calls || [];
  const ord = { BUY: 0, WATCH: 1, AVOID: 2 };
  const horizonLabel = strat === "short" ? "Day-trade" : "Long-term";
  // Prefer the live, strategy-aware feed (differs by day-trade vs long-term);
  // fall back to the static curated list only when live data hasn't loaded.
  const rows = liveCalls.length
    ? [...liveCalls]
        .sort((a, b) => { const pa = pick(a, strat), pb = pick(b, strat); return (ord[pa.v] ?? 1) - (ord[pb.v] ?? 1) || (pb.s - pa.s); })
        .slice(0, 40)
        .map((c) => { const P = pick(c, strat), plan = PLAN[c.t] || {}; return {
          ticker: c.t, name: c.name || plan.name || c.t, theme: plan.theme || c.setup || "",
          verdict: P.v, score: P.s, reason: P.w || plan.reason || c.why || "",
          price: c.p, entry: plan.entry || null, stop: plan.stop || null, live: true }; })
    : rankedSignals().map((s) => ({ ...s, live: false }));
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1 className="page-title">Signals</h1>
          <p className="page-sub">Ranked buy / watch / avoid, generated for you — <strong>{horizonLabel}</strong> view. Prices and scores refresh live through the day; entry, stop and thesis for the flagged names are hand-verified as of {ASOF}. Tap any name for detail.</p>
        </div>
      </div>
      <div className="sig-list">
        {rows.map((s) => {
          const v = VERDICT[s.verdict] || VERDICT.WATCH;
          const lp = priceMap[s.ticker];
          const px = lp || s.price;
          const hasPlan = !!(s.entry && s.stop);
          const lo = hasPlan ? s.stop : 0;
          const hi = hasPlan ? Math.max(s.entry[1], px) : 1;
          const span = (hi - lo) || 1;
          const pc = (x) => Math.max(0, Math.min(100, ((x - lo) / span) * 100));
          return (
            <div key={s.ticker} className="card sig-card sig-tap" onClick={() => onOpen && onOpen(s.ticker, false)}>
              <div className="sig-top">
                <span className="verdict" style={{ background: v.bg, color: v.color }}>{s.verdict}</span>
                <span className="sig-tkr num">{s.ticker}</span>
                <span className="sig-co">{s.name}</span>
                <span className="sig-gem"><b className="num" style={{ color: v.color }}>{s.score}</b><span>/10</span></span>
              </div>
              {s.theme && <span className="sig-theme">{s.theme}</span>}
              <div className="sig-levels">
                <div className="sig-lev"><span className="sig-lk">{lp ? "Now" : "Price"}</span><b className="num sig-lv">{usd0(px)}{lp && <span className="sig-livedot" />}</b></div>
                <div className="sig-lev"><span className="sig-lk">Entry zone</span><b className="num sig-lv" style={{ color: s.entry ? "var(--brand)" : "var(--ink2)" }}>{s.entry ? `${usd0(s.entry[0])}–${usd0(s.entry[1])}` : "—"}</b></div>
                <div className="sig-lev"><span className="sig-lk">Stop</span><b className="num sig-lv" style={{ color: s.stop ? "var(--down)" : "var(--ink2)" }}>{s.stop ? usd0(s.stop) : "—"}</b></div>
              </div>
              {hasPlan && (
                <div className="risk" aria-hidden="true">
                  <span className="risk-band" style={{ left: `${pc(s.entry[0])}%`, width: `${Math.max(3, pc(s.entry[1]) - pc(s.entry[0]))}%` }} />
                  <span className="risk-stop" />
                  <span className="risk-now" style={{ left: `${pc(px)}%` }} />
                </div>
              )}
              <p className="sig-reason">{s.reason}</p>
              <button className="btn-ghost sig-log" onClick={(e) => { e.stopPropagation(); onLog({ ticker: s.ticker, name: s.name, entry: s.entry, price: Number(px) || 0 }); }}>Log this trade →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ======================= universe ======================= */
function Universe({ onLog, live = {}, mode = "stocks", strat = "long", onOpen }) {
  const [raw, setRaw] = useState("");
  const [pasted, setPasted] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [err, setErr] = useState("");
  const isCrypto = mode === "crypto";
  const sigMap = Object.fromEntries(SIGNALS.map((s) => [s.ticker, s.verdict]));
  const total = UNIVERSE.reduce((n, g) => n + g.names.length, 0);
  const ord = { BUY: 0, WATCH: 1, AVOID: 2 };
  const sortCalls = (data) => [...data].sort((a, b) => { const pa = pick(a, strat), pb = pick(b, strat); return (ord[pa.v] ?? 1) - (ord[pb.v] ?? 1) || (pb.s - pa.s); });

  const importData = () => {
    try {
      const data = parseJSON(raw);
      if (!Array.isArray(data) || !data.length) throw new Error("expected a list of stocks");
      setPasted(sortCalls(data)); setShowAll(false); setErr("");
    } catch (e) { setErr(`Couldn't read that — ${e.message}. Paste the JSON the advisor prints with --export.`); }
  };

  const feedCalls = isCrypto ? ((live.crypto && live.crypto.calls) || null) : live.calls;
  const liveRanked = Array.isArray(feedCalls) && feedCalls.length ? sortCalls(feedCalls) : null;
  const ranked = (!isCrypto && pasted) || (!showAll ? liveRanked : null);

  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1 className="page-title">Universe</h1><p className="page-sub">{isCrypto ? "Every liquid coin I track, re-ranked live versus Bitcoin — strongest on top, weakening names flagged AVOID." : `Every name I track (${total}+), re-ranked by today's prices — strongest on top, weakening names flagged AVOID.`}</p></div>
        {!isCrypto && ranked && <button className="btn-ghost" onClick={() => { setShowAll(true); setPasted(null); setRaw(""); }}>Show all by theme →</button>}
        {!isCrypto && showAll && liveRanked && !pasted && <button className="btn-ghost" onClick={() => setShowAll(false)}>← Back to live ranking</button>}
      </div>

      {ranked ? (
        <div>
          {liveRanked && !pasted && <p className="uni-live"><span className="live-dot" /> Live ranking · updated {fmtClock(live.updated)} · {ranked.length} {isCrypto ? "coins" : "names"}</p>}
          <div className="uni-ranked">
            {ranked.map((d, i) => { const P = pick(d, strat); const meta = VERDICT[P.v] || VERDICT.WATCH; const tk = d.t || d.ticker; return (
              <div key={tk + i} className="uni-row uni-row-tap" onClick={() => onOpen && onOpen(tk, isCrypto)}>
                <span className="uni-rank num">{i + 1}</span>
                <span className="verdict" style={{ background: meta.bg, color: meta.color }}>{P.v}</span>
                <span className="uni-tkr num">{tk}</span>
                <span className="uni-setup">{d.name || d.setup || ""}</span>
                <span className="uni-price num">{d.p != null ? (isCrypto ? cUsd(d.p) : usd0(d.p)) : ""}</span>
                <span className="uni-score num" style={{ color: meta.color }}>{P.s != null ? `${P.s}/10` : ""}</span>
                <button className="uni-log" onClick={(e) => { e.stopPropagation(); onLog({ ticker: tk, name: d.name || tk, entry: null, price: Number(d.p) || 0 }); }} aria-label={`Log ${tk}`}>+</button>
              </div>
            ); })}
          </div>
        </div>
      ) : isCrypto ? (
        <Empty>The crypto ranking is loading — it refreshes through the day. When the market's weak you'll see mostly Watch and Avoid.</Empty>
      ) : (
        <div>
          <div className="card card-pad uni-import">
            <span className="field-l">Refresh with live data</span>
            <p className="uni-help">The app auto-loads the live ranking once it's published. To rank manually, run <code>python edge_desk_advisor.py --export</code>, copy the JSON, and paste it below.</p>
            <textarea className="textarea" placeholder='Paste advisor export, e.g.  [{"t":"GEV","v":"BUY","s":8,"p":1100.2,"setup":"Pullback"}, ...]' value={raw} onChange={(e) => setRaw(e.target.value)} />
            <button className="btn btn-block" onClick={importData} disabled={!raw.trim()}>Rank with live data</button>
            {err && <Empty tone="warn">{err}</Empty>}
          </div>
          <div className="uni-groups">
            {UNIVERSE.map((g) => (
              <div key={g.theme} className="uni-group">
                <h3 className="uni-gtitle">{g.theme}<span className="uni-count">{g.names.length}</span></h3>
                <div className="uni-chips">
                  {g.names.map((t) => { const v = sigMap[t]; const meta = v ? VERDICT[v] : null; return (
                    <span key={t} className="uni-chip" style={meta ? { borderColor: meta.color, color: meta.color } : undefined} title={v || "tracked"}>
                      {meta && <span className="uni-cdot" style={{ background: meta.color }} />}{t}
                    </span>
                  ); })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= portfolio (trade log) ======================= */
function Portfolio({ positions, setPositions, live = {} }) {
  const [adding, setAdding] = useState(false);
  const setP = (id, field, val) => setPositions((ps) => ps.map((p) => p.id === id ? { ...p, [field]: val } : p));
  const remove = (id) => setPositions((ps) => ps.filter((p) => p.id !== id));

  const calc = (p) => {
    const inv = num(p.invested), entry = num(p.entry), cur = num(p.current);
    const hasPL = entry > 0 && inv > 0;
    const shares = entry > 0 ? inv / entry : 0;
    const value = entry > 0 ? shares * cur : inv;
    const pl = hasPL ? value - inv : null;
    const plpct = hasPL ? (pl / inv) * 100 : null;
    return { value, pl, plpct, hasPL };
  };
  let tInv = 0, tVal = 0, w = 0, l = 0;
  positions.forEach((p) => { const c = calc(p); tInv += num(p.invested); tVal += c.value; if (c.pl !== null) { if (c.pl >= 0) w++; else l++; } });
  const tPL = tVal - tInv, tPct = tInv > 0 ? (tPL / tInv) * 100 : 0;

  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1 className="page-title">Portfolio</h1><p className="page-sub">Log each trade with two numbers — amount invested and entry price. Set "Now" to mark P&L.</p></div>
        <button className="btn" onClick={() => setAdding(true)}>+ Log trade</button>
      </div>

      <div className="card card-pad tl-summary">
        <div className="tl-stat"><span className="tl-k">Invested</span><span className="tl-v num">{usd2(tInv)}</span></div>
        <div className="tl-stat"><span className="tl-k">Value</span><span className="tl-v num">{usd2(tVal)}</span></div>
        <div className="tl-stat"><span className="tl-k">Total P&L</span><span className="tl-v num" style={{ color: tPL >= 0 ? "#138A5E" : "#CC3B3B" }}>{tPL >= 0 ? "+" : ""}{usd2(tPL)} ({tPct >= 0 ? "+" : ""}{tPct.toFixed(1)}%)</span></div>
        <div className="tl-stat"><span className="tl-k">Record</span><span className="tl-v num"><span style={{ color: "#138A5E" }}>{w}W</span> – <span style={{ color: "#CC3B3B" }}>{l}L</span></span></div>
      </div>

      {adding && <TlAddRow onSave={(p) => { setPositions((ps) => [...ps, p]); setAdding(false); }} onCancel={() => setAdding(false)} />}

      <div className="tl-list">
        {positions.map((p) => {
          const c = calc(p);
          return (
            <div key={p.id} className="card tl-card">
              <div className="tl-head">
                <span className="tl-tkr">{p.ticker}</span><span className="tl-name">{p.name}</span>
                {c.hasPL
                  ? <span className="tl-badge" style={{ background: c.pl >= 0 ? "#E7F4EE" : "#FBEAEA", color: c.pl >= 0 ? "#138A5E" : "#CC3B3B" }}>{c.pl >= 0 ? "▲" : "▼"} {c.plpct >= 0 ? "+" : ""}{c.plpct.toFixed(1)}%</span>
                  : <span className="tl-badge" style={{ background: "#F2F4F7", color: "#5A6573" }}>{num(p.entry) <= 0 ? "set entry" : "add amount"}</span>}
                <button className="tl-x" onClick={() => remove(p.id)} aria-label={`Remove ${p.ticker}`}>×</button>
              </div>
              <div className="tl-fields">
                <label className="tl-field"><span>Invested</span><span className="field-wrap"><span className="field-affix">$</span><input className="input tl-input num" inputMode="decimal" value={p.invested} onChange={(e) => setP(p.id, "invested", e.target.value)} /></span></label>
                <label className="tl-field"><span>Entry price</span><span className="field-wrap"><span className="field-affix">$</span><input className="input tl-input num" inputMode="decimal" value={p.entry} onChange={(e) => setP(p.id, "entry", e.target.value)} /></span></label>
                <label className="tl-field"><span>Now</span><span className="field-wrap"><span className="field-affix">$</span><input className="input tl-input num" inputMode="decimal" value={p.current} onChange={(e) => setP(p.id, "current", e.target.value)} /></span></label>
              </div>
              <div className="tl-foot">
                <span className="tl-foot-k">Value <b className="num">{usd2(c.value)}</b></span>
                {c.hasPL && <span className="tl-foot-k">P&L <b className="num" style={{ color: c.pl >= 0 ? "#138A5E" : "#CC3B3B" }}>{c.pl >= 0 ? "+" : ""}{usd2(c.pl)}</b></span>}
              </div>
            </div>
          );
        })}
        {positions.length === 0 && <Empty>No trades logged yet. Tap "Log trade," or hit "Log this trade" on any call in Signals.</Empty>}
      </div>
      <p className="hint-note">{live.status === "live"
        ? `Held tickers mark to live prices automatically (last ${fmtClock(live.updated)}). You can still override "Now" by hand.`
        : `Set "Now" to mark P&L. When the live feed is connected, held tickers update on their own.`} You only ever enter amount invested and entry price.</p>
    </div>
  );
}

function TlAddRow({ onSave, onCancel }) {
  const [ticker, setTicker] = useState(""); const [name, setName] = useState(""); const [invested, setInvested] = useState(""); const [entry, setEntry] = useState("");
  return (
    <div className="card add">
      <div className="add-fields">
        <input className="input" placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
        <input className="input" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="$ invested" inputMode="decimal" value={invested} onChange={(e) => setInvested(e.target.value)} />
        <input className="input" placeholder="Entry price" inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} />
      </div>
      <div className="add-actions">
        <button className="btn" disabled={!ticker} onClick={() => onSave({ id: uid(), ticker, name: name || ticker, invested: parseFloat(invested) || 0, entry: parseFloat(entry) || 0, current: parseFloat(entry) || 0 })}>Save</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ======================= sizer ======================= */
function Sizer() {
  const [acct, setAcct] = useState("750"); const [riskPct, setRiskPct] = useState("2");
  const [entry, setEntry] = useState(""); const [stop, setStop] = useState("");
  const A = parseFloat(acct) || 0, Rp = parseFloat(riskPct) || 0, E = parseFloat(entry) || 0, S = parseFloat(stop) || 0;
  const riskDollars = A * (Rp / 100), perShare = Math.abs(E - S);
  const valid = E > 0 && S > 0 && perShare > 0;
  const shares = valid ? Math.floor(riskDollars / perShare) : 0;
  const posVal = shares * E, posPct = A > 0 ? (posVal / A) * 100 : 0, long = E >= S;
  const targets = valid ? [1, 2, 3].map((r) => ({ r, price: long ? E + perShare * r : E - perShare * r, profit: riskDollars * r })) : [];

  return (
    <div>
      <div className="page-head"><div><h1 className="page-title">Position sizer</h1><p className="page-sub">Let the stop set the share count — not conviction. Risk a fixed slice per idea.</p></div></div>
      <div className="card card-pad">
        <div className="sizer-grid">
          <Field label="Account" prefix="$" value={acct} onChange={setAcct} />
          <Field label="Risk per trade" suffix="%" value={riskPct} onChange={setRiskPct} />
          <Field label="Entry price" prefix="$" value={entry} onChange={setEntry} placeholder="0.00" />
          <Field label="Stop price" prefix="$" value={stop} onChange={setStop} placeholder="0.00" />
        </div>
        <div className="result">
          <div className="result-hero">
            <span className="result-label">Position size</span>
            <span className="result-num num">{valid ? shares.toLocaleString() : "—"}</span>
            <span className="result-unit">shares{valid ? ` · ${usd0(posVal)}` : ""}</span>
          </div>
          <div className="result-stats">
            <Stat k="Risk at stop" v={usd0(riskDollars)} />
            <Stat k="Risk / share" v={valid ? `$${perShare.toFixed(2)}` : "—"} />
            <Stat k="% of account" v={valid ? `${posPct.toFixed(1)}%` : "—"} warn={posPct > 25} />
          </div>
        </div>
        {valid ? (
          <div className="rtable">
            <div className="rtable-head"><span>Target</span><span>Price</span><span>Profit</span></div>
            {targets.map((t) => <div key={t.r} className="rtable-row"><span className="r-tag">{t.r}R</span><span className="num">${t.price.toFixed(2)}</span><span className="num r-up">+{usd0(t.profit)}</span></div>)}
          </div>
        ) : <Empty>Enter an entry and a stop to size the trade and map your R-multiples.</Empty>}
      </div>
    </div>
  );
}

/* ======================= analyst ======================= */
function Analyst({ onAdd }) {
  const [mode, setMode] = useState("map");
  const [tape, setTape] = useState(""); const [ticker, setTicker] = useState(""); const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [pulse, setPulse] = useState(null); const [scan, setScan] = useState(null);

  const runMap = useCallback(async () => {
    if (!tape.trim()) return; setLoading(true); setErr(""); setPulse(null);
    try {
      const txt = await callClaude(`You are a buy-side analyst. Below is raw market commentary the user pasted. Sort it onto a macro framework. Return ONLY a JSON array (no prose, no markdown) of up to 5 items, each: {"headline": string (<12 words), "driver": one of "AI capex"|"Fed/rates"|"Energy/inflation"|"Geopolitics"|"Rotation"|"Other", "impact": "risk-on"|"risk-off"|"mixed", "note": string (<20 words)}.\n\nPASTED:\n${tape.slice(0, 4000)}`);
      setPulse(parseJSON(txt));
    } catch (e) { setErr(`Couldn't analyze that — ${e.message}. If AI calls are blocked in the app, paste it into the chat instead.`); }
    setLoading(false);
  }, [tape]);

  const runScore = useCallback(async () => {
    const t = ticker.trim().toUpperCase(); if (!t) return; setLoading(true); setErr(""); setScan(null);
    try {
      const txt = await callClaude(`You are a disciplined buy-side analyst scoring ${t} on a 5-pillar framework. ${notes.trim() ? "Use these user-provided current figures: " + notes.slice(0, 1500) : "You may lack current figures — score directionally and say so in the note."} Return ONLY JSON: {"ticker":"${t}","company":string,"theme":string,"revGrowth":string,"verdict":"BUY"|"WATCH"|"AVOID","bull":string (<35 words),"bear":string (<35 words),"note":string (<25 words, flag what to verify)}.`);
      setScan(parseJSON(txt));
    } catch (e) { setErr(`Couldn't score ${t} — ${e.message}. If AI calls are blocked here, ask in the chat.`); }
    setLoading(false);
  }, [ticker, notes]);

  return (
    <div>
      <div className="page-head"><div><h1 className="page-title">Analyst</h1><p className="page-sub">Structures data you paste onto the framework. No live feed in-app — for live calls, run the advisor or ask in chat.</p></div></div>
      <div className="seg">
        <button className={`seg-btn ${mode === "map" ? "seg-on" : ""}`} onClick={() => setMode("map")}>Map the tape</button>
        <button className={`seg-btn ${mode === "ticker" ? "seg-on" : ""}`} onClick={() => setMode("ticker")}>Score a ticker</button>
      </div>

      {mode === "map" ? (
        <div className="card card-pad">
          <textarea className="textarea" placeholder="Paste today's headlines or market notes…" value={tape} onChange={(e) => setTape(e.target.value)} />
          <button className="btn btn-block" onClick={runMap} disabled={loading || !tape.trim()}>{loading ? <Loading text="Mapping the tape" /> : "Map to my framework"}</button>
          {!pulse && !err && !loading && <Empty>Paste what you're seeing — headlines, notable moves — and it gets sorted onto the four drivers.</Empty>}
          {err && <Empty tone="warn">{err}</Empty>}
          {pulse && <div className="pulse">{pulse.map((p, i) => (
            <div key={i} className="pulse-card" style={{ borderLeftColor: impactColor(p.impact) }}>
              <div className="pulse-top"><span className="pulse-driver">{p.driver}</span><span className="pulse-impact" style={{ color: impactColor(p.impact) }}>{(p.impact || "").replace("-", " ").toUpperCase()}</span></div>
              <p className="pulse-head">{p.headline}</p><p className="pulse-note">{p.note}</p>
            </div>
          ))}</div>}
        </div>
      ) : (
        <div className="card card-pad">
          <div className="scan-bar">
            <input className="input scan-input" placeholder="Ticker (e.g. AMD)" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") runScore(); }} />
            <button className="btn" onClick={runScore} disabled={loading || !ticker.trim()}>{loading ? "…" : "Score"}</button>
          </div>
          <textarea className="textarea" placeholder="Optional — paste current figures (revenue growth, valuation) for an accurate read…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {loading && <div className="load-block"><Loading text={`Scoring ${ticker.trim().toUpperCase()}`} /></div>}
          {err && <Empty tone="warn">{err}</Empty>}
          {scan && (
            <div className="scan-result">
              <div className="scan-head">
                <span className="verdict" style={{ background: (VERDICT[scan.verdict] || VERDICT.WATCH).bg, color: (VERDICT[scan.verdict] || VERDICT.WATCH).color }}>{scan.verdict || "—"}</span>
                <div className="scan-id"><span className="scan-tkr">{scan.ticker}</span><span className="scan-co">{scan.company} · {scan.theme} · rev {scan.revGrowth}</span></div>
              </div>
              <div className="bb">
                <div className="bb-block bull"><span className="bb-tag">Bull</span><p>{scan.bull}</p></div>
                <div className="bb-block bear"><span className="bb-tag">Bear</span><p>{scan.bear}</p></div>
              </div>
              {scan.note && <p className="scan-note">{scan.note}</p>}
              <button className="btn btn-block" onClick={() => onAdd({ ticker: scan.ticker, company: scan.company })}>Log this as a trade →</button>
            </div>
          )}
          {!scan && !loading && !err && <Empty>Enter a ticker for a framework read with a verdict and bull/bear. Paste current figures for accuracy.</Empty>}
        </div>
      )}
    </div>
  );
}

/* ======================= atoms ======================= */
function Spark({ data }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="spark-empty">No chart data</div>;
  const w = 320, h = 84, min = Math.min(...data), max = Math.max(...data), rng = (max - min) || 1;
  const up = data[data.length - 1] >= data[0];
  const col = up ? "#138A5E" : "#CC3B3B";
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${(h - 4) - ((v - min) / rng) * (h - 10) + 2}`).join(" ");
  return (
    <svg className="spark-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={up ? "rgba(19,138,94,.09)" : "rgba(204,59,59,.09)"} stroke="none" />
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function RiskMeter({ vol }) {
  const v = Math.max(3, Math.min(100, Math.round((vol / 120) * 100)));
  const label = vol < 30 ? "Low" : vol < 60 ? "Moderate" : vol < 90 ? "High" : "Very high";
  const col = vol < 30 ? "#138A5E" : vol < 60 ? "#B5852F" : "#CC3B3B";
  return (
    <div className="riskm">
      <div className="riskm-top"><span className="riskm-k">Risk level (volatility)</span><span className="riskm-v" style={{ color: col }}>{label} · {Math.round(vol)}%</span></div>
      <div className="riskm-track"><span className="riskm-fill" style={{ width: `${v}%`, background: col }} /></div>
    </div>
  );
}

function MarketGauge({ market, label }) {
  if (!market) return null;
  const v = Math.max(0, Math.min(100, market.value));
  const col = v < 25 ? "#CC3B3B" : v < 45 ? "#B5852F" : v < 82 ? "#138A5E" : "#B5852F";
  return (
    <div className="card card-pad gauge">
      <div className="gauge-top"><span className="gauge-k">{label} risk</span><span className="gauge-label" style={{ color: col }}>{market.label} · {v}/100</span></div>
      <div className="gauge-track"><span className="gauge-fill" style={{ width: `${v}%` }} /><span className="gauge-marker" style={{ left: `${v}%` }} /></div>
      <div className="gauge-scale"><span>Risk-off</span><span>Balanced</span><span>Frothy</span></div>
      {market.breadth != null && <p className="gauge-note">{market.breadth}% of names are above their 50-day average.</p>}
    </div>
  );
}

function DetailView({ sel, live, strat, desc, onClose, onLog }) {
  const feed = sel.crypto ? ((live.crypto && live.crypto.calls) || []) : (live.calls || []);
  const c = feed.find((x) => (x.t || "").toUpperCase() === (sel.t || "").toUpperCase());
  const fmt = sel.crypto ? cUsd : usd0;
  const swipeRef = useSwipeBack(onClose);
  return (
    <div className="detail" ref={swipeRef}>
      <div className="detail-bar">
        <button className="detail-back" onClick={onClose} aria-label="Back">←</button>
        <div className="detail-id"><span className="detail-tkr num">{sel.t}</span>{c && <span className="detail-name">{c.name}</span>}</div>
      </div>
      {!c ? (
        <div className="wrap"><Empty>No live data for {sel.t} yet — it refreshes through the day.</Empty></div>
      ) : (() => {
        const p = pick(c, strat);
        const meta = VERDICT[p.v] || VERDICT.WATCH;
        const up = (c.chg || 0) >= 0;
        const rangePct = c.hi > c.lo ? Math.max(0, Math.min(100, ((c.p - c.lo) / (c.hi - c.lo)) * 100)) : 50;
        return (
          <div className="wrap detail-body">
            <div className="detail-head">
              <div className="detail-price">
                <span className="detail-p num">{sel.crypto ? cUsd(c.p) : usd2(c.p)}</span>
                <span className="detail-chg num" style={{ color: up ? "var(--up)" : "var(--down)" }}>{up ? "▲" : "▼"} {c.chg >= 0 ? "+" : ""}{c.chg}% today</span>
              </div>
              <span className="verdict" style={{ background: meta.bg, color: meta.color }}>{p.v} · {p.s}/10</span>
            </div>
            <div className="card detail-chart"><Spark data={c.spark} /></div>
            <div className="detail-range">
              <div className="detail-range-lab"><span>52-wk low {fmt(c.lo)}</span><span>high {fmt(c.hi)}</span></div>
              <div className="rng"><span className="rng-fill" style={{ width: `${rangePct}%` }} /><span className="rng-dot" style={{ left: `${rangePct}%` }} /></div>
            </div>
            <div className="card card-pad"><RiskMeter vol={c.vol} /></div>
            <div className="detail-stats">
              <Stat k="1-mo return" v={`${c.r1m >= 0 ? "+" : ""}${c.r1m}%`} />
              <Stat k="3-mo return" v={`${c.r3m >= 0 ? "+" : ""}${c.r3m}%`} />
              <Stat k="RSI" v={`${c.rsi}`} />
              <Stat k="Setup" v={c.setup} />
              <Stat k="Avg volume" v={`$${(c.dvol / 1e6).toFixed(0)}M`} />
              <Stat k="Score" v={`${p.s}/10`} />
            </div>
            <div className="card card-pad detail-why">
              <span className="detail-why-k">{strat === "short" ? "Short-term read" : "Long-term read"}</span>
              <p>{p.w || "—"}.</p>
            </div>
            {desc && desc.desc && (
              <div className="card card-pad detail-about">
                <div className="detail-about-head">
                  <span className="detail-why-k">About {c.name || sel.t}</span>
                  {(desc.sector || desc.industry) && (
                    <div className="detail-tags">
                      {desc.sector && <span className="detail-tag">{desc.sector}</span>}
                      {desc.industry && desc.industry !== desc.sector && <span className="detail-tag">{desc.industry}</span>}
                    </div>
                  )}
                </div>
                <p className="detail-about-body">{desc.desc}</p>
              </div>
            )}
            <button className="btn btn-block" onClick={() => { onLog({ ticker: c.t, name: c.name, entry: null, price: Number(c.p) || 0 }); onClose(); }}>Log this trade →</button>
            <p className="hint-note">Informational only — not investment advice. Prices refresh through the day.</p>
          </div>
        );
      })()}
    </div>
  );
}

function About({ go }) {
  return (
    <div className="wrap">
      <div className="page-head"><div><h1 className="page-title">How it works</h1><p className="page-sub">What Edge Desk does, where the numbers come from, and what it isn't.</p></div></div>
      <div className="card card-pad about">
        <h3 className="about-h">The idea</h3>
        <p>Edge Desk scans 100+ liquid names with a transparent rules engine — trend, momentum, breakout and pullback structure, and relative strength versus the market — then ranks each one Buy, Watch, or Avoid. It's a shortlist of setups that match criteria, not predictions.</p>
        <h3 className="about-h">Where the numbers come from</h3>
        <p>The advisor computes everything from live prices and publishes a snapshot the app pulls through the day — on open, on a timer, and when you tap the live badge. Nothing here is hand-typed or guessed.</p>
        <h3 className="about-h">The tabs</h3>
        <ul className="about-list">
          <li><b>Overview</b> — the macro regime and sector momentum framing every call.</li>
          <li><b>Signals</b> — ranked Buy / Watch / Avoid with entry zone, stop, and thesis.</li>
          <li><b>Universe</b> — every tracked name, re-ranked live by today's prices.</li>
          <li><b>Portfolio</b> — your trade log; it marks P&amp;L to live prices automatically.</li>
          <li><b>Sizer</b> — stop-based position sizing and R-multiples.</li>
        </ul>
        <h3 className="about-h">Important</h3>
        <p>This is an <b>informational tool, not investment advice</b>. The calls are setups that match criteria; you decide what to trade — willing to win or lose. The win/loss record exists to keep the process honest.</p>
        <button className="btn btn-block" onClick={() => go("signals")}>See today's signals →</button>
      </div>
    </div>
  );
}

function Section({ eyebrow, title, date, sub, children }) {
  return (
    <section className="sec">
      <div className="sec-head">{eyebrow && <span className="sec-eyebrow">{eyebrow}</span>}<h2 className="sec-title">{title}{date && <span className="sec-date num">{date}</span>}</h2>{sub && <p className="sec-sub">{sub}</p>}</div>
      {children}
    </section>
  );
}
function Field({ label, value, onChange, placeholder, prefix, suffix }) {
  return (
    <label className="field"><span className="field-l">{label}</span>
      <span className="field-wrap">{prefix && <span className="field-affix">{prefix}</span>}<input className="input" inputMode="decimal" value={value} placeholder={placeholder || "0"} onChange={(e) => onChange(e.target.value)} />{suffix && <span className="field-affix suffix">{suffix}</span>}</span>
    </label>
  );
}
function Stat({ k, v, warn }) { return <div className="stat"><span className="stat-k">{k}</span><span className="stat-v num" style={warn ? { color: "#CC3B3B" } : undefined}>{v}</span></div>; }
function Empty({ children, tone }) { return <div className={`empty ${tone === "warn" ? "empty-warn" : ""}`}>{children}</div>; }
function Loading({ text }) { return <span className="loading"><span className="ld" /><span className="ld" /><span className="ld" /> {text}…</span>; }

const heatColor = (m) => (m >= 85 ? "#0E7A57" : m >= 70 ? "#1AA06E" : m >= 55 ? "#B5852F" : "#C4CCD6");
const impactColor = (i) => (i === "risk-on" ? "#138A5E" : i === "risk-off" ? "#CC3B3B" : "#B5852F");

/* ======================= styles ======================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
.app{ --bg:#F3F5F7; --surface:#fff; --ink:#131A26; --ink2:#5A6573; --line:#E4E8EE; --brand:#0E7A57; --brand-d:#0A5C42; --gold:#B5852F; --up:#138A5E; --down:#CC3B3B;
  --body:'Inter',system-ui,-apple-system,sans-serif; --disp:'Fraunces',Georgia,serif;
  background:var(--bg); color:var(--ink); font-family:var(--body); min-height:100vh; width:100%; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
.app *{ box-sizing:border-box; } .app button{ font-family:inherit; cursor:pointer; }
.num{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum"; }
.app ::selection{ background:rgba(14,122,87,.16); }

.nav{ position:sticky; top:0; z-index:40; background:var(--ink); box-shadow:0 2px 14px rgba(19,26,38,.18); }
.nav-inner{ max-width:1120px; margin:0 auto; height:60px; padding:0 18px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
.brand{ display:flex; align-items:center; gap:9px; background:none; border:none; padding:0; }
.brand-mark{ width:13px; height:13px; border-radius:3px; background:linear-gradient(135deg,var(--brand),#1FB37D); transform:rotate(45deg); display:inline-block; box-shadow:0 0 14px rgba(31,179,125,.4); }
.brand-name{ font-family:var(--disp); font-weight:600; font-size:20px; color:#fff; letter-spacing:-.01em; display:flex; align-items:center; gap:8px; }
.brand-thin{ font-weight:500; color:#9FB0AA; }
.brand-name.dark{ color:var(--ink); } .brand-name.dark .brand-thin{ color:var(--brand); }
.nav-tabs{ display:flex; gap:4px; margin-right:auto; margin-left:24px; }
.nav-tab{ background:none; border:none; color:#AEB8C4; font-size:14.5px; font-weight:500; padding:9px 14px; border-radius:8px; transition:.15s; }
.nav-tab:hover{ color:#fff; background:rgba(255,255,255,.06); }
.nav-tab-on{ color:#fff; background:rgba(31,179,125,.16); }
.nav-right{ display:flex; align-items:center; gap:12px; }
.regime{ display:inline-flex; align-items:center; gap:7px; padding:6px 11px; border-radius:999px; }
.regime-dot{ width:7px; height:7px; border-radius:50%; } .regime-dot.lg{ width:9px; height:9px; }
.regime-txt{ font-size:12.5px; font-weight:600; }
.burger{ display:none; flex-direction:column; gap:4px; background:none; border:none; padding:6px; }
.burger span{ width:22px; height:2px; background:#fff; border-radius:2px; }

.menu{ position:fixed; inset:0; z-index:60; background:rgba(19,26,38,.5); backdrop-filter:blur(2px); display:flex; justify-content:flex-end; animation:fade .18s; }
.menu-panel{ width:min(86vw,380px); background:var(--surface); height:100%; display:flex; flex-direction:column; box-shadow:-12px 0 40px rgba(19,26,38,.25); animation:slidein .22s ease; }
.menu-top{ display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid var(--line); }
.menu-x{ background:none; border:none; font-size:30px; line-height:1; color:var(--ink2); padding:0 4px; }
.menu-rows{ display:flex; flex-direction:column; padding:8px 0; flex:1; }
.menu-row{ display:flex; align-items:center; justify-content:space-between; background:none; border:none; text-align:left; font-family:var(--disp); font-size:24px; font-weight:600; color:var(--ink); padding:16px 22px; border-bottom:1px solid var(--line); transition:background .15s; }
.menu-row:hover{ background:#F6F8FA; } .menu-row-on{ color:var(--brand); }
.menu-arrow{ color:var(--brand); font-weight:400; font-family:var(--body); }
.menu-reset{ margin:16px 20px 24px; background:none; border:1px solid var(--line); color:var(--ink2); font-size:13.5px; font-weight:500; padding:11px; border-radius:9px; }
.menu-reset:hover{ border-color:var(--down); color:var(--down); }

.hero{ background:radial-gradient(120% 140% at 85% 10%, #14503C 0%, #0E1726 55%), linear-gradient(135deg,#0E1726,#0F3A2C); color:#fff; }
.hero-inner{ max-width:1120px; margin:0 auto; padding:54px 22px 60px; }
.hero-kicker{ display:inline-block; font-size:12.5px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:#5FD3A6; margin-bottom:14px; }
.hero-title{ font-family:var(--disp); font-weight:600; font-size:clamp(32px,6.5vw,54px); line-height:1.04; letter-spacing:-.02em; margin:0 0 16px; max-width:20ch; }
.hero-sub{ font-size:clamp(15px,2.4vw,18px); line-height:1.55; color:#C3CDD6; max-width:56ch; margin:0 0 26px; }
.hero-cta{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:26px; }
.hero-regime{ display:inline-flex; align-items:center; gap:9px; font-size:14px; color:#AEB8C4; }

.wrap{ max-width:1120px; margin:0 auto; padding:34px 22px 10px; }
.sec{ margin-bottom:38px; } .sec-head{ margin-bottom:16px; }
.sec-eyebrow{ display:inline-block; font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--brand); margin-bottom:7px; }
.sec-title{ font-family:var(--disp); font-weight:600; font-size:25px; letter-spacing:-.01em; margin:0; }
.sec-date{ font-family:var(--body); font-weight:500; font-size:12.5px; color:var(--ink2); letter-spacing:.01em; margin-left:10px; vertical-align:2px; }
.sec-sub{ color:var(--ink2); font-size:14.5px; line-height:1.5; margin:5px 0 0; max-width:64ch; }
.page-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:34px 0 22px; }
.page-title{ font-family:var(--disp); font-weight:600; font-size:32px; letter-spacing:-.02em; margin:0; }
.page-sub{ color:var(--ink2); font-size:14.5px; line-height:1.5; margin:6px 0 0; max-width:64ch; }

.card{ background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:0 1px 2px rgba(19,26,38,.04), 0 8px 22px rgba(19,26,38,.05); }
.card-pad{ padding:22px; }
.btn{ background:var(--brand); color:#fff; border:none; font-size:14.5px; font-weight:600; padding:11px 20px; border-radius:9px; box-shadow:0 1px 2px rgba(10,92,66,.3); transition:.15s; }
.btn:hover{ background:var(--brand-d); } .btn:active{ transform:translateY(1px); } .btn:disabled{ opacity:.45; cursor:not-allowed; }
.btn-light{ background:rgba(255,255,255,.12); color:#fff; box-shadow:none; backdrop-filter:blur(4px); } .btn-light:hover{ background:rgba(255,255,255,.2); }
.btn-block{ width:100%; margin-top:14px; padding:13px; }
.btn-ghost{ background:none; border:1px solid var(--line); color:var(--ink2); font-size:14px; font-weight:600; padding:10px 16px; border-radius:9px; }
.btn-ghost:hover{ border-color:var(--brand); color:var(--brand); }

.verdict{ font-size:12px; font-weight:700; letter-spacing:.04em; padding:5px 11px; border-radius:999px; flex:0 0 auto; }

.tops{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
.top-card{ display:flex; align-items:center; gap:12px; padding:16px; text-align:left; transition:.15s; }
.top-card:hover{ transform:translateY(-2px); box-shadow:0 14px 30px rgba(19,26,38,.09); }
.top-meta{ display:flex; flex-direction:column; } .top-tkr{ font-weight:700; font-size:18px; } .top-theme{ color:var(--ink2); font-size:12px; }
.top-score{ margin-left:auto; font-weight:700; font-size:15px; color:var(--brand); }

.macro-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:14px; }
.macro-card{ text-align:left; border-top:3px solid; padding:18px; transition:.15s; }
.macro-card:hover{ transform:translateY(-2px); box-shadow:0 14px 30px rgba(19,26,38,.09); }
.macro-top{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px; }
.macro-label{ font-weight:600; font-size:15.5px; }
.pill{ font-size:11.5px; font-weight:700; padding:4px 9px; border-radius:999px; white-space:nowrap; }
.macro-detail{ color:var(--ink2); font-size:13.5px; line-height:1.5; margin:0; }

.heat{ padding:8px 18px; }
.heat-row{ display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid var(--line); } .heat-row:last-child{ border-bottom:none; }
.heat-name{ flex:0 0 160px; font-size:14px; font-weight:500; }
.heat-track{ flex:1; height:9px; background:#EDF0F4; border-radius:99px; overflow:hidden; }
.heat-fill{ display:block; height:100%; border-radius:99px; transition:width .3s; }
.heat-val{ width:30px; text-align:right; font-size:13px; font-weight:600; color:var(--ink2); }
.heat-ctrl{ display:flex; gap:5px; }
.mini{ width:28px; height:28px; border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:7px; font-size:16px; line-height:1; transition:.12s; }
.mini:hover{ border-color:var(--brand); color:var(--brand); }

/* signals */
.sig-list{ display:flex; flex-direction:column; gap:12px; }
.sig-card{ padding:18px; }
.sig-top{ display:flex; align-items:center; gap:12px; margin-bottom:8px; }
.sig-tkr{ font-weight:700; font-size:19px; letter-spacing:-.01em; }
.sig-score{ margin-left:auto; font-weight:700; font-size:15px; }
.sig-name{ font-size:13px; color:var(--ink2); margin:0 0 12px; }
.sig-levels{ display:flex; gap:18px; flex-wrap:wrap; margin-bottom:12px; }
.sig-lev{ font-size:13.5px; } .sig-lev span{ color:var(--ink2); } .sig-lev b{ font-weight:700; }
.sig-reason{ font-size:13.5px; line-height:1.55; margin:0 0 14px; }
.sig-log{ width:100%; }

/* trade log */
.tl-summary{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:16px; }
.tl-stat{ display:flex; flex-direction:column; gap:3px; flex:1; min-width:120px; }
.tl-k{ font-size:11.5px; font-weight:600; color:var(--ink2); }
.tl-v{ font-weight:700; font-size:17px; }
.tl-list{ display:flex; flex-direction:column; gap:10px; }
.tl-card{ padding:16px; }
.tl-head{ display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.tl-tkr{ font-weight:700; font-size:16px; } .tl-name{ font-size:12px; color:var(--ink2); }
.tl-badge{ margin-left:auto; font-size:12.5px; font-weight:700; padding:4px 10px; border-radius:999px; }
.tl-x{ background:none; border:none; color:#A4AFBC; font-size:22px; line-height:1; padding:0 2px; } .tl-x:hover{ color:var(--down); }
.tl-fields{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:12px; }
.tl-field{ display:flex; flex-direction:column; gap:5px; } .tl-field span{ font-size:11.5px; font-weight:600; color:var(--ink2); }
.tl-input{ padding-left:24px; padding-top:9px; padding-bottom:9px; font-size:14px; }
.tl-foot{ display:flex; gap:20px; padding-top:4px; border-top:1px solid var(--line); padding-top:12px; }
.tl-foot-k{ font-size:13px; color:var(--ink2); } .tl-foot-k b{ color:var(--ink); }

.add{ padding:18px; margin-bottom:16px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }
.add-fields{ display:flex; gap:10px; flex:1; flex-wrap:wrap; } .add-fields .input{ flex:1; min-width:110px; }
.add-actions{ display:flex; gap:10px; }

.input{ width:100%; background:#fff; border:1px solid var(--line); color:var(--ink); font-size:15px; padding:11px 13px; border-radius:9px; transition:.15s; }
.input:focus{ outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(14,122,87,.12); }
.input::placeholder{ color:#A4AFBC; }
.textarea{ width:100%; min-height:104px; resize:vertical; background:#fff; border:1px solid var(--line); color:var(--ink); font-family:var(--body); font-size:14.5px; line-height:1.55; padding:13px; border-radius:9px; }
.textarea:focus{ outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(14,122,87,.12); } .textarea::placeholder{ color:#A4AFBC; }

.sizer-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
.field{ display:flex; flex-direction:column; gap:7px; } .field-l{ font-size:12.5px; font-weight:600; color:var(--ink2); }
.field-wrap{ position:relative; display:flex; align-items:center; }
.field-affix{ position:absolute; left:13px; color:var(--ink2); font-size:15px; pointer-events:none; } .field-affix.suffix{ left:auto; right:13px; }
.field-wrap .input{ padding-left:26px; }
.result{ margin-top:20px; display:flex; gap:16px; flex-wrap:wrap; align-items:stretch; }
.result-hero{ flex:0 0 auto; min-width:190px; background:linear-gradient(150deg,#0F3A2C,#0E7A57); color:#fff; border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; justify-content:center; }
.result-label{ font-size:12.5px; font-weight:600; color:#9FD9C2; } .result-num{ font-weight:700; font-size:44px; line-height:1.05; letter-spacing:-.02em; } .result-unit{ font-size:13px; color:#C3E5D7; }
.result-stats{ flex:1; display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; align-content:center; }
.stat{ background:#F6F8FA; border:1px solid var(--line); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:4px; }
.stat-k{ font-size:11.5px; font-weight:500; color:var(--ink2); } .stat-v{ font-weight:700; font-size:18px; }
.rtable{ margin-top:18px; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.rtable-head,.rtable-row{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; padding:11px 16px; }
.rtable-head{ font-size:11.5px; font-weight:600; color:var(--ink2); text-transform:uppercase; letter-spacing:.04em; background:#F6F8FA; border-bottom:1px solid var(--line); }
.rtable-row{ border-bottom:1px solid var(--line); font-size:14.5px; } .rtable-row:last-child{ border-bottom:none; }
.r-tag{ font-weight:700; color:var(--brand); } .r-up{ color:var(--up); font-weight:600; }
.hint-note{ color:var(--ink2); font-size:13px; line-height:1.55; margin:14px 0 0; }

.seg{ display:flex; gap:8px; margin-bottom:18px; }
.seg-btn{ background:#fff; border:1px solid var(--line); color:var(--ink2); font-size:14px; font-weight:600; padding:10px 18px; border-radius:9px; transition:.15s; }
.seg-btn:hover{ border-color:#CBD3DC; } .seg-on{ background:var(--ink); border-color:var(--ink); color:#fff; }
.scan-bar{ display:flex; gap:10px; } .scan-input{ flex:1; text-transform:uppercase; } .scan-input::placeholder{ text-transform:none; } .scan-bar + .textarea{ margin-top:12px; }
.load-block{ display:flex; justify-content:center; padding:20px; }
.pulse{ display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.pulse-card{ background:#F8FAFB; border:1px solid var(--line); border-left:3px solid; border-radius:10px; padding:14px 16px; }
.pulse-top{ display:flex; justify-content:space-between; gap:10px; margin-bottom:6px; }
.pulse-driver{ font-size:12px; font-weight:600; color:var(--brand-d); } .pulse-impact{ font-size:11px; font-weight:700; letter-spacing:.04em; }
.pulse-head{ font-weight:600; font-size:15px; margin:0 0 4px; } .pulse-note{ color:var(--ink2); font-size:13px; line-height:1.5; margin:0; }
.scan-result{ margin-top:18px; }
.scan-head{ display:flex; align-items:center; gap:14px; margin-bottom:16px; }
.scan-id{ display:flex; flex-direction:column; gap:3px; } .scan-tkr{ font-weight:700; font-size:22px; } .scan-co{ font-size:13px; color:var(--ink2); }
.bb{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:16px 0; }
.bb-block{ border:1px solid var(--line); border-radius:11px; padding:14px; } .bb-block p{ font-size:13.5px; line-height:1.55; margin:7px 0 0; }
.bb-tag{ font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
.bull{ background:#EEF7F2; } .bull .bb-tag{ color:var(--up); } .bear{ background:#FBF0F0; } .bear .bb-tag{ color:var(--down); }
.scan-note{ font-size:13px; color:var(--ink2); line-height:1.55; margin:0; padding-top:12px; border-top:1px solid var(--line); }

.empty{ background:#F8FAFB; border:1px dashed #D4DCE4; border-radius:11px; padding:20px; text-align:center; color:var(--ink2); font-size:14px; line-height:1.55; margin-top:14px; }
.empty-warn{ background:#FBF0F0; border-color:#E9C4C4; color:#B23838; }
.loading{ display:inline-flex; align-items:center; gap:7px; font-weight:600; }
.ld{ width:6px; height:6px; border-radius:50%; background:currentColor; display:inline-block; animation:blink 1.2s infinite; } .ld:nth-child(2){ animation-delay:.2s; } .ld:nth-child(3){ animation-delay:.4s; }

.foot{ margin-top:40px; border-top:1px solid var(--line); background:#fff; }
.foot-inner{ max-width:1120px; margin:0 auto; padding:26px 22px 34px; }
.foot-brand{ color:var(--ink); font-size:18px; margin-bottom:8px; } .foot-brand .brand-thin{ color:var(--brand); }
.foot p{ color:var(--ink2); font-size:12.5px; line-height:1.6; margin:0; max-width:72ch; }

/* universe */
.uni-import{ margin-bottom:18px; }
.uni-help{ font-size:13px; color:var(--ink2); line-height:1.55; margin:6px 0 12px; }
.uni-help code{ background:#F2F4F7; padding:2px 6px; border-radius:5px; font-size:12px; }
.uni-groups{ display:flex; flex-direction:column; gap:22px; }
.uni-gtitle{ font-size:13px; font-weight:700; margin:0 0 10px; display:flex; align-items:center; gap:9px; }
.uni-count{ font-size:11px; font-weight:600; color:var(--ink2); background:#F2F4F7; padding:2px 8px; border-radius:999px; }
.uni-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.uni-chip{ display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; padding:6px 11px; border:1px solid var(--line); border-radius:999px; background:#fff; color:var(--ink); }
.uni-cdot{ width:7px; height:7px; border-radius:50%; }
.uni-ranked{ display:flex; flex-direction:column; gap:6px; }
.uni-row{ display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
.uni-rank{ width:26px; text-align:right; font-weight:700; color:var(--ink2); font-size:13px; }
.uni-tkr{ font-weight:700; font-size:15px; min-width:62px; }
.uni-setup{ font-size:12px; color:var(--ink2); flex:1; }
.uni-price{ font-size:13px; font-weight:600; min-width:60px; text-align:right; }
.uni-score{ font-size:13px; font-weight:700; min-width:42px; text-align:right; }
.uni-log{ width:28px; height:28px; border:1px solid var(--line); background:#fff; color:var(--brand); border-radius:7px; font-size:16px; line-height:1; }
.uni-log:hover{ border-color:var(--brand); background:#EEF7F2; }
@media (max-width:480px){ .uni-setup{ display:none; } }

@keyframes fade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes slidein{ from{ transform:translateX(20px); opacity:.6; } to{ transform:none; opacity:1; } }
@keyframes blink{ 0%,100%{ opacity:.3; } 50%{ opacity:1; } }
@media (prefers-reduced-motion: reduce){ .app *{ animation:none !important; transition:none !important; } }
@media (min-width:721px){ .burger{ display:none; } }
@media (max-width:720px){ .nav-tabs{ display:none; } .burger{ display:flex; } .hero-inner{ padding:40px 20px 44px; } .bb{ grid-template-columns:1fr; } .result-hero{ width:100%; } .page-head{ padding:26px 0 18px; } }
@media (max-width:420px){ .heat-name{ flex-basis:120px; } .tl-fields{ grid-template-columns:1fr; } }

/* ================= redesign layer — native app shell ================= */
.app{ background:var(--bg); min-height:100dvh; }
.app *{ -webkit-tap-highlight-color:transparent; }
.ic{ width:22px; height:22px; display:block; }

/* app bar */
.appbar{ position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between; gap:12px;
  background:linear-gradient(158deg,#16233A 0%,#0F1726 62%); border-bottom:1px solid rgba(255,255,255,.06);
  padding:calc(env(safe-area-inset-top) + 12px) 16px 12px; box-shadow:0 2px 16px rgba(11,14,20,.16); }
.appbar .brand{ gap:9px; }
.appbar-right{ display:flex; align-items:center; gap:9px; }

/* stocks / crypto toggle bar */
.assetbar{ display:flex; justify-content:center; align-items:center; gap:10px; flex-wrap:wrap; background:var(--surface); border-bottom:1px solid var(--line); padding:10px 16px; }
.seg2{ display:inline-flex; background:#EDF0F4; border-radius:12px; padding:3px; gap:3px; }
.seg2-btn{ border:none; background:none; font-family:var(--body); font-size:13.5px; font-weight:600; color:var(--ink2); padding:7px 26px; border-radius:9px; transition:.15s; }
.seg2-btn:active{ transform:scale(.97); }
.seg2-on{ background:#fff; color:var(--brand-d); box-shadow:0 1px 3px rgba(19,26,38,.13); }

/* live status pill */
.live{ display:inline-flex; align-items:center; gap:7px; border:1px solid transparent; padding:6px 10px; border-radius:22px; background:rgba(255,255,255,.06); font-family:inherit; transition:.15s; }
.live:active{ transform:scale(.97); }
.live-dot{ width:7px; height:7px; border-radius:50%; background:#8A94A2; flex:0 0 auto; }
.live-txt{ font-size:12px; font-weight:600; letter-spacing:.01em; }
.live-ref{ display:inline-flex; align-items:center; margin-left:1px; opacity:.85; }
.live-ref .ic{ width:15px; height:15px; }
.live-live{ background:rgba(31,179,125,.14); border-color:rgba(31,179,125,.32); }
.live-live .live-dot{ background:#1FB37D; animation:livepulse 1.7s ease-in-out infinite; }
.live-live .live-txt,.live-live .live-ref{ color:#8FE9C9; }
.live-load .live-dot{ background:#5FD3A6; animation:livepulse .95s ease-in-out infinite; }
.live-load .live-txt,.live-load .live-ref,.live-snap .live-ref{ color:#AEB8C4; }
.live-snap .live-dot{ background:#C99A3A; }
.live-snap .live-txt{ color:#D2AC63; }
.live-static{ pointer-events:none; }
@keyframes livepulse{ 0%,100%{ opacity:.4; transform:scale(.8); } 50%{ opacity:1; transform:scale(1); } }

/* menu (more) button + slide-out additions */
.iconbtn{ display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.07); border:none; }
.iconbtn .ic{ color:#CBD3DD; width:19px; height:19px; }
.refresh-btn:active{ transform:scale(.92); }
.refresh-btn.spinning .ic{ animation:spin .8s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
.appbar .burger{ display:flex !important; flex-direction:column; gap:3.5px; align-items:center; }
.appbar .burger span{ width:16px; height:1.8px; background:#CBD3DD; border-radius:2px; }
.menu-reg{ display:flex; gap:8px; flex-wrap:wrap; padding:16px 20px 4px; }
.menu-reg .live{ background:#F1F3F6; border-color:#E4E8EE; }
.menu-reg .live-live{ background:#E7F4EE; border-color:#BEE4D3; } .menu-reg .live-live .live-txt{ color:#0A5C42; }
.menu-reg .live-snap{ background:#F7F0E2; } .menu-reg .live-snap .live-txt{ color:#8A6420; }
.menu-note{ margin:auto 20px 22px; color:var(--ink2); font-size:11.5px; line-height:1.55; }
.menu-panel{ display:flex; flex-direction:column; }

/* content + bottom tab bar */
.main{ min-height:58vh; padding-bottom:calc(env(safe-area-inset-bottom) + 86px); }
.wrap{ padding:20px 16px 8px; }
.page-head{ padding:22px 0 16px; }
.page-title{ font-size:28px; }
.tabbar{ position:fixed; left:0; right:0; bottom:0; z-index:50; display:flex;
  background:rgba(15,23,38,.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  border-top:1px solid rgba(255,255,255,.07); padding:9px 6px calc(env(safe-area-inset-bottom) + 9px); }
.tabbtn{ flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none; color:#8A94A2; padding:2px 0; transition:color .15s; }
.tabbtn .ic{ width:23px; height:23px; }
.tabbtn-l{ font-size:11px; font-weight:600; letter-spacing:.01em; }
.tabbtn-on{ color:#1FB37D; }
.tabbtn:active{ transform:scale(.93); }

/* premium cards + hero */
.card{ border-radius:16px; border-color:#E7EBF1; box-shadow:0 1px 2px rgba(19,26,38,.04), 0 12px 26px -14px rgba(19,26,38,.16); }
.hero{ border-radius:0; }
.hero-inner{ padding:32px 18px 40px; }
.hero-title{ font-size:clamp(27px,7vw,40px); }
.hero-live{ color:#8FE9C9; font-weight:600; }

/* signals card */
.sig-card{ padding:16px; }
.sig-top{ display:flex; align-items:center; gap:9px; margin-bottom:3px; }
.sig-tkr{ font-family:var(--disp); font-weight:700; font-size:19px; letter-spacing:-.01em; }
.sig-co{ font-size:12.5px; color:var(--ink2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sig-gem{ margin-left:auto; display:inline-flex; align-items:baseline; gap:1px; background:#F1F7F4; border-radius:9px; padding:5px 9px; flex:0 0 auto; }
.sig-gem b{ font-size:16px; font-weight:700; } .sig-gem span{ font-size:11px; color:#7FA595; }
.sig-theme{ display:inline-block; font-size:11.5px; color:var(--ink2); margin-bottom:13px; }
.sig-levels{ display:flex; gap:16px; margin:0 0 12px; flex-wrap:wrap; }
.sig-lev{ display:flex; flex-direction:column; gap:2px; }
.sig-lk{ font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:#8A94A2; }
.sig-lv{ font-size:16.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.sig-livedot{ width:6px; height:6px; border-radius:50%; background:#1FB37D; animation:livepulse 1.7s ease-in-out infinite; }
.risk{ position:relative; height:5px; border-radius:3px; background:#EEF1F5; margin:0 0 14px; }
.risk-band{ position:absolute; top:0; bottom:0; background:#B7E3D2; border-radius:3px; }
.risk-stop{ position:absolute; left:0; top:-1.5px; width:3px; height:8px; border-radius:2px; background:var(--down); }
.risk-now{ position:absolute; top:-2px; width:9px; height:9px; margin-left:-4.5px; border-radius:50%; background:var(--ink); border:2px solid #fff; }
.sig-reason{ font-size:13px; line-height:1.5; color:var(--ink2); margin:0 0 14px; }

/* universe live line */
.uni-live{ display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:var(--brand-d); margin:2px 0 12px; }
.uni-live .live-dot{ background:#1FB37D; animation:livepulse 1.7s ease-in-out infinite; }
.uni-tkr{ font-family:var(--disp); }
.uni-row{ border-radius:12px; }

/* about / how it works */
.about h3.about-h{ font-family:var(--disp); font-weight:600; font-size:16px; letter-spacing:-.01em; margin:18px 0 6px; }
.about h3.about-h:first-child{ margin-top:0; }
.about p{ font-size:13.5px; line-height:1.6; color:var(--ink2); margin:0; }
.about .about-list{ margin:4px 0 0; padding-left:18px; }
.about .about-list li{ font-size:13.5px; line-height:1.6; color:var(--ink2); margin-bottom:5px; }
.about .about-list b, .about p b{ color:var(--ink); font-weight:600; }
.about .btn-block{ margin-top:20px; }

/* tap affordances */
.sig-tap, .uni-row-tap{ cursor:pointer; -webkit-user-select:none; user-select:none; transition:.12s; }
.sig-tap:active, .uni-row-tap:active{ transform:scale(.994); background:#FBFCFD; }

/* market risk gauge */
.gauge{ margin-bottom:16px; }
.gauge-top{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:12px; }
.gauge-k{ font-family:var(--disp); font-weight:600; font-size:16px; }
.gauge-label{ font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; }
.gauge-track{ position:relative; height:8px; border-radius:5px; background:linear-gradient(90deg,#E5A6A6 0%,#E8CE93 35%,#9CD9BF 60%,#E8CE93 90%,#E5A6A6 100%); }
.gauge-fill{ display:none; }
.gauge-marker{ position:absolute; top:-3px; width:14px; height:14px; margin-left:-7px; border-radius:50%; background:var(--ink); border:3px solid #fff; box-shadow:0 1px 4px rgba(19,26,38,.3); }
.gauge-scale{ display:flex; justify-content:space-between; margin-top:7px; font-size:10.5px; font-weight:600; color:var(--ink2); text-transform:uppercase; letter-spacing:.03em; }
.gauge-note{ font-size:12px; color:var(--ink2); margin:9px 0 0; }

/* per-stock risk meter */
.riskm-top{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px; }
.riskm-k{ font-size:12.5px; font-weight:600; color:var(--ink2); }
.riskm-v{ font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; }
.riskm-track{ height:8px; border-radius:5px; background:#EEF1F5; overflow:hidden; }
.riskm-fill{ display:block; height:100%; border-radius:5px; transition:width .3s; }

/* detail view (Robinhood/Coinbase-style) */
.detail{ position:fixed; inset:0; z-index:80; background:var(--bg); overflow-y:auto; -webkit-overflow-scrolling:touch; animation:fade .16s; touch-action:pan-y; will-change:transform; }
.detail-bar{ position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:12px; background:linear-gradient(158deg,#16233A,#0F1726); padding:calc(env(safe-area-inset-top) + 12px) 16px 12px; }
.detail-back{ width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.1); border:none; color:#fff; font-size:19px; line-height:1; flex:0 0 auto; }
.detail-id{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.detail-tkr{ font-family:var(--disp); font-weight:700; font-size:18px; color:#fff; letter-spacing:-.01em; }
.detail-name{ font-size:12.5px; color:#AEB8C4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.detail-body{ padding-bottom:calc(env(safe-area-inset-bottom) + 40px); }
.detail-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin:6px 0 16px; }
.detail-price{ display:flex; flex-direction:column; gap:3px; }
.detail-p{ font-family:var(--disp); font-weight:700; font-size:34px; letter-spacing:-.02em; line-height:1; }
.detail-chg{ font-size:14px; font-weight:600; }
.detail-chart{ padding:10px 6px; margin-bottom:16px; }
.spark-svg{ width:100%; height:90px; display:block; }
.spark-empty{ height:90px; display:flex; align-items:center; justify-content:center; color:var(--ink2); font-size:13px; }
.detail-range{ margin-bottom:18px; }
.detail-range-lab{ display:flex; justify-content:space-between; font-size:12px; color:var(--ink2); font-weight:500; margin-bottom:7px; font-variant-numeric:tabular-nums; }
.rng{ position:relative; height:6px; border-radius:4px; background:#EEF1F5; }
.rng-fill{ position:absolute; left:0; top:0; bottom:0; border-radius:4px; background:linear-gradient(90deg,#BEE4D3,#0E7A57); }
.rng-dot{ position:absolute; top:-3px; width:12px; height:12px; margin-left:-6px; border-radius:50%; background:var(--ink); border:2px solid #fff; box-shadow:0 1px 3px rgba(19,26,38,.3); }
.detail-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:16px 0; }
.detail-why{ margin-top:4px; }
.detail-why-k{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--brand); }
.detail-why p{ font-size:14px; line-height:1.55; color:var(--ink); margin:6px 0 0; }
.detail-about{ margin-top:4px; }
.detail-about-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.detail-tags{ display:flex; gap:6px; flex-wrap:wrap; }
.detail-tag{ font-size:11px; font-weight:600; color:var(--ink2); background:var(--wash,#F1EFEA); border:1px solid var(--line,#E6E2D9); border-radius:999px; padding:3px 9px; white-space:nowrap; }
.detail-about-body{ font-size:14px; line-height:1.62; color:var(--ink); margin:9px 0 0; }
@media (max-width:400px){ .detail-stats{ grid-template-columns:repeat(2,1fr); } }
`;
