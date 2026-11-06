#!/usr/bin/env python3
"""Dependency-free, report-first automation commands for files, data, and local services.

Python 3.9+. Every write operation creates a new output file by default and refuses
replacement unless ``--force`` is explicitly supplied. No command deletes input data.
"""

from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import logging
import re
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from scripts.automations.extended import EXTENDED_HANDLERS, add_extended_parsers, safe_url

LOGGER = logging.getLogger("shards.automation")
LOG_FORMAT = "%(asctime)s %(levelname)s %(message)s"
CHUNK_SIZE = 1024 * 1024
DEFAULT_TIMEOUT = 10.0
ARCHIVE_EXCLUDES = {".git", "node_modules", "__pycache__", ".venv", "venv"}
SECRET_PATTERN = re.compile(
    r"(?i)(api[_-]?key|secret|token|password|passwd|private[_-]?key)\s*([:=])\s*([^\s,;]+)"
)


def configure_logging(level: str) -> None:
    """Configure concise operational logging for one command invocation."""
    numeric_level = getattr(logging, level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"Invalid log level: {level}")
    logging.basicConfig(level=numeric_level, format=LOG_FORMAT, force=True)


def output_path(path: Path, force: bool) -> Path:
    """Validate a new output path and create its parent directory."""
    target = path.expanduser().resolve()
    if target.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite {target}; pass --force to replace it")
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def ensure_distinct_paths(source: Path, target: Path) -> None:
    """Reject an output path that resolves to the input file."""
    if source.expanduser().resolve() == target.expanduser().resolve():
        raise ValueError("Input and output paths must be different")


