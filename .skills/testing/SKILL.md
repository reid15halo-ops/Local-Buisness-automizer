---
name: testing
description: |
  Write and maintain Vitest unit tests for FreyAI Visions services and modules.
  Trigger on: "write tests", "test coverage", "unit test", "vitest", "TDD", "test this",
  "add tests for", "cover edge cases", or any request involving automated testing.
---

# Testing Skill

Write reliable, maintainable Vitest tests for FreyAI Visions. Tests live in `tests/` and target vanilla JS (ES6+) services, modules, and UI components.

Read `references/mock-patterns.md` before writing any test file -- it contains the project's established mock patterns for Supabase, IndexedDB, localStorage, and window globals.

## 1. Understand the Target

Before writing tests, read the source file completely. Identify:

- **Class or object pattern** -- most services export a class via `new ClassName()` singleton
- **External dependencies** -- Supabase client, IndexedDB, localStorage, `window.*` globals, other services
- **Async operations** -- Supabase queries, IndexedDB transactions, fetch calls
- **State management** -- internal arrays/maps, localStorage keys, subscriber patterns

## 2. Test File Structure

File naming: `tests/[service-name].test.js`

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 1. Mock setup (globals, localStorage, Supabase client)
// 2. Inline class copy OR import (see pattern below)
// 3. describe blocks grouped by feature area

