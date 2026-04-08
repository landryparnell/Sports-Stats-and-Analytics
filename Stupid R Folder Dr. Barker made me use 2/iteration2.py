"""
iteration2.py
NFL Injury Risk — Random Forest Classifier
Claire Rasmussen · Updated 2026

Changes from v1:
  - Team identity columns RESTORED in both Model A (situation) and Model B (situation + team)
  - Season risk increase analysis added (week-over-week trend)
  - Team Injury Culture factor added as an engineered feature
  - Play-type multipliers reweighted to match updated risk_engine.py
  - All output labels cleaned up for readability
"""

import pandas as pd
import numpy as np
import math
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

# ─── Team Injury Culture Factor ───────────────────────────────────────────────
# Franchise-level multiplier based on historical injury rates (2020–2024).
# League average = 1.00. Added as an engineered feature in Model B.
TEAM_INJURY_CULTURE = {
    'ARI': 1.08, 'ATL': 0.97, 'BAL': 0.94, 'BUF': 1.02,
    'CAR': 1.12, 'CHI': 1.05, 'CIN': 0.98, 'CLE': 1.07,
    'DAL': 1.03, 'DEN': 0.96, 'DET': 0.99, 'GB' : 0.95,
    'HOU': 1.01, 'IND': 1.06, 'JAX': 1.04, 'KC' : 0.93,
    'LAC': 1.09, 'LA' : 1.00, 'LV' : 1.11, 'MIA': 1.04,
    'MIN': 1.02, 'NE' : 0.97, 'NO' : 0.98, 'NYG': 1.13,
    'NYJ': 1.08, 'PHI': 1.01, 'PIT': 0.96, 'SEA': 0.99,
    'SF' : 1.10, 'TB' : 1.00, 'TEN': 1.05, 'WAS': 1.07,
}

# ─── Opponent Defense Rankings ────────────────────────────────────────────────
TEAM_DEFENSE_RANKINGS = {
    'ARI': {'rush': 25, 'pass': 24}, 'ATL': {'rush': 24, 'pass': 13},
    'BAL': {'rush': 10, 'pass': 30}, 'BUF': {'rush': 28, 'pass':  1},
    'CAR': {'rush': 20, 'pass': 15}, 'CHI': {'rush': 27, 'pass': 22},
    'CIN': {'rush': 32, 'pass': 26}, 'CLE': {'rush': 16, 'pass':  3},
    'DAL': {'rush': 23, 'pass': 32}, 'DEN': {'rush':  2, 'pass':  7},
    'DET': {'rush': 14, 'pass': 20}, 'GB' : {'rush': 18, 'pass': 11},
    'HOU': {'rush':  4, 'pass':  6}, 'IND': {'rush':  7, 'pass': 30},
    'JAX': {'rush':  1, 'pass': 21}, 'KC' : {'rush':  9, 'pass': 12},
    'LAC': {'rush':  8, 'pass':  5}, 'LA' : {'rush': 12, 'pass': 19},
    'LV' : {'rush': 17, 'pass': 14}, 'MIA': {'rush': 26, 'pass': 18},
    'MIN': {'rush': 21, 'pass':  2}, 'NE' : {'rush':  6, 'pass':  9},
    'NO' : {'rush': 19, 'pass':  4}, 'NYG': {'rush': 31, 'pass': 16},
    'NYJ': {'rush': 29, 'pass': 17}, 'PHI': {'rush': 22, 'pass':  8},
    'PIT': {'rush': 13, 'pass': 29}, 'SEA': {'rush':  3, 'pass': 10},
    'SF' : {'rush': 11, 'pass': 25}, 'TB' : {'rush':  5, 'pass': 27},
    'TEN': {'rush': 15, 'pass': 23}, 'WAS': {'rush': 30, 'pass': 28},
}

# ─── Load Data ────────────────────────────────────────────────────────────────
df = pd.read_csv("play_by_play_2025_filtered.csv")

df['injury'] = df['desc'].str.contains('injured|injury', case=False, na=False).astype(int)

print(f"\nTotal plays:         {len(df):,}")
print(f"Plays with injuries: {df['injury'].sum():,}")
print(f"Injury rate:         {df['injury'].mean():.2%}\n")

# ─── Basic Cleaning ───────────────────────────────────────────────────────────
drop_always = [c for c in ["Unnamed: 0", "desc", "game_date", "game_id",
                            "play_id", "injury_flag"] if c in df.columns]
df = df.drop(columns=drop_always)
df = df.dropna(subset=["play_type"])


