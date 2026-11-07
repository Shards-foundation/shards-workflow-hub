#!/usr/bin/env python3
"""Validate a v-prefixed or plain semantic-version release tag."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="release_tag_check"))
