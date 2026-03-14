---
name: review
description: |
  Structured code review for diffs, commits, PRs, or changed files. Evaluates security, correctness,
  architecture, and quality. Trigger on: "review", "check my code", "audit this PR", "is this safe to merge",
  "code review", "review the last commit", "pre-merge check", or any request to evaluate code changes.
  Do NOT use for full multi-file architecture reviews — use /morpheus for that instead.
---

# Code Review Skill

Perform structured, thorough code reviews that catch real issues before they reach production. Reviews follow the FreyAI Visions quality bar: security-first, no over-engineering, clean vanilla JS/Python/SQL.

Read `references/codebase-guide.md` for project architecture context before reviewing.

## Scope: Review vs. Morpheus

This skill handles **targeted, diff-based code reviews**. Use the right tool:

| Use /review when... | Use /morpheus when... |
|---------------------|----------------------|
| Reviewing a specific commit, PR, or diff | Full architecture review of multiple files |
| Pre-merge quality gate on changed code | Design validation of a new feature |
| Quick security/correctness check | Parallel 4-agent multi-perspective analysis |
| `git diff` or `gh pr diff` is the input | No clean diff — reviewing existing system design |
| 1–20 files changed | 20+ files, system-wide refactors |

**Rule**: If the user says "review", use this skill. If they say "architect review", "full system audit", "Morpheus", or the scope is a large feature with no specific diff — redirect to `/morpheus`.

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

**REQUIRED**: Always gather the actual diff before reviewing. Never review from memory or assumptions.

## 2. Analyze Changes

Evaluate each changed file against 5 categories in strict priority order. Stop-ship issues first. Read `references/security-checklist.md` for security-specific guidance.

### P0: Security (blocks merge)
- OWASP Top 10: injection (SQL, XSS, command), broken auth/authz
- Exposed secrets, API keys, credentials in code
- Missing input sanitization at system boundaries
- RLS policy gaps on new Supabase tables
- DSGVO violations (external CDN, unencrypted PII)

### P1: Correctness (fix before merge)
- Logic errors, null/undefined access, off-by-one
- Race conditions in async code, unhandled promise rejections
- Error handling gaps (silent failures, swallowed errors)
- Schema mismatches (querying non-existent columns — verify against `config/sql/supabase-schema.sql`)

### P2: Architecture & Design (suggestion, with rationale)
- Fit with 95/5 pattern (async n8n / sync client)
- Over-engineering or unnecessary complexity
- Breaking existing APIs or contracts
- Missing offline-first considerations for PWA

### P3: Code Quality & Performance (suggestion)
- Dead code, unused imports, naming inconsistencies
- N+1 queries, memory leaks (event listeners not cleaned up)
- Blocking main thread, large unbatched DOM operations

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
- **No Morpheus overlap**: Don't re-do architecture design analysis that /morpheus would do — flag for Morpheus if architectural concern is deep

## 5. Quality Gate (all must pass)

1. [ ] Actual diff/file was read — never review from memory
2. [ ] All changed files in the diff have been examined (no file skipped)
3. [ ] Every finding has `file_path:line_number` + concrete fix
4. [ ] Security checked against OWASP Top 10; Supabase queries verified against `config/sql/supabase-schema.sql`
5. [ ] No nitpicking (formatting, comments, type annotations)
6. [ ] Output follows exact template: Critical Issues, Bugs, Suggestions, Positive Notes, Verdict
7. [ ] All findings are specific to the actual code — no generic boilerplate
8. [ ] Verdict is exactly one of: APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
9. [ ] Severity levels used correctly: P0 in Critical, P1 in Bugs, P2–P3 in Suggestions

## References

- `references/codebase-guide.md` — Key services, architecture, table schema overview
- `references/security-checklist.md` — OWASP checks, Supabase auth patterns, DSGVO
- `references/review-patterns.md` — Severity definitions, common review patterns, anti-patterns
