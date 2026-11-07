#!/usr/bin/env python3
"""Validate the reusable GitHub Actions workflow library without third-party dependencies."""

from __future__ import annotations

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"


class ReusableWorkflowCatalogTests(unittest.TestCase):
    """Ensure reusable workflows have discoverable, safe call interfaces."""

    def test_catalog_contains_at_least_thirty_one_reusable_workflows(self) -> None:
        workflows = sorted(WORKFLOWS.glob("reusable-*.yml"))
        self.assertGreaterEqual(len(workflows), 31)

    def test_each_reusable_workflow_declares_call_trigger_and_least_privilege(self) -> None:
        workflows = sorted(WORKFLOWS.glob("reusable-*.yml"))
        self.assertTrue(workflows, "No reusable workflow files found")
        for workflow in workflows:
            with self.subTest(workflow=workflow.name):
                content = workflow.read_text(encoding="utf-8")
                self.assertRegex(content, r"(?m)^name:\s+.+$")
                self.assertRegex(content, r"(?m)^  workflow_call:")
                self.assertRegex(content, r"(?m)^permissions:\s*$")
                self.assertNotRegex(content, r"(?m)^\s*uses:\s+[^\s@]+@main\s*$")
                self.assertNotIn("TODO", content)

    def test_external_actions_are_pinned_to_full_commit_shas(self) -> None:
        workflows = sorted(WORKFLOWS.glob("reusable-*.yml")) + [WORKFLOWS / "ci.yml"]
        for workflow in workflows:
            for line_number, line in enumerate(workflow.read_text(encoding="utf-8").splitlines(), 1):
                match = re.match(r"^\s*uses:\s*(\S+)", line)
                if not match or match.group(1).startswith("./"):
                    continue
                with self.subTest(workflow=workflow.name, line=line_number):
                    self.assertRegex(match.group(1), r"@[0-9a-f]{40}$")
                    self.assertRegex(line, r"\s+#\s+\S+\s*$")

    def test_actionlint_workflow_does_not_request_write_permissions(self) -> None:
        content = (WORKFLOWS / "reusable-ci-actionlint.yml").read_text(encoding="utf-8")
        self.assertNotRegex(content, r"(?m)^\s+(?:checks|pull-requests):\s*write\s*$")

    def test_codeql_language_input_controls_analysis(self) -> None:
        content = (WORKFLOWS / "reusable-security-codeql.yml").read_text(encoding="utf-8")
        self.assertIn("languages: ${{ inputs.languages }}", content)
        self.assertNotIn("language: [javascript-typescript]", content)
        self.assertNotIn("matrix:", content)

    def test_govulncheck_uses_versioned_module_release(self) -> None:
        content = (WORKFLOWS / "reusable-security-go.yml").read_text(encoding="utf-8")
        self.assertIn("golang.org/x/vuln/cmd/govulncheck@v1.1.4", content)
        self.assertNotIn("govulncheck@latest", content)

    def test_workflow_security_regressions(self) -> None:
        dotnet = (WORKFLOWS / "reusable-ci-dotnet.yml").read_text(encoding="utf-8")
        self.assertIn('run: dotnet restore "$SOLUTION_PATH"', dotnet)
        spelling = (WORKFLOWS / "reusable-ci-spelling.yml").read_text(encoding="utf-8")
        self.assertIn("          path: ", spelling)
        self.assertNotIn("          files: ", spelling)
        http = (WORKFLOWS / "reusable-observability-http.yml").read_text(encoding="utf-8")
        self.assertNotIn('2>/dev/null || true)', http)
        precommit = (WORKFLOWS / "reusable-ci-precommit.yml").read_text(encoding="utf-8")
        self.assertIn("shlex.split", precommit)

    def test_workflow_files_have_unique_names(self) -> None:
        names: list[str] = []
        for workflow in sorted(WORKFLOWS.glob("reusable-*.yml")):
            match = re.search(r"(?m)^name:\s+(.+?)\s*$", workflow.read_text(encoding="utf-8"))
            self.assertIsNotNone(match, workflow.name)
            names.append(match.group(1).strip('"\''))
        self.assertEqual(len(names), len(set(names)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
