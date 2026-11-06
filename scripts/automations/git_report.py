#!/usr/bin/env python3
"""Report Git branch and working-tree state: python3 git_report.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="git_report"))
