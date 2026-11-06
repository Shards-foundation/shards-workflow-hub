#!/usr/bin/env python3
"""Smoke and safety tests for the runnable automation command collection."""

from __future__ import annotations

import contextlib
import io
import pathlib
import runpy
import subprocess  # nosec B404: tests invoke local wrappers with fixed args and shell disabled.
import sys
import tempfile
import threading
import unittest
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
AUTOMATIONS = ROOT / "scripts" / "automations"
EXPECTED_SCRIPTS = {
    "archive_path_audit.py",
    "changelog_check.py",
    "check_dns.py",
    "check_port.py",
    "check_url.py",
    "checksum_tree.py",
    "compare_directories.py",
    "count_lines.py",
    "csv_deduplicate.py",
    "csv_profile.py",
    "csv_schema_check.py",
    "csv_rows_check.py",
    "csv_to_json.py",
    "dependency_lock_check.py",
    "directory_backup.py",
    "disk_report.py",
    "disk_threshold_check.py",
    "duplicate_files.py",
    "empty_directories.py",
    "env_template.py",
    "env_drift_check.py",
    "file_inventory.py",
    "filename_portability.py",
    "find_large_files.py",
    "find_old_files.py",
    "git_hygiene.py",
    "git_conflict_check.py",
    "git_report.py",
    "git_submodule_check.py",
    "git_tracked_secrets_check.py",
    "http_retry_check.py",
    "http_security_headers.py",
    "json_format.py",
    "json_log_validate.py",
    "json_duplicate_keys.py",
    "json_to_csv.py",
    "json_validate.py",
    "jsonl_validate.py",
    "log_summary.py",
    "manifest_verify.py",
    "permission_audit.py",
    "path_case_check.py",
    "prometheus_metrics_report.py",
    "python_syntax_check.py",
    "python_complexity_report.py",
    "python_docstring_check.py",
    "redact_log.py",
    "repo_size_report.py",
    "release_tag_check.py",
    "requirements_pin_check.py",
    "secret_scan.py",
    "shell_syntax_check.py",
    "service_json_health.py",
    "sqlite_integrity.py",
    "sqlite_backup.py",
    "stale_worktree_report.py",
    "tls_certificate_check.py",
    "verify_backup.py",
    "whitespace_check.py",
    "workflow_action_audit.py",
}


def _run_script(script: pathlib.Path, *arguments: str) -> tuple[int, str, str]:
    """Run a standalone wrapper in-process and capture its exit code and output."""
    original_argv, original_path = sys.argv[:], sys.path[:]
    stdout, stderr = io.StringIO(), io.StringIO()
    sys.argv = [str(script), *arguments]
    try:
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            try:
                runpy.run_path(str(script), run_name="__main__")
            except SystemExit as error:
                if error.code is None:
                    return_code = 0
                elif isinstance(error.code, int):
                    return_code = error.code
                else:
                    return_code = 1
            else:
                return_code = 0
    finally:
        sys.argv = original_argv
        sys.path[:] = original_path
    return return_code, stdout.getvalue(), stderr.getvalue()


