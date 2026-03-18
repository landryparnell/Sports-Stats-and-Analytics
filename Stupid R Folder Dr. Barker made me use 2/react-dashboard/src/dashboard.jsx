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
  { abbr: "LAR", name: "LA Rams",                  conf: "NFC" },
  { abbr: "LVR", name: "Las Vegas Raiders",        conf: "AFC" },
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
const POSITIONS = ["QB", "WR", "RB", "TE", "S", "OL", "DL", "CB", "DB", "LB"];

// Offense vs Defense grouping
const OFF_POS = ["QB", "WR", "RB", "TE", "OL"];
const DEF_POS = ["DL", "LB", "CB", "DB", "S"];

const HIGH_RISK = 0.68;
const MED_RISK  = 0.42;

// ─── Player Risk Score Model constants (from Player_Risk_Score_Model.py) ──────
const POSITION_FACTORS = {
  QB: 0.5, WR: 1.2, RB: 2.0, TE: 1.8,
  S:  1.6, OL: 1.4, DL: 1.6, CB: 1.4,
  DB: 1.4, LB: 1.8
};
const RUN_FACTOR  = 1.3172;
const PASS_FACTOR = 0.8678;
const TEAM_DEFENSE_RANKINGS = {
  ARI: { rush: 25, pass: 24 }, ATL: { rush: 24, pass: 13 },
  BAL: { rush: 10, pass: 30 }, BUF: { rush: 28, pass:  1 },
  CAR: { rush: 20, pass: 15 }, CHI: { rush: 27, pass: 22 },
  CIN: { rush: 32, pass: 26 }, CLE: { rush: 16, pass:  3 },
  DAL: { rush: 23, pass: 32 }, DEN: { rush:  2, pass:  7 },
  DET: { rush: 14, pass: 20 }, GB:  { rush: 18, pass: 11 },
  HOU: { rush:  4, pass:  6 }, IND: { rush:  7, pass: 30 },
  JAX: { rush:  1, pass: 21 }, KC:  { rush:  9, pass: 12 },
  LAC: { rush:  8, pass:  5 }, LAR: { rush: 12, pass: 19 },
  LVR: { rush: 17, pass: 14 }, MIA: { rush: 26, pass: 18 },
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
 * Formula: (posFactor × playTypeFactor × oppFactor) + sitModifiers
 *   where sitModifiers = fatigueMod(week) + weatherMod(temp, wind)
 *
 * Per-play defteam is used when available (stored by risk_engine.py).
 * oppTeam dropdown acts as a fallback for plays missing defteam.
 *
 * Normalization: raw scores range from ~1.8 (low) to ~9.02 (max).
 * Max = (RB=2.0 × run=1.3172 × best_opp=(33-1)/16=2.0) + (Q4=2.0 + Wet/Cold=1.75) = 9.0188
 */
const PRM_MAX = 9.02;  // theoretical max raw score for normalization

function applyPlayerRiskModel(plays, pos, oppTeam) {
  const posFactor = POSITION_FACTORS[pos] ?? 1.0;

  // Season-quarter fatigue: maps NFL week to game-quarter analogue
  // Weeks 1–4  → Q1 (0.5)  early season, fresh legs
  // Weeks 5–9  → Q2 (1.0)  mid season
  // Weeks 10–13→ Q3 (1.5)  late season fatigue building
  // Weeks 14–18→ Q4 (2.0)  end of season, maximum fatigue
  const fatigueMod = w => w <= 4 ? 0.5 : w <= 9 ? 1.0 : w <= 13 ? 1.5 : 2.0;

  // Weather derived from play data (temp/wind fields stored by risk_engine.py)
  // Mirrors Python model: Wet/Cold = 1.75, Warm/Dry = 1.25
  const weatherMod = p => (p.temp < 40 || p.wind > 15) ? 1.75 : 1.25;

  let cum = 0;
  return plays.map(p => {
    // Use the actual opponent from this play's game; fall back to dropdown selection
    const opp      = (p.defteam && TEAM_DEFENSE_RANKINGS[p.defteam])
                       ? p.defteam
                       : oppTeam;
    const oppRanks = TEAM_DEFENSE_RANKINGS[opp] ?? { rush: 16, pass: 16 };
    const oppFact  = calcOppFactor(
      p.playType === "run" ? oppRanks.rush : oppRanks.pass
    );
    const ptFact   = p.playType === "run" ? RUN_FACTOR : PASS_FACTOR;
    const sitMod   = fatigueMod(p.week) + weatherMod(p);

    const raw  = (posFactor * ptFact * oppFact) + sitMod;
    const norm = Math.min(Math.max(raw / PRM_MAX, 0), 1);
    cum += norm;
    return {
      ...p,
      risk:    parseFloat(norm.toFixed(4)),
      cumRisk: parseFloat(cum.toFixed(2)),
      isHigh:  norm >= HIGH_RISK,
      cls:     norm >= HIGH_RISK ? "HIGH" : norm >= MED_RISK ? "MEDIUM" : "LOW",
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
      {d.isInjury && <div className="tt-injury">🚑 INJURY IN DESC</div>}
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
      {d.isInjury && <div className="tt-injury">🚑 INJURY EVENT</div>}
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
    if (model === "player_risk") return applyPlayerRiskModel(rawPlays, pos, oppTeam);
    return rawPlays;
  }, [rawPlays, model, pos, oppTeam]);

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
  const injCnt   = filtered.filter(p => p.isInjury).length;
  const sackCnt  = filtered.filter(p => p.sack).length;
  const avgRisk  = total ? filtered.reduce((a,b) => a + b.risk, 0) / total : 0;
  const peakRisk = total ? Math.max(...filtered.map(p => p.risk)) : 0;
  const cumFinal = plays.length ? plays[plays.length-1].cumRisk : 0;
  const subThresh = cumFinal * 0.72;

  const allWeeks = [...new Set(plays.map(p => p.week))].sort((a,b)=>a-b);
  const weekly = allWeeks.map(w => {
    const wp = plays.filter(p => p.week === w);
    return {
      week: w,
      avg:  wp.reduce((a,b) => a + b.risk, 0) / wp.length,
      high: wp.filter(p => p.isHigh).length,
      inj:  wp.filter(p => p.isInjury).length,
      sacks:wp.filter(p => p.sack).length,
    };
  });

  const cumSample = plays.filter((_,i) => i % 3 === 0);
  const barSample = plays.filter((_,i) => i % 3 === 0).slice(0, 250);

  const teamInfo  = ALL_TEAMS.find(t => t.abbr === team);
  const isDefPos  = DEF_POS.includes(pos);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`theme-${team === "KC" ? "KC" : team === "WAS" ? "WAS" : "DEFAULT"}`}>

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
            {model === "player_risk" && (
              <div className="opp-select-wrap">
                <span className="opp-label">OPP FALLBACK</span>
                <select
                  className="opp-select"
                  value={oppTeam}
                  onChange={e => setOppTeam(e.target.value)}
                  title="Used for plays where per-game opponent data is unavailable"
                >
                  {ALL_TEAMS.filter(t => t.abbr !== team).map(t => (
                    <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
                  ))}
                </select>
                <span className="opp-fallback-note">per-play opp used when available</span>
              </div>
            )}
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
              <StatCard label="Injury Events" value={injCnt}                           sub="in play desc" colorClass="c-red" />
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
                <div className="panel">
                  <h2 className="panel-title">Cumulative Risk Score — Season Progression</h2>
                  <p className="panel-sub">Running total of play-level risk. Dashed line = substitution threshold ({subThresh.toFixed(0)} pts)</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={cumSample} margin={{ top:8, right:24, bottom:8, left:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="idx" tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }}
                        label={{ value:"Play #", position:"insideBottomRight", offset:-4, fill:"rgba(255,255,255,0.28)", fontSize:10 }} />
                      <YAxis tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} />
                      <Tooltip content={<CumTooltip />} />
                      <ReferenceLine y={subThresh} stroke="#ef4444" strokeDasharray="6 4"
                        label={{ value:`⚠ Sub at ${subThresh.toFixed(0)}`, fill:"#ef4444", fontSize:10, position:"insideTopLeft" }} />
                      <Line type="monotone" dataKey="cumRisk" stroke="var(--secondary)"
                        strokeWidth={2.5} dot={false} activeDot={{ r:4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="panel">
                  <h2 className="panel-title">Per-Play Risk Score</h2>
                  <p className="panel-sub">Each bar = one play, colored by risk classification. Sampled view.</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={barSample} margin={{ top:4, right:24, bottom:4, left:0 }}>
                      <XAxis dataKey="idx" hide />
                      <YAxis domain={[0,1]} tickFormatter={v=>`${(v*100).toFixed(0)}%`}
                        tick={{ fill:"rgba(255,255,255,0.3)", fontSize:10 }} width={36} />
                      <Tooltip content={<PlayTooltip />} />
                      <ReferenceLine y={HIGH_RISK} stroke="#ef4444" strokeDasharray="3 3"
                        label={{ value:"High", fill:"#ef4444", fontSize:9, position:"insideTopRight" }} />
                      <ReferenceLine y={MED_RISK} stroke="#f59e0b" strokeDasharray="3 3"
                        label={{ value:"Med", fill:"#f59e0b", fontSize:9, position:"insideTopRight" }} />
                      <Bar dataKey="risk" radius={[2,2,0,0]}>
                        {barSample.map((e,i) => <Cell key={i} fill={rc(e.risk)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    <span><span style={{ color:"#ef4444" }}>■</span> HIGH ≥68%</span>
                    <span><span style={{ color:"#f59e0b" }}>■</span> MEDIUM ≥42%</span>
                    <span><span style={{ color:"#22c55e" }}>■</span> LOW &lt;42%</span>
                  </div>
                </div>

                <div className="week-cards">
                  {weekly.map(w => (
                    <div key={w.week}
                      onClick={() => setWeek(week===w.week?null:w.week)}
                      className={`week-card ${week===w.week?"active":""}`}>
                      <div className="week-card-title">Week {w.week}</div>
                      <div className="week-card-row">
                        <span>Avg: <span style={{ color:rc(w.avg), fontWeight:700 }}>{(w.avg*100).toFixed(1)}%</span></span>
                        <span className="c-red">{w.high} high</span>
                      </div>
                      {w.sacks > 0 && <div className="week-card-inj" style={{ color:"#f97316" }}>🏈 {w.sacks} sack{w.sacks>1?"s":""}</div>}
                      {w.inj   > 0 && <div className="week-card-inj">🚑 {w.inj} injury{w.inj>1?"s":""}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── BY WEEK TAB ── */}
            {tab === "weekly" && (
              <div className="panel">
                <h2 className="panel-title">Average Risk Score by Week</h2>
                <p className="panel-sub">Click a bar to filter all views to that week</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={weekly} margin={{ top:8, right:24, bottom:8, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" tick={{ fill:"rgba(255,255,255,0.4)", fontSize:11 }}
                      label={{ value:"Week", position:"insideBottomRight", offset:-4, fill:"rgba(255,255,255,0.28)", fontSize:10 }} />
                    <YAxis domain={[0,1]} tickFormatter={v=>`${(v*100).toFixed(0)}%`}
                      tick={{ fill:"rgba(255,255,255,0.4)", fontSize:11 }} />
                    <Tooltip
                      formatter={v => [`${(v*100).toFixed(1)}%`, "Avg Risk"]}
                      labelFormatter={w => `Week ${w}`}
                      contentStyle={{ background:"#1f2937", border:"1px solid rgba(255,255,255,0.18)", borderRadius:8, fontSize:12 }} />
                    <ReferenceLine y={HIGH_RISK} stroke="#ef4444" strokeDasharray="4 4"
                      label={{ value:"High Risk", fill:"#ef4444", fontSize:10, position:"insideTopLeft" }} />
                    <ReferenceLine y={MED_RISK} stroke="#f59e0b" strokeDasharray="4 4"
                      label={{ value:"Medium", fill:"#f59e0b", fontSize:10, position:"insideTopLeft" }} />
                    <Bar dataKey="avg" radius={[4,4,0,0]} onClick={d => setWeek(week===d.week?null:d.week)}>
                      {weekly.map((e,i) => (
                        <Cell key={i} fill={rc(e.avg)} opacity={week===e.week||!week ? 1 : 0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="weekly-cards">
                  {weekly.map(w => (
                    <div key={w.week}
                      onClick={() => setWeek(week===w.week?null:w.week)}
                      className={`weekly-card ${week===w.week?"active":""}`}>
                      <div className="weekly-card-top">
                        <span style={{ fontWeight:800, fontSize:13 }}>Week {w.week}</span>
                        <Badge cls={w.avg>=HIGH_RISK?"HIGH":w.avg>=MED_RISK?"MEDIUM":"LOW"} />
                      </div>
                      <div className="weekly-card-stats">
                        <span>Avg: <b style={{ color:rc(w.avg) }}>{(w.avg*100).toFixed(1)}%</b></span>
                        <span className="c-red">{w.high} high</span>
                        {w.sacks>0 && <span className="c-orange">{w.sacks} sacks</span>}
                      </div>
                      {w.inj>0 && <div className="week-card-inj">🚑 {w.inj} injury event{w.inj>1?"s":""}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PLAY TABLE TAB ── */}
            {tab === "table" && (
              <div className="panel" style={{ padding:0, overflow:"hidden" }}>
                <div className="table-header">
                  <div>
                    <div className="table-header-title">Play-Level Risk Classification</div>
                    <div className="table-header-sub">
                      Showing {Math.min(filtered.length,150)} of {filtered.length} plays
                    </div>
                  </div>
                  <div className="table-counts">
                    <span><b className="c-red">{highCnt}</b> HIGH</span>
                    <span><b className="c-yellow">{filtered.filter(p=>p.cls==="MEDIUM").length}</b> MED</span>
                    <span><b className="c-green">{filtered.filter(p=>p.cls==="LOW").length}</b> LOW</span>
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
                      {filtered.slice(0,150).map((p,i) => (
                        <tr key={i} className={p.isInjury?"row-injury":p.isHigh?"row-high":""}>
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
            )}
          </>
        )}

        <p className="footer">
          Model:{" "}
          {model === "risk_engine"
            ? "Risk Engine (risk_engine.py) — Random Forest feature scoring · Thresholds: HIGH ≥68% · MEDIUM ≥42%"
            : "Player Risk Score (Player_Risk_Score_Model.py) — Position × Play-Type × Opponent · Normalized to [0,1]"}
        </p>
      </main>
    </div>
  );
}