#!/usr/bin/env python3
"""Resolve a hostname through the system resolver and list unique addresses."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="check_dns"))
