# Runnable automation scripts

The `scripts/automations/` directory contains standalone Python 3.9+ command-line utilities for routine file, data, repository, and connectivity tasks. They use only the Python standard library; no dependency installation is required. Run any command with `--help` for its exact arguments.

## Examples

```bash
# Validate JSON or JSON Lines
python3 scripts/automations/json_validate.py config.json
python3 scripts/automations/jsonl_validate.py events.jsonl

# Profile CSV data, then write a de-duplicated copy (source is unchanged)
python3 scripts/automations/csv_profile.py export.csv
python3 scripts/automations/csv_deduplicate.py export.csv export-deduplicated.csv --key id

# Create and verify a ZIP backup; source files are retained
python3 scripts/automations/directory_backup.py ./reports ./reports-backup.zip
python3 scripts/automations/verify_backup.py ./reports-backup.zip

# Report duplicate files, large files, old files, or empty directories (no cleanup/deletion)
python3 scripts/automations/duplicate_files.py ./data
python3 scripts/automations/find_large_files.py ./data --minimum-mb 250
python3 scripts/automations/find_old_files.py ./logs --days 90
python3 scripts/automations/empty_directories.py ./data

# Check service reachability and view local Git status
python3 scripts/automations/check_url.py https://example.com --timeout 5
python3 scripts/automations/check_port.py db.example.net 5432 --timeout 3
python3 scripts/automations/git_report.py .
```

## Script catalog

| Script | Purpose |
| --- | --- |
| `check_port.py` | TCP connectivity check with timeout |
| `check_url.py` | HTTP(S) health check with timeout |
| `checksum_tree.py` | SHA-256 manifest for a directory |
| `compare_directories.py` | Compare directory trees by path and content hash |
| `count_lines.py` | Count text lines in a file or directory |
| `csv_deduplicate.py` | Write a deduplicated CSV copy |
| `csv_profile.py` | Summarize rows, missing values, and unique values |
| `csv_to_json.py` | Convert CSV records into a JSON array |
| `directory_backup.py` | Create an additive ZIP backup |
| `disk_report.py` | Report disk capacity and free space |
| `duplicate_files.py` | Report duplicate file groups by SHA-256 |
| `empty_directories.py` | Report empty directories; never removes them |
| `env_template.py` | Create a blank `.env` template from key names only |
| `find_large_files.py` | Report files above a configurable size |
| `find_old_files.py` | Report files older than a configurable age |
| `git_report.py` | Report branch, latest commit, and working-tree status |
| `json_to_csv.py` | Convert a JSON array of objects to CSV |
| `json_validate.py` | Validate JSON syntax |
| `jsonl_validate.py` | Validate each non-empty JSON Lines record |
| `log_summary.py` | Count common log severity labels |
| `redact_log.py` | Create a redacted copy of a log |
| `verify_backup.py` | Verify ZIP CRC integrity and report its size |

## Safety and exit behavior

All commands provide `--help`, structured logging, and a non-zero exit status on input, validation, or network failures. HTTP, TCP, and TLS checks use bounded timeouts; DNS resolution delegates to the operating system resolver. File-writing commands create a separate output and refuse to overwrite an existing file unless `--force` is explicitly supplied; input and output paths cannot be the same. The utilities do not delete files or modify Git state. The directory backup excludes common generated/dependency directories (`.git`, `node_modules`, `.venv`, `venv`, and `__pycache__`) by default.

Smoke tests for the command catalog are run with:

```bash
python3 scripts/test_automations.py
python3 scripts/test-reusable-workflows.py
```

## Observability, security, and quality checks

```bash
# Redact findings from output: the scanner never prints matched credential values
python3 scripts/automations/secret_scan.py ./ --exclude fixtures

# Check Python syntax without producing __pycache__ and audit action references
python3 scripts/automations/python_syntax_check.py scripts/
python3 scripts/automations/workflow_action_audit.py .github/workflows/

# Check endpoint retries, response headers, and certificate expiry
python3 scripts/automations/http_retry_check.py https://status.example.com --attempts 4
python3 scripts/automations/http_security_headers.py https://example.com --require-all
python3 scripts/automations/tls_certificate_check.py example.com --minimum-days 21

# Validate metrics/log shape and local storage/database health
python3 scripts/automations/prometheus_metrics_report.py metrics.prom
python3 scripts/automations/json_log_validate.py service.jsonl --required-fields timestamp,level,message
python3 scripts/automations/disk_threshold_check.py / --minimum-free-percent 12 --minimum-free-mb 1024
python3 scripts/automations/sqlite_integrity.py ./local.db
```

