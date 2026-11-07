#!/usr/bin/env python3
"""Find GitHub Actions using mutable refs and optionally require commit SHA pins."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="workflow_action_audit"))
