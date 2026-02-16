---
name: fix-bug
description: Debug and fix a reported bug — systematic root cause analysis with console tracing, DOM inspection, and Supabase query validation.
argument-hint: [bug-description]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Fix Bug

**Bug:** `$ARGUMENTS`

### Systematic Debug Process

#### 1. Reproduce — understand the symptom
- Search the codebase for keywords from the bug description
- Identify the affected file(s) and function(s)
- Trace the data flow from UI → store-service → Supabase

#### 2. Isolate — narrow the root cause

**Frontend bugs:**
- Check if `window.storeService.state` has the expected data
- Check if the render function is called (search for `render<View>`)
- Check for `window.UI.sanitize()` issues mangling data
- Check for missing null checks on optional fields

**Data bugs:**
- Verify the `_mapFromDB()` and `_mapToDB()` mapping is correct
- Check if Supabase RLS is blocking the query (missing `user_id`)
- Check if the `_tableMap` entry exists for the affected entity

**Backend bugs:**
- Check Pydantic model matches the request payload
- Check Supabase client initialization
- Check error handling (is the exception swallowed?)

#### 3. Fix — minimal change

- Make the smallest possible fix
- Don't refactor surrounding code
- Add a defensive null check if the root cause is missing data
- Test the fix by tracing the same data flow

#### 4. Verify — confirm the fix

- Grep for similar patterns that might have the same bug
- Check if the fix could break other callers
- Report what was wrong and what was changed

### Common FreyAI Bugs

| Symptom | Likely Cause |
|---------|-------------|
| Empty list | `_fetchAllFromSupabase` missing the table |
| Data not saving | `_tableMap` missing the entity |
| Crash on load | Mapping function accessing undefined property |
| Stale data | `notify()` not called after mutation |
| Auth error | Session expired, `_isOnline()` returns false |
