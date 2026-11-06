#!/usr/bin/env python3
"""Check HTTP(S) reachability with a timeout: python3 check_url.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="check_url"))
