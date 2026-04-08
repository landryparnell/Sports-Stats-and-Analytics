import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from "recharts";
import "./dashboard.css";

// ─── Constants ─────────────────────────────────────────────────────────────────
const ALL_TEAMS = [
  { abbr: "ARI", name: "Arizona Cardinals",       conf: "NFC" },
  { abbr: "ATL", name: "Atlanta Falcons",          conf: "NFC" },
  { abbr: "BAL", name: "Baltimore Ravens",         conf: "AFC" },
  { abbr: "BUF", name: "Buffalo Bills",            conf: "AFC" },
  { abbr: "CAR", name: "Carolina Panthers",        conf: "NFC" },
  { abbr: "CHI", name: "Chicago Bears",            conf: "NFC" },
  { abbr: "CIN", name: "Cincinnati Bengals",       conf: "AFC" },
  { abbr: "CLE", name: "Cleveland Browns",         conf: "AFC" },
  { abbr: "DAL", name: "Dallas Cowboys",           conf: "NFC" },
  { abbr: "DEN", name: "Denver Broncos",           conf: "AFC" },
  { abbr: "DET", name: "Detroit Lions",            conf: "NFC" },
  { abbr: "GB",  name: "Green Bay Packers",        conf: "NFC" },
  { abbr: "HOU", name: "Houston Texans",           conf: "AFC" },
  { abbr: "IND", name: "Indianapolis Colts",       conf: "AFC" },
  { abbr: "JAX", name: "Jacksonville Jaguars",     conf: "AFC" },
  { abbr: "KC",  name: "Kansas City Chiefs",       conf: "AFC" },
  { abbr: "LAC", name: "LA Chargers",              conf: "AFC" },
  { abbr: "LA", name: "LA Rams",                  conf: "NFC" },
  { abbr: "LV", name: "Las Vegas Raiders",        conf: "AFC" },
  { abbr: "MIA", name: "Miami Dolphins",           conf: "AFC" },
  { abbr: "MIN", name: "Minnesota Vikings",        conf: "NFC" },
  { abbr: "NE",  name: "New England Patriots",     conf: "AFC" },
  { abbr: "NO",  name: "New Orleans Saints",       conf: "NFC" },
  { abbr: "NYG", name: "New York Giants",          conf: "NFC" },
  { abbr: "NYJ", name: "New York Jets",            conf: "AFC" },
  { abbr: "PHI", name: "Philadelphia Eagles",      conf: "NFC" },
  { abbr: "PIT", name: "Pittsburgh Steelers",      conf: "AFC" },
  { abbr: "SEA", name: "Seattle Seahawks",         conf: "NFC" },
  { abbr: "SF",  name: "San Francisco 49ers",      conf: "NFC" },
  { abbr: "TB",  name: "Tampa Bay Buccaneers",     conf: "NFC" },
  { abbr: "TEN", name: "Tennessee Titans",         conf: "AFC" },
  { abbr: "WAS", name: "Washington Commanders",    conf: "NFC" },
];

const TEAM_MAP = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t.name]));

// Expanded position list matching Player_Risk_Score_Model.py
const POSITIONS = ["QB", "WR", "RB", "TE", "S", "OL", "DL", "CB", "LB"];

// Offense vs Defense grouping
const OFF_POS = ["QB", "WR", "RB", "TE", "OL"];
const DEF_POS = ["DL", "LB", "CB", "S"];

const HIGH_RISK = 0.68;
const MED_RISK  = 0.42;

// ─── Player Risk Score Model constants (from Player_Risk_Score_Model.py) ──────
const POSITION_FACTORS = {
  QB: 0.5, WR: 1.2, RB: 2.0, TE: 1.8,
  S: 1.6, OL: 1.4, DL: 1.6, CB: 1.4,
  DB: 1.4, LB: 1.8,
};

