# Reusable CI/CD/CT workflows

This repository provides reusable GitHub Actions workflows for Node.js validation, container delivery, and Playwright continuous testing. Callers reference them directly from this repository; no workflow is automatically deployed to a consuming repository.

## Reusable workflow catalog

The `.github/workflows/reusable-*.yml` files are opt-in building blocks. Call one from a caller workflow in your repository; the caller controls its triggers and may pin this repository to a reviewed commit SHA. Each workflow declares its own permissions. Many expose inputs for project-specific paths and versions; the available inputs vary by workflow.

| Workflow | Purpose |
| --- | --- |
| `reusable-ci-node.yml` | Install, lint, type-check, test, and build Node.js projects |
| `reusable-ct-playwright.yml` | Run Playwright browser tests and retain reports |
| `reusable-cd-ghcr.yml` | Publish a Docker image to GHCR from a version tag |
| `reusable-ci-python.yml` | Install, optionally lint, and test Python projects |
| `reusable-ci-python-package.yml` | Test (optionally), build, and validate Python distributions |
| `reusable-ci-go.yml` | Format, vet, test, and optionally lint Go modules |
| `reusable-ci-rust.yml` | Format, lint, and test Rust projects |
| `reusable-ci-java.yml` | Verify Maven or Gradle Java projects |
| `reusable-ci-dotnet.yml` | Restore, format-check (optionally), and test .NET solutions |
| `reusable-ci-php.yml` | Validate Composer projects and run their test command |
| `reusable-ci-ruby.yml` | Install Bundler dependencies and run Ruby tests |
| `reusable-ci-deno.yml` | Format, lint, type-check (optionally), and test Deno projects |
| `reusable-ci-helm.yml` | Lint Helm charts and render templates |
| `reusable-ci-terraform.yml` | Format and validate Terraform configuration |
| `reusable-ci-markdown.yml` | Lint Markdown files |
| `reusable-ci-shellcheck.yml` | Lint shell scripts |
| `reusable-ci-links.yml` | Check links in documentation |
| `reusable-ci-spelling.yml` | Check spelling with codespell |
| `reusable-security-codeql.yml` | Analyze supported source code with CodeQL |
| `reusable-security-dependency-review.yml` | Review pull-request dependency changes |
| `reusable-security-container.yml` | Build locally and scan a container image with Trivy |
| `reusable-security-go.yml` | Scan Go source for known vulnerabilities |
| `reusable-security-python.yml` | Audit Python dependencies with pip-audit |
| `reusable-security-node-audit.yml` | Audit Node.js dependencies |
| `reusable-security-terraform.yml` | Scan Terraform configuration for security misconfigurations |
| `reusable-ci-actionlint.yml` | Lint GitHub Actions syntax and expressions |
| `reusable-ci-precommit.yml` | Run configured repository pre-commit hooks |
| `reusable-ci-container.yml` | Build and validate a container image without publishing it |
| `reusable-security-gitleaks.yml` | Scan repository history for likely secrets |
| `reusable-observability-http.yml` | Check endpoint availability with bounded retries and timeouts |
| `reusable-maintenance-stale.yml` | Apply stale labels without automatically closing issues or PRs |

### Python CI and dependency audit example

```yaml
name: Python CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  checks:
    uses: Shards-foundation/shards-workflow-hub/.github/workflows/reusable-ci-python.yml@master
    with:
      python-version: "3.12"
      install-command: python -m pip install -e ".[dev]"
      test-command: python -m pytest
      lint-command: python -m ruff check .
  dependency-audit:
    uses: Shards-foundation/shards-workflow-hub/.github/workflows/reusable-security-python.yml@master
    with:
      python-version: "3.12"
      requirements-file: requirements.txt
```

Use only the caller workflow stages that apply to your repository. Inputs that run shell commands are intended for trusted, checked-in workflow configuration, not untrusted event payloads. For production, pin the reusable workflow references to a reviewed commit SHA rather than a moving branch.