class AutomationScriptTests(unittest.TestCase):
    """Check command discovery, behavior, and security-sensitive output."""

    def test_catalog_contains_at_least_fifty_nine_commands(self) -> None:
        scripts = set(path.name for path in AUTOMATIONS.glob("*.py")) - {"__init__.py", "cli.py", "extended.py"}
        self.assertGreaterEqual(len(scripts), 59)
        self.assertTrue(EXPECTED_SCRIPTS.issubset(scripts))

    def test_each_script_supports_help(self) -> None:
        for script in sorted(AUTOMATIONS.glob("*.py")):
            if script.name in {"__init__.py", "cli.py", "extended.py"}:
                continue
            with self.subTest(script=script.name):
                return_code, stdout, stderr = _run_script(script, "--help")
                self.assertEqual(return_code, 0, stderr)
                self.assertIn("usage:", stdout.lower())

    def test_secret_scan_reports_a_match_without_printing_secret_value(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-secret-test-") as directory:
            root = pathlib.Path(directory)
            token = "ghp_" + ("a" * 36)
            (root / "settings.env").write_text(f"GITHUB_TOKEN={token}\n", encoding="utf-8")
            return_code, stdout, stderr = _run_script(AUTOMATIONS / "secret_scan.py", str(root))
            self.assertEqual(return_code, 1)
            self.assertIn("pattern matched", (stdout + stderr).lower())
            self.assertNotIn(token, stdout + stderr)

    def test_workflow_action_audit_flags_mutable_action_refs(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-workflow-test-") as directory:
            workflow = pathlib.Path(directory) / "unsafe.yml"
            workflow.write_text("steps:\n  - uses: actions/checkout@main # mutable ref\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "workflow_action_audit.py"), str(workflow)],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("mutable", (result.stdout + result.stderr).lower())

    def test_http_checks_reject_urls_without_a_host(self) -> None:
        for script in ("check_url.py", "http_retry_check.py", "http_security_headers.py"):
            with self.subTest(script=script):
                return_code, stdout, stderr = _run_script(AUTOMATIONS / script, "http:///etc/passwd")
                self.assertNotEqual(return_code, 0)
                self.assertIn("valid http(s) url with a host", (stdout + stderr).lower())
                self.assertNotIn("Traceback", stderr)

    def test_secret_scan_does_not_follow_symlinks_outside_scan_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-symlink-test-") as directory:
            root = pathlib.Path(directory)
            scan_root = root / "scan"
            scan_root.mkdir()
            outside = root / "private.env"
            outside.write_text("API_KEY=external-secret-value-12345\n", encoding="utf-8")
            link = scan_root / "external.env"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("Symlinks are not available on this platform")
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "secret_scan.py"), str(scan_root)],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 0)
            self.assertNotIn("external.env", result.stdout + result.stderr)

    def test_http_health_logs_do_not_disclose_query_parameters(self) -> None:
        class HealthHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')

            def log_message(self, format, *args):  # pylint: disable=redefined-builtin
                return

        server = HTTPServer(("127.0.0.1", 0), HealthHandler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        token = uuid.uuid4().hex
        url = f"http://127.0.0.1:{server.server_port}/health?token={token}"
        try:
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "service_json_health.py"), url],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(token, result.stdout + result.stderr)

    def test_failed_url_check_does_not_disclose_query_parameters(self) -> None:
        token = uuid.uuid4().hex
        result = subprocess.run(
            [sys.executable, str(AUTOMATIONS / "check_url.py"), f"http://127.0.0.1:1/health?token={token}", "--timeout", "1"],
            cwd=ROOT, capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(token, result.stdout + result.stderr)

    def test_http_retry_permanent_error_does_not_disclose_query_parameters(self) -> None:
        class ForbiddenHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                self.send_response(403)
                self.end_headers()

            def log_message(self, format, *args):  # pylint: disable=redefined-builtin
                return

        server = HTTPServer(("127.0.0.1", 0), ForbiddenHandler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        token = uuid.uuid4().hex
        url = f"http://127.0.0.1:{server.server_port}/health?token={token}"
        try:
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "http_retry_check.py"), url, "--attempts", "1"],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(token, result.stdout + result.stderr)

    def test_count_lines_glob_includes_nested_files(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-count-lines-test-") as directory:
            root = pathlib.Path(directory)
            (root / "top.txt").write_text("one\n", encoding="utf-8")
            nested = root / "nested"
            nested.mkdir()
            (nested / "inner.txt").write_text("two\nthree\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "count_lines.py"), str(root), "--glob", "*.txt"],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("files=2 lines=3", result.stdout + result.stderr)

    def test_json_duplicate_key_check_rejects_ambiguous_objects(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-json-duplicate-test-") as directory:
            path = pathlib.Path(directory) / "ambiguous.json"
            path.write_text('{"role":"reader","role":"admin"}\n', encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "json_duplicate_keys.py"), str(path)],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("duplicate", (result.stdout + result.stderr).lower())

    def test_complexity_report_handles_syntax_errors_without_traceback(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-python-syntax-test-") as directory:
            source = pathlib.Path(directory) / "broken.py"
            source.write_text("def broken(\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "python_complexity_report.py"), str(source)],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 1)
            self.assertNotIn("Traceback", result.stderr)
            self.assertIn("Command failed", result.stderr)

    def test_archive_audit_detects_parent_directory_traversal(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-archive-test-") as directory:
            archive = pathlib.Path(directory) / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("../../outside.txt", "do not extract")
            result = subprocess.run(
                [sys.executable, str(AUTOMATIONS / "archive_path_audit.py"), str(archive)],
                cwd=ROOT, capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("unsafe", (result.stdout + result.stderr).lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