const MULTIPLIERS = {
  QB: { run: 1.82, pass: 1.45 },
  RB: { run: 1.65, pass: 0.85 },
  WR: { run: 0.60, pass: 1.55 },
  TE: { run: 0.90, pass: 1.35 },
  OL: { run: 1.10, pass: 1.05 },
  DL: { run: 1.70, pass: 1.20 },
  LB: { run: 1.55, pass: 1.10 },
  CB: { run: 0.70, pass: 1.60 },
  DB: { run: 0.75, pass: 1.55 },
  S: { run: 0.90, pass: 1.45 },
};
const TEAM_DEFENSE_RANKINGS = {
  ARI: { rush: 25, pass: 24 }, ATL: { rush: 24, pass: 13 },
  BAL: { rush: 10, pass: 30 }, BUF: { rush: 28, pass:  1 },
  CAR: { rush: 20, pass: 15 }, CHI: { rush: 27, pass: 22 },
  CIN: { rush: 32, pass: 26 }, CLE: { rush: 16, pass:  3 },
  DAL: { rush: 23, pass: 32 }, DEN: { rush:  2, pass:  7 },
  DET: { rush: 14, pass: 20 }, GB:  { rush: 18, pass: 11 },
  HOU: { rush:  4, pass:  6 }, IND: { rush:  7, pass: 30 },
  JAX: { rush:  1, pass: 21 }, KC:  { rush:  9, pass: 12 },
  LAC: { rush:  8, pass:  5 }, LA:  { rush: 12, pass: 19 },
  LV:  { rush: 17, pass: 14 }, MIA: { rush: 26, pass: 18 },
  MIN: { rush: 21, pass:  2 }, NE:  { rush:  6, pass:  9 },
  NO:  { rush: 19, pass:  4 }, NYG: { rush: 31, pass: 16 },
  NYJ: { rush: 29, pass: 17 }, PHI: { rush: 22, pass:  8 },
  PIT: { rush: 13, pass: 29 }, SEA: { rush:  3, pass: 10 },
  SF:  { rush: 11, pass: 25 }, TB:  { rush:  5, pass: 27 },
  TEN: { rush: 15, pass: 23 }, WAS: { rush: 30, pass: 28 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rc = r => r >= HIGH_RISK ? "#ef4444" : r >= MED_RISK ? "#f59e0b" : "#22c55e";

function calcOppFactor(rank) { return (33 - rank) / 16; }

/**
 * Re-score plays through the Player Risk Score Model lens.
 * Formula: (positionFactor × playTypeMultiplier × opponentFactor) + situationalModifiers
 *   where situationalModifiers = fatigueMod(week) + weatherMod(temp, wind)
 *
 * Per-play defteam is used when available from risk_engine.py.
 * Normalization uses the highest plausible raw score:
 *   (RB=2.0 × run=1.65 × best_opp=2.0) + (Q4=2.0 + Wet/Cold=1.75) = 10.35
 */
const PRM_MAX = 10.35;

function applyPlayerRiskModel(plays, pos) {
  const posFactor = POSITION_FACTORS[pos] ?? 1.0;
  const fatigueMod = w => w <= 4 ? 0.5 : w <= 9 ? 1.0 : w <= 13 ? 1.5 : 2.0;
  const weatherMod = p => (p.temp < 40 || p.wind > 15) ? 1.75 : 1.25;

  let cum = 0;
  return plays.map(p => {
    const ptFact = MULTIPLIERS[pos]?.[p.playType] ?? 1.0;
    const sitMod = fatigueMod(p.week) + weatherMod(p);

    const defteam = (p.defteam || "").toUpperCase();
    const defRanks = TEAM_DEFENSE_RANKINGS[defteam];
    const oppRank = defRanks ? (p.playType === "run" ? defRanks.rush : defRanks.pass) : null;
    const oppFactor = oppRank != null ? calcOppFactor(oppRank) : 1.0;

    const raw = (posFactor * ptFact * oppFactor) + sitMod;
    const norm = Math.min(Math.max(raw / PRM_MAX, 0), 1);
    cum += norm;
    return {
      ...p,
      risk: parseFloat(norm.toFixed(4)),
      cumRisk: parseFloat(cum.toFixed(2)),
      isHigh: norm >= HIGH_RISK,
      cls: norm >= HIGH_RISK ? "HIGH" : norm >= MED_RISK ? "MEDIUM" : "LOW",
    };
  });
}

// ─── Small components ──────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, colorClass }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${colorClass || "c-white"}`}>{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

const Badge = ({ cls }) => (
  <span className={`badge badge-${cls}`}>{cls}</span>
);

// ─── Model Toggle ─────────────────────────────────────────────────────────────
const ModelToggle = ({ model, onChange }) => (
  <div className="model-toggle-wrap">
    <span className="model-toggle-label">MODEL</span>
    <div className="model-toggle">
      <button
        className={`model-btn ${model === "risk_engine" ? "active" : ""}`}
        onClick={() => onChange("risk_engine")}
        title="risk_engine.py — play-level feature scoring"
      >
        Risk Engine
      </button>
      <button
        className={`model-btn ${model === "player_risk" ? "active" : ""}`}
        onClick={() => onChange("player_risk")}
        title="Player_Risk_Score_Model.py — position × play-type × opponent"
      >
        Player Risk Score
      </button>
    </div>
    <span className="model-source">
      {model === "risk_engine"
        ? "risk_engine.py"
        : "Player_Risk_Score_Model.py"}
    </span>
  </div>
);

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const PlayTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tt">
      <div className="tt-title">Play #{d.idx} · Week {d.week}</div>
      <div className="tt-row">Type: <span className="tt-val" style={{ textTransform:"capitalize" }}>{d.playType}</span></div>
      <div className="tt-row">Down &amp; Distance: <span className="tt-val">{d.down}&amp;{d.ydstogo}</span></div>
      <div className="tt-row">Yds Gained: <span className="tt-val">{d.yardsGained}</span></div>
      <div className="tt-row">Risk Score: <span className="tt-val" style={{ color: rc(d.risk) }}>{(d.risk*100).toFixed(1)}%</span></div>
      <div className="tt-row">Cumulative: <span className="tt-val" style={{ color:"#a78bfa" }}>{d.cumRisk.toFixed(1)}</span></div>
      {d.sack    && <div className="tt-injury">🏈 SACK</div>}
      {d.qbHit   && <div className="tt-injury">💥 QB HIT</div>}
      {d.fumble  && <div className="tt-injury">⚠ FUMBLE</div>}
      {d.isInjuryPlay && <div className="tt-injury">🚑 INJURY IN DESC</div>}
    </div>
  );
};

const CumTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tt">
      <div className="tt-title">Play #{d.idx} · Week {d.week}</div>
      <div className="tt-row">Cumulative Risk: <span className="tt-val" style={{ color:"#a78bfa" }}>{d.cumRisk.toFixed(1)}</span></div>
      <div className="tt-row">This Play: <span className="tt-val" style={{ color: rc(d.risk) }}>{(d.risk*100).toFixed(1)}%</span></div>
      {d.isInjuryPlay && <div className="tt-injury">🚑 INJURY EVENT</div>}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [team,    setTeam]    = useState("KC");
  const [oppTeam, setOppTeam] = useState("WAS");  // opponent for Player Risk Model
  const [pos,     setPos]     = useState("QB");
  const [week,    setWeek]    = useState(null);
  const [tab,     setTab]     = useState("cumulative");
  const [model,   setModel]   = useState("risk_engine"); // "risk_engine" | "player_risk"
  const [dropOpen, setDropOpen] = useState(false);

  // ── Fetch JSON on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/nflData.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — run: python generate_data.py`);
        return r.json();
      })
      .then(setData)
      .catch(e => setLoadErr(e.message));
  }, []);

  useEffect(() => { setWeek(null); }, [team, pos]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const handler = () => setDropOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dropOpen]);

  // All hooks must come before early returns
  const teamData      = data ? data[team] : null;
  const teamAvailable = !!teamData;
  const rawPlays      = teamAvailable ? (teamData[pos] || []) : [];

  const plays = useMemo(() => {
    if (model === "player_risk") return applyPlayerRiskModel(rawPlays, pos);
    return rawPlays;
  }, [rawPlays, model, pos]);

  const playsRiskEngine = useMemo(() => rawPlays, [rawPlays]);
  const playsPlayerRisk = useMemo(() => applyPlayerRiskModel(rawPlays, pos), [rawPlays, pos]);

  const overlaySample = useMemo(() => {
    const step = Math.max(1, Math.floor(playsRiskEngine.length / 200));
    return playsRiskEngine
      .filter((_,i) => i % step === 0)
      .map((p, i) => {
        const prm = playsPlayerRisk[i * step];
        return {
          idx:     p.idx,
          week:    p.week,
          reRisk:  p.risk,
          reCum:   p.cumRisk,
          prmRisk: prm ? prm.risk    : null,
          prmCum:  prm ? prm.cumRisk : null,
        };
      });
  }, [playsRiskEngine, playsPlayerRisk]);

  const weeklyBoth = useMemo(() => {
    const allW = [...new Set(playsRiskEngine.map(p => p.week))].sort((a,b) => a - b);
    return allW.map(w => {
      const re  = playsRiskEngine.filter(p => p.week === w);
      const prm = playsPlayerRisk.filter(p => p.week === w);
      return {
        week:   w,
        reAvg:  re.length  ? re.reduce((a,b)  => a + b.risk, 0) / re.length  : 0,
        prmAvg: prm.length ? prm.reduce((a,b) => a + b.risk, 0) / prm.length : 0,
      };
    });
  }, [playsRiskEngine, playsPlayerRisk]);

  // Early returns AFTER all hooks
  if (loadErr) return (
    <div className="load-error">
      <h2>Could not load nflData.json</h2>
      <p>{loadErr}</p>
      <pre>python generate_data.py</pre>
      <p>Then restart the dev server.</p>
    </div>
  );
  if (!data) return <div className="load-spinner"><span className="spinner" />Loading data…</div>;


  // ── Derived stats ──────────────────────────────────────────────────────────
  const filtered = week ? plays.filter(p => p.week === week) : plays;
  const total    = filtered.length;
  const highCnt  = filtered.filter(p => p.isHigh).length;
  const injCnt   = filtered.filter(p => p.isInjuryPlay).length;
  const sackCnt  = filtered.filter(p => p.sack).length;
  const avgRisk  = total ? filtered.reduce((a,b) => a + b.risk, 0) / total : 0;
  const peakRisk = total ? Math.max(...filtered.map(p => p.risk)) : 0;
  const cumFinal = plays.length ? plays[plays.length-1].cumRisk : 0;

  // ── Injury-history sub thresholds ─────────────────────────────────────────
  // For each model, find all plays where isInjuryPlay===true and record cumRisk at
  // that moment. Average those per team+position. Fall back to league-wide
  // average for that position if team sample < MIN_INJ_SAMPLE.
  const MIN_INJ_SAMPLE = 3;

  function calcInjuryThreshold(allData, targetTeam, targetPos, modelPlaysGetter) {
    // Collect injury cumRisk values for the target team+pos
    const teamPlays   = allData[targetTeam]?.[targetPos] ?? [];
    const modelPlays  = modelPlaysGetter(teamPlays, targetPos);
    const teamInjCums = modelPlays.filter(p => p.isInjuryPlay).map(p => p.cumRisk);

    if (teamInjCums.length >= MIN_INJ_SAMPLE) {
      return {
        value:  teamInjCums.reduce((a, b) => a + b, 0) / teamInjCums.length,
        source: "team",
        n:      teamInjCums.length,
      };
    }

    // Fallback: league-wide average for this position across all available teams
    const leagueInjCums = Object.entries(allData).flatMap(([t, posMap]) => {
      if (t === targetTeam) return []; // exclude current team to keep it pure
      const mp = modelPlaysGetter(posMap[targetPos] ?? [], targetPos);
      return mp.filter(p => p.isInjuryPlay).map(p => p.cumRisk);
    });

    if (leagueInjCums.length === 0) return { value: null, source: "none", n: 0 };

    return {
      value:  leagueInjCums.reduce((a, b) => a + b, 0) / leagueInjCums.length,
      source: "league",
      n:      leagueInjCums.length,
    };
  }

  // Risk Engine: raw plays straight from data (no transformation)
  const reGetter  = (rawP) => rawP;
  // Player Risk Score: run through the model formula
  const prmGetter = (rawP, p) => applyPlayerRiskModel(rawP, p);

  const subRE  = calcInjuryThreshold(data, team, pos, reGetter);
  const subPRM = calcInjuryThreshold(data, team, pos, prmGetter);

  const subThreshRE  = subRE.value;
  const subThreshPRM = subPRM.value;
  const subThresh    = model === "player_risk" ? subThreshPRM : subThreshRE;

  const allWeeks = [...new Set(plays.map(p => p.week))].sort((a,b)=>a-b);
  const weekly = allWeeks.map(w => {
    const wp = plays.filter(p => p.week === w);
    return {
      week: w,
      avg:  wp.reduce((a,b) => a + b.risk, 0) / wp.length,
      high: wp.filter(p => p.isHigh).length,
      inj:  wp.filter(p => p.isInjuryPlay).length,
      sacks:wp.filter(p => p.sack).length,
    };
  });

  const cumSample = plays.filter((_,i) => i % 3 === 0);
  const barSample = plays.filter((_,i) => i % 3 === 0).slice(0, 250);

  const teamInfo  = ALL_TEAMS.find(t => t.abbr === team);
  const isDefPos  = DEF_POS.includes(pos);

  // ── Themes ─────────────────────────────────────────────────────────────────
  const NFL_THEMES = {
    BUF: { primary: '#00338D', secondary: '#C60C30', bg: '#000F2E', glow: '#00338D55' },
    MIA: { primary: '#008E97', secondary: '#FC4C02', bg: '#003040', glow: '#008E9755' },
    NE:  { primary: '#002244', secondary: '#C60C30', bg: '#000D1A', glow: '#00224455' },
    NYJ: { primary: '#125740', secondary: '#FFFFFF', bg: '#061F17', glow: '#12574055' },
    BAL: { primary: '#241773', secondary: '#9E7C0C', bg: '#0D0827', glow: '#24177355' },
    CLE: { primary: '#FF3C00', secondary: '#FF7C1A', bg: '#1A0C00', glow: '#FF3C0055' },
    PIT: { primary: '#FFB612', secondary: '#101820', bg: '#060C12', glow: '#FFB61255' },
    CIN: { primary: '#000000', secondary: '#FB4F14', bg: '#1A0A00', glow: '#FB4F1455' },
    HOU: { primary: '#A71930', secondary: '#006497', bg: '#1A0008', glow: '#A7193055' },
    IND: { primary: '#002C5F', secondary: '#A2AAAD', bg: '#001020', glow: '#002C5F55' },
    JAX: { primary: '#006778', secondary: '#D4B97A', bg: '#001F25', glow: '#00677855' },
    TEN: { primary: '#0C2340', secondary: '#4B92DB', bg: '#05101C', glow: '#4B92DB55' },
    DEN: { primary: '#FB4F14', secondary: '#002244', bg: '#1A0A00', glow: '#FB4F1455' },
    KC:  { primary: '#E31837', secondary: '#FFB81C', bg: '#1A0009', glow: '#E3183755' },
    LV:  { primary: '#A5ACAF', secondary: '#C8CDD0', bg: '#060606', glow: '#A5ACAF55' },
    LAC: { primary: '#0080C6', secondary: '#FFC20E', bg: '#00253B', glow: '#0080C655' },
    DAL: { primary: '#003594', secondary: '#869397', bg: '#000E2B', glow: '#00359455' },
    NYG: { primary: '#0B2265', secondary: '#A71930', bg: '#050D27', glow: '#0B226555' },
    PHI: { primary: '#004C54', secondary: '#A5ACAF', bg: '#001B1E', glow: '#004C5455' },
    WAS: { primary: '#5A1414', secondary: '#FFB612', bg: '#1E0606', glow: '#5A141455' },
    CHI: { primary: '#C83803', secondary: '#235ac0', bg: '#1A0800', glow: '#C8380355' },
    DET: { primary: '#0076B6', secondary: '#B0B7BC', bg: '#00253B', glow: '#0076B655' },
    GB:  { primary: '#203731', secondary: '#FFB612', bg: '#0C1712', glow: '#20373155' },
    MIN: { primary: '#4F2683', secondary: '#FFC62F', bg: '#1A0D2E', glow: '#4F268355' },
    ATL: { primary: '#A71930', secondary: '#000000', bg: '#1A0008', glow: '#A7193055' },
    CAR: { primary: '#0085CA', secondary: '#101820', bg: '#002840', glow: '#0085CA55' },
    NO:  { primary: '#D3BC8D', secondary: '#004890', bg: '#0A0806', glow: '#D3BC8D55' },
    TB:  { primary: '#D50A0A', secondary: '#34302B', bg: '#1A0000', glow: '#D50A0A55' },
    ARI: { primary: '#97233F', secondary: '#FFB612', bg: '#1A0009', glow: '#97233F55' },
    LA: { primary: '#003594', secondary: '#FFA300', bg: '#000E2B', glow: '#00359455' },
    SF:  { primary: '#AA0000', secondary: '#B3995D', bg: '#1A0000', glow: '#AA000055' },
    SEA: { primary: '#002244', secondary: '#69BE28', bg: '#000D1A', glow: '#69BE2855' },
  };

  const DEFAULT_THEME = { primary: '#3b82f6', secondary: '#93c5fd', bg: '#060a14', glow: '#3b82f655' };
  const theme = NFL_THEMES[team] ?? DEFAULT_THEME;

  return (
    <div style={{
                '--primary':   theme.primary,
                '--secondary': theme.secondary,
                '--bg':        theme.bg,
                '--card-bg':   'rgba(255,255,255,0.05)',
                '--glow':      theme.glow,
                background:    theme.bg,
                minHeight:     '100vh',
              }}>

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-eyebrow">NFL Injury Risk · 2025 Season</div>
          <div className="header-top">
            <div>
              <h1 className="header-title">
                <span className="header-title-accent">▌</span>{" "}
                {TEAM_MAP[team] || team}
              </h1>
              <p className="header-subtitle">
                Position: <span className="header-subtitle-pos">{pos}</span>
                {" "}·{" "}
                <span style={{ color:"rgba(255,255,255,0.45)", fontSize:12 }}>
                  {isDefPos ? "Defense" : "Offense"}
                </span>
                {week && <> · <span style={{ color:"rgba(255,255,255,0.7)" }}>Week {week}</span></>}
              </p>
            </div>

            {/* Team Dropdown */}
            <div className="team-dropdown-wrap" onClick={e => e.stopPropagation()}>
              <button
                className="team-dropdown-btn"
                onClick={() => setDropOpen(o => !o)}
              >
                <span className="team-abbr">{team}</span>
                <span className="team-name-short">{TEAM_MAP[team] || team}</span>
                <span className="dropdown-arrow">{dropOpen ? "▲" : "▼"}</span>
              </button>

              {dropOpen && (
                <div className="team-dropdown-menu">
                  <div className="dropdown-group-label">AFC</div>
                  {ALL_TEAMS.filter(t => t.conf === "AFC").map(t => (
                    <button
                      key={t.abbr}
                      className={`dropdown-item ${team === t.abbr ? "active" : ""} ${!data[t.abbr] ? "unavailable" : ""}`}
                      onClick={() => { setTeam(t.abbr); setDropOpen(false); }}
                    >
                      <span className="di-abbr">{t.abbr}</span>
                      <span className="di-name">{t.name}</span>
                      {!data[t.abbr] && <span className="di-tag">soon</span>}
                    </button>
                  ))}
                  <div className="dropdown-group-label">NFC</div>
                  {ALL_TEAMS.filter(t => t.conf === "NFC").map(t => (
                    <button
                      key={t.abbr}
                      className={`dropdown-item ${team === t.abbr ? "active" : ""} ${!data[t.abbr] ? "unavailable" : ""}`}
                      onClick={() => { setTeam(t.abbr); setDropOpen(false); }}
                    >
                      <span className="di-abbr">{t.abbr}</span>
                      <span className="di-name">{t.name}</span>
                      {!data[t.abbr] && <span className="di-tag">soon</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Position Selector — split offense / defense */}
          <div className="pos-row">
            <span className="pos-group-label">OFF</span>
            {OFF_POS.map(p => (
              <button key={p} onClick={() => setPos(p)}
                className={`pos-btn ${pos===p ? "active" : ""}`}>{p}</button>
            ))}
            <span className="pos-group-sep">|</span>
            <span className="pos-group-label">DEF</span>
            {DEF_POS.map(p => (
              <button key={p} onClick={() => setPos(p)}
                className={`pos-btn ${pos===p ? "active" : ""}`}>{p}</button>
            ))}
          </div>

          {/* Model Toggle */}
          <div className="model-row">
            <ModelToggle model={model} onChange={setModel} />
          </div>
        </div>
      </header>

      <main className="main">

        {/* No data banner */}
        {!teamAvailable && (
          <div className="no-data-banner">
            <span>⏳</span>
            <div>
              <strong>{TEAM_MAP[team]}</strong> data not yet loaded.
              <br />
              <span style={{ fontSize:11, opacity:0.6 }}>
                Add this team to your CSV and re-run <code>python generate_data.py</code>
              </span>
            </div>
          </div>
        )}

        {teamAvailable && (
          <>
            {/* Stat Cards */}
            <div className="stat-grid">
              <StatCard label="Total Plays"   value={total.toLocaleString()}          sub={week ? `Week ${week}` : "Full season"} />
              <StatCard label="High Risk"     value={highCnt}                          sub={`${total ? ((highCnt/total)*100).toFixed(1) : 0}% of plays`} colorClass="c-red" />
              <StatCard label="Avg Risk"      value={`${(avgRisk*100).toFixed(1)}%`}   sub="per play" colorClass={avgRisk>=HIGH_RISK?"c-red":avgRisk>=MED_RISK?"c-yellow":"c-green"} />
              <StatCard label="Peak Risk"     value={`${(peakRisk*100).toFixed(1)}%`}  sub="single play" colorClass="c-orange" />
              <StatCard label="Sacks"         value={sackCnt}                          sub="contact plays" colorClass="c-orange" />
              <StatCard label="Injury Plays" value={injCnt}                           sub="text-matched plays" colorClass="c-red" />
              <StatCard label="Cumulative"    value={cumFinal.toFixed(0)}              sub="season total" colorClass="c-purple" />
            </div>

            {/* Tab Bar */}
            <div className="tab-bar">
              {[["cumulative","Cumulative"],["weekly","By Week"],["table","Play Table"]].map(([id,label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`tab-btn ${tab===id?"active":""}`}>{label}</button>
              ))}
            </div>

            {/* Week Filter */}
            <div className="week-filter">
              <span className="week-label">Week:</span>
              <button onClick={() => setWeek(null)} className={`week-btn ${!week?"active":""}`}>ALL</button>
              {allWeeks.map(w => (
                <button key={w} onClick={() => setWeek(week===w?null:w)}
                  className={`week-btn ${week===w?"active":""}`}>{w}</button>
              ))}
            </div>

            {/* ── CUMULATIVE TAB ── */}
            {tab === "cumulative" && (
              <>
                {/* ── Dual-model overlay line chart ── */}
                <div className="panel">
                  <h2 className="panel-title">Model Comparison — Cumulative Risk Overlay</h2>
                  <p className="panel-sub">
                    Substitution thresholds = average cumulative risk at historical {pos} injury events for {TEAM_MAP[team]}.{" "}
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={overlaySample} margin={{ top:8, right:24, bottom:8, left:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="idx" tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }}
                        label={{ value:"Play #", position:"insideBottomRight", offset:-4, fill:"rgba(255,255,255,0.28)", fontSize:10 }} />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.6)" }}
                        label={{
                          value: "Current Cumulative Risk Score",
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle", fill: "rgba(255,255,255,0.7)" }
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="tt">
                              <div className="tt-title">Play #{d.idx} · Week {d.week}</div>
                              <div className="tt-row">Risk Engine: <span className="tt-val" style={{ color:"var(--secondary)" }}>{d.reCum?.toFixed(1)}</span></div>
                              <div className="tt-row">Player Risk: <span className="tt-val" style={{ color:"#a78bfa" }}>{d.prmCum?.toFixed(1)}</span></div>
                              <div className="tt-row">RE play risk: <span className="tt-val" style={{ color:rc(d.reRisk) }}>{(d.reRisk*100).toFixed(1)}%</span></div>
                              <div className="tt-row">PRM play risk: <span className="tt-val" style={{ color:rc(d.prmRisk??0) }}>{((d.prmRisk??0)*100).toFixed(1)}%</span></div>
                            </div>
                          );
                        }}
                      />
                      {subThreshRE != null && (
                        <ReferenceLine y={subThreshRE} stroke="#ef4444" strokeDasharray="6 4"
                          label={{ value:`Average ML Risk Score: ${subThreshRE.toFixed(1)}`, fill:"#ef4444", fontSize:9, position:"insideTopLeft" }} />
                      )}
                      {subThreshPRM != null && (
                        <ReferenceLine y={subThreshPRM} stroke="#f97316" strokeDasharray="6 4"
                          label={{ value:`Average MATH Risk Score: ${subThreshPRM.toFixed(1)}`, fill:"#f97316", fontSize:9, position:"insideTopRight" }} />
                      )}
                      <Line type="monotone" dataKey="reCum"  stroke="var(--secondary)" strokeWidth={2.5} dot={false} activeDot={{ r:4 }} name="Risk Engine" />
                      <Line type="monotone" dataKey="prmCum" stroke="#a78bfa"           strokeWidth={2}   dot={false} activeDot={{ r:4 }} strokeDasharray="6 3" name="Player Risk" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    <span><span style={{ color:"var(--secondary)" }}>—</span> Machine Learning Model</span>
                    <span><span style={{ color:"#a78bfa" }}>- -</span> Mathematical Model</span>
                    {subThreshRE  != null
                      ? <span><span style={{ color:"#ef4444" }}>- -</span> ML sub: {subThreshRE.toFixed(1)} pts ({subRE.source === "league" ? "league fallback" : "team avg"})</span>
                      : <span style={{ color:"rgba(255,255,255,0.3)" }}>ML sub: no injury data</span>}
                    {subThreshPRM != null
                      ? <span><span style={{ color:"#f97316" }}>- -</span> MATH sub: {subThreshPRM.toFixed(1)} pts ({subPRM.source === "league" ? "league fallback" : "team avg"})</span>
                      : <span style={{ color:"rgba(255,255,255,0.3)" }}>MATH sub: no injury data</span>}
                  </div>
                </div>

                {/* ── Side-by-side: per-play risk bars ── */}
                <div className="side-by-side">
                  <div className="panel side-panel">
                    <h2 className="panel-title">Per-Play Risk — Risk Engine</h2>
                    <p className="panel-sub">Feature-weighted scoring (sacks, down/dist, field position…)</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={playsRiskEngine.filter((_,i)=>i%3===0).slice(0,250)} margin={{ top:4, right:16, bottom:4, left:0 }}>
                        <XAxis dataKey="idx" hide />
                        <YAxis domain={[0,1]} tickFormatter={v=>`${(v*100).toFixed(0)}%`}
                          tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} width={36} />
                        <Tooltip content={<PlayTooltip />} />
                        <ReferenceLine y={HIGH_RISK} stroke="#ef4444" strokeDasharray="3 3"
                          label={{ value:"High", fill:"#ef4444", fontSize:9, position:"insideTopRight" }} />
                        <ReferenceLine y={MED_RISK} stroke="#f59e0b" strokeDasharray="3 3"
                          label={{ value:"Med", fill:"#f59e0b", fontSize:9, position:"insideTopRight" }} />
                        <Bar dataKey="risk" radius={[2,2,0,0]}>
                          {playsRiskEngine.filter((_,i)=>i%3===0).slice(0,250).map((e,i) => <Cell key={i} fill={rc(e.risk)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="panel side-panel">
                    <h2 className="panel-title">Per-Play Risk — Player Risk Score</h2>
                    <p className="panel-sub">Position × play-type × opponent formula</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={playsPlayerRisk.filter((_,i)=>i%3===0).slice(0,250)} margin={{ top:4, right:16, bottom:4, left:0 }}>
                        <XAxis dataKey="idx" hide />
                        <YAxis domain={[0,1]} tickFormatter={v=>`${(v*100).toFixed(0)}%`}
                          tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} width={36} />
                        <Tooltip content={<PlayTooltip />} />
                        <ReferenceLine y={HIGH_RISK} stroke="#ef4444" strokeDasharray="3 3"
                          label={{ value:"High", fill:"#ef4444", fontSize:9, position:"insideTopRight" }} />
                        <ReferenceLine y={MED_RISK} stroke="#f59e0b" strokeDasharray="3 3"
                          label={{ value:"Med", fill:"#f59e0b", fontSize:9, position:"insideTopRight" }} />
                        <Bar dataKey="risk" radius={[2,2,0,0]}>
                          {playsPlayerRisk.filter((_,i)=>i%3===0).slice(0,250).map((e,i) => <Cell key={i} fill={rc(e.risk)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Model comparison writeup ── */}
                <div className="panel model-compare-panel">
                  <h2 className="panel-title">How the Two Models Weight Risk Differently</h2>
                  <div className="model-compare-grid">
                    <div className="model-compare-col">
                      <div className="mc-header mc-re">Risk Engine <span className="mc-file">risk_engine.py</span></div>
                      <div className="mc-body">
                        <p>The Risk Engine scores each play using <strong>nine independent play-level features</strong>, weighted by Random Forest importance ranking. It treats every play as a standalone event and asks: <em>what happened on this specific snap that increases injury probability?</em></p>
                        <ul className="mc-list">
                          <li><span className="mc-pill mc-pill-high">High weight</span> <strong>Yards gained</strong> — big plays (positive or negative) signal high-contact situations. Gains or losses over 10 yards add 18% base risk.</li>
                          <li><span className="mc-pill mc-pill-high">High weight</span> <strong>Game clock</strong> — late-game desperation driving riskier play-calling. Accounts for up to 14% of score.</li>
                          <li><span className="mc-pill mc-pill-med">Medium weight</span> <strong>Score differential</strong> — large deficits correlate with hurry-up offense and aggressive defense (10%).</li>
                          <li><span className="mc-pill mc-pill-med">Medium weight</span> <strong>Down &amp; distance</strong> — 4th downs and 3rd-and-long are flagged as elevated risk (up to 10%).</li>
                          <li><span className="mc-pill mc-pill-low">Contact flags</span> <strong>Sacks, QB hits, fumbles, TFLs</strong> — direct contact signals baked in from nflfastR columns.</li>
                          <li><span className="mc-pill mc-pill-low">Environmental</span> <strong>Wind &gt;15mph, temp &lt;40°F</strong> — cold/windy conditions add 5–6% each.</li>
                        </ul>
                        <p className="mc-note">The position-specific multiplier is applied <em>after</em> scoring, scaling the final number up or down depending on how exposed each position is on run vs. pass plays.</p>
                      </div>
                    </div>

                    <div className="model-compare-col">
                      <div className="mc-header mc-prm">Player Risk Score <span className="mc-file">Player_Risk_Score_Model.py</span></div>
                      <div className="mc-body">
                        <p>The Player Risk Score Model uses a <strong>structured mathematical formula</strong> with three macro-level factors. It asks: <em>given who is playing, in what play type, when in the season, and in what conditions — how risky is this snap?</em></p>
                        <ul className="mc-list">
                          <li><span className="mc-pill mc-pill-high">Primary driver</span> <strong>Position factor</strong> — RBs carry the highest inherent risk (2.0×), QBs the lowest (0.5×). This is the largest single lever in the formula and creates a 4× spread between positions.</li>
                          <li><span className="mc-pill mc-pill-high">Primary driver</span> <strong>Play-type factor</strong> — run plays (1.317×) are treated as universally more dangerous than pass plays (0.868×), derived from historical injury rates. Every run play is riskier than every pass play, regardless of context.</li>
                          <li><span className="mc-pill mc-pill-low">Additive modifier</span> <strong>Fatigue (week)</strong> — early season (weeks 1–4) adds 0.5 pts; late season (weeks 14–18) adds 2.0 pts. Applied additively, so it affects all positions equally in absolute terms.</li>
                          <li><span className="mc-pill mc-pill-low">Additive modifier</span> <strong>Weather</strong> — Wet/Cold adds 1.75 pts; Warm/Dry adds 1.25. Always present and never zero — even a perfect-weather game carries the base weather cost.</li>
                        </ul>
                        <p className="mc-note">Because situational modifiers are <em>additive</em> (not multiplicative), they have greater relative impact on low-risk positions like QB and less on already-high-risk positions like RB. The formula produces consistent, predictable scores within each position group.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mc-divergence">
                    <div className="mc-divergence-title">Where They Diverge</div>
                    <div className="mc-divergence-grid">
                      <div className="mc-div-item">
                        <div className="mc-div-label">Late-game sacks</div>
                        <div className="mc-div-body">Risk Engine scores these very high — sack + qb_hit + late clock + down flags all stack. Player Risk Score doesn't see individual contact events at all; only play-type and week matter.</div>
                      </div>
                      <div className="mc-div-item">
                        <div className="mc-div-label">Same position, different plays</div>
                        <div className="mc-div-body">Player Risk Score gives every RB run the same base score regardless of down, field position, or score. Risk Engine can score a 1st-and-10 run much lower than a 4th-and-1 goal-line carry.</div>
                      </div>
                      <div className="mc-div-item">
                        <div className="mc-div-label">RB vs QB risk gap</div>
                        <div className="mc-div-body">Player Risk Score bakes in a 4× position gap between RB (2.0) and QB (0.5). Risk Engine's position multiplier is narrower and only applied after all features are scored, so the gap shrinks in low-contact situations.</div>
                      </div>
                      <div className="mc-div-item">
                        <div className="mc-div-label">Cold-weather games</div>
                        <div className="mc-div-body">Both models penalize cold/wind, but Risk Engine caps the environmental contribution at ~11% of total score. Player Risk Score's additive weather modifier represents 20–30% of total raw score in extreme conditions.</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="side-by-side">
                  <div className="panel side-panel">
                    <h2 className="panel-title">Week Cards — Risk Engine</h2>
                    <div className="week-cards">
                      {allWeeks.map(w => {
                        const wp = playsRiskEngine.filter(p => p.week === w);
                        const avg  = wp.reduce((a,b)=>a+b.risk,0)/wp.length;
                        const high = wp.filter(p=>p.isHigh).length;
                        const inj  = wp.filter(p=>p.isInjuryPlay).length;
                        const sacks= wp.filter(p=>p.sack).length;
                        return (
                          <div key={w} onClick={() => setWeek(week===w?null:w)}
                            className={`week-card ${week===w?"active":""}`}>
                            <div className="week-card-title">Week {w}</div>
                            <div className="week-card-row">
                              <span>Avg: <span style={{ color:rc(avg), fontWeight:700 }}>{(avg*100).toFixed(1)}%</span></span>
                              <span className="c-red">{high} high</span>
                            </div>
                            {inj  >0 && <div className="week-card-inj">🚑 {inj} injury{inj>1?"s":""}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="panel side-panel">
                    <h2 className="panel-title">Week Cards — Player Risk Score</h2>
                    <div className="week-cards">
                      {allWeeks.map(w => {
                        const wp = playsPlayerRisk.filter(p => p.week === w);
                        const avg  = wp.reduce((a,b)=>a+b.risk,0)/wp.length;
                        const high = wp.filter(p=>p.isHigh).length;
                        const inj  = wp.filter(p=>p.isInjuryPlay).length;
                        return (
                          <div key={w} onClick={() => setWeek(week===w?null:w)}
                            className={`week-card ${week===w?"active":""}`}>
                            <div className="week-card-title">Week {w}</div>
                            <div className="week-card-row">
                              <span>Avg: <span style={{ color:rc(avg), fontWeight:700 }}>{(avg*100).toFixed(1)}%</span></span>
                              <span className="c-red">{high} high</span>
                            </div>
                            {inj>0 && <div className="week-card-inj">🚑 {inj} injury{inj>1?"s":""}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── BY WEEK TAB ── */}
            {tab === "weekly" && (
              <>
                <div className="panel">
                  <h2 className="panel-title">Average Risk by Week — Both Models</h2>
                  <p className="panel-sub">Side-by-side weekly averages. Gaps between lines reveal where models agree or diverge by week.</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={weeklyBoth} margin={{ top:8, right:24, bottom:8, left:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="week" tick={{ fill:"rgba(255,255,255,0.4)", fontSize:11 }}
                        label={{ value:"Week", position:"insideBottomRight", offset:-4, fill:"rgba(255,255,255,0.28)", fontSize:10 }} />
                      <YAxis domain={[0,1]} tickFormatter={v=>`${(v*100).toFixed(0)}%`}
                        tick={{ fill:"rgba(255,255,255,0.4)", fontSize:11 }} />
                      <Tooltip
                        formatter={(v, name) => [`${(v*100).toFixed(1)}%`, name]}
                        labelFormatter={w => `Week ${w}`}
                        contentStyle={{ background:"#1f2937", border:"1px solid rgba(255,255,255,0.18)", borderRadius:8, fontSize:12 }} />
                      <ReferenceLine y={HIGH_RISK} stroke="#ef4444" strokeDasharray="4 4" />
                      <ReferenceLine y={MED_RISK}  stroke="#f59e0b" strokeDasharray="4 4" />
                      <Bar dataKey="reAvg"  name="Risk Engine"       radius={[3,3,0,0]} fill="var(--secondary)" opacity={0.85} />
                      <Bar dataKey="prmAvg" name="Player Risk Score"  radius={[3,3,0,0]} fill="#a78bfa"          opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    <span><span style={{ color:"var(--secondary)" }}>■</span> Risk Engine</span>
                    <span><span style={{ color:"#a78bfa" }}>■</span> Player Risk Score</span>
                  </div>
                </div>

                <div className="side-by-side">
                  <div className="panel side-panel">
                    <h2 className="panel-title">By Week — Risk Engine</h2>
                    <div className="weekly-cards">
                      {weeklyBoth.map(w => (
                        <div key={w.week} onClick={() => setWeek(week===w.week?null:w.week)}
                          className={`weekly-card ${week===w.week?"active":""}`}>
                          <div className="weekly-card-top">
                            <span style={{ fontWeight:800, fontSize:13 }}>Week {w.week}</span>
                            <Badge cls={w.reAvg>=HIGH_RISK?"HIGH":w.reAvg>=MED_RISK?"MEDIUM":"LOW"} />
                          </div>
                          <div className="weekly-card-stats">
                            <span>Avg: <b style={{ color:rc(w.reAvg) }}>{(w.reAvg*100).toFixed(1)}%</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel side-panel">
                    <h2 className="panel-title">By Week — Player Risk Score</h2>
                    <div className="weekly-cards">
                      {weeklyBoth.map(w => (
                        <div key={w.week} onClick={() => setWeek(week===w.week?null:w.week)}
                          className={`weekly-card ${week===w.week?"active":""}`}>
                          <div className="weekly-card-top">
                            <span style={{ fontWeight:800, fontSize:13 }}>Week {w.week}</span>
                            <Badge cls={w.prmAvg>=HIGH_RISK?"HIGH":w.prmAvg>=MED_RISK?"MEDIUM":"LOW"} />
                          </div>
                          <div className="weekly-card-stats">
                            <span>Avg: <b style={{ color:rc(w.prmAvg) }}>{(w.prmAvg*100).toFixed(1)}%</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── PLAY TABLE TAB ── */}
            {tab === "table" && (
              <div className="side-by-side side-by-side-tables">
                {[
                  { label: "Risk Engine", data: week ? playsRiskEngine.filter(p=>p.week===week) : playsRiskEngine },
                  { label: "Player Risk Score", data: week ? playsPlayerRisk.filter(p=>p.week===week) : playsPlayerRisk },
                ].map(({ label, data: tdata }) => (
                  <div key={label} className="panel side-panel" style={{ padding:0, overflow:"hidden" }}>
                    <div className="table-header">
                      <div>
                        <div className="table-header-title">{label}</div>
                        <div className="table-header-sub">Showing {Math.min(tdata.length,150)} of {tdata.length} plays</div>
                      </div>
                      <div className="table-counts">
                        <span><b className="c-red">{tdata.filter(p=>p.cls==="HIGH").length}</b> HIGH</span>
                        <span><b className="c-yellow">{tdata.filter(p=>p.cls==="MEDIUM").length}</b> MED</span>
                        <span><b className="c-green">{tdata.filter(p=>p.cls==="LOW").length}</b> LOW</span>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {["Play#","Wk","Type","Dn","Dist","Yardline","Gained","Score Δ","QB Hit","Sack","Risk %","Class"].map(h=>(
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tdata.slice(0,150).map((p,i) => (
                            <tr key={i} className={p.isInjuryPlay?"row-injury":p.isHigh?"row-high":""}>
                              <td className="td-muted">{p.idx}</td>
                              <td className="td-muted">{p.week}</td>
                              <td className={`td-${p.playType==="pass"?"pass":p.playType==="run"?"run":"special"}`}
                                style={{ textTransform:"capitalize" }}>{p.playType}</td>
                              <td className="td-pos">{p.down}</td>
                              <td className="td-pos">{p.ydstogo}</td>
                              <td className="td-pos">{p.yardline}</td>
                              <td className={p.yardsGained>=0?"td-gain-pos":"td-gain-neg"}>
                                {p.yardsGained>=0?"+":""}{p.yardsGained}
                              </td>
                              <td style={{ color: p.scoreDiff>0?"#22c55e":p.scoreDiff<0?"#ef4444":"rgba(255,255,255,0.4)" }}>
                                {p.scoreDiff>0?"+":""}{p.scoreDiff}
                              </td>
                              <td>{p.qbHit  && <span className="td-flag">💥</span>}</td>
                              <td>{p.sack   && <span className="td-flag">🏈</span>}</td>
                              <td className="td-risk" style={{ color:rc(p.risk) }}>{(p.risk*100).toFixed(1)}%</td>
                              <td><Badge cls={p.cls} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="footer">
          Both models run simultaneously — Risk Engine (risk_engine.py) uses play-level feature scoring · Player Risk Score (Player_Risk_Score_Model.py) uses Position × Play-Type × Opponent formula · Thresholds: HIGH ≥68% · MEDIUM ≥42%
        </p>
      </main>
    </div>
  );
}