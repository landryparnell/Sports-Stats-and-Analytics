"""
generate_data.py
Run this once (or on every CSV update) to produce src/nflData.json.

Automatically detects which teams are present in the CSV —
no code changes needed when you add more team data.

Usage:
    python generate_data.py
    python generate_data.py --csv data/all_teams_filtered.csv --out src/nflData.json
    python generate_data.py --teams KC WAS PHI DAL   # optional: limit to specific teams
"""
import argparse, json, sys
import pandas as pd
from pathlib import Path
from risk_engine import process_team, POSITIONS, ALL_TEAMS

parser = argparse.ArgumentParser()
parser.add_argument("--csv",   default="data/play_by_play_2025_filtered.csv")
parser.add_argument("--out",   default="src/nflData.json")
parser.add_argument("--teams", nargs="*", default=None,
                    help="Limit processing to these team abbreviations (e.g. --teams KC WAS PHI)")
args = parser.parse_args()

if not Path(args.csv).exists():
    print(f"ERROR: CSV not found at '{args.csv}'", file=sys.stderr)
    sys.exit(1)

# Detect which teams actually exist in the CSV
df_check = pd.read_csv(args.csv, low_memory=False, usecols=["posteam"])
teams_in_csv = sorted(df_check["posteam"].dropna().unique().tolist())
print(f"Teams found in CSV: {teams_in_csv}")

# Intersect with known NFL teams (filter out junk values)
valid_teams = [t for t in teams_in_csv if t in ALL_TEAMS]

# Optional CLI override
if args.teams:
    unknown = [t for t in args.teams if t not in ALL_TEAMS]
    if unknown:
        print(f"WARNING: Unknown team abbreviations: {unknown}", file=sys.stderr)
    valid_teams = [t for t in args.teams if t in valid_teams]

if not valid_teams:
    print("ERROR: No valid NFL team abbreviations found in CSV.", file=sys.stderr)
    sys.exit(1)

print(f"Processing {len(valid_teams)} team(s): {valid_teams}\n")

output = {}
for team in valid_teams:
    print(f"Processing {team}...")
    output[team] = process_team(args.csv, team)
    for pos in POSITIONS:
        plays = output[team][pos]
        high  = sum(1 for p in plays if p["isHigh"])
        inj   = sum(1 for p in plays if p["isInjury"])
        print(f"  {pos}: {len(plays)} plays  high={high}  injuries={inj}")
    print()

Path(args.out).parent.mkdir(parents=True, exist_ok=True)
with open(args.out, "w") as f:
    json.dump(output, f, separators=(",", ":"))

kb = Path(args.out).stat().st_size // 1024
print(f"✓ Written to {args.out}  ({kb} KB)")
print(f"✓ Teams in output: {list(output.keys())}")