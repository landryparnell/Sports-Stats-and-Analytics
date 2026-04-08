#NFL Player Risk Score Model
#Claire Rasmussen 2/25/2026
#Play Risk Score=(Play Type Factor x Opponent Factor) + Situational Modifiers
#Player Risk Score = (Position Factor x Play Type Factor x Opponent Factor) + Situational Modifiers

#Preamble
import pandas as pd
import os

DATA_DIR = r'C:\Users\clair\OneDrive\Documents\Sports Stats\MATH 302'

# ─────────────────────────────────────────────────────────────────────────────
# FACTOR DICTIONARIES
# ─────────────────────────────────────────────────────────────────────────────

#Position Factors (preset)
#Original values from Claire's model — unchanged.
#DB added explicitly (same exposure class as CB).
position_factors = {
    'QB': 0.5,  'WR': 1.2,  'RB': 2.0,  'TE': 1.8,
    'S' : 1.6,  'OL': 1.4,  'DL': 1.6,  'CB': 1.4,
    'DB': 1.4,  'LB': 1.8,
}

#Play Type Factors (from Landry's Machine Learning Model)
run_factor  = 1.3172   # injury rate: 5.3305%
pass_factor = 0.8678   # injury rate: 3.5117%

#Opponent Factor (Defense Ranking for Rushing & Passing)
#Source: https://www.foxsports.com/articles/nfl/2025-nfl-defense-rankings-team-pass-and-rush-stats
#Formula: (33 - rank) / 16
#  rank 1  (best defense)  → 2.0000  (highest risk — elite D forces contested plays)
#  rank 32 (worst defense) → 0.0625  (lowest risk)
team_defense_rankings = {
    'ARI': {'rush': 25, 'pass': 24},
    'ATL': {'rush': 24, 'pass': 13},
    'BAL': {'rush': 10, 'pass': 30},
    'BUF': {'rush': 28, 'pass':  1},
    'CAR': {'rush': 20, 'pass': 15},
    'CHI': {'rush': 27, 'pass': 22},
    'CIN': {'rush': 32, 'pass': 26},
    'CLE': {'rush': 16, 'pass':  3},
    'DAL': {'rush': 23, 'pass': 32},
    'DEN': {'rush':  2, 'pass':  7},
    'DET': {'rush': 14, 'pass': 20},
    'GB' : {'rush': 18, 'pass': 11},
    'HOU': {'rush':  4, 'pass':  6},
    'IND': {'rush':  7, 'pass': 30},
    'JAX': {'rush':  1, 'pass': 21},
    'KC' : {'rush':  9, 'pass': 12},
    'LAC': {'rush':  8, 'pass':  5},
    'LA' : {'rush': 12, 'pass': 19},   # Rams (nflfastR abbr: LA)
    'LV' : {'rush': 17, 'pass': 14},   # Raiders (nflfastR abbr: LV)
    'MIA': {'rush': 26, 'pass': 18},
    'MIN': {'rush': 21, 'pass':  2},
    'NE' : {'rush':  6, 'pass':  9},
    'NO' : {'rush': 19, 'pass':  4},
    'NYG': {'rush': 31, 'pass': 16},
    'NYJ': {'rush': 29, 'pass': 17},
    'PHI': {'rush': 22, 'pass':  8},
    'PIT': {'rush': 13, 'pass': 29},
    'SEA': {'rush':  3, 'pass': 10},
    'SF' : {'rush': 11, 'pass': 25},
    'TB' : {'rush':  5, 'pass': 27},
    'TEN': {'rush': 15, 'pass': 23},
    'WAS': {'rush': 30, 'pass': 28},
}

#Situational Modifiers
fatigue_modifiers = {'Q1': 0.5, 'Q2': 1.0, 'Q3': 1.5, 'Q4': 2.0}
weather_modifiers = {'Wet/Cold': 1.75, 'Warm/Dry': 1.25}

# ─────────────────────────────────────────────────────────────────────────────
# FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def calc_opp_factor(rank):
    """Convert a defense ranking (1-32) to an opponent factor via (33 - rank) / 16."""
    return round((33 - rank) / 16, 4)


def calc_position_risk(pos_factor, play_type_factor, opp_factor, sit_mod):
    """
    Player Risk Score formula (unchanged from original):
        (pos_factor x play_type_factor x opp_factor) + sit_mod

    sit_mod = fatigue_modifier + weather_modifier
    """
    return round((pos_factor * play_type_factor * opp_factor) + sit_mod, 4)


def week_to_quarter(week):
    """
    Map an NFL season week number (1-18) to a fatigue quarter label.

    This is the integration bridge between the play-by-play CSV data (which
    uses week numbers) and Claire's quarter-based fatigue modifier system.
    Used by risk_engine.py and the dashboard so both models use the same
    fatigue values.

        Weeks  1-4  -> Q1 (0.5)  early season, off-season conditioning fresh
        Weeks  5-9  -> Q2 (1.0)  mid-season baseline wear
        Weeks 10-13 -> Q3 (1.5)  post-bye fatigue building
        Weeks 14-18 -> Q4 (2.0)  late season, roster attrition, desperation
    """
    if week <= 4:
        return 'Q1'
    elif week <= 9:
        return 'Q2'
    elif week <= 13:
        return 'Q3'
    else:
        return 'Q4'


