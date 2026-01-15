# Security Configuration - MHS Workflow Tool

## Content Security Policy (CSP)
Recommended header for production deployment (e.g., Apache, Nginx, Vercel logic).

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';
```

**Notes:**
- `script-src`: Includes `unsafe-inline` because the app uses inline event handlers (legacy choice, refactoring recommended for strict CSP). Includes `cdn.sheetjs.com` for Excel export.
- `style-src`: Includes `unsafe-inline` for dynamic styles. Includes Google Fonts.
- `font-src`: Google Fonts data.

## Recommended HTTP Headers

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=()
```

## LocalStorage Quota
The application monitors LocalStorage usage and warns the user when it exceeds 4MB (approx 80% of typical 5MB limit).
