---
name: add-service
description: Create a new frontend JavaScript service file following the FreyAI project pattern with JSDoc typing, global registration, and lazy-loader integration.
argument-hint: [service-name]
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Create a Frontend Service

Create a new JS service called `$ARGUMENTS`.

### Steps

1. **Read** `js/services/lazy-loader.js` to understand how services are registered and loaded.
2. **Read** one existing service (e.g., `js/services/calendar-service.js`) to see the pattern.
3. **Create** `js/services/$ARGUMENTS.js` following the template below.
4. **Register** the service in `js/services/lazy-loader.js` so it can be loaded on demand.

### Service Template

```javascript
/* ============================================================
   FreyAI Core — <ServiceName> Service
   ============================================================
   <One-line description of what this service does.>
   ============================================================ */

class <ServiceName>Service {
    constructor() {
        /** @type {boolean} */
        this.initialized = false;
    }

    /**
     * Initialize the service. Called by lazy-loader.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        // Setup logic here

        this.initialized = true;
        console.info('[FreyAI] <ServiceName>Service initialized.');
    }

    // --- Public API ---

    // Add methods here

    // --- Private helpers ---
}

// Register globally for lazy-loader access
window.<serviceName>Service = new <ServiceName>Service();
```

### Conventions (FreyAI Core)

- **Naming**: File is kebab-case (`my-service.js`), class is PascalCase (`MyService`), global is camelCase (`window.myService`)
- **JSDoc**: Add `@param` and `@returns` annotations to all public methods
- **Constructor**: Initialize state only — no async work, no DOM access
- **init()**: Async setup method called by lazy-loader
- **Supabase access**: Use `window.freyaiSupabase` (not the old `supabaseConfig`)
- **Store access**: Use `window.storeService.state` for reading data
- **Error handling**: Use `console.error('[FreyAI] ...')` and `window.errorHandler?.error()` for user-facing errors
- **No side effects on load**: The service file should only define the class and register the global
- **Dependencies**: Check for required globals before using them (`if (!window.freyaiSupabase) return;`)

### Lazy-Loader Registration

Add to the service registry in `lazy-loader.js`:

```javascript
'<service-name>': {
    path: 'js/services/$ARGUMENTS.js',
    global: '<serviceName>Service',
    description: '<what it does>'
}
```
