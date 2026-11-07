#!/usr/bin/env python3
"""Check TLS certificate trust and expiry with a bounded socket timeout."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.automations.cli import main
if __name__ == "__main__":
    raise SystemExit(main(forced_command="tls_certificate_check"))
