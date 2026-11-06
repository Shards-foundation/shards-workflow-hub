#!/usr/bin/env python3
"""Convert CSV rows to JSON records: python3 csv_to_json.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="csv_to_json"))
