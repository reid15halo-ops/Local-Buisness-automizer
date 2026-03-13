# Review Patterns & Anti-Patterns

## Severity Definitions

### CRITICAL (blocks merge)
Issues that cause immediate harm if deployed:
- Security vulnerabilities exploitable in production
- Data loss or corruption (e.g., sync overwrites, missing WHERE clauses)
- Broken core functionality (e.g., auth bypass, payment errors)
- Exposed credentials or secrets

**Review action**: REQUEST CHANGES. List specific files and line numbers.

### BUG (fix before merge)
Issues that cause incorrect behavior:
- Logic errors (wrong condition, off-by-one, null access)
- Missing error handling that causes crashes
- Schema/API mismatches (querying non-existent columns)
- Race conditions in async flows
- Silent failures that hide real problems

**Review action**: REQUEST CHANGES if severe, NEEDS DISCUSSION if debatable.

### SUGGESTION (nice to have)
Improvements that don't block the change:
- Performance optimizations
- Better patterns or abstractions
- Code deduplication
- Minor readability improvements

**Review action**: APPROVE with notes, or NEEDS DISCUSSION if architectural.

## Good Review Patterns

### 1. Schema Verification
When reviewing Supabase queries, always verify columns exist:
```
Finding: `.eq('kunde_id', id)` on `rechnungen` table
Evidence: `config/sql/supabase-schema.sql` shows `rechnungen` has `kunde_name TEXT` not `kunde_id`
Impact: Query silently returns zero rows
Fix: Change to `.eq('kunde_name', customerName)`
```

### 2. Error Handling Audit
Check every `try/catch` and `.catch()`:
- Does it log the error? (at minimum `console.warn`)
- Does it swallow silently? (`.catch(() => {})` is a red flag)
- Does it re-throw when appropriate?
- Does it show user-facing feedback?

### 3. Offline-First Verification
For any data mutation:
- What happens when offline?
- Is the change queued for later sync?
- Can the sync race with another sync path?
- Does the UI update optimistically?

### 4. Cross-Reference with Git History
```bash
git log --oneline -10 -- path/to/file  # Recent changes
git blame path/to/file                  # Who wrote what
```

## Review Anti-Patterns (DO NOT)

### 1. Generic Boilerplate
BAD: "Consider adding error handling"
GOOD: "Line 42: `_loadSharedPhotos()` catch block swallows the error silently. If this table is created later, real bugs will be hidden. Add `console.warn('shared photos:', e.message)`"

### 2. Formatting Nitpicks
BAD: "Use consistent indentation" / "Add JSDoc to this function"
These waste reviewer and author time. Only comment on formatting if it causes confusion.

### 3. Inventing Issues
BAD: Finding "potential issues" in code that is actually correct, just to have something to say.
GOOD: If the code is clean, say APPROVE with brief positive notes.

### 4. Missing Context
BAD: "This function is too long"
GOOD: "This function (85 lines) handles 4 different sync paths. Consider extracting `_syncAngebote()`, `_syncAuftraege()`, `_syncRechnungen()` to make each path independently testable."

### 5. Suggesting Framework Changes
BAD: "Consider using React hooks for this state management"
GOOD: The project is vanilla JS by design. Don't suggest framework migrations.

## Output Template Compliance

Every review MUST have these exact sections in this order:
1. `## Review: [scope]`
2. `### Critical Issues` — present even if "None found."
3. `### Bugs & Logic Errors` — present even if "None found."
4. `### Suggestions` — present even if "None."
5. `### Positive Notes` — MUST be non-empty
6. `### Verdict` — exactly one of: `APPROVE`, `REQUEST CHANGES`, `NEEDS DISCUSSION`

Finding format:
```
**N. [Title]** (`file_path:line_number`)
[Description of what's wrong and why]
**Fix**: [Concrete suggestion]
```