The additional commands are:

| Script | Purpose |
| --- | --- |
| `archive_path_audit.py` | Detect archive path traversal without extracting files |
| `check_dns.py` | Report system-resolver IP results for a host |
| `csv_schema_check.py` | Validate required CSV headers and detect duplicates |
| `dependency_lock_check.py` | Find Node/Python manifests missing recognized lockfiles |
| `disk_threshold_check.py` | Fail when available disk space is below a threshold |
| `file_inventory.py` | Summarize file counts and bytes by extension |
| `filename_portability.py` | Find reserved or invalid cross-platform names |
| `git_hygiene.py` | Report working-tree changes and `git diff --check` errors |
| `http_retry_check.py` | Retry transient HTTP health-check failures with bounded backoff |
| `http_security_headers.py` | Report missing browser security response headers |
| `json_format.py` | Write normalized JSON to a separate file |
| `json_log_validate.py` | Validate JSON Lines objects and required fields |
| `manifest_verify.py` | Verify SHA-256 records and reject paths outside the root |
| `permission_audit.py` | Report world-writable files on POSIX systems |
| `prometheus_metrics_report.py` | Summarize Prometheus metric samples and malformed lines |
| `python_syntax_check.py` | Compile Python files in memory without bytecode artifacts |
| `repo_size_report.py` | Summarize repository footprint and largest files |
| `secret_scan.py` | Find common credential patterns while suppressing secret values |
| `service_json_health.py` | Validate an HTTP JSON health field and expected value |
| `sqlite_integrity.py` | Run SQLite integrity checks with a read-only connection |
| `tls_certificate_check.py` | Check certificate trust and expiry with a timeout |
| `whitespace_check.py` | Report trailing spaces and missing final newlines |
| `workflow_action_audit.py` | Detect mutable GitHub Actions refs; optionally require SHAs |

## Maintenance, release, and portability checks

```bash
python3 scripts/automations/json_duplicate_keys.py config.json
python3 scripts/automations/git_tracked_secrets_check.py .
python3 scripts/automations/git_conflict_check.py .
python3 scripts/automations/env_drift_check.py .env.example .env.staging
python3 scripts/automations/python_complexity_report.py src/ --threshold 10
python3 scripts/automations/python_docstring_check.py src/
python3 scripts/automations/shell_syntax_check.py scripts/ --shell bash
python3 scripts/automations/sqlite_backup.py app.db backups/app.db
python3 scripts/automations/release_tag_check.py v1.4.0
```

| Script | Purpose |
| --- | --- |
| `changelog_check.py` | Require a semantic-version release entry in the changelog |
| `csv_rows_check.py` | Detect CSV records with inconsistent field counts |
| `env_drift_check.py` | Compare environment variable names without exposing values |
| `git_conflict_check.py` | Find unresolved merge-conflict markers in text files |
| `git_submodule_check.py` | Report uninitialized or diverged submodules |
| `git_tracked_secrets_check.py` | Detect tracked environment and private-key-like files |
| `json_duplicate_keys.py` | Reject ambiguous JSON objects with duplicate keys |
| `path_case_check.py` | Find case-folding path collisions before cross-platform builds |
| `python_complexity_report.py` | Report functions above a control-flow threshold |
| `python_docstring_check.py` | Find public Python classes and functions without docstrings |
| `release_tag_check.py` | Validate semantic-version release tags |
| `requirements_pin_check.py` | Find direct Python requirements without exact version pins |
| `shell_syntax_check.py` | Parse shell scripts in syntax-only mode; never execute them |
| `sqlite_backup.py` | Create a consistent, integrity-checked SQLite backup |
| `stale_worktree_report.py` | Report old or missing worktrees without pruning them |
