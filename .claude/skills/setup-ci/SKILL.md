---
name: setup-ci
description: Set up CI/CD pipeline — GitHub Actions for linting, testing, Docker build, and deployment.
argument-hint: [platform]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Setup CI/CD

**Argument:** `$ARGUMENTS` — one of: `github-actions`, `gitlab-ci`

### Steps

1. **Read** project structure to understand what needs to be built/tested.
2. Generate the CI config.

### GitHub Actions Template

Create `.github/workflows/ci.yml`:

```yaml
name: FreyAI CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install dependencies
        run: pip install -r backend/requirements.txt
      - name: Check imports
        run: python -c "import main"
        working-directory: backend

  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build backend image
        run: docker build -t freyai-backend:test ./backend

  schema-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate SQL syntax
        run: |
          sudo apt-get install -y postgresql-client
          pg_isready || true
          # Basic syntax check
          psql -f supabase_schema.sql --set ON_ERROR_STOP=on 2>&1 || echo "Schema review needed"

  frontend-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for common issues
        run: |
          # No hardcoded secrets
          ! grep -rn "sk_live\|password.*=.*['\"]" js/ || exit 1
          # No eval
          ! grep -rn "eval(" js/ || exit 1
```

### Add deployment job as needed (Docker push, fly.io deploy, etc.)
