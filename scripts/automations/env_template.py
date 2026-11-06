#!/usr/bin/env python3
"""Create a blank environment template from key names only: python3 env_template.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="env_template"))
