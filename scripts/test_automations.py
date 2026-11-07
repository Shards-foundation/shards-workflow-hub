#!/usr/bin/env python3
"""Smoke and safety tests for the runnable automation command collection."""

from __future__ import annotations

import contextlib
import io
import json
import os
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
            token = "synthetic-fixture-" + uuid.uuid4().hex
            (root / "settings.env").write_text(f"GITHUB_TOKEN={token}\n", encoding="utf-8")
            return_code, stdout, stderr = _run_script(AUTOMATIONS / "secret_scan.py", str(root))
            self.assertEqual(return_code, 1)
            self.assertIn("pattern matched", (stdout + stderr).lower())
            self.assertNotIn(token, stdout + stderr)

    def test_environment_template_and_drift_share_safe_key_parser(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-env-test-") as directory:
            root = pathlib.Path(directory)
            source = root / "environment.env"
            template = root / "template.env"
            source.write_text(
                "# comment\nexport ALPHA=private-value\nBETA=another-private-value\n",
                encoding="utf-8",
            )
            return_code, stdout, stderr = _run_script(
                AUTOMATIONS / "env_template.py", str(source), str(template)
            )
            self.assertEqual(return_code, 0, stdout + stderr)
            self.assertEqual(template.read_text(encoding="utf-8"), "ALPHA=\nBETA=\n")
            return_code, stdout, stderr = _run_script(
                AUTOMATIONS / "env_drift_check.py", str(template), str(source)
            )
            self.assertEqual(return_code, 0, stdout + stderr)
            self.assertNotIn("private-value", stdout + stderr)
            source.write_text("ALPHA=secret\nGAMMA=secret\n", encoding="utf-8")
            return_code, stdout, stderr = _run_script(
                AUTOMATIONS / "env_drift_check.py", str(template), str(source)
            )
            self.assertEqual(return_code, 1, stdout + stderr)
            self.assertIn("missing", (stdout + stderr).lower())

    def test_secret_scan_detects_prefixed_and_json_keys(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-secret-formats-") as directory:
            root = pathlib.Path(directory)
            token = "synthetic-fixture-" + uuid.uuid4().hex
            (root / "configuration.env").write_text(
                f"GITHUB_TOKEN={token}\n"
                "DB_PASSWORD='synthetic phrase value'\n"
                "AWS_SECRET_ACCESS_KEY=synthetic-access-value-12345\n"
                '{"password": "synthetic JSON value"}\n',
                encoding="utf-8",
            )
            code, stdout, stderr = _run_script(AUTOMATIONS / "secret_scan.py", str(root))
            output = stdout + stderr
            self.assertEqual(code, 1, output)
            self.assertGreaterEqual(output.lower().count("pattern matched"), 4)
            self.assertNotIn(token, output)
            self.assertNotIn("synthetic JSON value", output)

    def test_redact_log_preserves_json_and_quoted_values(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-redaction-") as directory:
            root = pathlib.Path(directory)
            original = root / "original.log"
            redacted = root / "redacted.log"
            original.write_text(
                '{"token": "private JSON value"}\n'
                "password: 'secret phrase with spaces'\n"
                "GITHUB_TOKEN=synthetic-token-value\n",
                encoding="utf-8",
            )
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "redact_log.py", str(original), str(redacted)
            )
            self.assertEqual(code, 0, stdout + stderr)
            content = redacted.read_text(encoding="utf-8")
            self.assertEqual(json.loads(content.splitlines()[0]), {"token": "[REDACTED]"})
            self.assertIn("password: '[REDACTED]'", content)
            self.assertIn("GITHUB_TOKEN=[REDACTED]", content)
            self.assertNotIn("private JSON value", content)
            self.assertNotIn("secret phrase with spaces", content)

    def test_scanning_under_build_parent_does_not_skip_entire_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-parent-path-") as directory:
            base = pathlib.Path(directory)
            root = base / "build" / "project"
            root.mkdir(parents=True)
            (root / "content.txt").write_text("backup me\n", encoding="utf-8")
            (root / "settings.env").write_text(
                "GITHUB_TOKEN=synthetic-secret-value-12345\n", encoding="utf-8"
            )
            code, stdout, stderr = _run_script(AUTOMATIONS / "secret_scan.py", str(root))
            self.assertEqual(code, 1, stdout + stderr)
            backup = base / "project-backup.zip"
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "directory_backup.py", str(root), str(backup)
            )
            self.assertEqual(code, 0, stdout + stderr)
            with zipfile.ZipFile(backup) as archive:
                self.assertEqual(
                    set(archive.namelist()), {"content.txt", "settings.env"}
                )

    def test_http_retry_only_logs_terminal_failure_after_all_attempts(self) -> None:
        class RecoveringHandler(BaseHTTPRequestHandler):
            requests = 0

            def do_GET(self) -> None:
                type(self).requests += 1
                self.send_response(503 if self.requests == 1 else 200)
                self.end_headers()

            def log_message(self, log_format, *args):
                return

        server = HTTPServer(("127.0.0.1", 0), RecoveringHandler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "http_retry_check.py",
                f"http://127.0.0.1:{server.server_port}/health",
                "--attempts", "2", "--base-delay", "0", "--max-delay", "0",
            )
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)
        self.assertEqual(code, 0, stdout + stderr)
        self.assertNotIn("remained unhealthy", (stdout + stderr).lower())
        self.assertEqual(RecoveringHandler.requests, 2)

    def test_csv_conversions_reject_extra_fields_and_duplicate_headers(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-csv-safety-") as directory:
            root = pathlib.Path(directory)
            source = root / "source.csv"
            output = root / "output.json"
            for malformed in ("id,name\n1,Alice,paid\n", "id,id\n1,2\n"):
                source.write_text(malformed, encoding="utf-8")
                code, stdout, stderr = _run_script(
                    AUTOMATIONS / "csv_to_json.py", str(source), str(output)
                )
                self.assertEqual(code, 1, stdout + stderr)
                self.assertFalse(output.exists(), "Malformed CSV must not produce partial output")
            source.write_text("id,name\n\n1,Alice\n", encoding="utf-8")
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "csv_to_json.py", str(source), str(output)
            )
            self.assertEqual(code, 0, stdout + stderr)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), [{"id": "1", "name": "Alice"}])

    def test_hardlink_output_is_rejected_even_with_force(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-hardlink-") as directory:
            root = pathlib.Path(directory)
            source = root / "source.json"
            target = root / "target.csv"
            content = '[{"name":"preserve-me"}]\n'
            source.write_text(content, encoding="utf-8")
            try:
                os.link(source, target)
            except (OSError, NotImplementedError):
                self.skipTest("Hard links are unavailable on this filesystem")
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "json_to_csv.py", str(source), str(target), "--force"
            )
            self.assertEqual(code, 1, stdout + stderr)
            self.assertEqual(source.read_text(encoding="utf-8"), content)

    def test_generated_manifest_handles_leading_star_and_space(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-manifest-") as directory:
            base = pathlib.Path(directory)
            root = base / "files"
            root.mkdir()
            (root / "*leading.txt").write_text("one\n", encoding="utf-8")
            (root / " leading.txt").write_text("two\n", encoding="utf-8")
            manifest = base / "checksums.txt"
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "checksum_tree.py", str(root), "--output", str(manifest)
            )
            self.assertEqual(code, 0, stdout + stderr)
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "manifest_verify.py", str(root), str(manifest)
            )
            self.assertEqual(code, 0, stdout + stderr)

    def test_requirements_pin_check_rejects_wildcards(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-pin-check-") as directory:
            source = pathlib.Path(directory) / "requirements.txt"
            source.write_text("requests==2.*\n", encoding="utf-8")
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "requirements_pin_check.py", str(source)
            )
            self.assertEqual(code, 1, stdout + stderr)
            source.write_text("requests==2.32.3\n", encoding="utf-8")
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "requirements_pin_check.py", str(source)
            )
            self.assertEqual(code, 0, stdout + stderr)

    def test_release_tag_check_enforces_semver_prerelease_identifiers(self) -> None:
        for tag, expected in (
            ("v1.2.3", 0), ("1.2.3-alpha.1", 0),
            ("v1.2.3-01", 1), ("v1.2.3-alpha..1", 1),
        ):
            with self.subTest(tag=tag):
                code, stdout, stderr = _run_script(
                    AUTOMATIONS / "release_tag_check.py", tag
                )
                self.assertEqual(code, expected, stdout + stderr)

    def test_invalid_url_cannot_leak_query_string(self) -> None:
        token = uuid.uuid4().hex
        url = f"http://example.com/bad path?token={token}"
        for script in ("check_url.py", "http_retry_check.py", "service_json_health.py"):
            with self.subTest(script=script):
                code, stdout, stderr = _run_script(AUTOMATIONS / script, url)
                self.assertEqual(code, 1)
                self.assertNotIn(token, stdout + stderr)

    def test_camelcase_credentials_and_empty_quotes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-camelcase-") as directory:
            root = pathlib.Path(directory)
            source = root / "source.txt"
            output = root / "output.txt"
            source.write_text(
                'accessToken="secret access value"\n'
                'dbPassword="another secret"\n'
                'TOKEN=""\n'
                "PASSWORD=''\n",
                encoding="utf-8",
            )
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "redact_log.py", str(source), str(output)
            )
            self.assertEqual(code, 0, stdout + stderr)
            redacted = output.read_text(encoding="utf-8")
            self.assertIn('accessToken="[REDACTED]"', redacted)
            self.assertIn('dbPassword="[REDACTED]"', redacted)
            self.assertIn('TOKEN=""', redacted)
            self.assertIn("PASSWORD=''", redacted)
            source.write_text('TOKEN=""\nPASSWORD=\'\'\n', encoding="utf-8")
            code, stdout, stderr = _run_script(AUTOMATIONS / "secret_scan.py", str(source))
            self.assertEqual(code, 0, stdout + stderr)

    def test_new_checksum_manifest_inside_source_tree_is_allowed(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-in-tree-manifest-") as directory:
            root = pathlib.Path(directory)
            (root / "source.txt").write_text("checksum this\n", encoding="utf-8")
            manifest = root / "SHA256SUMS.txt"
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "checksum_tree.py", str(root), "--output", str(manifest)
            )
            self.assertEqual(code, 0, stdout + stderr)
            self.assertTrue(manifest.is_file())
            self.assertIn("source.txt", manifest.read_text(encoding="utf-8"))
            code, stdout, stderr = _run_script(
                AUTOMATIONS / "checksum_tree.py", str(root), "--output", str(manifest), "--force"
            )
            self.assertEqual(code, 1, stdout + stderr)
            self.assertIn("source.txt", manifest.read_text(encoding="utf-8"))

    def test_source_tree_writers_refuse_existing_input(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-guard-") as directory:
            root = pathlib.Path(directory)
            source = root / "source.txt"
            source.write_text("preserve content\n", encoding="utf-8")
            for script in ("checksum_tree.py", "directory_backup.py"):
                with self.subTest(script=script):
                    code, stdout, stderr = _run_script(
                        AUTOMATIONS / script, str(root),
                        *(("--output", str(source)) if script == "checksum_tree.py" else (str(source),)),
                        "--force"
                    )
                    self.assertEqual(code, 1, stdout + stderr)
                    self.assertEqual(source.read_text(encoding="utf-8"), "preserve content\n")

    def test_git_hygiene_supports_unborn_head(self) -> None:
        with tempfile.TemporaryDirectory(prefix="automation-unborn-git-") as directory:
            root = pathlib.Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True, capture_output=True, timeout=10)
            (root / "new-file.txt").write_text("safe content\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "new-file.txt"], check=True, capture_output=True, timeout=10)
            code, stdout, stderr = _run_script(AUTOMATIONS / "git_hygiene.py", str(root))
            self.assertEqual(code, 0, stdout + stderr)

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
