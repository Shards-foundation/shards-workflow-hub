#!/usr/bin/env python3
"""Write a deduplicated CSV copy: python3 csv_deduplicate.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="csv_deduplicate"))
