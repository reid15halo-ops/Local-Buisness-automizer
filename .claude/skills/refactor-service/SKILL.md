---
name: refactor-service
description: Modernize a legacy JS service to FreyAI Core patterns — replace localStorage/IndexedDB with Supabase, add JSDoc, use new globals.
argument-hint: [service-file-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Refactor Legacy Service

Modernize `js/services/$ARGUMENTS`.

### Steps

1. **Read** the target service file completely.
2. **Identify** legacy patterns to replace.
3. **Apply** changes per the checklist below.

### Refactoring Checklist

#### Replace legacy data access
| Old Pattern | New Pattern |
|-------------|------------|
| `window.dbService.get(key)` | `window.storeService.state.<key>` |
| `window.dbService.set(key, val)` | Mutate `storeService.state` + `storeService.save()` |
| `window.dbService.getUserData(...)` | `window.storeService.state` (already user-scoped) |
| `localStorage.getItem(...)` | `window.storeService.state.settings` or Supabase query |
| `localStorage.setItem(...)` | `window.storeService.save()` |

#### Replace legacy Supabase access
| Old Pattern | New Pattern |
|-------------|------------|
| `window.supabaseConfig.get()` | `window.freyaiSupabase` |
| `window.supabaseConfig.isConfigured()` | `!!window.freyaiSupabase` |
| `window.supabaseDB.getAll(table)` | `window.freyaiSupabase.from(table).select('*')` |
| `window.supabaseDB.create(table, row)` | `window.freyaiSupabase.from(table).insert([row])` |

#### Replace legacy auth
| Old Pattern | New Pattern |
|-------------|------------|
| `window.userManager.getCurrentUser()` | `await window.storeService.getUser()` |
| `window.authService.isLoggedIn()` | `!!window.storeService.currentUserId` |
| `window.authService.getUser()` | `await window.storeService.getUser()` |

#### Code style
- Add `[FreyAI]` prefix to all console logs
- Add JSDoc `@param`/`@returns` to public methods
- Remove dead code and commented-out blocks
- Use `async/await` instead of `.then()` chains where possible
