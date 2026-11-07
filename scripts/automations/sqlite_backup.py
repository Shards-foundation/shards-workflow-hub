#!/usr/bin/env python3
"""Create and integrity-check a SQLite backup in a separate output file."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="sqlite_backup"))