## 1. Continuous integration (CI)

The hub itself calls its reusable Node CI from `.github/workflows/ci.yml`. It runs the repository's TypeScript check and production build. Unit tests are currently disabled for this repository because no unit-test files are present; consuming repositories should keep `test-script: test` enabled when they have a test suite.

Create `.github/workflows/ci.yml` in a consuming repository:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

permissions:
  contents: read

jobs:
  ci:
    uses: Shards-foundation/shards-workflow-hub/.github/workflows/reusable-ci-node.yml@master
    with:
      node-version: "22"
      package-manager: pnpm
      lint-script: lint
      typecheck-script: check
      test-script: test
      build-script: build
```

Set `lint-script` to an empty string if the project has no lint script. Set any other script input to an empty string only when that stage is intentionally not applicable. The reusable workflow runs the named `package.json` scripts and fails if a configured script fails. It expects a compatible lockfile: `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`. For pnpm, declare the authoritative version in `package.json` using its `packageManager` field; the setup action reads that field rather than receiving a second, potentially conflicting version.

## 2. Continuous delivery (CD) to GHCR

The container workflow publishes a Docker image only when called from a version tag beginning with `v` (for example, `v1.2.3`). The consuming repository must have a Dockerfile and grant the caller workflow `packages: write` permission.

Create `.github/workflows/release.yml` in a consuming repository:

```yaml
name: Release container

on:
  push:
    tags: ["v*"]

permissions:
  contents: read
  packages: write

jobs:
  publish:
    uses: Shards-foundation/shards-workflow-hub/.github/workflows/reusable-cd-ghcr.yml@master
    with:
      image-name: my-service
      context: .
      dockerfile: ./Dockerfile
      platforms: linux/amd64
```

This publishes a version tag and an immutable commit-SHA tag to `ghcr.io/<owner>/<image-name>`. It does not deploy to a live environment. Production deployment should be a separate environment-protected job using the target provider's credentials and health checks. Configure package visibility and repository access in GitHub as required.

## 3. Continuous testing (CT) with Playwright

Create `.github/workflows/ct.yml` in a consuming repository:

```yaml
name: Continuous testing

on:
  pull_request:
  push:
    branches: [master]
  schedule:
    - cron: "0 5 * * 1-5"

permissions:
  contents: read

jobs:
  e2e:
    uses: Shards-foundation/shards-workflow-hub/.github/workflows/reusable-ct-playwright.yml@master
    with:
      node-version: "22"
      package-manager: pnpm
      test-command: pnpm exec playwright test
      artifact-name: playwright-results
```

The consuming repository must install Playwright and provide a working test suite. Configure its Playwright `webServer` if tests require an application server. The workflow installs Chromium by default and uploads `playwright-report/` and `test-results/` as evidence for up to 14 days, including after failures.

## Security and rollout

- Reusable workflows declare least-privilege default token permissions; the caller must grant any additional permission needed by its job.
- CD fails unless the caller ref is a version tag beginning with `v`. Protect release tags and restrict who can create them.
- No deployment credentials are required for CI or CT. GHCR publishing uses the calling workflow's `GITHUB_TOKEN`; do not add a PAT unless an explicit cross-repository publishing requirement justifies it.
- Pin this workflow hub to a reviewed commit SHA in production callers. The examples use `@master` for readability; a tag or SHA is more reproducible.
- Every third-party action used by the reusable workflow library is pinned to a full commit SHA, with the human-readable version retained in a trailing comment. Review both the action release and resolved commit when updating pins.
- The Trivy workflows use `aquasecurity/trivy-action` v0.36.0 pinned by SHA. The advisory identifies v0.35.0 as the fixed release; keep this action at v0.35.0 or later and review the [Trivy supply-chain advisory](https://github.com/advisories/GHSA-69fq-xp46-6x23) before changing its pin.
- These workflows are opt-in. Adding them to the hub does not change CI/CD/CT in other repositories until those repositories add caller workflows.