def calc_opp_factor(team: str, play_type: str) -> float:
    """Numeric opponent factor from defense rankings."""
    rankings = TEAM_DEFENSE_RANKINGS.get(str(team).upper().strip(), None)
    if not rankings:
        return 1.0
    key = "rush" if str(play_type).lower() == "run" else "pass"
    rank = rankings[key]
    return round((33 - rank) / 16, 4)

def season_fatigue_modifier(week) -> float:
    """Continuous exponential fatigue modifier (Week 1=0.5, Week 9=1.0, Week 18=2.0)."""
    try:
        w = float(week)
    except (TypeError, ValueError):
        return 1.0
    k = math.log(4) / 17
    return round(min(max(0.50 * math.exp(k * (w - 1)), 0.50), 2.00), 4)

# Engineered numeric features from team identity
if 'defteam' in df.columns and 'play_type' in df.columns:
    df['opp_factor'] = df.apply(
        lambda r: calc_opp_factor(r.get('defteam', ''), r.get('play_type', 'pass')), axis=1
    )
if 'posteam' in df.columns:
    df['team_culture'] = df['posteam'].map(TEAM_INJURY_CULTURE).fillna(1.0)
if 'week' in df.columns:
    df['fatigue_mod'] = df['week'].apply(season_fatigue_modifier)

print("Engineered features added: opp_factor, team_culture, fatigue_mod")

# ─── Feature Groups ───────────────────────────────────────────────────────────

# Team identity — categorical columns naming specific teams.
# Restored in Model B so the model can learn team-specific injury patterns.
TEAM_COLS = [c for c in df.columns if c in [
    'posteam', 'defteam', 'home_team', 'away_team',
    'possession_team', 'penalty_team', 'td_team',
    'forced_fumble_player_1_team', 'forced_fumble_player_2_team',
    'fumbled_1_team', 'fumbled_2_team',
    'solo_tackle_1_team', 'solo_tackle_2_team',
    'assist_tackle_1_team', 'assist_tackle_2_team',
    'tackle_with_assist_1_team', 'tackle_with_assist_2_team',
]]

# Numeric team-identity features (engineered above)
TEAM_NUMERIC_COLS = [c for c in ['opp_factor', 'team_culture', 'fatigue_mod']
                     if c in df.columns]

# Situational / game-state features — the core of Model A.
# These capture what happened on the play independent of which teams are playing.
SITUATION_COLS = [c for c in df.columns if c in [
    # Down & distance
    'down', 'ydstogo', 'yardline_100', 'goal_to_go',
    # Score / game state
    'score_differential', 'posteam_score', 'defteam_score',
    'half_seconds_remaining', 'game_seconds_remaining',
    'game_half', 'qtr', 'drive',
    # Play type & formation
    'play_type', 'shotgun', 'no_huddle', 'qb_dropback',
    'qb_scramble', 'pass_length', 'pass_location',
    'run_location', 'run_gap',
    # Field & weather
    'roof', 'surface', 'temp', 'wind',
    'stadium_id', 'location',
    # Personnel / pressure
    'defenders_in_box', 'number_of_pass_rushers',
    'offense_formation', 'offense_personnel', 'defense_personnel',
    # Contact signals
    'qb_hit', 'sack', 'tackled_for_loss', 'fumble',
    # Penalty
    'penalty', 'penalty_type',
    # Misc
    'season', 'season_type', 'week',
    'special_teams_play', 'st_play_type',
    'yards_gained', 'air_yards', 'yards_after_catch',
    'ep', 'wp',
    'third_down_converted', 'third_down_failed',
    'fourth_down_converted', 'fourth_down_failed',
]]

TARGET = 'injury'

print("\n" + "=" * 60)
print("FEATURE SUMMARY")
print("=" * 60)
print(f"Situation columns:           {len(SITUATION_COLS)}")
print(f"Team identity (categorical): {len(TEAM_COLS)}")
print(f"Team identity (numeric):     {len(TEAM_NUMERIC_COLS)}")
print(f"Team cols: {TEAM_COLS}")
print(f"Team numeric: {TEAM_NUMERIC_COLS}\n")


# ─── Model Builder ────────────────────────────────────────────────────────────

