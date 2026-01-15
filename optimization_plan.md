# Optimization & Enhancement Plan

## Phase 1: Code Health & Cleanup
1.  **Audit Codebase:** Scan all files for `TODO`, `FIXME`, and `placeholder` text to identify incomplete implementations.
2.  **Refactor Data Store:** Extract the monolithic `store` object from `app.js` into a dedicated `js/services/store-service.js` for better state management.
3.  **Modularize Navigation:** Move navigation logic (`initNavigation`, `switchView`) from `app.js` to `js/ui/navigation.js`.
4.  **Consolidate UI Logic:** Merge redundant UI helpers from `new-features-ui.js` and `app.js` into a shared `js/ui/ui-helpers.js`.
5.  **Standardize Error Handling:** Create `js/services/error-handler.js` to replace `console.log` with a centralized logging and notification system.
6.  **Clean HTML Structure:** Review `index.html` to ensure all modal content is standardized and potentially moved to template tags.

## Phase 2: Performance & Security
7.  **Input Sanitization:** Implement a `sanitizeString()` utility to prevent XSS attacks when rendering user input (e.g., in `innerHTML`).
8.  **LocalStorage Guard:** Add a check on startup to warn if LocalStorage usage exceeds 4MB (near browser limits).
9.  **Lazy Loading:** Implement dynamic script loading for non-essential services (e.g., `chart.js` or heavy features) to speed up initial load.
10. **CSS Optimization:** Split `styles.css` into `core.css` and `components.css` to improve maintainability and load performance.
11. **Secure Headers:** (If deploying) Prepare a headers configuration for Content-Security-Policy (CSP).
12. **Dependency Audit:** Check internal dependencies (if any) and ensure external links (e.g., Google Fonts) are optimized.

## Phase 3: UI/UX Improvements
13. **Mobile Navigation:** Implement a collapsible "Hamburger Menu" for the sidebar on screens narrower than 768px.
14. **Global Keyboard Shortcuts:** Add support for shortcuts like `Ctrl+K` (Search), `Ctrl+N` (New Inquiry), `Esc` (Close Modal).
15. **Toast Notifications:** Standardize the notification system across the app (Success, Error, Info, Warning) with animations.
16. **Global Loading State:** Create a centralized "Spinner/Overlay" for async operations (OCR, AI generation, Network requests).
17. **Empty State Actions:** Enhance empty states (e.g., "No Invoices") with direct "Create New" buttons and helpful illustrations.
18. **Print Optimization:** Add specific `@media print` styles to ensure Invoices and Reports print perfectly without UI clutter.

## Phase 4: Feature Enhancements
19. **Global Search:** Implement a search bar in the header that indexes Customers, Invoices, and Tasks for instant access.
20. **Settings Panel UI:** fully implement the "Einstellungen" view with Company Info, Tax Rates, and UI preferences.
21. **Dark/Light Mode:** Add a theme toggle in the sidebar or settings to switch between Dark (default) and Light mode.
22. **Data Management:** Add "Export All Data" (JSON/ZIP) and "Import Data" features in the Settings panel for easy migration.
23. **Help Center:** Add a generic Help/Documentation modal accessible via a "?" icon, showing the features walkthrough.
24. **Dashboard Customization:** Allow users to toggle visibility of dashboard cards (e.g., "Show/Hide Revenue").

## Phase 5: Final Polish & Quality
25. **Accessibility Audit:** Add ARIA labels to buttons and inputs; ensure proper contrast ratios.
26. **Form Validation:** Enhance HTML5 validation with custom UI feedback for invalid fields (e.g., red borders, error messages).
27. **Icon Consistency:** Review all icons (currently mixing text emojis and simple shapes) for visual consistency.
28. **Cross-Browser Verification:** Test (simulate) layout on Firefox and Safari rendering engines via CSS logic checks.
29. **Code Documentation:** Add JSDoc headers to all major functions in `app.js` and services.
30. **Final Versioning:** Update the app version string in the UI and `README.md`, preparing for "Release 1.0".
