---
name: question
description: |
  Enforces a requirements clarification protocol before any implementation.
  Use this skill BEFORE starting any feature, bug fix, or refactor.
  Trigger with /questions or /question.
  The goal is: never guess. Surface every ambiguity before writing a single line.
---

# Question Skill — Requirements Clarification Protocol

## When to Use

Run this skill at the START of every task that involves:
- Adding a new feature
- Modifying existing behavior
- Integrating a new service
- Changing data models or persistence
- Any UI change visible to Herr Müller

## Protocol

### Step 1: Research First (Subagents)

Before asking ANY question, use the Explore subagent to:
- Search the codebase for relevant existing code
- Read related service files, UI files, and the store shape
- Check lazy-loader.js and index.html for what is already wired
- Read the boomer-ux skill if UI is involved
- Check .env.example for relevant config vars

**Rule:** Never ask a question you could answer yourself by reading the code.
Present a brief "Here's what I found" summary before your questions — it shows the user
you did your homework and frames the questions with context.

### Step 2: Generate Minimum 5 Questions

Across these 5 categories (at least one per category):

#### 1. Scope
What is explicitly in scope vs. out of scope?
- Is this UI-only or does it need a new service module?
- Does it affect existing features or is it standalone?
- Should it work in both Einfacher Modus and Profi-Modus, or only one?

Example: "Should the reorder engine appear in Einfacher Modus or only in Profi-Modus?"

#### 2. Behavior & Edge Cases
What happens in non-happy-path scenarios?
- What if the required data is missing or malformed?
- What if Supabase is offline (IndexedDB-only mode)?
- What if the user cancels halfway through a multi-step flow?
- What are the business rules for the edge case?

Example: "If Supabase sync fails mid-invoice, should the invoice be saved locally and retried, or should the user see an error?"

#### 3. UX & Boomer Alignment
Does the UI pass the Herr Müller Test?
- Which mode does this feature appear in?
- What German labels should buttons/fields use?
- Are confirmation dialogs needed before destructive/send actions?
- What does a friendly error message look like for this feature's failure cases?

Example: "What should the button label be — 'Rechnung senden' or 'Rechnung per E-Mail senden'?"

#### 4. Data & Persistence
Where does the data live and how does it flow?
- Is this stored in IndexedDB (storeService), Supabase, or localStorage?
- What `freyai_` localStorage key should be used if needed?
- Does this affect the store's state shape (new field on existing objects)?
- Does this need to be included in the Fragebogen import mapping?

Example: "Should the customer's preferred contact method be stored on the Kunde object or in a separate settings table?"

#### 5. Integration & Script Order
How does this fit into the existing module system?
- Which services does this depend on? Are they guaranteed to be initialized first?
- Does it need a new entry in lazy-loader.js?
- Does it need a new `<script>` tag in index.html, and if so, where in the load order?
- Does it trigger or depend on any existing event bus events?

Example: "Does the new notification service need to be initialized before or after the invoice service? Are there events it needs to subscribe to at startup?"

### Step 3: Present Questions

Format:
```
## What I found (research summary)
[Brief bullets of relevant existing code/config found]

## Questions before I start

**1. [Category] — [Short title]**
[Full question]

**2. [Category] — [Short title]**
[Full question]

... (minimum 5, maximum 8 — more than 8 means the scope is too large, break it down first)
```

## Rules

- Ask questions in German if the answer involves business domain concepts
- Ask questions in English if the answer involves technical architecture
- Never ask more than 8 questions — if needed, ask the most important 5-8 and note what else needs scoping
- Group related questions
- After the user answers, confirm your understanding in one sentence before starting implementation