def build_and_evaluate(df, feature_cols, model_name, n_estimators=200, max_depth=10):
    X = df[feature_cols + [TARGET]].copy()
    X = X[[c for c in X.columns if c in df.columns]]
    X = X.dropna(subset=[TARGET])
    y = X.pop(TARGET)

    X = pd.get_dummies(X)
    X = X.fillna(X.median(numeric_only=True))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_split=20,
        min_samples_leaf=10,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]

    print(f"\n{'=' * 60}")
    print(f"  {model_name}")
    print(f"{'=' * 60}")
    print(f"\nTraining rows: {len(X_train):,}  |  Test rows: {len(X_test):,}")
    print(f"Injury rate in test set: {y_test.mean():.2%}")
    print(f"\nAccuracy: {accuracy_score(y_test, preds):.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, preds, target_names=['No Injury', 'Injury']))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, preds))
    print(f"\nAvg predicted injury probability: {proba.mean():.2%}")
    print(f"Plays >50% injury risk: {(proba > 0.50).sum()}")
    print(f"Plays >25% injury risk: {(proba > 0.25).sum()}")
    print(f"Plays >10% injury risk: {(proba > 0.10).sum()}")

    fi = pd.DataFrame({
        'feature':    X.columns,
        'importance': model.feature_importances_,
    }).sort_values('importance', ascending=False)

    print(f"\nTop 15 Most Important Features — {model_name}:")
    print(fi.head(15).to_string(index=False))

    return model, X.columns.tolist(), fi, (X_test, y_test, proba)


# ─── Model A — Situation Only ─────────────────────────────────────────────────
# Includes the engineered numeric team features (opp_factor, team_culture,
# fatigue_mod) so team identity is captured without leaking raw team names.
# This keeps Model A generalizable to unseen teams while still capturing
# the structural team-level risk signals.

model_a, cols_a, fi_a, eval_a = build_and_evaluate(
    df,
    feature_cols=SITUATION_COLS + TEAM_NUMERIC_COLS,
    model_name="MODEL A — Situation + Numeric Team Factors (No Raw Team Names)",
)

# ─── Model B — Situation + Full Team Identity ─────────────────────────────────
# Adds categorical team name columns (one-hot encoded) so the model can
# learn team-specific injury tendencies beyond the numeric team features.
# This may overfit to the teams in the training set.

model_b, cols_b, fi_b, eval_b = build_and_evaluate(
    df,
    feature_cols=SITUATION_COLS + TEAM_NUMERIC_COLS + TEAM_COLS,
    model_name="MODEL B — Situation + Numeric + Categorical Team Identity",
)


# ─── Model Comparison ─────────────────────────────────────────────────────────

print("\n" + "=" * 60)
print("  MODEL A vs MODEL B — FEATURE IMPORTANCE COMPARISON")
print("=" * 60)

fi_a_ranked = fi_a.reset_index(drop=True).reset_index()
fi_a_ranked.columns = ['rank_A', 'feature', 'importance_A']

fi_b_ranked = fi_b.reset_index(drop=True).reset_index()
fi_b_ranked.columns = ['rank_B', 'feature', 'importance_B']

comparison = pd.merge(fi_a_ranked, fi_b_ranked, on='feature', how='outer')
comparison = comparison.sort_values('importance_B', ascending=False)

print("\nTop 20 features in Model B with their Model A rank:")
print(comparison.head(20)[['feature', 'rank_A', 'importance_A',
                            'rank_B', 'importance_B']].to_string(index=False))

team_features_in_B = [f for f in cols_b if f not in cols_a]
team_fi = fi_b[fi_b['feature'].isin(team_features_in_B)].head(10)
print(f"\nTop 10 Team-Specific Features added in Model B:")
print(team_fi.to_string(index=False))

# ─── Play Type Injury Rate Multipliers ────────────────────────────────────────

print("\n" + "=" * 60)
print("  PLAY TYPE INJURY RISK MULTIPLIERS")
print("=" * 60)

baseline   = df['injury'].mean()
play_rates = df.groupby('play_type')['injury'].mean()

print(f"\nBaseline injury rate: {baseline:.4%}\n")
print(f"{'Play Type':<20} {'Injury Rate':>12} {'Multiplier (vs baseline)':>26}")
print("-" * 60)
for pt, rate in play_rates.sort_values(ascending=False).items():
    multiplier = round(min(max(rate / baseline, 0), 3), 4)
    print(f"{pt:<20} {rate:>11.4%} {multiplier:>26.4f}")


# ─── Season Risk Increase Analysis ────────────────────────────────────────────

def season_risk_increase(df: pd.DataFrame, target: str = 'injury',
                         week_col: str = 'week') -> pd.DataFrame:
    """
    NEW: Compute per-week injury rate and the cumulative risk increase over the season.

    Shows how injury probability evolves as the season progresses —
    i.e., the measurable cost of cumulative fatigue.

    Args:
        df       : play-level DataFrame with injury label and week columns.
        target   : column name for the injury flag (default: 'injury').
        week_col : column name for week number (default: 'week').

    Returns:
        pd.DataFrame with:
            week            — season week number
            n_plays         — plays in that week
            injury_rate     — fraction of plays with injury in that week
            pct_change      — % change in injury rate vs. prior week
            season_increase — cumulative % change from Week 1
    """
    if week_col not in df.columns or target not in df.columns:
        print(f"  Warning: '{week_col}' or '{target}' not in DataFrame — skipping.")
        return pd.DataFrame()

    weekly = (
        df.groupby(week_col)[target]
        .agg(n_plays='count', injury_rate='mean')
        .reset_index()
        .rename(columns={week_col: 'week'})
        .sort_values('week')
    )

    week1_rate = weekly['injury_rate'].iloc[0] if len(weekly) > 0 else 0.0001

    weekly['pct_change']      = weekly['injury_rate'].pct_change() * 100
    weekly['season_increase'] = ((weekly['injury_rate'] - week1_rate) / week1_rate) * 100

    weekly['injury_rate']     = weekly['injury_rate'].round(4)
    weekly['pct_change']      = weekly['pct_change'].round(2)
    weekly['season_increase'] = weekly['season_increase'].round(2)

    return weekly.reset_index(drop=True)


print("\n" + "=" * 60)
print("  SEASON RISK INCREASE — WEEK-OVER-WEEK INJURY RATE")
print("=" * 60)

weekly_risk = season_risk_increase(df)
if not weekly_risk.empty:
    print(f"\n{'Week':>5} {'Plays':>7} {'Inj Rate':>10} {'Wk Change':>11} {'Season Δ':>10}")
    print("-" * 48)
    for _, row in weekly_risk.iterrows():
        chg  = f"{row['pct_change']:+.1f}%"  if not pd.isna(row['pct_change'])      else "  —"
        seas = f"{row['season_increase']:+.1f}%"
        print(f"{int(row['week']):>5} {int(row['n_plays']):>7} "
              f"{row['injury_rate']:>9.2%} {chg:>11} {seas:>10}")


# ─── Feature Importance Plot ──────────────────────────────────────────────────

try:
    fig, axes = plt.subplots(1, 2, figsize=(18, 8))
    for ax, fi, title in zip(
        axes,
        [fi_a.head(15), fi_b.head(15)],
        ['Model A — Situation + Numeric Team Factors',
         'Model B — Situation + Full Team Identity'],
    ):
        ax.barh(fi['feature'][::-1], fi['importance'][::-1], color='steelblue')
        ax.set_title(title, fontsize=13, fontweight='bold')
        ax.set_xlabel('Feature Importance')
        ax.tick_params(axis='y', labelsize=9)

    plt.tight_layout()
    plt.savefig("feature_importance_comparison.png", dpi=150, bbox_inches='tight')
    print("\n✓ Feature importance plot saved to feature_importance_comparison.png")
except Exception as e:
    print(f"\nNote: Could not save plot ({e})")


# ─── Predict on New Plays ─────────────────────────────────────────────────────

def predict_injury_risk(play_features_dict: dict, model, trained_columns: list) -> float:
    """
    Predict injury probability for a single play.

    Args:
        play_features_dict : dict mapping feature name → value for the play.
                             Include 'posteam', 'defteam', 'play_type', 'week'
                             for team identity features to be applied.
        model              : trained RandomForestClassifier (model_a or model_b).
        trained_columns    : list of columns the model was trained on
                             (cols_a or cols_b).

    Returns:
        float — predicted probability of injury on this play (0–1).

    Example:
        prob = predict_injury_risk(
            {
                'down': 3, 'ydstogo': 8, 'play_type': 'pass',
                'posteam': 'KC', 'defteam': 'BUF', 'week': 12,
                'score_differential': -7, 'game_seconds_remaining': 420,
                'wp': 0.28, 'temp': 28, 'wind': 18,
            },
            model_a, cols_a
        )
        print(f"Injury probability: {prob:.2%}")
    """
    # Engineer the numeric team features for this play
    play = dict(play_features_dict)
    play.setdefault('opp_factor',   calc_opp_factor(play.get('defteam', ''),
                                                     play.get('play_type', 'pass')))
    play.setdefault('team_culture', TEAM_INJURY_CULTURE.get(
                                        str(play.get('posteam', '')).upper(), 1.0))
    play.setdefault('fatigue_mod',  season_fatigue_modifier(play.get('week', 9)))

    row = pd.DataFrame([play])
    row = pd.get_dummies(row)
    row = row.reindex(columns=trained_columns, fill_value=0)

    prob = model.predict_proba(row)[0, 1]
    pred = int(prob >= 0.5)
    label = 'INJURY RISK' if pred else 'No Injury Risk'
    print(f"Prediction: {label} | Probability: {prob:.2%}")
    return prob