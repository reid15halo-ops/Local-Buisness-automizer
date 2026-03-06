# FreyAI Visions — Project Rules

## Architecture
- **95/5 Pattern**: 95% async (n8n workflows) / 5% sync (FastAPI backend)
- **Database**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **VPS**: Hostinger KVM 4 (Ubuntu 24.04, Docker, 16 GB RAM)
- **Local LLMs**: Ollama on VPS (Mistral Small, Qwen3.5:9b)
- **Cloud LLMs**: Claude (Anthropic), Codex (OpenAI)

## Definition of Done (DoD) — Morpheus Feedback Loop

When implementing any feature or fixing any issue, follow this 4-agent workflow:

### Agent 1: Grounding Agent
- Research the issue/task thoroughly before coding
- Read relevant source files, documentation, and related issues
- For code: understand the full context (imports, dependencies, tests)
- For content: understand target language, style, audience
- Output: structured context document for the Execution Agent

### Agent 2: Execution Agent
- Model: **Mistral Small** (local via Ollama) for simple tasks, **Claude** for complex tasks
- Implement the solution based on Grounding Agent context
- Focus ONLY on implementation — no self-review
- Output: code changes / content / translation

### Agent 3: Evaluation Agent (4 parallel reviewers)
Spawn **at minimum 4 review agents** before accepting any change:

#### Review 1 — Code Quality (Codex/GPT)
- Is the code clean, correct, secure, performant?
- Is it maintainable, testable, robust, documented?
- Does it follow project conventions?

#### Review 2 — Issue Resolution (Codex/GPT)
- Does the new code solve the issue 100%?
- Are all acceptance criteria met?
- Are there edge cases not covered?

#### Review 3 — Code Quality (Claude)
- Same checks as Review 1, different model perspective
- Claude and Codex find different issues — use both

#### Review 4 — Issue Resolution (Claude)
- Same checks as Review 2, different model perspective
- Verify from a different angle

**Rules:**
- If ANY reviewer flags an issue → back to Execution Agent with feedback
- Loop continues until ALL 4 reviewers approve
- Linting, type-checking, and tests must pass regardless (non-negotiable)
- Track the review round number (Morpheus example: 11 rounds needed)

### Agent 4: Finalizing Agent
- Only runs when all 4 reviewers approve
- Git commit with descriptive message
- Update relevant documentation
- For n8n workflows: deploy to production
- For content: write to database

## Models Used (matching Morpheus setup)

| Role | Model | Where |
|------|-------|-------|
| Execution (simple) | Mistral Small 24B | Ollama on VPS (localhost:11434) |
| Execution (complex) | Claude Opus 4.6 | Anthropic API |
| Evaluation Review 1 | GPT-4o / Codex | OpenAI API |
| Evaluation Review 2 | GPT-4o / Codex | OpenAI API |
| Evaluation Review 3 | Claude Sonnet 4.6 | Anthropic API |
| Evaluation Review 4 | Claude Sonnet 4.6 | Anthropic API |
| Grounding (research) | Claude Opus 4.6 | Anthropic API |

## Coding Standards
- TypeScript for frontend/Edge Functions
- Python for backend (FastAPI)
- SQL migrations in supabase/migrations/
- n8n workflows exported as JSON in config/n8n-workflows/
- Always use RLS policies on new Supabase tables

## Git Workflow
- Main branch: main
- Feature branches: feature/<name>
- Commit messages: conventional commits (feat:, fix:, chore:)
- Never push directly to main without review loop completion
