#!/usr/bin/env python3
"""Verify a SHA-256 manifest while rejecting paths escaping the root directory."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="manifest_verify"))
