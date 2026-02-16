---
name: add-service
description: Create a new frontend JavaScript service file with JSDoc, global registration, and lazy-loader integration.
argument-hint: [service-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Create a Frontend Service

Create `js/services/$ARGUMENTS.js` and register in lazy-loader.

### Steps

1. **Read** `js/services/lazy-loader.js` for registry pattern.
2. **Read** one existing service for reference.
3. **Create** `js/services/$ARGUMENTS.js` using template.
4. **Register** in `lazy-loader.js`.

### Template

```javascript
/* ============================================================
   FreyAI Core — <ServiceName> Service
   <description>
   ============================================================ */

class <ServiceName>Service {
    constructor() {
        /** @type {boolean} */
        this.initialized = false;
    }

    /** @returns {Promise<void>} */
    async init() {
        if (this.initialized) return;
        this.initialized = true;
        console.info('[FreyAI] <ServiceName>Service initialized.');
    }
}

window.<serviceName>Service = new <ServiceName>Service();
```

### Conventions
- File: kebab-case, Class: PascalCase, Global: camelCase
- JSDoc `@param`/`@returns` on all public methods
- Supabase via `window.freyaiSupabase` (not old `supabaseConfig`)
- Store via `window.storeService.state`
- Errors: `console.error('[FreyAI] ...')` + `window.errorHandler?.error()`
- No side effects on load — define class + register global only