def sha256_file(path: Path) -> str:
    """Compute a file's SHA-256 digest without loading it all into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_file(path: Path) -> Path:
    """Return a resolved regular file or raise a useful validation error."""
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Not a file: {resolved}")
    return resolved


def ensure_dir(path: Path) -> Path:
    """Return a resolved directory or raise a useful validation error."""
    resolved = path.expanduser().resolve()
    if not resolved.is_dir():
        raise NotADirectoryError(f"Not a directory: {resolved}")
    return resolved


def build_parser() -> argparse.ArgumentParser:
    """Build parsers for every standalone command and the aggregate CLI."""
    parser = argparse.ArgumentParser(description="Safe, report-first automation utilities")
    commands = parser.add_subparsers(dest="command", required=True)

    def add(name: str, help_text: str) -> argparse.ArgumentParser:
        """Create a command parser with the shared logging option."""
        command = commands.add_parser(name.replace("_", "-"), help=help_text, description=help_text)
        command.add_argument("--log-level", choices=("DEBUG", "INFO", "WARNING", "ERROR"), default="INFO")
        return command

    p = add("json_validate", "Validate a JSON file and report its top-level type")
    p.add_argument("file", type=Path)

    p = add("jsonl_validate", "Validate every JSON Lines record")
    p.add_argument("file", type=Path)

    p = add("csv_profile", "Report CSV row count, column names, missing values, and unique counts")
    p.add_argument("file", type=Path)

    p = add("csv_deduplicate", "Write a deduplicated CSV without modifying the source")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--key", help="Column used as a unique key; default compares complete rows")
    p.add_argument("--force", action="store_true", help="Allow replacing the output file")

    p = add("csv_to_json", "Convert a CSV file to a JSON array")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    p = add("json_to_csv", "Convert an array of JSON objects to CSV")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    p = add("checksum_tree", "Write SHA-256 checksums for files under a directory")
    p.add_argument("directory", type=Path)
    p.add_argument("--output", type=Path, default=Path("SHA256SUMS.txt"))
    p.add_argument("--force", action="store_true")

    p = add("duplicate_files", "Report identical files by SHA-256 without changing them")
    p.add_argument("directory", type=Path)

    p = add("find_large_files", "List files at or above a size threshold")
    p.add_argument("directory", type=Path)
    p.add_argument("--minimum-mb", type=float, default=100.0)

    p = add("find_old_files", "List files older than a specified age")
    p.add_argument("directory", type=Path)
    p.add_argument("--days", type=float, required=True)

    p = add("count_lines", "Count text lines in a file or recursively in a directory")
    p.add_argument("path", type=Path)
    p.add_argument("--glob", default="*", help="Filename glob when path is a directory")

    p = add("empty_directories", "Report empty directories; does not remove them")
    p.add_argument("directory", type=Path)

    p = add("compare_directories", "Compare regular files in two directory trees by relative path and hash")
    p.add_argument("left", type=Path)
    p.add_argument("right", type=Path)

    p = add("directory_backup", "Create a ZIP archive of a directory without deleting source files")
    p.add_argument("directory", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    p = add("verify_backup", "Test a ZIP archive and report member count and uncompressed size")
    p.add_argument("archive", type=Path)

    p = add("log_summary", "Summarize common severity labels in a text log")
    p.add_argument("file", type=Path)

    p = add("redact_log", "Write a copy of a log with common credential assignments redacted")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    p = add("git_report", "Report repository branch, status, and latest commit without changing Git state")
    p.add_argument("directory", type=Path, nargs="?", default=Path("."))

    p = add("check_url", "Check an HTTP or HTTPS URL with a bounded timeout")
    p.add_argument("url")
    p.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)

    p = add("check_port", "Check whether a TCP host and port accept a connection")
    p.add_argument("host")
    p.add_argument("port", type=int)
    p.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)

    p = add("disk_report", "Report total, used, and free disk space for a path")
    p.add_argument("path", type=Path, nargs="?", default=Path("."))

    p = add("env_template", "Create a blank .env template containing keys only, never secret values")
    p.add_argument("file", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--force", action="store_true")

    add_extended_parsers(commands)
    return parser


def cmd_json_validate(args: argparse.Namespace) -> int:
    path = ensure_file(args.file)
    with path.open("r", encoding="utf-8") as stream:
        value = json.load(stream)
    LOGGER.info("Valid JSON: file=%s top_level_type=%s", path, type(value).__name__)
    return 0


def cmd_jsonl_validate(args: argparse.Namespace) -> int:
    path = ensure_file(args.file)
    records = 0
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                json.loads(line)
            except json.JSONDecodeError as error:
                LOGGER.error("Invalid JSON on line %d: %s", line_number, error.msg)
                return 1
            records += 1
    LOGGER.info("Valid JSONL: file=%s records=%d", path, records)
    return 0


def cmd_csv_profile(args: argparse.Namespace) -> int:
    path = ensure_file(args.file)
    rows = 0
    missing: collections.Counter[str] = collections.Counter()
    unique: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames:
            raise ValueError("CSV must include a header row")
        unique = {field: set() for field in reader.fieldnames}
        for row in reader:
            rows += 1
            for field in reader.fieldnames:
                value = (row.get(field) or "").strip()
                if not value:
                    missing[field] += 1
                unique[field].add(value)
    LOGGER.info("CSV profile: file=%s rows=%d columns=%d", path, rows, len(unique))
    for field in unique:
        LOGGER.info("column=%s missing=%d unique=%d", field, missing[field], len(unique[field]))
    return 0


def _csv_rows(path: Path) -> tuple[list[str], Iterable[dict[str, str | None]]]:
    stream = path.open("r", encoding="utf-8-sig", newline="")
    reader = csv.DictReader(stream)
    if not reader.fieldnames:
        stream.close()
        raise ValueError(f"CSV must include a header row: {path}")
    return list(reader.fieldnames), _closing_rows(reader, stream)


def _closing_rows(reader: csv.DictReader, stream: Any) -> Iterable[dict[str, str | None]]:
    try:
        yield from reader
    finally:
        stream.close()


def cmd_csv_deduplicate(args: argparse.Namespace) -> int:
    source = ensure_file(args.input)
    ensure_distinct_paths(source, args.output)
    target = output_path(args.output, args.force)
    headers, rows = _csv_rows(source)
    if args.key and args.key not in headers:
        raise ValueError(f"Unknown key column: {args.key}")
    seen: set[tuple[str, ...] | str] = set()
    kept = duplicates = 0
    with target.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            values = tuple((row.get(column) or "") for column in headers)
            identity: tuple[str, ...] | str = (row.get(args.key) or "") if args.key else values
            if identity in seen:
                duplicates += 1
                continue
            seen.add(identity)
            writer.writerow(row)
            kept += 1
    LOGGER.info("CSV deduplicated: input=%d kept=%d removed=%d output=%s", kept + duplicates, kept, duplicates, target)
    return 0


def cmd_csv_to_json(args: argparse.Namespace) -> int:
    source = ensure_file(args.input)
    ensure_distinct_paths(source, args.output)
    target = output_path(args.output, args.force)
    headers, rows = _csv_rows(source)
    count = 0
    with target.open("w", encoding="utf-8") as stream:
        stream.write("[\n")
        for row in rows:
            if count:
                stream.write(",\n")
            stream.write("  " + json.dumps({key: row.get(key) for key in headers}, ensure_ascii=False))
            count += 1
        stream.write("\n]\n")
    LOGGER.info("CSV converted to JSON: records=%d output=%s", count, target)
    return 0


def cmd_json_to_csv(args: argparse.Namespace) -> int:
    source = ensure_file(args.input)
    ensure_distinct_paths(source, args.output)
    target = output_path(args.output, args.force)
    with source.open("r", encoding="utf-8") as stream:
        records = json.load(stream)
    if not isinstance(records, list) or any(not isinstance(record, dict) for record in records):
        raise ValueError("JSON input must be an array of objects")
    fields = list(dict.fromkeys(key for record in records for key in record))
    if not fields:
        raise ValueError("JSON array contains no object fields")
    with target.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    LOGGER.info("JSON converted to CSV: records=%d columns=%d output=%s", len(records), len(fields), target)
    return 0


def _walk_files(directory: Path, exclude: set[Path] | None = None) -> Iterable[Path]:
    excluded = exclude or set()
    for path in sorted(directory.rglob("*")):
        if any(part in ARCHIVE_EXCLUDES for part in path.parts):
            continue
        if not path.is_symlink() and path.is_file() and path.resolve() not in excluded:
            yield path


def cmd_checksum_tree(args: argparse.Namespace) -> int:
    root = ensure_dir(args.directory)
    target = output_path(args.output, args.force)
    files = list(_walk_files(root, {target}))
    with target.open("w", encoding="utf-8") as stream:
        for path in files:
            stream.write(f"{sha256_file(path)}  {path.relative_to(root).as_posix()}\n")
    LOGGER.info("Checksum manifest written: files=%d output=%s", len(files), target)
    return 0


def cmd_duplicate_files(args: argparse.Namespace) -> int:
    root = ensure_dir(args.directory)
    by_hash: dict[tuple[int, str], list[Path]] = collections.defaultdict(list)
    failures = 0
    for path in _walk_files(root):
        try:
            by_hash[(path.stat().st_size, sha256_file(path))].append(path)
        except OSError as error:
            LOGGER.warning("Unable to read %s: %s", path, error)
            failures += 1
    groups = [paths for paths in by_hash.values() if len(paths) > 1]
    for group in groups:
        LOGGER.info("Duplicate group (%d files): %s", len(group), " | ".join(str(item) for item in group))
    LOGGER.info("Duplicate scan summary: files=%d duplicate_groups=%d read_failures=%d", sum(len(v) for v in by_hash.values()), len(groups), failures)
    return 1 if failures else 0


def cmd_find_large_files(args: argparse.Namespace) -> int:
    root = ensure_dir(args.directory)
    if args.minimum_mb < 0:
        raise ValueError("--minimum-mb must be non-negative")
    threshold = int(args.minimum_mb * 1024 * 1024)
    found = 0
    for path in _walk_files(root):
        size = path.stat().st_size
        if size >= threshold:
            LOGGER.info("large_file size_bytes=%d path=%s", size, path)
            found += 1
    LOGGER.info("Large-file scan complete: matches=%d threshold_bytes=%d", found, threshold)
    return 0


def cmd_find_old_files(args: argparse.Namespace) -> int:
    root = ensure_dir(args.directory)
    if args.days < 0:
        raise ValueError("--days must be non-negative")
    cutoff = datetime.now(timezone.utc).timestamp() - args.days * 86400
    found = 0
    for path in _walk_files(root):
        if path.stat().st_mtime < cutoff:
            LOGGER.info("old_file modified=%s path=%s", datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(), path)
            found += 1
    LOGGER.info("Old-file report complete: matches=%d age_days=%s", found, args.days)
    return 0


def cmd_count_lines(args: argparse.Namespace) -> int:
    path = args.path.expanduser().resolve()
    files = [path] if path.is_file() else sorted(path.glob(args.glob)) if path.is_dir() else []
    if not files:
        raise FileNotFoundError(f"No files found at {path}")
    total = 0
    for file_path in files:
        if not file_path.is_file():
            continue
        with file_path.open("r", encoding="utf-8", errors="replace") as stream:
            count = sum(1 for _ in stream)
        total += count
        LOGGER.info("line_count=%d path=%s", count, file_path)
    LOGGER.info("Line-count summary: files=%d lines=%d", len(files), total)
    return 0


def cmd_empty_directories(args: argparse.Namespace) -> int:
    root = ensure_dir(args.directory)
    empty: list[Path] = []
    for path in sorted(root.rglob("*"), reverse=True):
        if path.is_dir() and not any(path.iterdir()):
            empty.append(path)
    for path in empty:
        LOGGER.info("empty_directory=%s", path)
    LOGGER.info("Empty-directory report complete: count=%d (no directories removed)", len(empty))
    return 0


def cmd_compare_directories(args: argparse.Namespace) -> int:
    left, right = ensure_dir(args.left), ensure_dir(args.right)
    left_files = {p.relative_to(left).as_posix(): p for p in _walk_files(left)}
    right_files = {p.relative_to(right).as_posix(): p for p in _walk_files(right)}
    differences = 0
    for name in sorted(left_files.keys() | right_files.keys()):
        if name not in left_files:
            LOGGER.info("only_right=%s", name)
            differences += 1
        elif name not in right_files:
            LOGGER.info("only_left=%s", name)
            differences += 1
        elif sha256_file(left_files[name]) != sha256_file(right_files[name]):
            LOGGER.info("content_differs=%s", name)
            differences += 1
    LOGGER.info("Directory comparison complete: left=%d right=%d differences=%d", len(left_files), len(right_files), differences)
    return 1 if differences else 0


def cmd_directory_backup(args: argparse.Namespace) -> int:
    root = ensure_dir(args.directory)
    target = output_path(args.output, args.force)
    files = list(_walk_files(root, {target}))
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.relative_to(root).as_posix())
    LOGGER.info("Directory backup created: files=%d archive=%s bytes=%d", len(files), target, target.stat().st_size)
    return 0


def cmd_verify_backup(args: argparse.Namespace) -> int:
    archive_path = ensure_file(args.archive)
    with zipfile.ZipFile(archive_path, "r") as archive:
        bad_member = archive.testzip()
        if bad_member:
            LOGGER.error("Corrupt archive member: %s", bad_member)
            return 1
        members = archive.infolist()
        total_size = sum(member.file_size for member in members)
    LOGGER.info("Backup verified: archive=%s members=%d uncompressed_bytes=%d", archive_path, len(members), total_size)
    return 0


def cmd_log_summary(args: argparse.Namespace) -> int:
    path = ensure_file(args.file)
    levels = collections.Counter({"critical": 0, "error": 0, "warning": 0, "info": 0, "debug": 0, "other": 0})
    patterns = {
        "critical": re.compile(r"\b(critical|fatal)\b", re.I),
        "error": re.compile(r"\berror\b", re.I),
        "warning": re.compile(r"\b(warn|warning)\b", re.I),
        "info": re.compile(r"\binfo\b", re.I),
        "debug": re.compile(r"\bdebug\b", re.I),
    }
    lines = 0
    with path.open("r", encoding="utf-8", errors="replace") as stream:
        for line in stream:
            lines += 1
            match = next((name for name, pattern in patterns.items() if pattern.search(line)), "other")
            levels[match] += 1
    LOGGER.info("Log summary: file=%s lines=%d", path, lines)
    for level, count in levels.items():
        LOGGER.info("level=%s count=%d", level, count)
    return 0


def cmd_redact_log(args: argparse.Namespace) -> int:
    source = ensure_file(args.input)
    ensure_distinct_paths(source, args.output)
    target = output_path(args.output, args.force)
    substitutions = 0
    with source.open("r", encoding="utf-8", errors="replace") as reader, target.open("w", encoding="utf-8") as writer:
        for line in reader:
            redacted, count = SECRET_PATTERN.subn(lambda match: f"{match.group(1)}{match.group(2)}[REDACTED]", line)
            substitutions += count
            writer.write(redacted)
    LOGGER.info("Log redaction complete: replacements=%d output=%s", substitutions, target)
    return 0


def _git(directory: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(directory), *args], check=True, capture_output=True, text=True, timeout=15)
    return result.stdout.strip()


def cmd_git_report(args: argparse.Namespace) -> int:
    directory = ensure_dir(args.directory)
    try:
        branch = _git(directory, "branch", "--show-current") or "(detached HEAD)"
        status = _git(directory, "status", "--short")
        commit = _git(directory, "log", "-1", "--format=%h %s")
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() if error.stderr else "not a Git repository"
        raise ValueError(f"Unable to inspect repository at {directory}: {detail}") from error
    LOGGER.info("Git report: directory=%s branch=%s latest_commit=%s", directory, branch, commit or "none")
    LOGGER.info("Working tree: %s", "clean" if not status else "modified")
    for line in status.splitlines():
        LOGGER.info("status=%s", line)
    return 0


def cmd_check_url(args: argparse.Namespace) -> int:
    if args.timeout <= 0:
        raise ValueError("--timeout must be positive")
    if not args.url.startswith(("http://", "https://")):
        raise ValueError("URL must begin with http:// or https://")
    request = urllib.request.Request(args.url, headers={"User-Agent": "shards-workflow-hub-healthcheck/1.0"}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            LOGGER.info("URL reachable: status=%d url=%s", response.status, safe_url(args.url))
            return 0 if 200 <= response.status < 400 else 1
    except urllib.error.HTTPError as error:
        LOGGER.error("URL returned HTTP status %d: %s", error.code, safe_url(args.url))
        return 1
    except urllib.error.URLError as error:
        LOGGER.error("URL request failed: url=%s reason=%s", safe_url(args.url), error.reason)
        return 1


def cmd_check_port(args: argparse.Namespace) -> int:
    if not 1 <= args.port <= 65535:
        raise ValueError("port must be between 1 and 65535")
    if args.timeout <= 0:
        raise ValueError("--timeout must be positive")
    try:
        with socket.create_connection((args.host, args.port), timeout=args.timeout):
            LOGGER.info("TCP port open: host=%s port=%d", args.host, args.port)
        return 0
    except OSError as error:
        LOGGER.error("TCP port unavailable: host=%s port=%d reason=%s", args.host, args.port, error)
        return 1


def cmd_disk_report(args: argparse.Namespace) -> int:
    path = args.path.expanduser().resolve()
    usage = shutil.disk_usage(path)
    percent = (usage.used / usage.total * 100) if usage.total else 0.0
    LOGGER.info("Disk usage: path=%s total_bytes=%d used_bytes=%d free_bytes=%d used_percent=%.1f", path, usage.total, usage.used, usage.free, percent)
    return 0


def cmd_env_template(args: argparse.Namespace) -> int:
    source = ensure_file(args.file)
    ensure_distinct_paths(source, args.output)
    target = output_path(args.output, args.force)
    keys: set[str] = set()
    with source.open("r", encoding="utf-8", errors="replace") as stream:
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
    with target.open("w", encoding="utf-8") as stream:
        for key in sorted(keys):
            stream.write(f"{key}=\n")
    LOGGER.info("Environment template created: keys=%d output=%s (source values were not read into logs)", len(keys), target)
    return 0


HANDLERS: dict[str, Callable[[argparse.Namespace], int]] = {
    "json-validate": cmd_json_validate,
    "jsonl-validate": cmd_jsonl_validate,
    "csv-profile": cmd_csv_profile,
    "csv-deduplicate": cmd_csv_deduplicate,
    "csv-to-json": cmd_csv_to_json,
    "json-to-csv": cmd_json_to_csv,
    "checksum-tree": cmd_checksum_tree,
    "duplicate-files": cmd_duplicate_files,
    "find-large-files": cmd_find_large_files,
    "find-old-files": cmd_find_old_files,
    "count-lines": cmd_count_lines,
    "empty-directories": cmd_empty_directories,
    "compare-directories": cmd_compare_directories,
    "directory-backup": cmd_directory_backup,
    "verify-backup": cmd_verify_backup,
    "log-summary": cmd_log_summary,
    "redact-log": cmd_redact_log,
    "git-report": cmd_git_report,
    "check-url": cmd_check_url,
    "check-port": cmd_check_port,
    "disk-report": cmd_disk_report,
    "env-template": cmd_env_template,
}
HANDLERS.update(EXTENDED_HANDLERS)


def main(argv: list[str] | None = None, forced_command: str | None = None) -> int:
    """Parse arguments, execute one command, and return a process exit status."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    if forced_command is not None:
        arguments.insert(0, forced_command.replace("_", "-"))
    parser = build_parser()
    args = parser.parse_args(arguments)
    try:
        configure_logging(args.log_level)
        handler = HANDLERS[args.command]
        return handler(args)
    except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, zipfile.BadZipFile, SyntaxError, ValueError, subprocess.TimeoutExpired) as error:
        LOGGER.error("Command failed: %s", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
