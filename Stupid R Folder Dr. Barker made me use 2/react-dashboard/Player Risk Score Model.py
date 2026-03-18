#NFL Player Risk Score Model
#Claire Rasmussen 2/25/2026
#Play Risk Score=(Play Type Factor x Opponent Factor) + Situational Modifiers
#Player Risk Score = (Position Factor x Play Type Factor x Opponent Factor) + Situational Modifiers

#Preamble
import pandas as pd
import os

DATA_DIR = r'C:\Users\clair\OneDrive\Documents\Sports Stats\MATH 302'

#Factor Dictionaries

#Position Factors (preset)
position_factors = {
    'QB': 0.5, 'WR': 1.2, 'RB': 2.0, 'TE': 1.8,
    'S' : 1.6, 'OL': 1.4, 'DL': 1.6, 'CB': 1.4,
    'DB': 1.4, 'LB': 1.8
}

#Play Type Factors (from Landry's Machine Learning Model)
run_factor  = 1.3172   # injury rate: 5.3305%
pass_factor = 0.8678   # injury rate: 3.5117%

#Opponent Factor (Defense Ranking for Rushing & Passing)
#source: https://www.foxsports.com/articles/nfl/2025-nfl-defense-rankings-team-pass-and-rush-stats
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
    'LAR': {'rush': 12, 'pass': 19},
    'LVR': {'rush': 17, 'pass': 14},
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

#Functions
def calc_opp_factor(rank):
    return round((33 - rank) / 16, 4)

def calc_position_risk(pos_factor, play_type_factor, opp_factor, sit_mod):  # FIX: renamed from calc_player_risk
    return round((pos_factor * play_type_factor * opp_factor) + sit_mod, 4)

#Input Section
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

#Calculations
opp_rush_rank   = team_defense_rankings[opp]['rush']
opp_pass_rank   = team_defense_rankings[opp]['pass']
rush_opp_factor = calc_opp_factor(opp_rush_rank)
pass_opp_factor = calc_opp_factor(opp_pass_rank)
fatigue_mod     = fatigue_modifiers[quarter]
weather_mod     = weather_modifiers[weather]
sit_modifiers   = fatigue_mod + weather_mod

#Build Position Risk Table  # FIX: replaced all roster/summary code with this
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

#Output
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




















