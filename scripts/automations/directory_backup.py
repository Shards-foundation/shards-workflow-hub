#!/usr/bin/env python3
"""Create a ZIP backup without deleting source files: python3 directory_backup.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="directory_backup"))
