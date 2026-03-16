import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')


df = pd.read_csv("WAS.csv")


df['injury'] = df['desc'].str.contains('injured|injury', case=False, na=False).astype(int)

print(f"\nTotal plays:        {len(df):,}")
print(f"Plays with injuries:{df['injury'].sum():,}")
print(f"Injury rate:        {df['injury'].mean():.2%}\n")

# Cleaning
drop_always = [c for c in ["Unnamed: 0", "desc", "game_date", "game_id",
                            "play_id", "injury_flag"] if c in df.columns]
df = df.drop(columns=drop_always)
df = df.dropna(subset=["play_type"])

# DEFINE FEATURE GROUPS

# Team identity columns — anything that names a specific team
TEAM_COLS = [c for c in df.columns if c in [
    'posteam', 'defteam', 'home_team', 'away_team',
    'possession_team', 'penalty_team', 'td_team',
    'forced_fumble_player_1_team', 'forced_fumble_player_2_team',
    'fumbled_1_team', 'fumbled_2_team',
    'solo_tackle_1_team', 'solo_tackle_2_team',
    'assist_tackle_1_team', 'assist_tackle_2_team',
    'tackle_with_assist_1_team', 'tackle_with_assist_2_team',
    'pass_defense_1_player_name', 'pass_defense_2_player_name',
]]

# Situation / game-state columns — what the model learns from in Model A
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

print("=" * 60)
print("FEATURE SUMMARY")
print("=" * 60)
print(f"Team identity columns found:  {len(TEAM_COLS)}")
print(f"Situation columns found:      {len(SITUATION_COLS)}")
print(f"Team cols: {TEAM_COLS}")
print()

def build_and_evaluate(df, feature_cols, model_name, n_estimators=200, max_depth=10):
    X = df[feature_cols + [TARGET]].copy()

    # Only keep columns that exist in this dataframe
    X = X[[c for c in X.columns if c in df.columns]]

    # Drop rows missing the target
    X = X.dropna(subset=[TARGET])
    y = X.pop(TARGET)

    # One-hot encode any remaining categoricals
    X = pd.get_dummies(X)

    # Fill remaining NaNs with column median
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
        n_jobs=-1
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

    # Feature importance
    fi = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    print(f"\nTop 15 Most Important Features — {model_name}:")
    print(fi.head(15).to_string(index=False))

    return model, X.columns.tolist(), fi, (X_test, y_test, proba)


# MODEL A — SITUATION ONLY (no team identity)
# This reveals what game situations are inherently risky,
# independent of which teams are playing.

model_a, cols_a, fi_a, eval_a = build_and_evaluate(
    df,
    feature_cols=SITUATION_COLS,
    model_name="MODEL A — Situation Factors Only (No Team Identity)"
)

# MODEL B — SITUATION + TEAM IDENTITY
# Adding team columns shows whether specific teams carry
# injury risk beyond what the situation alone explains.

model_b, cols_b, fi_b, eval_b = build_and_evaluate(
    df,
    feature_cols=SITUATION_COLS + TEAM_COLS,
    model_name="MODEL B — Situation + Team Identity"
)

# COMPARISON: WHAT DOES ADDING TEAM INFO CHANGE?

print("\n" + "=" * 60)
print("  MODEL A vs MODEL B — FEATURE IMPORTANCE COMPARISON")
print("=" * 60)

# Merge the two importance tables to see rank shifts
fi_a_ranked = fi_a.reset_index(drop=True).reset_index()
fi_a_ranked.columns = ['rank_A', 'feature', 'importance_A']

fi_b_ranked = fi_b.reset_index(drop=True).reset_index()
fi_b_ranked.columns = ['rank_B', 'feature', 'importance_B']

comparison = pd.merge(fi_a_ranked, fi_b_ranked, on='feature', how='outer')
comparison = comparison.sort_values('importance_B', ascending=False)

print("\nTop 20 features in Model B with their Model A rank:")
print(comparison.head(20)[['feature', 'rank_A', 'importance_A',
                             'rank_B', 'importance_B']].to_string(index=False))

# Features that only appear in Model B (team-specific signals)
team_features_in_B = [f for f in cols_b if f not in cols_a]
team_fi = fi_b[fi_b['feature'].isin(team_features_in_B)].head(10)
print(f"\nTop 10 Team-Specific Features in Model B:")
print(team_fi.to_string(index=False))

# PLAY TYPE MULTIPLIERS (from raw data)

print("\n" + "=" * 60)
print("  PLAY TYPE INJURY RISK MULTIPLIERS")
print("=" * 60)

baseline = df['injury'].mean()
play_rates = df.groupby('play_type')['injury'].mean()

print(f"\nBaseline injury rate: {baseline:.4%}\n")
print(f"{'Play Type':<20} {'Injury Rate':>12} {'Multiplier (0-2)':>18}")
print("-" * 52)
for pt, rate in play_rates.sort_values(ascending=False).items():
    multiplier = round(min(max(rate / baseline, 0), 2), 4)
    print(f"{pt:<20} {rate:>11.4%} {multiplier:>18.4f}")

# PLOT FEATURE IMPORTANCES SIDE BY SIDE

try:
    fig, axes = plt.subplots(1, 2, figsize=(18, 8))

    for ax, fi, title in zip(axes,
                              [fi_a.head(15), fi_b.head(15)],
                              ['Model A — Situation Only', 'Model B — Situation + Team']):
        ax.barh(fi['feature'][::-1], fi['importance'][::-1], color='steelblue')
        ax.set_title(title, fontsize=13, fontweight='bold')
        ax.set_xlabel('Feature Importance')
        ax.tick_params(axis='y', labelsize=9)

    plt.tight_layout()
    plt.savefig("feature_importance_comparison.png", dpi=150, bbox_inches='tight')
    print("\n✓ Feature importance plot saved to feature_importance_comparison.png")
except Exception as e:
    print(f"\nNote: Could not save plot ({e})")

# PREDICT ON NEW PLAYS — REUSABLE FUNCTION

def predict_injury_risk(play_features_dict, model, trained_columns):
    """
    Predict injury probability for a single play.

    Args:
        play_features_dict: dict of feature name → value for the play
        model:              trained RandomForestClassifier (model_a or model_b)
        trained_columns:    list of columns the model was trained on
                            (cols_a for model_a, cols_b for model_b)

    Returns:
        probability (float) — predicted chance of injury on this play

    Example:
        prob = predict_injury_risk(
            {'down': 3, 'ydstogo': 8, 'play_type_run': 0, 'play_type_pass': 1, ...},
            model_a, cols_a
        )
    """
    row = pd.DataFrame([play_features_dict])
    row = pd.get_dummies(row)

    # Align to training columns — fill missing with 0
    row = row.reindex(columns=trained_columns, fill_value=0)

    prob = model.predict_proba(row)[0, 1]
    pred = int(prob >= 0.5)
    print(f"Prediction: {'INJURY RISK' if pred else 'No Injury Risk'} | Probability: {prob:.2%}")
    return prob

