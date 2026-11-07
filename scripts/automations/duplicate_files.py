#!/usr/bin/env python3
"""Report duplicate files: python3 scripts/automations/duplicate_files.py DIRECTORY."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="duplicate_files"))
