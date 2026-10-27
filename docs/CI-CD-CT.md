# Reusable CI/CD/CT workflows

This repository provides reusable GitHub Actions workflows for Node.js validation, container delivery, and Playwright continuous testing. Callers reference them directly from this repository; no workflow is automatically deployed to a consuming repository.

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
      pnpm-version: "10.4.1"
      lint-script: lint
      typecheck-script: check
      test-script: test
      build-script: build
```

Set `lint-script` to an empty string if the project has no lint script. Set any other script input to an empty string only when that stage is intentionally not applicable. The reusable workflow runs the named `package.json` scripts and fails if a configured script fails. It expects a compatible lockfile: `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`.

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
      pnpm-version: "10.4.1"
      test-command: pnpm exec playwright test
      artifact-name: playwright-results
```

The consuming repository must install Playwright and provide a working test suite. Configure its Playwright `webServer` if tests require an application server. The workflow installs Chromium by default and uploads `playwright-report/` and `test-results/` as evidence for up to 14 days, including after failures.

## Security and rollout

- Reusable workflows declare least-privilege default token permissions; the caller must grant any additional permission needed by its job.
- CD fails unless the caller ref is a version tag beginning with `v`. Protect release tags and restrict who can create them.
- No deployment credentials are required for CI or CT. GHCR publishing uses the calling workflow's `GITHUB_TOKEN`; do not add a PAT unless an explicit cross-repository publishing requirement justifies it.
- Pin this workflow hub to a reviewed commit SHA in production callers. The examples use `@master` for readability; a tag or SHA is more reproducible.
- The workflows use version-tag references for third-party actions. Keep them updated with Dependabot and consider full commit-SHA pinning under your organisation's action policy.
- These workflows are opt-in. Adding them to the hub does not change CI/CD/CT in other repositories until those repositories add caller workflows.
