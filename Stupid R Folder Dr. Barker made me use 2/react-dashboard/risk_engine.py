"""
risk_engine.py
Core risk-scoring logic. Imported by generate_data.py.
Supports all 32 NFL teams and expanded positions.
"""
import math
import pandas as pd

# Expanded positions — offense + defense
POSITIONS = ["QB", "WR", "RB", "TE", "S", "OL", "DL", "CB", "DB", "LB"]

# Offensive positions use play-type multipliers based on play involvement
# Defensive positions are exposed on every play regardless of type
MULTIPLIERS = {
    # Offense — tuned by play-type exposure
    "QB":  {"run": 1.82, "pass": 1.45},
    "RB":  {"run": 1.65, "pass": 0.85},
    "WR":  {"run": 0.60, "pass": 1.55},
    "TE":  {"run": 0.90, "pass": 1.35},
    "OL":  {"run": 1.10, "pass": 1.05},
    # Defense — higher exposure on run plays for front seven, pass for DBs
    "DL":  {"run": 1.70, "pass": 1.20},
    "LB":  {"run": 1.55, "pass": 1.10},
    "CB":  {"run": 0.70, "pass": 1.60},
    "DB":  {"run": 0.75, "pass": 1.55}, # no db because we split CB/DB
    "S":   {"run": 0.90, "pass": 1.45},
}

HIGH_RISK = 0.68
MED_RISK  = 0.42

# All 32 NFL teams — generate_data.py will process whichever teams exist in the CSV
ALL_TEAMS = [
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB",  "HOU", "IND", "JAX", "KC",
    "LAC", "LA", "LV", "MIA", "MIN", "NE",  "NO",  "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF",  "TB",  "TEN", "WAS",
]


def _safe(val, default):
    if val is None:
        return default
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (TypeError, ValueError):
        return default


def score_play(row: dict, pos: str) -> float:
    """
    Compute a risk score in [0, 1] for one play + position.
    Features ordered by Random Forest importance ranking.
    """
    risk = 0.0

    # yards_gained — big positive or negative plays increase risk
    yg = _safe(row.get("yards_gained"), 0)
    risk += 0.18 if abs(yg) > 10 else abs(yg) * 0.012

    # game_seconds_remaining — late game = higher desperation
    gs = _safe(row.get("game_seconds_remaining"), 1800)
    risk += (1.0 - min(gs, 3600) / 3600) * 0.14

    # wp — extreme win probabilities (blowout or desperate comeback)
    wp = _safe(row.get("wp"), 0.5)
    risk += 0.08 if abs(wp - 0.5) > 0.35 else 0.02

    # score_differential — large deficit drives risky play-calling
    sd = _safe(row.get("score_differential"), 0)
    risk += min(abs(sd) / 28.0, 1.0) * 0.10

    # yardline_100 — red zone and backed-up situations
    yl = _safe(row.get("yardline_100"), 50)
    risk += 0.09 if (yl < 15 or yl > 85) else 0.02

    # down & distance
    down = int(_safe(row.get("down"), 1))
    yds  = _safe(row.get("ydstogo"), 10)
    risk += 0.10 if down == 4 else (0.08 if (down == 3 and yds > 7) else 0.02)

    # real contact/injury signals from nflfastR columns
    risk += 0.05 if _safe(row.get("qb_hit"),          0) > 0 else 0
    risk += 0.06 if _safe(row.get("sack"),             0) > 0 else 0
    risk += 0.04 if _safe(row.get("tackled_for_loss"), 0) > 0 else 0
    risk += 0.07 if _safe(row.get("fumble"),           0) > 0 else 0

    # environmental
    wind = _safe(row.get("wind"), 0)
    risk += 0.06 if wind > 15 else 0
    temp = _safe(row.get("temp"), 65)
    risk += 0.05 if temp < 40 else 0

    # week — fatigue / season wear
    week = _safe(row.get("week"), 9)
    risk += (week / 18.0) * 0.06

    # position × play-type multiplier
    pt   = str(row.get("play_type", "pass")).lower()
    mult = MULTIPLIERS.get(pos, {}).get(pt, 1.0)

    return round(min(max(risk * mult, 0.0), 1.0), 4)


def load_and_clean(csv_path: str, team: str) -> pd.DataFrame:
    """
    Load CSV, filter to one team's pass/run plays.
    Works with any team abbreviation present in the data.
    """
    df = pd.read_csv(csv_path, low_memory=False)
    df["injury_flag"] = (
        df["desc"].str.contains("injured|injury", case=False, na=False).astype(int)
    )
    df = df[(df["posteam"] == team) & (df["play_type"].isin(["pass", "run"]))].copy()
    df = df.dropna(subset=["down"]).reset_index(drop=True)
    return df


def process_team(csv_path: str, team: str) -> dict:
    """
    Full pipeline for one team. Returns dict keyed by position.
    """
    df = load_and_clean(csv_path, team)
    result = {}
    for pos in POSITIONS:
        plays = []
        cum   = 0.0
        for idx, row in enumerate(df.to_dict(orient="records"), 1):
            risk  = score_play(row, pos)
            cum  += risk
            plays.append({
                "idx":         idx,
                "week":        int(_safe(row.get("week"), 0)),
                "defteam":     str(row.get("defteam", "")),   # opponent team — used by Player Risk Score Model
                "playType":    str(row.get("play_type", "pass")),
                "down":        int(_safe(row.get("down"), 1)),
                "ydstogo":     int(_safe(row.get("ydstogo"), 10)),
                "yardline":    int(_safe(row.get("yardline_100"), 50)),
                "yardsGained": int(_safe(row.get("yards_gained"), 0)),
                "scoreDiff":   int(_safe(row.get("score_differential"), 0)),
                "wind":        int(_safe(row.get("wind"), 0)),
                "temp":        int(_safe(row.get("temp"), 65)),
                "qbHit":       bool(_safe(row.get("qb_hit"),          0) > 0),
                "sack":        bool(_safe(row.get("sack"),             0) > 0),
                "fumble":      bool(_safe(row.get("fumble"),           0) > 0),
                "risk":        risk,
                "cumRisk":     round(cum, 2),
                "isInjuryPlay": bool(row.get("injury_flag", 0)),
                "isHigh":      risk >= HIGH_RISK,
                "cls": (
                    "HIGH"   if risk >= HIGH_RISK else
                    "MEDIUM" if risk >= MED_RISK  else
                    "LOW"
                ),
            })
        result[pos] = plays
    return result