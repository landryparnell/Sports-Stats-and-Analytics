"""
generate_data.py
Run this once (or on every CSV update) to produce src/nflData.json.

Usage:
    python generate_data.py
    python generate_data.py --csv data/WAS_KC_filtered.csv --out src/nflData.json
"""
import argparse, json, sys
from pathlib import Path
from risk_engine import process_team, POSITIONS

parser = argparse.ArgumentParser()
parser.add_argument("--csv", default="data/WAS_KC_filtered.csv")
parser.add_argument("--out", default="src/nflData.json")
args = parser.parse_args()

if not Path(args.csv).exists():
    print(f"ERROR: CSV not found at '{args.csv}'", file=sys.stderr)
    sys.exit(1)

output = {}
for team in ["KC", "WAS"]:
    print(f"Processing {team}...")
    output[team] = process_team(args.csv, team)
    for pos in POSITIONS:
        plays = output[team][pos]
        high  = sum(1 for p in plays if p["isHigh"])
        inj   = sum(1 for p in plays if p["isInjury"])
        print(f"  {pos}: {len(plays)} plays  high={high}  injuries={inj}")

Path(args.out).parent.mkdir(parents=True, exist_ok=True)
with open(args.out, "w") as f:
    json.dump(output, f, separators=(",", ":"))

kb = Path(args.out).stat().st_size // 1024
print(f"\n✓ Written to {args.out}  ({kb} KB)")