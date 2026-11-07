#!/usr/bin/env python3
"""Compare directory trees: python3 scripts/automations/compare_directories.py LEFT RIGHT."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="compare_directories"))
