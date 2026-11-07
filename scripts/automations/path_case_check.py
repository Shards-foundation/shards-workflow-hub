#!/usr/bin/env python3
"""Find paths that collide on case-insensitive filesystems."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="path_case_check"))
