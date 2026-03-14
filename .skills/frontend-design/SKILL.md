---
name: frontend-design
description: |
  Create distinctive, production-grade frontend interfaces with high design quality.
  Use this skill when the user asks to build web components, pages, artifacts, posters, or applications
  (websites, landing pages, dashboards, React components, HTML/CSS layouts, styling/beautifying any web UI).
  Also trigger when the user says "make it look good", "design this", "beautify", "polish the UI",
  "premium look", "industrial luxury", "not generic", "distinctive", or asks for any visual/aesthetic improvement.
  Generates creative, polished code and UI design that avoids generic AI slop aesthetics.
  Make sure to use this skill whenever building or improving any user-facing frontend, even if the user
  doesn't explicitly mention design quality — great design should be the default, not an afterthought.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## FreyAI Branding

When building interfaces FOR FreyAI Visions (freyaivisions.de), always apply the FreyAI brand system:

- **Primary color**: `#0EA5E9` (sky blue) — for CTAs, highlights, active states
- **Accent**: `#6366F1` (indigo) — for secondary elements, gradients
- **Dark bg**: `#0F172A` (slate-900) — default dark surface
- **Surface**: `#1E293B` (slate-800) — cards, panels
- **Text primary**: `#F8FAFC` (slate-50)
- **Text muted**: `#94A3B8` (slate-400)
- **Error**: `#EF4444` | **Success**: `#10B981` | **Warning**: `#F59E0B`
- **Font**: `Syne` (display/headings) + `Inter` (body) — loaded via Google Fonts
- **Logo**: "FreyAI Visions" wordmark — never alter capitalization or spacing
- **Tone**: Professional, KI-forward, Mittelstand-vertrauend — not startup-flashy

For non-FreyAI projects: ignore brand constraints above and exercise full creative freedom.

## Responsive Design (Required)

Every interface MUST be responsive. Non-negotiable:

```css
/* Mobile-first breakpoints */
/* Base: < 640px (mobile) */
/* sm: 640px (tablet portrait) */
/* md: 768px (tablet landscape) */
/* lg: 1024px (desktop) */
/* xl: 1280px (large desktop) */
```

- No fixed-width containers without `max-width` + `margin: auto`
- Touch targets: minimum 44×44px on mobile
- Test mentally at 375px (iPhone SE), 768px (iPad), 1280px (desktop)
- Flexible grids: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`
- Typography scales: use `clamp()` for fluid type — `font-size: clamp(1rem, 2.5vw, 1.5rem)`
- Navigation collapses to hamburger/bottom-nav on mobile

## Accessibility (WCAG 2.1 AA — Required)

Every interface MUST meet WCAG 2.1 AA minimum:

- **Color contrast**: 4.5:1 for normal text, 3:1 for large text (≥18pt or ≥14pt bold)
- **Focus indicators**: visible, high-contrast focus rings — never `outline: none` without replacement
- **Semantic HTML**: `<nav>`, `<main>`, `<header>`, `<section>`, `<button>` (not divs for interactive elements)
- **ARIA labels**: all icon-only buttons, images, form inputs
- **Keyboard navigation**: all interactive elements reachable via Tab; modals trap focus
- **Alt text**: all `<img>` tags have meaningful `alt` attributes (empty `alt=""` for decorative images)
- **Form labels**: every `<input>` has an associated `<label>` or `aria-label`
- **Skip link**: `<a href="#main">Skip to main content</a>` as first element for multi-section pages

```html
<!-- Required pattern for icon buttons -->
<button aria-label="Menü öffnen" class="icon-btn">
  <svg aria-hidden="true">...</svg>
</button>
```

## Dark Theme (Default — Required)

FreyAI interfaces use **dark theme as the default**. Light theme is optional but dark must always work:

```css
:root {
  --bg-primary: #0F172A;
  --bg-surface: #1E293B;
  --bg-elevated: #334155;
  --text-primary: #F8FAFC;
  --text-muted: #94A3B8;
  --border: rgba(255,255,255,0.08);
  --accent: #0EA5E9;
}

/* If light theme is also needed */
@media (prefers-color-scheme: light) {
  :root {
    --bg-primary: #F8FAFC;
    --bg-surface: #FFFFFF;
    --text-primary: #0F172A;
    --text-muted: #64748B;
    --border: rgba(0,0,0,0.08);
  }
}
```

Rules:
- Never hardcode `#fff` or `#000` — always use CSS variables
- Shadows must use `rgba` with dark-aware values (darker shadows on dark bg)
- Images must have appropriate `filter: brightness()` or `mix-blend-mode` in dark context
- Avoid pure black backgrounds (`#000000`) — use dark slate (`#0F172A`) for comfortable dark mode

## Framework Independence

Write framework-agnostic CSS/HTML by default. Use vanilla JS unless a framework is explicitly specified or already in use:

- **Prefer**: CSS custom properties, native Web APIs, vanilla JS modules
- **Avoid**: framework-specific utilities (Tailwind classes alone, Bootstrap components) unless asked
- **When React is needed**: use functional components + hooks only — no class components
- **CSS architecture**: BEM naming or scoped CSS-in-JS — no global class soup
- **Zero runtime dependencies** for pure HTML/CSS deliverables — embed everything

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial; opt for distinctive choices that elevate aesthetics. Pair a distinctive display font with a refined body font. For FreyAI: Syne + Inter always.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Apply gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, and grain overlays.

NEVER use generic AI-generated aesthetics: overused font families (Roboto, Arial, system fonts), cliched color schemes (purple gradients on white), predictable layouts, cookie-cutter patterns.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code. Minimalist designs need restraint and precision. Elegance comes from executing the vision well.

## Quality Gate

Before delivering, verify:
1. [ ] FreyAI brand applied (if FreyAI project) OR intentional brand-free creative direction
2. [ ] Responsive at 375px / 768px / 1280px (tested mentally or with media queries)
3. [ ] WCAG 2.1 AA: contrast, focus, semantic HTML, ARIA labels on icon buttons
4. [ ] Dark theme works without hardcoded light colors
5. [ ] No unnecessary framework dependencies for the scope of the deliverable
