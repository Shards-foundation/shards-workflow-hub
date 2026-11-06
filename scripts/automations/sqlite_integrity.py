#!/usr/bin/env python3
"""Run SQLite integrity_check through a read-only database connection."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="sqlite_integrity"))