describe('ServiceName', () => {
  let service;

  beforeEach(() => {
    // Reset all mocks and state
    vi.clearAllMocks();
    localStorage.clear();
    // Instantiate fresh service
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature Area', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange - Act - Assert
    });
  });
});
```

## 3. Project Patterns (IMPORTANT)

This project inlines service class copies in test files rather than importing from source. This avoids module resolution issues with the vanilla JS codebase (no bundler, no ESM in source). Follow this established pattern:

1. Copy the class/object definition into the test file
2. Mock all external dependencies before instantiation
3. Test the copied class directly

See existing tests in `tests/` for examples (e.g., `customer-service.test.js`, `auth-service.test.js`).

## 4. What to Test

For every public method, write tests for these 4 scenarios (minimum):

1. **Happy path** -- expected input produces expected output
2. **Error path** -- Supabase returns `{ data: null, error }`, fetch fails, invalid input
3. **Edge cases** -- null/undefined, empty arrays, missing fields, boundary values
4. **State side effects** -- localStorage changes, subscriber notifications, internal state mutations

Also cover German business logic where applicable (Zahlungsziel defaults, Kleinunternehmer tax rules, MwSt calculations).

**Never test:**
- Private methods (test through public API)
- CSS/DOM rendering
- n8n workflow integration
- Actual network calls (always mock)
- Third-party library internals

## 5. Async Testing Patterns

Key patterns (see `references/mock-patterns.md` for full examples):

- **Success**: Mock chain returns `{ data: [...], error: null }`, assert on returned data
- **Failure**: Mock chain returns `{ data: null, error: new Error('msg') }`, use `await expect(...).rejects.toThrow()`
- **Chain mocking**: Supabase uses fluent API -- mock each method in the chain to return the next: `from().select().eq().order()` etc.
- **Void operations**: UPDATE/DELETE return only `{ error }` -- test that no error means success, and that errors propagate

## 6. Test Organization by Service Type

| Service Type | Key Test Areas |
|-------------|----------------|
| CRUD (customer, invoice, material) | Add/update/delete, duplicate detection, persistence, search/filter |
| Auth (auth-service) | Login/logout/register, session management, error states, listener callbacks |
| Security (security-service, sanitize) | XSS escaping, input validation, CSP checks |
| Financial (bookkeeping, datev-export) | EUR calculations, rounding, tax rules, DATEV format compliance |
| Sync (db-service, store-service) | Offline queue, sync cycle, conflict resolution, IndexedDB fallback |
| Queue (approval-queue) | Queue/dequeue, approval/rejection, timeout handling |

## 7. Coverage Target & Thresholds

**Target: 80% line coverage** across all service files. The thresholds are enforced in `vitest.config.js`:

```js
// vitest.config.js (do not lower these thresholds)
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80
  },
  include: ['js/services/**/*.js'],
  exclude: ['js/services/vendor/**', 'js/services/**/index.js']
}
```

### Coverage Per Service Category

| Category | Minimum Coverage |
|----------|----------------|
| Financial calculations (bookkeeping, MwSt) | 95% -- zero tolerance for rounding bugs |
| Auth & Security | 90% -- every error path matters |
| CRUD Services | 80% -- standard threshold |
| Sync / IndexedDB | 80% -- critical offline paths |
| UI helpers | 60% -- lower due to DOM dependencies |

### Checking Coverage Locally

```bash
npx vitest run --coverage
# or for a single file:
npx vitest run tests/customer-service.test.js --coverage
```

If coverage drops below threshold, the run exits with code 1 -- same as a test failure.

## 8. CI/CD Integration

Tests run automatically in the CI pipeline on every push and pull request.

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --coverage --reporter=verbose
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

### Local Pre-commit Check

Before pushing, always run:
```bash
npx vitest run
```

Tests must pass locally before any push to `staging`. Production deploys require tests to pass in CI.

### Test Failure Policy

- **Failing tests block staging deploy** -- fix the test or the code, never skip
- **Never use `it.skip()` or `it.todo()` in merged code** -- open a GitHub issue instead
- **Flaky tests** (intermittently failing) must be investigated and fixed within 2 days

## 9. Regression Tests

Regression tests prevent previously fixed bugs from returning. They are the highest-priority tests.

### When to Write a Regression Test

Write a regression test immediately after fixing any bug:

1. **Write the failing test first** (reproduces the bug)
2. **Verify it fails** against the broken code
3. **Fix the code**
4. **Verify the test passes**
5. **Commit both** the fix and the test together

### Regression Test Naming Convention

```js
// Prefix with "regression:" and include the issue/bug reference
it('regression: sync queue items with retries >= 5 are not deleted', async () => {
  // Bug: previously, items at max retries were silently deleted
  // Fixed in: db-service.js _syncOfflineQueue()
  const failedItem = { id: 1, retries: 5, synced: false };
  await dbService.addToSyncQueue(failedItem);
  await dbService.syncNow();
  const queue = await dbService.getUnsyncedQueue();
  expect(queue.find(i => i.id === 1)).toBeDefined(); // must still exist
});
```

### Existing Regression Areas (always re-test when touching these)

| Area | Known past bug | Test file |
|------|---------------|-----------|
| Sync queue | Items silently deleted on max retries | `db-service.test.js` |
| Dual-DB race | Race condition when two IndexedDB DBs open simultaneously | `db-service.test.js` |
| MwSt rounding | EUR amounts rounded incorrectly (should be 2 decimal places) | `bookkeeping.test.js` |
| Variant auto-reject | Accepting one Angebot variant did not reject siblings | `offer-service.test.js` |

## 10. Quality Gate (all must pass)

1. [ ] Source file read completely before writing tests
2. [ ] Every public method has happy path + error path test (minimum)
3. [ ] Mocks match actual API shape (verified against `references/mock-patterns.md`)
4. [ ] Tests are independent -- no execution order dependency, `beforeEach` resets all state
5. [ ] German field names match source (`kunde`, `rechnung`, `angebot`)
6. [ ] No real API calls, no real IndexedDB, no real DOM manipulation
7. [ ] `npx vitest run tests/[file].test.js` passes in isolation
8. [ ] Coverage at or above threshold (80% lines/functions, 70% branches)
9. [ ] Bug fixes include a regression test with `regression:` prefix
10. [ ] No `it.skip()` or `it.todo()` in committed code

## References

- `references/mock-patterns.md` -- Reusable mock code for Supabase, IndexedDB, auth, localStorage
- `vitest.config.js` -- Test config (jsdom env, v8 coverage, verbose reporter)
- `tests/` -- 24 existing test files as reference implementations
