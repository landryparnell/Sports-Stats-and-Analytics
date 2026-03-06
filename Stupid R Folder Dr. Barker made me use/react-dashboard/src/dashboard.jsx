import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from "recharts";
import "./dashboard.css";

const TEAM_LABELS = { KC: "Kansas City Chiefs", WAS: "Washington Commanders" };
const POSITIONS   = ["QB", "RB", "WR", "TE", "OL"];
const HIGH_RISK   = 0.68;
const MED_RISK    = 0.42;

const rc = r => r >= HIGH_RISK ? "#ef4444" : r >= MED_RISK ? "#f59e0b" : "#22c55e";

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
  const [data,      setData]    = useState(null);
  const [loadErr,   setLoadErr] = useState(null);
  const [team,      setTeam]    = useState("KC");
  const [pos,       setPos]     = useState("QB");
  const [week,      setWeek]    = useState(null);
  const [tab,       setTab]     = useState("cumulative");


  // ── Fetch JSON on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/nflData.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — run: npm run generate`);
        return r.json();
      })
      .then(setData)
      .catch(e => setLoadErr(e.message));
  }, []);

  useEffect(() => { setWeek(null); }, [team, pos]);

  // ── Guard: loading / error states ─────────────────────────────────────────
  if (loadErr) return (
    <div className="load-error">
      <h2>Could not load nflData.json</h2>
      <p>{loadErr}</p>
      <pre>python generate_data.py</pre>
      <p>Then restart the dev server.</p>
    </div>
  );
  if (!data) return <div className="load-spinner"><span className="spinner" />Loading data…</div>;

  // ── Derived ────────────────────────────────────────────────────────────────
  const plays    = data[team][pos] || [];
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

  // Sample for charts (every 3rd play)
  const cumSample = plays.filter((_,i) => i % 3 === 0);
  const barSample = plays.filter((_,i) => i % 3 === 0).slice(0, 250);



  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`theme-${team}`}>

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-eyebrow">NFL Injury Risk · 2025 Season</div>
          <div className="header-top">
            <div>
              <h1 className="header-title">
                <span className="header-title-accent">▌</span>{" "}
                {TEAM_LABELS[team]}
              </h1>
              <p className="header-subtitle">
                Position: <span className="header-subtitle-pos">{pos}</span>
                {week && <> · <span style={{ color:"rgba(255,255,255,0.7)" }}>Week {week}</span></>}
              </p>
            </div>
            <div className="team-toggle">
              {["KC","WAS"].map(t => (
                <button key={t} onClick={() => setTeam(t)}
                  className={`team-btn ${team===t ? `active-${t}` : ""}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="pos-row">
            {POSITIONS.map(p => (
              <button key={p} onClick={() => setPos(p)}
                className={`pos-btn ${pos===p ? "active" : ""}`}>{p}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="main">

        {/* Stat Cards */}
        <div className="stat-grid">
          <StatCard label="Total Plays"   value={total.toLocaleString()}          sub={week ? `Week ${week}` : "Full season"} />
          <StatCard label="High Risk"     value={highCnt}                          sub={`${((highCnt/total)*100).toFixed(1)}% of plays`} colorClass="c-red" />
          <StatCard label="Avg Risk"      value={`${(avgRisk*100).toFixed(1)}%`}   sub="per play" colorClass={avgRisk>=HIGH_RISK?"c-red":avgRisk>=MED_RISK?"c-yellow":"c-green"} />
          <StatCard label="Peak Risk"     value={`${(peakRisk*100).toFixed(1)}%`}  sub="single play"    colorClass="c-orange" />
          <StatCard label="Sacks"         value={sackCnt}                          sub="contact plays"  colorClass="c-orange" />
          <StatCard label="Injury Events" value={injCnt}                           sub="in play desc"   colorClass="c-red" />
          <StatCard label="Cumulative"    value={cumFinal.toFixed(0)}              sub="season total"   colorClass="c-purple" />
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

        <p className="footer">
          Data: WAS_KC_filtered.csv · Model: Random Forest (n_estimators=200, max_depth=10) ·
          Thresholds: HIGH ≥68% · MEDIUM ≥42% · LOW &lt;42%
        </p>
      </main>
    </div>
  );
}