---
name: testing
description: |
  Write and maintain Vitest unit tests for FreyAI Visions services, modules, and UI components.
  Use this skill when the user asks to write tests, add test coverage, create unit tests, run vitest,
  do TDD, write specs, test a service, test a module, cover edge cases, increase coverage,
  or says things like "test this", "add tests for", "write a spec", "unit test", "test coverage",
  "TDD", "vitest", "test the happy path", "test error handling", or any request involving automated testing.
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

**Always test:**
- Happy path for every public method
- Error handling (Supabase errors return `{ data: null, error }`)
- Edge cases: null/undefined inputs, empty arrays, missing fields
- State changes (user login sets `this.user`, logout clears it)
- Data persistence (localStorage save/restore cycle)
- Subscriber/listener notification after state changes
- German business logic (Zahlungsziel defaults, Kleinunternehmer rules)

**Skip:**
- Private methods (test through public API)
- CSS/DOM rendering (no JSDOM rendering tests)
- n8n workflow integration
- Actual network calls (always mock Supabase/fetch)
- Third-party library internals (Supabase SDK, Stripe.js)

## 5. Async Testing Patterns

```js
// Supabase call that succeeds
it('should fetch data', async () => {
  mockSupabaseClient.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null })
    })
  });
  const result = await service.getData('1');
  expect(result).toHaveLength(1);
});

// Supabase call that fails
it('should handle Supabase error', async () => {
  mockSupabaseClient.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
    })
  });
  await expect(service.getData('1')).rejects.toThrow('DB error');
});
```

## 6. Test Organization by Service Type

| Service Type | Key Test Areas |
|-------------|----------------|
| CRUD (customer, invoice, material) | Add/update/delete, duplicate detection, persistence, search/filter |
| Auth (auth-service) | Login/logout/register, session management, error states, listener callbacks |
| Security (security-service, sanitize) | XSS escaping, input validation, CSP checks |
| Financial (bookkeeping, datev-export) | EUR calculations, rounding, tax rules, DATEV format compliance |
| Sync (db-service, store-service) | Offline queue, sync cycle, conflict resolution, IndexedDB fallback |
| Queue (approval-queue) | Queue/dequeue, approval/rejection, timeout handling |

## 7. Quality Checklist

Before submitting tests, verify:

1. [ ] Source file was read completely before writing tests
2. [ ] All public methods have at least one test
3. [ ] Error paths are tested (not just happy path)
4. [ ] Mocks match the actual API shape (check `references/mock-patterns.md`)
5. [ ] No test depends on execution order (each test is independent)
6. [ ] German field names match source (`kunde`, `rechnung`, `angebot`, not English)
7. [ ] Async tests use `async/await` with proper `expect().rejects` for errors
8. [ ] `beforeEach` resets all state (localStorage, mocks, service instance)
9. [ ] Tests run in isolation -- `npx vitest run tests/[file].test.js` passes
10. [ ] No real API calls, no real IndexedDB, no real DOM manipulation

## References

- `references/mock-patterns.md` -- Reusable mock code for Supabase, IndexedDB, auth, localStorage
- `vitest.config.js` -- Test config (jsdom env, v8 coverage, verbose reporter)
- `tests/` -- 24 existing test files as reference implementations
