#!/usr/bin/env python3
"""Convert a JSON array of objects to CSV: python3 json_to_csv.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="json_to_csv"))
