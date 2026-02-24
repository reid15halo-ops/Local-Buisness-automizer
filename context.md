SYSTEM CONTEXT & ARCHITECTURE ROADMAP: FREYAI VISIONS

1. The Creator & The Vibe

User: Jonas (Jonez), 34, Senior CTO / Lead Architect / Process Engineer (Automotive, NVH).

Archetype: "The Min-Maxer" – Optimization is key. Maximum output for minimum necessary input. Data-driven, efficient, utilizing game theory and economy mechanics for real-world business.

Aesthetic & Brand: "FreyAI Visions". Target: "Industrial Luxury" (Rolex/Apple-Vibe). Dark mode, bold typography, minimalist industrial visuals, high-end "Matrix/Real World" feel. The software must feel exclusive, powerful, and freeing.

Tone of AI Assistant: Direct, professional, visionary, but grounded in engineering reality. Skip the fluff. Give me complete code blocks for implementation and concise explanations for learning.

2. The Business Objective ("The Greater Picture")

The Problem: Local German SMBs (specifically Craftspeople/Handwerker with 5-10 employees) have high cash flow but are drowning in bureaucracy, Excel chaos, and unstructured data.

The Product: A bespoke "Complete Finance & Org Suite" – a local infrastructure SaaS solution.

The USP: "Apple-like" simplicity with "Rolex-like" prestige. We do not sell cheap 20€/month SaaS. We sell a premium, custom-fit digital backbone (Setup: 3.5k-7.5k € + Retainer: 300-500 €/month).

The Ultimate Goal (Personal): Achieve "Coast FIRE" and financial independence by age 59 (or earlier), leveraging Geo-Arbitrage (moving to Spain/Portugal) to halve living costs and tax burdens. This business is the cash-flow engine to accelerate a highly optimized ETF portfolio (Stoxx600/India/Tech focus) beyond the 1 Million € mark.

3. The Technical Stack & Architecture

We are building a lean, hyper-efficient system orchestrated by a small human team (Jonas) and an army of Autonomous AI Agents.

OS/Environment: Linux Mint (Cinnamon), Local Network Focus.

Frontend: Flutter (Single Source Solution for cross-platform) or React. Focus on a slick, dark-mode, industrial UI.

Backend / Orchestration: n8n (The backbone for workflow automation) + Python (FastAPI) for custom AI agents.

Database: Supabase (PostgreSQL) + Self-hosted encrypted Cloud for backups.

Language Preferences: Python, SQL, JavaScript (for n8n nodes), Dart (Flutter).

4. Hard Constraints & Design Principles (Non-Negotiable)

Data Sovereignty & GDPR (DSGVO): Strict compliance. We use US hardware/models (GitHub/OpenAI/Anthropic) where necessary, but Data Logic must be sovereign. Local backups, encrypted storage, and European server locations (Hetzner/Supabase EU) are preferred.

Prompt Injection Defense: Security-first architecture. Treat all user input (even from the Handwerker) as potentially hostile.

Human-in-the-Loop (HITL) for Finance:

Input: Automated CSV exports (Keep it simple, no crazy banking APIs yet).

Validation: The AI prepares GoBD-compliant data, but a human must confirm (Critical mandatory step before ordering/paying).

CLI > GUI: Move away from GUI tools (Excel/Word) towards Code, APIs, and CLI automations.

Future-Proofing (The Exit Strategy): The architecture must be modular enough that if Jonas relocates to Spain/Portugal, the system runs 100% remotely without needing on-site server maintenance at the client's location.

5. Current MVP Focus (What Claude should help with now)

We are building the MVP for the first local Handwerker client.

Task 1: Setting up the robust n8n + Supabase local orchestration.

Task 2: Designing the Flutter/React "Industrial Luxury" UI for the client dashboard.

Task 3: Implementing the CSV-parsing and GoBD-preparation logic via Python/FastAPI.

Instructions for Claude: Read this context before generating architecture proposals, UI code, or database schemas. Align your solutions with the "Min-Maxer" philosophy: don't over-engineer, but make it scale effortlessly.
