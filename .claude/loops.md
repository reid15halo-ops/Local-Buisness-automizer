# FreyAI Visions — Loop & Scheduled Task Recipes

Useful `/loop` and cron patterns for this project. Copy-paste these into Claude Code sessions.

## Development Loops (use during active development)

### Watch for build errors
```
/loop 5m Check for any JavaScript syntax errors or broken imports in js/services/ and js/modules/. Report only if issues found.
```

### Monitor git changes
```
/loop 10m Run git status and summarize what files have changed. Flag any uncommitted changes to critical files (auth-service.js, security-service.js, db-service.js).
```

### CSS consistency check
```
/loop 15m Scan CSS files for any hardcoded hex colors that should use design tokens from css/core.css. Report violations.
```

## Operations Loops (use during deploy/monitoring)

### VPS health check
```
/loop 10m SSH to 72.61.187.24 and check: nginx status, disk usage, Postiz containers, Ollama status. Alert only on issues.
```

### Supabase sync monitor
```
/loop 15m Check Supabase edge function logs for errors in the last 15 minutes. Summarize any failures.
```

## Business Loops

### Overdue invoice check
```
/loop 30m Use the FreyAI MCP to check for overdue invoices. Summarize any new overdue items with customer name and amount.
```

### Daily revenue snapshot
```
/loop 60m Use the FreyAI MCP to get today's revenue summary. Show total vs yesterday.
```

## Scheduled Tasks (for Claude Desktop / Cowork)

These are designed for the scheduled tasks feature (persistent, survives restarts):

### Daily Morning Briefing
- **Name:** morning-briefing
- **Schedule:** Daily 07:00
- **Prompt:** Check overdue invoices, today's schedule, and any open tickets. Create a morning briefing summary in German.

### Weekly Skill Eval
- **Name:** weekly-skill-eval
- **Schedule:** Monday 09:00
- **Prompt:** Run eval test cases for the boomer-ux skill using the skill-creator. Generate a benchmark report and save to .skills/boomer-ux-workspace/.

### Daily Code Quality
- **Name:** daily-code-quality
- **Schedule:** Daily 18:00
- **Prompt:** Run a quick code quality scan on any files modified today (git diff --name-only HEAD~1). Check for: console.log statements, hardcoded strings that should be i18n keys, missing error handling in service methods.

### Weekly Security Check
- **Name:** weekly-security-scan
- **Schedule:** Friday 16:00
- **Prompt:** Scan for potential security issues: exposed API keys in code, missing input sanitization, CSP violations, outdated dependencies. Report findings.

## One-Off Reminders

```
/loop 1x in 30m Remind me to test the invoice flow on mobile before pushing.
```

```
/loop 1x in 2h Check if the Supabase migration has completed and verify the new RLS policies are active.
```

## Notes

- **Loops** expire after 3 days and only live in the current session
- **Scheduled Tasks** persist across sessions (desktop app only, not VS Code yet)
- Loops don't catch up if the session was closed — use scheduled tasks for must-run jobs
- Use `cron list` to see active loops, `cron delete <id>` to remove one