def season_risk_increase(plays_df, position=None):
    """
    Compute per-week average risk score and cumulative season increase.

    Given a DataFrame with 'week' and 'risk_score' columns (optionally filtered
    by 'position'), shows how risk evolves week-over-week across the season.

    Args:
        plays_df : DataFrame with at minimum 'week' and 'risk_score' columns.
        position : If provided and 'position' column exists, filters to that position.

    Returns:
        pd.DataFrame with columns:
            week            - season week number
            avg_risk        - mean risk score for that week
            pct_change      - % change vs. prior week (NaN for week 1)
            season_increase - cumulative % change from Week 1

    Example:
        df['quarter']    = df['week'].apply(week_to_quarter)
        df['fatigue']    = df['quarter'].map(fatigue_modifiers)
        df['sit_mod']    = df['fatigue'] + weather_modifiers['Warm/Dry']
        df['opp_factor'] = df['defteam'].apply(
            lambda t: calc_opp_factor(team_defense_rankings[t]['rush'])
        )
        df['risk_score'] = df.apply(
            lambda r: calc_position_risk(
                position_factors[r['position']],
                run_factor if r['play_type'] == 'run' else pass_factor,
                r['opp_factor'],
                r['sit_mod']
            ), axis=1
        )
        trend = season_risk_increase(df, position='RB')
        print(trend)
    """
    df = plays_df.copy()
    if position and 'position' in df.columns:
        df = df[df['position'] == position]

    weekly = (
        df.groupby('week')['risk_score']
        .mean()
        .reset_index()
        .rename(columns={'risk_score': 'avg_risk'})
        .sort_values('week')
    )

    week1_risk = weekly['avg_risk'].iloc[0] if len(weekly) > 0 else 1.0
    weekly['pct_change']      = weekly['avg_risk'].pct_change() * 100
    weekly['season_increase'] = ((weekly['avg_risk'] - week1_risk) / week1_risk) * 100
    weekly['avg_risk']        = weekly['avg_risk'].round(4)
    weekly['pct_change']      = weekly['pct_change'].round(2)
    weekly['season_increase'] = weekly['season_increase'].round(2)

    return weekly.reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# INPUT SECTION
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 50)
print("    NFL PLAYER RISK SCORE CALCULATOR")
print("=" * 50)

#Opponent
print("\nAvailable Teams:")
teams = sorted(team_defense_rankings.keys())
for i, t in enumerate(teams, 1):
    print(f"  {i:2}. {t}", end="\t" if i % 4 != 0 else "\n")
print()

while True:
    opp = input("Who is the team playing? Enter opponent abbreviation (e.g. BUF): ").strip().upper()
    if opp in team_defense_rankings:
        break
    print(f"  '{opp}' not found. Please use a team abbreviation from the list above.")

#Quarter
print("\nQuarters: Q1, Q2, Q3, Q4")
while True:
    quarter = input("What quarter is it? ").strip().upper()
    if quarter in fatigue_modifiers:
        break
    print("  Please enter Q1, Q2, Q3, or Q4.")

#Weather
print("\nWeather options: Wet/Cold or Warm/Dry")
while True:
    weather_input = input("What are the weather conditions? ").strip().title()
    if weather_input in weather_modifiers:
        weather = weather_input
        break
    if weather_input.lower() in ['wet', 'cold', 'rain', 'snow']:
        weather = 'Wet/Cold'
        break
    if weather_input.lower() in ['warm', 'dry', 'sun', 'sunny']:
        weather = 'Warm/Dry'
        break
    print("  Please enter 'Wet/Cold' or 'Warm/Dry'.")

# ─────────────────────────────────────────────────────────────────────────────
# CALCULATIONS
# ─────────────────────────────────────────────────────────────────────────────

opp_rush_rank   = team_defense_rankings[opp]['rush']
opp_pass_rank   = team_defense_rankings[opp]['pass']
rush_opp_factor = calc_opp_factor(opp_rush_rank)
pass_opp_factor = calc_opp_factor(opp_pass_rank)
fatigue_mod     = fatigue_modifiers[quarter]
weather_mod     = weather_modifiers[weather]
sit_modifiers   = fatigue_mod + weather_mod

#Build Position Risk Table
rows = []
for position, pos_factor in position_factors.items():
    run_risk  = calc_position_risk(pos_factor, run_factor,  rush_opp_factor, sit_modifiers)
    pass_risk = calc_position_risk(pos_factor, pass_factor, pass_opp_factor, sit_modifiers)
    rows.append({'Position': position, 'Run Risk': run_risk, 'Pass Risk': pass_risk})

results = pd.DataFrame(rows).sort_values('Run Risk', ascending=False).reset_index(drop=True)
results.index += 1

#Play-level risk (no position factor)
play_run_risk  = round((run_factor  * rush_opp_factor) + sit_modifiers, 4)
play_pass_risk = round((pass_factor * pass_opp_factor) + sit_modifiers, 4)

# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "=" * 50)
print(f"  RISK SCORES vs {opp} | {quarter} | {weather}")
print(f"\n  Opponent Rush Defense Rank: #{opp_rush_rank}  (Factor: {rush_opp_factor})")
print(f"  Opponent Pass Defense Rank: #{opp_pass_rank}  (Factor: {pass_opp_factor})")
print(f"  Fatigue Modifier ({quarter}):      {fatigue_mod}")
print(f"  Weather Modifier ({weather}):  {weather_mod}")
print(f"  Total Situational Modifier:   {sit_modifiers}")
print(f"\n  Play-Level Run Risk Score:    {play_run_risk}")
print(f"  Play-Level Pass Risk Score:   {play_pass_risk}")

print("\n--- Position Risk Scores ---\n")
print(results.to_string())

#Export
#results.to_csv(os.path.join(DATA_DIR, 'Position_Risk_Scores.csv'), index=False)
#print(f"\nData saved to Position_Risk_Scores.csv")