#!/usr/bin/env python3
"""Additional observability, security, portability, and repository hygiene checks."""

from __future__ import annotations

import argparse
import ast
import collections
import csv
import fnmatch
import hashlib
import json
import logging
import os
import re
import socket
import shutil
import sqlite3
import ssl
import stat
import subprocess  # nosec B404: process calls below use fixed argv and never invoke a shell.
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit, urlunsplit
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

LOGGER = logging.getLogger("shards.automation")
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}
SECRET_RULES = (
    ("credential-assignment", re.compile(r"(?i)\b(?:api[_-]?key|secret|token|password|passwd|private[_-]?key)\s*[:=]\s*['\"]?[^\s,;'\"]{8,}")),
    ("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
)
ACTION_USE = re.compile(r"^\s*(?:-\s*)?uses:\s*([^\s#]+)(?:\s+#.*)?$")
MUTABLE_REFS = {"main", "master", "latest", "develop", "development", "dev", "head"}
WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


def add_extended_parsers(subparsers: Any) -> None:
    """Register CLI parsers for the additional automation commands."""
    def add(name: str, description: str) -> argparse.ArgumentParser:
        """Create a command parser with the shared logging option."""
        parser = subparsers.add_parser(name.replace("_", "-"), help=description, description=description)
        parser.add_argument("--log-level", choices=("DEBUG", "INFO", "WARNING", "ERROR"), default="INFO")
        return parser

    p = add("secret_scan", "Scan text files for likely credentials without printing their values")
    p.add_argument("path", type=Path)
    p.add_argument("--max-file-mb", type=float, default=2.0)
    p.add_argument("--exclude", action="append", default=[], help="Additional exact directory or filename component to skip")

    p = add("python_syntax_check", "Compile Python source files in memory without creating bytecode")
    p.add_argument("path", type=Path)

    p = add("whitespace_check", "Report trailing whitespace and missing final newlines")
    p.add_argument("path", type=Path)
    p.add_argument("--glob", default="*", help="Filename glob when path is a directory")

    p = add("filename_portability", "Report file names incompatible with common Windows filesystems")
    p.add_argument("directory", type=Path)
    p.add_argument("--max-path", type=int, default=240)

    p = add("tls_certificate_check", "Check a TLS certificate and report days until expiry")
    p.add_argument("host")
    p.add_argument("--port", type=int, default=443)
    p.add_argument("--timeout", type=float, default=5.0)
    p.add_argument("--minimum-days", type=int, default=14)

    p = add("http_retry_check", "Check an HTTP endpoint with bounded exponential retries")
    p.add_argument("url")
    p.add_argument("--attempts", type=int, default=3)
    p.add_argument("--base-delay", type=float, default=0.5)
    p.add_argument("--max-delay", type=float, default=4.0)
    p.add_argument("--timeout", type=float, default=5.0)

    p = add("http_security_headers", "Report common browser security headers on an HTTP(S) response")
    p.add_argument("url")
    p.add_argument("--timeout", type=float, default=8.0)
    p.add_argument("--require-all", action="store_true", help="Fail when any recommended header is absent")

    p = add("json_log_validate", "Validate JSON Lines logs and optionally require selected fields")
    p.add_argument("file", type=Path)
    p.add_argument("--required-fields", default="", help="Comma-separated object fields required on every record")

    p = add("prometheus_metrics_report", "Summarize Prometheus text exposition metrics")
    p.add_argument("file", type=Path)

    p = add("archive_path_audit", "Detect unsafe absolute or parent-traversal paths in a ZIP archive")
    p.add_argument("archive", type=Path)

    p = add("manifest_verify", "Verify a sha256sum-style manifest against files under a directory")
    p.add_argument("directory", type=Path)
    p.add_argument("manifest", type=Path)

    p = add("disk_threshold_check", "Fail when a filesystem has less free space than a threshold")
    p.add_argument("path", type=Path, nargs="?", default=Path("."))
    p.add_argument("--minimum-free-percent", type=float, default=10.0)
    p.add_argument("--minimum-free-mb", type=float, default=0.0)

    p = add("workflow_action_audit", "Find GitHub Actions pinned to mutable branch or floating refs")
    p.add_argument("path", type=Path)
    p.add_argument("--require-sha", action="store_true", help="Also flag action references not pinned to a 40-character commit SHA")

    p = add("dependency_lock_check", "Report supported package manifests that lack a lock file")
    p.add_argument("directory", type=Path)

    p = add("csv_schema_check", "Check that a CSV contains required column headers")
    p.add_argument("file", type=Path)
    p.add_argument("--required-columns", required=True, help="Comma-separated required column names")

    p = add("json_format", "Write normalized, indented JSON to a separate output file")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    p = add("file_inventory", "Count files and aggregate bytes by extension")
    p.add_argument("directory", type=Path)
    p.add_argument("--top", type=int, default=10, help="Number of largest files to list")

    p = add("service_json_health", "Check an HTTP JSON endpoint for an expected field value")
    p.add_argument("url")
    p.add_argument("--field", default="status")
    p.add_argument("--equals", default="ok")
    p.add_argument("--timeout", type=float, default=8.0)

    p = add("check_dns", "Resolve a hostname and report its unique IP addresses")
    p.add_argument("host")
    p.add_argument("--port", type=int, default=443)

    p = add("git_hygiene", "Report repository changes and whitespace errors without changing Git state")
    p.add_argument("directory", type=Path, nargs="?", default=Path("."))
    p.add_argument("--fail-on-dirty", action="store_true")

    p = add("repo_size_report", "Report repository file count, total bytes, and largest files")
    p.add_argument("directory", type=Path)
    p.add_argument("--top", type=int, default=20)

    p = add("permission_audit", "Report world-writable files under a directory (POSIX only)")
    p.add_argument("directory", type=Path)

    p = add("sqlite_integrity", "Run SQLite integrity_check using a read-only connection")
    p.add_argument("database", type=Path)

    p = add("changelog_check", "Require a semantic-version entry in a changelog")
    p.add_argument("file", type=Path, nargs="?", default=Path("CHANGELOG.md"))

    p = add("csv_rows_check", "Validate CSV row widths against the header")
    p.add_argument("file", type=Path)

    p = add("env_drift_check", "Compare environment variable names without printing values")
    p.add_argument("template", type=Path)
    p.add_argument("environment", type=Path)

    p = add("git_conflict_check", "Scan text files for unresolved merge conflict markers")
    p.add_argument("directory", type=Path)

    p = add("git_submodule_check", "Report uninitialized, changed, or conflicted Git submodules")
    p.add_argument("directory", type=Path, nargs="?", default=Path("."))

    p = add("git_tracked_secrets_check", "Report tracked secret-like environment and key files")
    p.add_argument("directory", type=Path, nargs="?", default=Path("."))

    p = add("json_duplicate_keys", "Reject JSON objects containing duplicate keys")
    p.add_argument("file", type=Path)

    p = add("path_case_check", "Find paths that collide on case-insensitive filesystems")
    p.add_argument("directory", type=Path)

    p = add("python_complexity_report", "Report Python functions with many control-flow branches")
    p.add_argument("path", type=Path)
    p.add_argument("--threshold", type=int, default=10)

    p = add("python_docstring_check", "Require docstrings on public Python functions and classes")
    p.add_argument("path", type=Path)

    p = add("release_tag_check", "Validate a release tag against semantic version syntax")
    p.add_argument("tag")

    p = add("requirements_pin_check", "Report unpinned direct Python requirements")
    p.add_argument("file", type=Path)

    p = add("shell_syntax_check", "Run a shell parser in syntax-only mode over scripts")
    p.add_argument("path", type=Path)
    p.add_argument("--shell", choices=("bash", "sh"), default="bash")

    p = add("sqlite_backup", "Create a consistent SQLite backup to a separate file")
    p.add_argument("database", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    p = add("stale_worktree_report", "Report missing or old Git worktrees without removing them")
    p.add_argument("directory", type=Path, nargs="?", default=Path("."))
    p.add_argument("--minimum-age-days", type=float, default=30.0)


def _resolve_file(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Not a file: {resolved}")
    return resolved


def _resolve_directory(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_dir():
        raise NotADirectoryError(f"Not a directory: {resolved}")
    return resolved


def _walk(path: Path, suffix: str | None = None) -> list[Path]:
    if path.is_file():
        return [path] if not path.is_symlink() and (suffix is None or path.suffix.lower() == suffix.lower()) else []
    ignored = set(SKIP_DIRS)
    result = []
    for candidate in path.rglob("*"):
        if any(part in ignored for part in candidate.parts):
            continue
        if not candidate.is_symlink() and candidate.is_file() and (suffix is None or candidate.suffix.lower() == suffix.lower()):
            result.append(candidate)
    return sorted(result)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_url(url: str) -> str:
    """Return a log-safe URL with credentials, path, query, and fragment removed."""
    parts = urlsplit(url)
    authority = parts.netloc.rsplit("@", 1)[-1]
    return urlunsplit((parts.scheme, authority, "/", "", ""))


def require_http_url(url: str) -> str:
    """Require an absolute HTTP(S) URL with a hostname and valid optional port."""
    try:
        parts = urlsplit(url)
        hostname = parts.hostname
        parts.port
    except ValueError as error:
        raise ValueError("URL must be a valid http(s) URL with a host") from error
    if parts.scheme.lower() not in {"http", "https"} or not hostname:
        raise ValueError("URL must be a valid http(s) URL with a host")
    return url


def _new_output(path: Path, force: bool) -> Path:
    result = path.expanduser().resolve()
    if result.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite {result}; pass --force to replace it")
    result.parent.mkdir(parents=True, exist_ok=True)
    return result


def cmd_secret_scan(args: argparse.Namespace) -> int:
    root = args.path.expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(f"Path does not exist: {root}")
    if args.max_file_mb <= 0:
        raise ValueError("--max-file-mb must be positive")
    extra_excludes = set(args.exclude)
    matches = files_scanned = skipped = 0
    for path in _walk(root):
        relative = path.relative_to(root).as_posix() if root.is_dir() else path.name
        if any(part in extra_excludes for part in path.parts) or any(part in SKIP_DIRS for part in path.parts):
            skipped += 1
            continue
        try:
            if path.stat().st_size > args.max_file_mb * 1024 * 1024:
                skipped += 1
                continue
            data = path.read_bytes()
        except OSError as error:
            LOGGER.warning("Unable to scan %s: %s", relative, error)
            skipped += 1
            continue
        if b"\x00" in data:
            skipped += 1
            continue
        files_scanned += 1
        for line_number, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), start=1):
            for rule, pattern in SECRET_RULES:
                if pattern.search(line):
                    LOGGER.warning("Pattern matched: rule=%s file=%s line=%d (line content suppressed)", rule, relative, line_number)
                    matches += 1
                    break
    LOGGER.info("Secret scan summary: files_scanned=%d skipped=%d findings=%d", files_scanned, skipped, matches)
    return 1 if matches else 0


def cmd_python_syntax_check(args: argparse.Namespace) -> int:
    path = args.path.expanduser().resolve()
    files = _walk(path, ".py")
    if not files:
        raise ValueError(f"No Python files found under {path}")
    failures = 0
    for source in files:
        try:
            compile(source.read_text(encoding="utf-8"), str(source), "exec")
        except (SyntaxError, UnicodeError) as error:
            LOGGER.error("Python syntax error: file=%s line=%s detail=%s", source, getattr(error, "lineno", "?"), error)
            failures += 1
    LOGGER.info("Python syntax check: files=%d failures=%d (no bytecode written)", len(files), failures)
    return 1 if failures else 0


def cmd_whitespace_check(args: argparse.Namespace) -> int:
    path = args.path.expanduser().resolve()
    files = [path] if path.is_file() else sorted(path.glob(args.glob)) if path.is_dir() else []
    files = [candidate for candidate in files if candidate.is_file()]
    if not files:
        raise FileNotFoundError(f"No files found: {path}")
    failures = 0
    for file_path in files:
        try:
            data = file_path.read_bytes()
        except OSError as error:
            LOGGER.warning("Unable to read %s: %s", file_path, error)
            failures += 1
            continue
        if b"\x00" in data:
            continue
        lines = data.decode("utf-8", errors="replace").splitlines(keepends=True)
        for line_number, line in enumerate(lines, 1):
            body = line.rstrip("\r\n")
            if body.endswith((" ", "\t")):
                LOGGER.warning("Trailing whitespace: file=%s line=%d", file_path, line_number)
                failures += 1
        if data and not data.endswith((b"\n", b"\r")):
            LOGGER.warning("Missing final newline: file=%s", file_path)
            failures += 1
    LOGGER.info("Whitespace check: files=%d findings=%d (no files modified)", len(files), failures)
    return 1 if failures else 0


def cmd_filename_portability(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    if args.max_path < 40:
        raise ValueError("--max-path must be at least 40")
    findings = 0
    for path in sorted(root.rglob("*")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        name = path.name
        stem = name.split(".", 1)[0].upper()
        reasons = []
        if stem in WINDOWS_RESERVED:
            reasons.append("reserved-name")
        if any(char in name for char in '<>:"|?*'):
            reasons.append("invalid-character")
        if name.endswith((".", " ")):
            reasons.append("trailing-dot-or-space")
        try:
            relative_length = len(str(path.relative_to(root)))
            if relative_length > args.max_path:
                reasons.append("path-too-long")
        except ValueError:
            pass
        if reasons:
            LOGGER.warning("Non-portable path: path=%s reasons=%s", path.relative_to(root), ",".join(reasons))
            findings += 1
    LOGGER.info("Filename portability check: findings=%d", findings)
    return 1 if findings else 0


def cmd_tls_certificate_check(args: argparse.Namespace) -> int:
    if not 1 <= args.port <= 65535 or args.timeout <= 0 or args.minimum_days < 0:
        raise ValueError("port must be 1..65535, timeout positive, and minimum-days non-negative")
    context = ssl.create_default_context()
    with socket.create_connection((args.host, args.port), timeout=args.timeout) as connection:
        with context.wrap_socket(connection, server_hostname=args.host) as tls_socket:
            cert = tls_socket.getpeercert()
    expires_at = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    remaining = (expires_at - datetime.now(timezone.utc)).total_seconds() / 86400
    LOGGER.info("TLS certificate: host=%s expires_at=%s days_remaining=%.2f", args.host, expires_at.isoformat(), remaining)
    if remaining < args.minimum_days:
        LOGGER.error("TLS certificate expires inside threshold: threshold_days=%d", args.minimum_days)
        return 1
    return 0


def cmd_http_retry_check(args: argparse.Namespace) -> int:
    url = require_http_url(args.url)
    if args.attempts < 1 or args.timeout <= 0 or args.base_delay < 0 or args.max_delay < 0:
        raise ValueError("attempts must be >=1; timeout positive; retry delays non-negative")
    delay = args.base_delay
    for attempt in range(1, args.attempts + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "shards-observability-check/1.0"})
            with urllib.request.urlopen(request, timeout=args.timeout) as response:  # nosec B310
                status = response.status
            if 200 <= status < 400:
                LOGGER.info("Endpoint healthy: url=%s status=%d attempt=%d", safe_url(url), status, attempt)
                return 0
            error_text = f"HTTP {status}"
        except urllib.error.HTTPError as error:
            status = error.code
            error_text = f"HTTP {status}"
            if 400 <= status < 500 and status != 429:
                LOGGER.error("Endpoint returned permanent client error: url=%s status=%d", safe_url(url), status)
                return 1
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            error_text = type(error).__name__
        LOGGER.warning("Endpoint check failed: attempt=%d/%d error=%s", attempt, args.attempts, error_text)
        if attempt < args.attempts:
            time.sleep(min(delay, args.max_delay))
            delay = min(max(delay * 2, args.base_delay), args.max_delay)
        LOGGER.error("Endpoint remained unhealthy after %d attempts: url=%s", args.attempts, safe_url(url))
    return 1


def cmd_http_security_headers(args: argparse.Namespace) -> int:
    url = require_http_url(args.url)
    if args.timeout <= 0:
        raise ValueError("timeout must be positive")
    expected = ("strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy")
    request = urllib.request.Request(url, headers={"User-Agent": "shards-header-audit/1.0"}, method="GET")
    try:
        response = urllib.request.urlopen(request, timeout=args.timeout)  # nosec B310
    except urllib.error.HTTPError as error:
        response = error
    with response:
        present = {name.lower() for name in response.headers.keys()}
        missing = [name for name in expected if name not in present]
        LOGGER.info("HTTP security headers: url=%s status=%d present=%d missing=%d", safe_url(url), response.status, len(expected) - len(missing), len(missing))
        for name in missing:
            LOGGER.warning("Missing recommended response header: %s", name)
    return 1 if args.require_all and missing else 0


def cmd_json_log_validate(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    required = {field.strip() for field in args.required_fields.split(",") if field.strip()}
    records = failures = 0
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                LOGGER.error("Invalid JSON log record: line=%d column=%d detail=%s", line_number, error.colno, error.msg)
                failures += 1
                continue
            if not isinstance(value, dict):
                LOGGER.error("JSON log record must be an object: line=%d", line_number)
                failures += 1
                continue
            absent = required - value.keys()
            if absent:
                LOGGER.error("Missing required log fields: line=%d fields=%s", line_number, ",".join(sorted(absent)))
                failures += 1
            records += 1
    LOGGER.info("JSON log validation: file=%s records=%d failures=%d", path, records, failures)
    return 1 if failures else 0


def cmd_prometheus_metrics_report(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    line_pattern = re.compile(r"^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{.*\})?\s+(?:[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|NaN|[+-]?Inf)(?:\s+\d+)?$")
    counts: collections.Counter[str] = collections.Counter()
    malformed = 0
    with path.open("r", encoding="utf-8", errors="replace") as stream:
        for line_number, line in enumerate(stream, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            match = line_pattern.match(stripped)
            if not match:
                LOGGER.warning("Malformed metric line: line=%d", line_number)
                malformed += 1
                continue
            family = re.sub(r"_(?:bucket|sum|count)$", "", match.group(1))
            counts[family] += 1
    LOGGER.info("Prometheus exposition: metric_samples=%d families=%d malformed=%d", sum(counts.values()), len(counts), malformed)
    for name, count in sorted(counts.items()):
        LOGGER.info("metric_family=%s samples=%d", name, count)
    return 1 if malformed else 0


def cmd_archive_path_audit(args: argparse.Namespace) -> int:
    path = _resolve_file(args.archive)
    unsafe = 0
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            name = member.filename.replace("\\", "/")
            parsed = PurePosixPath(name)
            if parsed.is_absolute() or ".." in parsed.parts or re.match(r"^[A-Za-z]:", name):
                LOGGER.error("Unsafe archive path detected: %s", member.filename)
                unsafe += 1
        count = len(archive.infolist())
    LOGGER.info("Archive path audit: archive=%s members=%d unsafe_paths=%d (archive not extracted)", path, count, unsafe)
    return 1 if unsafe else 0


def cmd_manifest_verify(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    manifest = _resolve_file(args.manifest)
    checked = failures = 0
    with manifest.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            match = re.fullmatch(r"([a-fA-F0-9]{64})\s+[* ](.+)", line.rstrip("\r\n"))
            if not match:
                LOGGER.error("Invalid checksum record: line=%d", line_number)
                failures += 1
                continue
            expected, relative_name = match.groups()
            candidate = (root / relative_name).resolve()
            try:
                candidate.relative_to(root)
            except ValueError:
                LOGGER.error("Manifest path escapes root: line=%d", line_number)
                failures += 1
                continue
            if not candidate.is_file():
                LOGGER.error("Manifest file missing: path=%s", relative_name)
                failures += 1
                continue
            actual = _sha256(candidate)
            checked += 1
            if actual.lower() != expected.lower():
                LOGGER.error("Checksum mismatch: path=%s", relative_name)
                failures += 1
    LOGGER.info("Manifest verification: checked=%d failures=%d", checked, failures)
    return 1 if failures else 0


def cmd_disk_threshold_check(args: argparse.Namespace) -> int:
    if not 0 <= args.minimum_free_percent <= 100 or args.minimum_free_mb < 0:
        raise ValueError("minimum-free-percent must be 0..100 and minimum-free-mb non-negative")
    path = args.path.expanduser().resolve()
    usage = shutil.disk_usage(path)
    total = usage.total
    free = usage.free
    free_percent = 100 * free / total if total else 0.0
    free_mb = free / (1024 * 1024)
    LOGGER.info("Disk threshold: path=%s free_percent=%.2f free_mb=%.1f", path, free_percent, free_mb)
    if free_percent < args.minimum_free_percent or free_mb < args.minimum_free_mb:
        LOGGER.error("Disk space is below configured threshold")
        return 1
    return 0


def cmd_workflow_action_audit(args: argparse.Namespace) -> int:
    path = args.path.expanduser().resolve()
    files = [path] if path.is_file() else [*path.rglob("*.yml"), *path.rglob("*.yaml")] if path.is_dir() else []
    if not files:
        raise FileNotFoundError(f"No YAML workflow files found: {path}")
    findings = 0
    for workflow in sorted(set(files)):
        if any(part in SKIP_DIRS for part in workflow.parts):
            continue
        for line_number, line in enumerate(workflow.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            match = ACTION_USE.match(line)
            if not match:
                continue
            reference = match.group(1)
            if reference.startswith("./") or reference.startswith("docker://"):
                continue
            if "@" not in reference:
                LOGGER.warning("Action has no explicit ref: file=%s line=%d", workflow, line_number)
                findings += 1
                continue
            ref = reference.rsplit("@", 1)[1].lower()
            mutable = ref in MUTABLE_REFS or ref.startswith("refs/heads/")
            sha_missing = not re.fullmatch(r"[0-9a-f]{40}", ref)
            if mutable or (args.require_sha and sha_missing):
                LOGGER.warning("Mutable or unpinned action ref: file=%s line=%d action=%s", workflow, line_number, reference)
                findings += 1
    LOGGER.info("Workflow action audit: files=%d findings=%d", len(files), findings)
    return 1 if findings else 0


def cmd_dependency_lock_check(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    findings = 0
    for manifest in _walk(root):
        if manifest.name == "package.json":
            siblings = {child.name for child in manifest.parent.iterdir() if child.is_file()}
            locks = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}
            if not siblings & locks:
                LOGGER.warning("Node dependency manifest has no lockfile: %s", manifest.relative_to(root))
                findings += 1
        elif manifest.name == "pyproject.toml":
            siblings = {child.name for child in manifest.parent.iterdir() if child.is_file()}
            lock_names = {"uv.lock", "poetry.lock", "pdm.lock", "Pipfile.lock"}
            if not siblings & lock_names:
                LOGGER.warning("Python dependency manifest has no recognized lockfile: %s", manifest.relative_to(root))
                findings += 1
    LOGGER.info("Dependency lock audit: findings=%d", findings)
    return 1 if findings else 0


def cmd_csv_schema_check(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    required = {item.strip() for item in args.required_columns.split(",") if item.strip()}
    if not required:
        raise ValueError("Provide at least one required column")
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream)
        try:
            headers = next(reader)
        except StopIteration as error:
            raise ValueError("CSV file is empty") from error
    duplicates = sorted(name for name, count in collections.Counter(headers).items() if count > 1)
    missing = sorted(required - set(headers))
    if duplicates:
        LOGGER.error("Duplicate CSV headers: %s", ",".join(duplicates))
    if missing:
        LOGGER.error("Missing required CSV headers: %s", ",".join(missing))
    LOGGER.info("CSV schema check: file=%s columns=%d missing=%d duplicate_headers=%d", path, len(headers), len(missing), len(duplicates))
    return 1 if missing or duplicates else 0


def cmd_json_format(args: argparse.Namespace) -> int:
    source = _resolve_file(args.input)
    target_path = args.output.expanduser().resolve()
    if source == target_path:
        raise ValueError("Input and output paths must be different")
    target = _new_output(args.output, args.force)
    with source.open("r", encoding="utf-8") as stream:
        value = json.load(stream)
    with target.open("w", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, sort_keys=True)
        stream.write("\n")
    LOGGER.info("JSON formatted: output=%s", target)
    return 0


def cmd_file_inventory(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    if args.top < 0:
        raise ValueError("--top must be non-negative")
    extensions: collections.Counter[str] = collections.Counter()
    sizes: collections.Counter[str] = collections.Counter()
    largest: list[tuple[int, Path]] = []
    file_count = total_bytes = 0
    for path in _walk(root):
        try:
            size = path.stat().st_size
        except OSError as error:
            LOGGER.warning("Unable to stat %s: %s", path, error)
            continue
        extension = path.suffix.lower() or "[no extension]"
        extensions[extension] += 1
        sizes[extension] += size
        file_count += 1
        total_bytes += size
        largest.append((size, path))
    LOGGER.info("File inventory: root=%s files=%d total_bytes=%d extensions=%d", root, file_count, total_bytes, len(extensions))
    for extension, count in extensions.most_common():
        LOGGER.info("extension=%s files=%d bytes=%d", extension, count, sizes[extension])
    for size, path in sorted(largest, reverse=True)[:args.top]:
        LOGGER.info("largest_file bytes=%d path=%s", size, path.relative_to(root))
    return 0


def cmd_service_json_health(args: argparse.Namespace) -> int:
    url = require_http_url(args.url)
    if args.timeout <= 0:
        raise ValueError("timeout must be positive")
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "shards-json-health/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:  # nosec B310
            status_code = response.status
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        LOGGER.error("Health endpoint request failed: url=%s error=%s", safe_url(url), type(error).__name__)
        return 1
    except (UnicodeError, json.JSONDecodeError) as error:
        LOGGER.error("Health endpoint returned invalid JSON: %s", error)
        return 1
    if not isinstance(payload, dict):
        LOGGER.error("Health endpoint JSON must be an object")
        return 1
    actual = payload.get(args.field)
    healthy = status_code < 400 and actual == args.equals
    LOGGER.info("JSON health endpoint: url=%s http_status=%d field=%s matches_expected=%s", safe_url(url), status_code, args.field, healthy)
    if not healthy:
        LOGGER.error("Health condition did not match expected value")
    return 0 if healthy else 1


def cmd_check_dns(args: argparse.Namespace) -> int:
    if not 1 <= args.port <= 65535:
        raise ValueError("port must be between 1 and 65535")
    try:
        answers = socket.getaddrinfo(args.host, args.port, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        LOGGER.error("DNS lookup failed: host=%s reason=%s", args.host, error)
        return 1
    addresses = sorted({answer[4][0] for answer in answers})
    LOGGER.info("DNS resolved: host=%s address_count=%d addresses=%s", args.host, len(addresses), ",".join(addresses))
    return 0 if addresses else 1


def cmd_git_hygiene(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    status = subprocess.run(["git", "-C", str(root), "status", "--short", "--untracked-files=all"], capture_output=True, text=True, timeout=20)  # nosec B603
    if status.returncode != 0:
        raise ValueError(status.stderr.strip() or f"Not a Git repository: {root}")
    whitespace = subprocess.run(["git", "-C", str(root), "diff", "--check"], capture_output=True, text=True, timeout=20)  # nosec B603
    if whitespace.returncode != 0:
        LOGGER.error("Git whitespace check failed")
        for line in whitespace.stdout.splitlines()[:50]:
            LOGGER.error("%s", line)
    changed = [line for line in status.stdout.splitlines() if line.strip()]
    LOGGER.info("Git hygiene: root=%s changed_paths=%d whitespace_errors=%s", root, len(changed), whitespace.returncode != 0)
    for line in changed[:100]:
        LOGGER.info("git_status=%s", line)
    if whitespace.returncode != 0 or (args.fail_on_dirty and changed):
        return 1
    return 0


def cmd_repo_size_report(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    if args.top < 0:
        raise ValueError("--top must be non-negative")
    files = _walk(root)
    entries = []
    total = 0
    for path in files:
        try:
            size = path.stat().st_size
        except OSError as error:
            LOGGER.warning("Unable to stat %s: %s", path, error)
            continue
        entries.append((size, path))
        total += size
    LOGGER.info("Repository size: root=%s files=%d total_bytes=%d", root, len(entries), total)
    for size, path in sorted(entries, reverse=True)[:args.top]:
        LOGGER.info("largest_file bytes=%d path=%s", size, path.relative_to(root))
    return 0


def cmd_permission_audit(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    if os.name == "nt":
        LOGGER.warning("POSIX permission-bit audit is not available on Windows")
        return 0
    findings = 0
    for path in _walk(root):
        try:
            mode = path.lstat().st_mode
        except OSError as error:
            LOGGER.warning("Unable to inspect permissions for %s: %s", path, error)
            continue
        if mode & stat.S_IWOTH:
            LOGGER.warning("World-writable file: path=%s mode=%04o", path.relative_to(root), stat.S_IMODE(mode))
            findings += 1
    LOGGER.info("Permission audit: files_with_world_write=%d", findings)
    return 1 if findings else 0


def cmd_sqlite_integrity(args: argparse.Namespace) -> int:
    database = _resolve_file(args.database)
    uri = database.as_uri() + "?mode=ro"
    try:
        connection = sqlite3.connect(uri, uri=True, timeout=5)
        try:
            results = [row[0] for row in connection.execute("PRAGMA integrity_check")]
        finally:
            connection.close()
    except sqlite3.DatabaseError as error:
        LOGGER.error("SQLite integrity check could not run: %s", error)
        return 1
    ok = results == ["ok"]
    LOGGER.info("SQLite integrity: database=%s result=%s", database, "; ".join(results[:5]))
    return 0 if ok else 1


def cmd_changelog_check(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    heading = re.compile(r"^##\s+\[?v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?\]?(?:\s|$)")
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if heading.match(line):
            LOGGER.info("Changelog release entry found: file=%s line=%d", path, line_number)
            return 0
    LOGGER.error("No semantic-version release heading found: %s", path)
    return 1


def cmd_csv_rows_check(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    failures = rows = 0
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream)
        try:
            headers = next(reader)
        except StopIteration as error:
            raise ValueError("CSV file is empty") from error
        expected = len(headers)
        for line_number, row in enumerate(reader, 2):
            if not row:
                continue
            rows += 1
            if len(row) != expected:
                LOGGER.error("CSV field count mismatch: line=%d expected=%d actual=%d", line_number, expected, len(row))
                failures += 1
    LOGGER.info("CSV row-width check: file=%s rows=%d failures=%d", path, rows, failures)
    return 1 if failures else 0


def _env_keys(path: Path) -> set[str]:
    keys = set()
    with _resolve_file(path).open("r", encoding="utf-8", errors="replace") as stream:
        for line in stream:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith("export "):
                stripped = stripped[7:].lstrip()
            key, separator, _value = stripped.partition("=")
            key = key.strip()
            if separator and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                keys.add(key)
    return keys


def cmd_env_drift_check(args: argparse.Namespace) -> int:
    expected = _env_keys(args.template)
    actual = _env_keys(args.environment)
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    for key in missing:
        LOGGER.error("Environment key missing from target: %s", key)
    for key in extra:
        LOGGER.warning("Environment key not documented in template: %s", key)
    LOGGER.info("Environment key drift: expected=%d actual=%d missing=%d extra=%d (values suppressed)", len(expected), len(actual), len(missing), len(extra))
    return 1 if missing or extra else 0


def cmd_git_conflict_check(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    marker = re.compile(r"^(?:<{7}(?:\s|$)|={7,}$|>{7}(?:\s|$)|\|{7}(?:\s|$))")
    findings = files = 0
    for path in _walk(root):
        try:
            data = path.read_bytes()
        except OSError as error:
            LOGGER.warning("Unable to scan %s: %s", path, error)
            continue
        if b"\x00" in data:
            continue
        files += 1
        for line_number, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), 1):
            if marker.match(line):
                LOGGER.error("Possible merge-conflict marker: file=%s line=%d", path.relative_to(root), line_number)
                findings += 1
    LOGGER.info("Conflict marker scan: files=%d findings=%d", files, findings)
    return 1 if findings else 0


def cmd_git_submodule_check(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    result = subprocess.run(["git", "-C", str(root), "submodule", "status", "--recursive"], capture_output=True, text=True, timeout=30)  # nosec B603
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "git submodule status failed")
    findings = 0
    for line in result.stdout.splitlines():
        if not line:
            continue
        state = line[0]
        if state in "-+U":
            LOGGER.warning("Submodule needs attention: state=%s detail=%s", state, line[1:].strip())
            findings += 1
        else:
            LOGGER.info("Submodule initialized: %s", line[1:].strip())
    LOGGER.info("Submodule check: findings=%d", findings)
    return 1 if findings else 0


def cmd_git_tracked_secrets_check(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    result = subprocess.run(["git", "-C", str(root), "ls-files", "-z"], capture_output=True, timeout=20)  # nosec B603
    if result.returncode != 0:
        raise ValueError("Unable to list tracked files; directory must be in a Git repository")
    patterns = (".env", ".env.*", "*.pem", "*.p12", "*.pfx", "*.key", "id_rsa*", "id_ed25519*", "secrets.*", "service-account*.json")
    safe_names = {".env.example", ".env.sample", ".env.template", ".env.test.example"}
    findings = []
    for name in result.stdout.decode("utf-8", errors="replace").split("\x00"):
        if not name:
            continue
        basename = Path(name).name.lower()
        if basename in safe_names:
            continue
        if any(fnmatch.fnmatch(basename, pattern) for pattern in patterns):
            findings.append(name)
    for name in findings:
        LOGGER.error("Potentially sensitive file is tracked: %s", name)
    LOGGER.info("Tracked secret-file audit: findings=%d", len(findings))
    return 1 if findings else 0


def cmd_json_duplicate_keys(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    duplicates: list[str] = []

    def object_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        """Collect duplicate keys while retaining the last parsed value."""
        record: dict[str, Any] = {}
        for key, value in pairs:
            if key in record:
                duplicates.append(key)
            record[key] = value
        return record

    with path.open("r", encoding="utf-8") as stream:
        json.load(stream, object_pairs_hook=object_hook)
    for _key in duplicates:
        LOGGER.error("Duplicate JSON object key detected (key suppressed)")
    LOGGER.info("JSON duplicate-key check: file=%s duplicates=%d", path, len(duplicates))
    return 1 if duplicates else 0


def cmd_path_case_check(args: argparse.Namespace) -> int:
    root = _resolve_directory(args.directory)
    seen: dict[str, str] = {}
    findings = 0
    for path in sorted(root.rglob("*")):
        if path.is_symlink() or any(part in SKIP_DIRS for part in path.parts):
            continue
        relative = path.relative_to(root).as_posix()
        key = relative.casefold()
        previous = seen.get(key)
        if previous is not None and previous != relative:
            LOGGER.error("Case-insensitive path collision: first=%s second=%s", previous, relative)
            findings += 1
        else:
            seen[key] = relative
    LOGGER.info("Path case-collision check: findings=%d", findings)
    return 1 if findings else 0


def _branch_count(function: ast.AST) -> int:
    branches = 0
    stack = [function]
    while stack:
        node = stack.pop()
        if isinstance(node, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try, ast.ExceptHandler)):
            branches += 1
        elif isinstance(node, ast.BoolOp):
            branches += max(0, len(node.values) - 1)
        for child in ast.iter_child_nodes(node):
            if child is not function and isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
                continue
            stack.append(child)
    return branches


def cmd_python_complexity_report(args: argparse.Namespace) -> int:
    if args.threshold < 1:
        raise ValueError("--threshold must be positive")
    path = args.path.expanduser().resolve()
    files = _walk(path, ".py")
    if not files:
        raise ValueError(f"No Python files found under {path}")
    hotspots = 0
    for source in files:
        tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                score = 1 + _branch_count(node)
                if score >= args.threshold:
                    LOGGER.warning("Complex function: file=%s function=%s line=%d branch_score=%d", source, node.name, node.lineno, score)
                    hotspots += 1
    LOGGER.info("Python complexity report: files=%d hotspots=%d threshold=%d", len(files), hotspots, args.threshold)
    return 1 if hotspots else 0


def cmd_python_docstring_check(args: argparse.Namespace) -> int:
    path = args.path.expanduser().resolve()
    files = _walk(path, ".py")
    if not files:
        raise ValueError(f"No Python files found under {path}")
    findings = 0
    for source in files:
        tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not node.name.startswith(("_", "cmd_")):
                if ast.get_docstring(node) is None:
                    LOGGER.warning("Missing public docstring: file=%s symbol=%s line=%d", source, node.name, node.lineno)
                    findings += 1
    LOGGER.info("Python docstring audit: files=%d findings=%d", len(files), findings)
    return 1 if findings else 0


def cmd_release_tag_check(args: argparse.Namespace) -> int:
    pattern = re.compile(r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$")
    if not pattern.fullmatch(args.tag):
        LOGGER.error("Invalid semantic version tag: %s", args.tag)
        return 1
    LOGGER.info("Semantic version tag is valid: %s", args.tag)
    return 0


def cmd_requirements_pin_check(args: argparse.Namespace) -> int:
    path = _resolve_file(args.file)
    pin = re.compile(r"^[A-Za-z0-9_.-]+(?:\[[A-Za-z0-9_,.-]+\])?\s*==\s*[^\s;]+(?:\s*;.*)?$")
    findings = checked = 0
    with path.open("r", encoding="utf-8") as stream:
        for line_number, raw_line in enumerate(stream, 1):
            line = raw_line.strip()
            if not line or line.startswith("#") or line.startswith(("-", "--")):
                continue
            checked += 1
            if not pin.fullmatch(line):
                LOGGER.warning("Requirement is not an exact version pin: file=%s line=%d", path, line_number)
                findings += 1
    LOGGER.info("Requirements pin audit: file=%s checked=%d findings=%d", path, checked, findings)
    return 1 if findings else 0


def cmd_shell_syntax_check(args: argparse.Namespace) -> int:
    if args.shell not in {"bash", "sh"}:
        raise ValueError("Shell must be exactly bash or sh")
    path = args.path.expanduser().resolve()
    files = _walk(path, ".sh")
    if not files:
        raise ValueError(f"No shell scripts found under {path}")
    failures = 0
    for source in files:
        if args.shell == "bash":
            result = subprocess.run(["bash", "-n", str(source)], capture_output=True, text=True, timeout=20, check=False)  # nosec B603
        else:
            result = subprocess.run(["sh", "-n", str(source)], capture_output=True, text=True, timeout=20, check=False)  # nosec B603
        if result.returncode:
            LOGGER.error("Shell syntax error: file=%s detail=%s", source, result.stderr.strip())
            failures += 1
    LOGGER.info("Shell syntax check: shell=%s files=%d failures=%d", args.shell, len(files), failures)
    return 1 if failures else 0


def cmd_sqlite_backup(args: argparse.Namespace) -> int:
    source = _resolve_file(args.database)
    destination = args.output.expanduser().resolve()
    if source == destination:
        raise ValueError("Database and backup paths must be different")
    if destination.exists() and not args.force:
        raise FileExistsError(f"Refusing to overwrite {destination}; pass --force to replace it")
    destination.parent.mkdir(parents=True, exist_ok=True)
    source_connection = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=10)
    destination_connection = sqlite3.connect(str(destination), timeout=10)
    try:
        source_connection.backup(destination_connection)
        integrity = [row[0] for row in destination_connection.execute("PRAGMA integrity_check")]
    except sqlite3.DatabaseError as error:
        LOGGER.error("SQLite backup failed: %s", error)
        return 1
    finally:
        destination_connection.close()
        source_connection.close()
    if integrity != ["ok"]:
        LOGGER.error("SQLite backup integrity verification failed: %s", "; ".join(integrity[:5]))
        return 1
    LOGGER.info("SQLite backup created and verified: output=%s", destination)
    return 0


def cmd_stale_worktree_report(args: argparse.Namespace) -> int:
    if args.minimum_age_days < 0:
        raise ValueError("--minimum-age-days must be non-negative")
    root = _resolve_directory(args.directory)
    result = subprocess.run(["git", "-C", str(root), "worktree", "list", "--porcelain"], capture_output=True, text=True, timeout=20)  # nosec B603
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "git worktree list failed")
    now = time.time()
    findings = worktrees = 0
    for block in result.stdout.strip().split("\n\n"):
        if not block.strip():
            continue
        first = next((line[9:] for line in block.splitlines() if line.startswith("worktree ")), "")
        if not first or "bare" in block.splitlines():
            continue
        worktrees += 1
        worktree = Path(first)
        if not worktree.exists():
            LOGGER.warning("Missing worktree path: %s", first)
            findings += 1
            continue
        age_days = (now - worktree.stat().st_mtime) / 86400
        if age_days >= args.minimum_age_days:
            LOGGER.info("Old worktree candidate: path=%s age_days=%.1f (report only; not removed)", first, age_days)
            findings += 1
    LOGGER.info("Worktree report: worktrees=%d old_or_missing=%d", worktrees, findings)
    return 1 if findings else 0


EXTENDED_HANDLERS = {
    "secret-scan": cmd_secret_scan,
    "python-syntax-check": cmd_python_syntax_check,
    "whitespace-check": cmd_whitespace_check,
    "filename-portability": cmd_filename_portability,
    "tls-certificate-check": cmd_tls_certificate_check,
    "http-retry-check": cmd_http_retry_check,
    "http-security-headers": cmd_http_security_headers,
    "json-log-validate": cmd_json_log_validate,
    "prometheus-metrics-report": cmd_prometheus_metrics_report,
    "archive-path-audit": cmd_archive_path_audit,
    "manifest-verify": cmd_manifest_verify,
    "disk-threshold-check": cmd_disk_threshold_check,
    "workflow-action-audit": cmd_workflow_action_audit,
    "dependency-lock-check": cmd_dependency_lock_check,
    "csv-schema-check": cmd_csv_schema_check,
    "json-format": cmd_json_format,
    "file-inventory": cmd_file_inventory,
    "service-json-health": cmd_service_json_health,
    "check-dns": cmd_check_dns,
    "git-hygiene": cmd_git_hygiene,
    "repo-size-report": cmd_repo_size_report,
    "permission-audit": cmd_permission_audit,
    "sqlite-integrity": cmd_sqlite_integrity,
    "changelog-check": cmd_changelog_check,
    "csv-rows-check": cmd_csv_rows_check,
    "env-drift-check": cmd_env_drift_check,
    "git-conflict-check": cmd_git_conflict_check,
    "git-submodule-check": cmd_git_submodule_check,
    "git-tracked-secrets-check": cmd_git_tracked_secrets_check,
    "json-duplicate-keys": cmd_json_duplicate_keys,
    "path-case-check": cmd_path_case_check,
    "python-complexity-report": cmd_python_complexity_report,
    "python-docstring-check": cmd_python_docstring_check,
    "release-tag-check": cmd_release_tag_check,
    "requirements-pin-check": cmd_requirements_pin_check,
    "shell-syntax-check": cmd_shell_syntax_check,
    "sqlite-backup": cmd_sqlite_backup,
    "stale-worktree-report": cmd_stale_worktree_report,
}
