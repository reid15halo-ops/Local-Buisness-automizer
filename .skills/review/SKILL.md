---
name: review
description: |
  Perform thorough code reviews on diffs, commits, PRs, or changed files with security, quality, and architecture focus.
  Use this skill whenever the user asks to review code, check a PR, audit changes, inspect a diff, look over recent commits,
  or says things like "review this", "check my code", "what do you think of these changes", "audit this PR",
  "is this safe to merge", "code review", "review the last commit", or any request to evaluate code quality.
  Also trigger when the user wants a pre-merge check, wants to find bugs in recent changes, or asks for feedback
  on code they've written. This skill applies the Morpheus Feedback Loop evaluation standards.
---

# Code Review Skill

Perform structured, thorough code reviews that catch real issues before they reach production. Reviews follow the FreyAI Visions quality bar: security-first, no over-engineering, clean vanilla JS/Python/SQL.

Read `references/codebase-guide.md` for project architecture context before reviewing.

## 1. Gather the Changes

Determine what to review based on user input:

| User says | Action |
|-----------|--------|
| "review last commit" | `git diff HEAD~1 HEAD` + `git log -1 --stat` |
| "review my changes" | `git diff` (unstaged) + `git diff --cached` (staged) |
| "check PR #N" | `gh pr diff N` or `git diff main...HEAD` |
| "review file X" | Read file directly |
| "review commits A..B" | `git diff A..B` |
| "review" (no scope) | `git status` + `git log --oneline -5`, then ask user |

Always gather the actual diff before reviewing. Never review from memory or assumptions.

## 2. Analyze Changes

For each changed file, evaluate against 5 categories. Read `references/security-checklist.md` for security-specific guidance.

### Security (Critical — blocks merge)
- OWASP Top 10: SQL injection, XSS, command injection
- Exposed secrets, API keys, credentials in code
- Missing input sanitization at system boundaries
- Broken auth/authz patterns
- RLS policy gaps on new Supabase tables
- CSP violations or weakened security headers
- DSGVO violations (external CDN, unencrypted PII)

### Correctness (Bug — fix before merge)
- Logic errors, off-by-one, null/undefined access
- Race conditions in async code
- Error handling gaps (silent failures, swallowed errors)
- Edge cases: empty arrays, missing fields, undefined params
- Schema mismatches (querying columns that don't exist)

### Architecture & Design (Suggestion)
- Does it fit the 95/5 pattern (async n8n / sync FastAPI)?
- Unnecessary complexity or over-engineering
- Code duplication that should be consolidated
- Breaking existing APIs or contracts
- Missing offline-first considerations for PWA

### Code Quality (Suggestion)
- Naming clarity and consistency
- Dead code or unused imports
- Inconsistent patterns vs. rest of codebase
- Missing error boundaries in UI code

### Performance (Suggestion)
- N+1 queries or unnecessary DB round-trips
- Memory leaks (event listeners not cleaned up)
- Blocking operations on the main thread
- Large DOM operations without batching

## 3. Produce the Review

Output MUST follow this exact template:

```markdown
## Review: [scope description]

### Critical Issues
[Security vulnerabilities, data loss risks, broken functionality — or "None found."]

### Bugs & Logic Errors
[Incorrect behavior, edge cases, race conditions — or "None found."]

### Suggestions
[Architecture improvements, code quality, performance — or "None."]

### Positive Notes
[Good patterns, clever solutions, improvements over previous code]

### Verdict
[APPROVE / REQUEST CHANGES / NEEDS DISCUSSION]
One-line summary of overall assessment.
```

## 4. Review Rules

- **Lead with severity**: Critical > Bug > Suggestion
- **Be specific**: Reference `file_path:line_number` for every finding
- **Explain why**: Not just "this is wrong" but why it's a problem and what it causes
- **Suggest fixes**: Every finding must include a concrete fix or recommendation
- **No nitpicking**: Do NOT comment on formatting, missing comments, docstrings, or type annotations unless they impact correctness
- **Acknowledge good work**: Every review must have a Positive Notes section
- **Don't invent issues**: If changes are clean and correct, say APPROVE with brief positive notes
- **Verify schema**: When reviewing Supabase queries, cross-reference `config/sql/supabase-schema.sql` to confirm column names exist

## 5. Quality Checklist

Before submitting the review, verify all 12 items:

1. [ ] Actual diff/file was read (not reviewing from memory)
2. [ ] Every finding references a specific file and line number
3. [ ] Every finding includes a concrete fix suggestion
4. [ ] Security issues checked against OWASP Top 10
5. [ ] Supabase queries verified against actual schema
6. [ ] No nitpicking on formatting, comments, or types
7. [ ] Positive Notes section is present and non-empty
8. [ ] Verdict is exactly one of: APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
9. [ ] Critical Issues section exists (even if "None found.")
10. [ ] Bugs section exists (even if "None found.")
11. [ ] Review follows the exact output template structure
12. [ ] No generic boilerplate advice — all findings are specific to the actual code

## References

- `references/codebase-guide.md` — Key services, architecture, table schema overview
- `references/security-checklist.md` — OWASP checks, Supabase auth patterns, DSGVO
- `references/review-patterns.md` — Severity definitions, common review patterns, anti-patterns
