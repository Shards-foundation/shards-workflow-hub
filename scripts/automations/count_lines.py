#!/usr/bin/env python3
"""Count text-file lines: python3 scripts/automations/count_lines.py FILE_OR_DIRECTORY."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="count_lines"))
