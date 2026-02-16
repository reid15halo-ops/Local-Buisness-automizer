---
name: add-auth-flow
description: Implement a Supabase Auth flow — signup, login, password reset, email verification, OAuth, or magic link.
argument-hint: [flow-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add Auth Flow

**Argument:** `$ARGUMENTS` — one of: `signup`, `login`, `logout`, `reset-password`, `verify-email`, `oauth`, `magic-link`, `session-restore`

### Steps

1. **Read** `js/services/store-service.js` (has `login()`, `logout()`, `getUser()`).
2. **Read** `js/config/supabase-client.js` (has `window.freyaiSupabase`).
3. Implement the requested flow.

### Flow Templates

#### signup
```javascript
async signup(email, password, metadata = {}) {
    const { data, error } = await window.freyaiSupabase.auth.signUp({
        email, password,
        options: { data: metadata }  // e.g., { business_name, full_name }
    });
    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
}
```

#### reset-password
```javascript
async resetPassword(email) {
    const { error } = await window.freyaiSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html#reset'
    });
    return { error: error?.message || null };
}
```

#### oauth
```javascript
async loginWithOAuth(provider) {  // 'google', 'github', etc.
    const { error } = await window.freyaiSupabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/index.html' }
    });
    return { error: error?.message || null };
}
```

#### magic-link
```javascript
async sendMagicLink(email) {
    const { error } = await window.freyaiSupabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + '/index.html' }
    });
    return { error: error?.message || null };
}
```

#### session-restore
```javascript
// Already in store-service.js load() — restores session from localStorage
const { data } = await sb.auth.getSession();
```

### UI Integration
- Add the auth UI elements to `index.html` (login modal, signup form, etc.)
- Wire button click handlers to the new store-service methods
- Show/hide UI based on auth state: `window.freyaiSupabase.auth.onAuthStateChange()`
