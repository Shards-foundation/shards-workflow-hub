#!/usr/bin/env python3
"""Redact common credential assignments in a new log copy: python3 redact_log.py [--help]."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="redact_log"))
