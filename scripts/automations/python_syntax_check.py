#!/usr/bin/env python3
"""Check Python syntax without writing bytecode files."""
from pathlib import Path
import sys
sys.dont_write_bytecode = True  # Avoid creating project __pycache__ during the syntax-only command.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="python_syntax_check"))
