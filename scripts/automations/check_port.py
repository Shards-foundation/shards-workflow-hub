#!/usr/bin/env python3
"""Check TCP connectivity: python3 scripts/automations/check_port.py HOST PORT [--timeout SECONDS]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="check_port"))
