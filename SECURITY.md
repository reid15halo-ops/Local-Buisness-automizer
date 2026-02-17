# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in MHS Workflow, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to the repository maintainers or use GitHub's private vulnerability reporting feature.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Fix Release**: Depending on severity, typically within 14 days for critical issues

## Security Best Practices for Deployment

### Admin Panel Credentials

This application is **open source**. There are **no default passwords** in the codebase. On first access to the Admin Panel, users are required to set their own credentials for both the **Admin** and **Developer** roles.

- Always use strong, unique passwords (minimum 6 characters, recommended 12+)
- Change credentials regularly
- Never share Developer credentials with non-technical users

### Environment Variables

Never commit real API keys or secrets to version control. Use the `.env.example` file as a template and create your own `.env` file locally.

Required secrets for production:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — Database access
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side operations (never expose client-side)
- `GEMINI_API_KEY` — AI features
- `RESEND_API_KEY` — Email delivery
- `STRIPE_SECRET_KEY` — Payment processing (never expose client-side)
- `EMAIL_RELAY_SECRET` — Email relay authentication

### Data Storage

- Sensitive configuration is stored in `localStorage` (browser-local)
- For multi-user production deployments, use Supabase with Row Level Security (RLS)
- The application supports offline mode — local data is not encrypted by default

### Content Security Policy

The application ships with strict CSP headers configured in `.htaccess`. Do not weaken these headers unless absolutely necessary.

### GDPR / DSGVO

- No external font CDNs (fonts are self-hosted)
- No tracking scripts
- No third-party analytics
- All data can be exported and deleted by the user
