# Contributing to FreyAI Visions

Vielen Dank für Ihr Interesse an FreyAI Visions! Beiträge sind willkommen.

Thank you for your interest in contributing to FreyAI Visions! Contributions are welcome.

## Getting Started

### Prerequisites

- Node.js 18+
- A modern browser (Chrome, Firefox, Edge, Safari)
- Git

### Local Setup

```bash
# Clone the repository
git clone https://github.com/your-username/Local-Buisness-automizer.git
cd Local-Buisness-automizer

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your own API keys

# Start development (open index.html in browser or use a local server)
npx serve .
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Open a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs. actual behavior
   - Browser & OS version
   - Screenshots if applicable

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain how it benefits Handwerker / small businesses

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit with a clear message (see below)
7. Push and open a Pull Request

### Commit Message Format

```
<type>: <short description>

<optional body>
```

Types:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `style` — Code style (no logic changes)
- `refactor` — Code restructuring
- `test` — Tests
- `chore` — Build, tooling, dependencies

Examples:
```
feat: add invoice PDF template selection
fix: correct VAT calculation for Kleinunternehmer
docs: update README with deployment instructions
```

## Code Guidelines

### Architecture

- **Services** (`js/services/`) — Business logic, one class per file
- **UI Modules** (`js/ui/`) — DOM manipulation, user interaction
- **Modules** (`js/modules/`) — Feature-specific modules
- **i18n** (`js/i18n/`) — Translations (DE + EN)

### Naming Conventions

- **Files**: kebab-case (`invoice-service.js`)
- **Classes**: PascalCase (`InvoiceService`)
- **Functions/Methods**: camelCase (`createInvoice()`)
- **Constants**: UPPER_SNAKE (`MAX_RETRY_COUNT`)
- **Business data**: German terms (`anfragen`, `angebote`, `auftraege`, `rechnungen`)

### Adding a New Service

1. Create `js/services/my-service.js`
2. Register in `js/init-lazy-services.js`
3. Add translations to `js/i18n/de.js` and `js/i18n/en.js`
4. Write tests in `tests/my-service.test.js`

### Adding UI to Sidebar

1. Add `<button class="nav-item" data-view="my-view" data-mode="pro">` to `index.html`
2. Add `<section class="view" id="view-my-view">` to `index.html`
3. Add the view name to `getVisibilityRules()` in `user-mode-service.js`
4. Handle initialization in `navigation.js` `handleViewEnter()`

## Security

- Never commit API keys, passwords, or secrets
- Use `.env.example` as template only
- XSS: Always escape user input with `textContent` (not `innerHTML` with raw data)
- See `SECURITY.md` for vulnerability reporting

## Language

- Code comments: German or English (both accepted)
- UI text: Always add to both `de.js` and `en.js`
- Issues & PRs: German or English

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
