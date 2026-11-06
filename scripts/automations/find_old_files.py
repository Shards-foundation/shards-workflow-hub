#!/usr/bin/env python3
"""Report old files without removing them: python3 find_old_files.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="find_old_files"))
