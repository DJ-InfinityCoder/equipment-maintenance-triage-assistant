<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project: Equipment Maintenance Triage Assistant

Product: a user reports an equipment problem (equipment type + identifier, issue description, recent operating events, optional structured sensor readings). The system retrieves relevant manual sections from a knowledge base, runs deterministic threshold rules, asks Gemini for structured triage, and produces a draft work order that a technician can edit, approve, or reject. History is preserved.

Tech stack: the Next.js version already installed here (App Router, TypeScript strict, app/ at the project root, no src dir), MongoDB via the official 'mongodb' driver, Gemini via '@google/genai' (model name from env var GEMINI_MODEL, default gemini-2.5-flash), shadcn/ui + the Tailwind version already installed, Zod for all validation, Vitest for unit tests.

Non-negotiable rules:
1. Safety thresholds are evaluated by deterministic TypeScript in lib/rules, never by the LLM. Final priority = max(rule-derived floor, AI suggestion). The AI can never lower priority below the rule floor.
2. The AI never approves work orders and never controls equipment. No endpoint, tool, or code path may auto-approve or send commands to equipment. Approval requires an explicit technician action.
3. Possible causes are always labelled as hypotheses. 'Confirmed findings' can only be entered by a human technician; the AI output schema must not contain a confirmed-findings field.
4. Every AI suggestion (cause, question, inspection step, priority rationale) must include citations pointing to a knowledge-base chunk id, an operating event, or a sensor reading. The server validates citations and drops or flags any that do not resolve.
5. All external input is validated with Zod at the API boundary. All AI output is parsed against a Zod schema and never trusted.
6. Failures (database, retrieval, Gemini, schema parse) surface as typed errors and a visible UI banner, never silent fallbacks or fake data.
7. Secrets only from environment variables. Never log secrets or full user payloads.
8. Keep modules small: lib/ for pure, testable domain logic, app/api for thin route handlers, components/ for UI.
9. Before using any Next.js API, check the installed version's docs as the existing Next.js rules in this file say. Do not assume older App Router behaviour.
10. After each task: run typecheck and lint, and tell me what to test manually.

Planned structure (all inside problem1): app/ (pages), app/api, components/, lib/{db,rules,rag,ai,schemas,services}, data/kb, scripts/, tests/.

Work rules for the agent: stay inside this folder, ask before deleting or renaming existing files, and never edit node_modules or commit .env.local.
