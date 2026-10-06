# Equipment Maintenance Triage Assistant

An evidence-backed maintenance triage app. Operators submit an equipment issue;
deterministic safety rules and grounded AI create a **draft** work order for
human review. Nothing in the application sends commands to equipment, and AI
cannot approve work.

## Status

- Core reporter and technician workflows are implemented.
- MongoDB persists reports, work orders, users, knowledge-base chunks, equipment
  history, and audit events.
- AI triage uses Gemini or Groq, with validated structured output and citation
  checks.
- A production build and the test suite pass locally.
- **Deployment is not included in this repository yet.** Do not submit this
  project as deployed until you have deployed it, verified the hosted workflow,
  and added the live URL and reviewer access in your submission remarks.

## Features

- Authenticated reporter and technician roles.
- Report form for equipment type/identifier, issue description, recent operating
  events, and optional structured sensor readings.
- Reporter-owned report history and edit workflow.
- Deterministic TypeScript thresholds establish the safety priority floor.
- Searchable maintenance knowledge base and retrieval-backed AI triage.
- AI suggestions are schema-validated; suggestions without resolvable citations
  are dropped/flagged. Possible causes are presented as hypotheses.
- Follow-up questions can be answered by the report owner or a technician.
- Reporters can view and edit their own draft workflow, answer questions, retry
  triage, edit the draft work order, and reject a draft; they cannot approve.
- Technicians can review and edit draft records, record confirmed findings, and
  explicitly approve or reject. Only technicians can enter confirmed findings
  or approve.
- Finalized work orders are read-only. Audit history preserves key changes.
- Missing/conflicting sensor data and database, retrieval, and AI failures are
  surfaced instead of being represented as successful AI results.
- Structured JSON server logs omit full report payloads and redact common
  credential fields.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB Atlas or a reachable MongoDB deployment.
- At least one supported chat provider (Gemini or Groq) for AI triage.
- For vector retrieval: Atlas Vector Search and a compatible embedding provider.
  Without a vector index, the app retains keyword/text retrieval where available.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy the example configuration and fill in your own values:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Never commit `.env.local`. At minimum, configure `MONGODB_URI`,
   `AUTH_SECRET`, one chat provider key and model, and the embedding provider/key
   and model if seeding a vector index. See [Environment variables](#environment-variables).

3. Initialize MongoDB collections and indexes:

   ```bash
   npm run db:init
   ```

4. Seed the manuals in `data/kb/`:

   ```bash
   npm run kb:seed
   ```

   Configure `ATLAS_VECTOR_INDEX` and embedding credentials before this step
   when you want the seed script to generate vector embeddings. Wait for the
   Atlas index to finish building before testing vector retrieval.

5. (Optional) Seed demo accounts manually (or use auto-provisioning on first demo login):

   ```bash
   npm run auth:seed-demo
   ```

   The login page displays demo evaluation credentials with quick "Use" buttons.
   Both reporter and technician demo accounts work in development and production
   environments for streamlined evaluation.

6. Start the app:

   ```bash
   npm run dev
   ```

   Visit <http://localhost:3000>. Reporter accounts can register. Technician
   registration requires `TECHNICIAN_INVITE_CODE`.

## Environment variables

See [.env.example](./.env.example) for a blank template. Never put real
credentials in that file or in source control.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string; keep it private. |
| `MONGODB_DB_NAME` | No | Database name; defaults to `maintenance_triage`. |
| `MONGODB_DNS_SERVERS` | No | Comma-separated DNS resolver addresses if SRV lookup needs explicit resolvers. |
| `AUTH_SECRET` | Yes | Random session-signing secret; use at least 32 characters. |
| `NEXTAUTH_SECRET` | No | Legacy fallback for `AUTH_SECRET`; prefer `AUTH_SECRET`. |
| `TECHNICIAN_INVITE_CODE` | For technician registration | Private invite code; use at least 16 characters. |
| `AI_PROVIDER` | No | Preferred provider: `gemini` or `groq`. Configured providers can be tried as fallback. |
| `GEMINI_API_KEY` | One chat key required | Private Google AI API key. |
| `GEMINI_MODEL` | With Gemini | Gemini model ID available to the key and supporting `generateContent`. |
| `GROQ_API_KEY` | One chat key required | Private Groq API key. |
| `GROQ_MODEL` | With Groq | Groq model ID available to the key. |
| `EMBEDDING_PROVIDER` | For vector search | `gemini` or `groq`; choose a provider with a compatible embedding endpoint. |
| `GEMINI_EMBEDDING_MODEL` | With Gemini embeddings | Gemini embedding model ID supported by the API key. |
| `GROQ_EMBEDDING_MODEL` | With Groq embeddings | Groq embedding model ID supported by the API key. |
| `ATLAS_VECTOR_INDEX` | For vector search | Atlas Vector Search index name; leave unset to seed without vectors. |
| `DEBUG_FAIL` | Development/testing only | Simulates selected failures locally; ignored in production. |

`GOOGLE_API_KEY` is not read by this project; use `GEMINI_API_KEY`. Model IDs
are intentionally configured through environment variables rather than silently
defaulting to a model that may not be available to an account.

## Architecture

```text
app/                         Next.js pages and thin API route handlers
components/report/           Multi-step report form and report editor
components/triage/            Shared dossier, evidence, checklist, work-order UI
lib/auth/                     Signed sessions and role/ownership authorization
lib/db/                       MongoDB client, collections, indexes, repositories
lib/rules/                    Pure deterministic thresholds and data-quality rules
lib/rag/                      Knowledge retrieval and embeddings
lib/ai/                       Provider calls, Zod output schema, citation checks
lib/services/                 Triage orchestration, follow-up workflow, logging
lib/schemas/                  Zod domain and API schemas
data/kb/                      Equipment-specific knowledge-base source manuals
scripts/                      Database, knowledge-base, and local demo setup
tests/                        Vitest unit and focused integration tests
```

API handlers validate external input with Zod. The triage service runs rules
independently of the LLM, retrieves relevant manual chunks, validates AI output,
and merges suggested priority with the deterministic rule floor. The LLM has
no approval or equipment-control capability. MongoDB audit events record
user-attributed workflow changes.

## Checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

The focused tests cover schemas, thresholds, citation validation, retrieval,
AI failure handling, auth, role access, work-order state changes, and equipment
history. Test logs may include simulated failure messages; these are generated
by tests and do not indicate a production failure.

## Deployment

This app has **not been deployed from this repository**. A public repository
alone is not a hosted app. To deploy:

1. Push this repository to GitHub and import it into a Next.js-capable host such
   as Vercel.
2. Add the production values from `.env.example` through the host's encrypted
   environment-variable settings. Do not reuse local demo credentials or check
   secrets into GitHub.
3. Configure production MongoDB network access, database permissions, and
   indexes. Run the database initialization and knowledge-base seeding scripts
   against the intended production database before review.
4. Configure a real AI provider/model and, if required, a compatible embedding
   provider and ready Atlas Vector Search index. Validate model IDs against
   current provider account availability.
5. Use a unique production `AUTH_SECRET` and `TECHNICIAN_INVITE_CODE`. Create
   separate least-privilege reviewer accounts; provide only those temporary
   review credentials through the submission remarks and rotate/delete them
   after review.
6. Confirm the hosting plan supports the triage route's configured execution
   duration. Verify login, report creation, AI/retrieval, follow-up, draft edit,
   technician approval, and error states against the deployed URL.
7. Keep the deployment, database, and provider access active until review is
   complete. Add the verified deployment URL to the submission.

## Completed and excluded scope

**Implemented:** reporting, deterministic rules, manual retrieval, AI triage,
citation validation, follow-up answers, role-based history and editing, draft
work orders, technician-only confirmed findings/approval, audit history,
equipment recurrence/history, and visible failure states.

**Intentionally excluded:** live IoT ingestion, predictive-maintenance models,
inventory management, technician dispatch, and remote equipment control.

## Limitations and reviewer notes

- AI availability, rate limits, output quality, and model names depend on the
  configured provider account. The app surfaces AI failures and keeps
  deterministic rule findings available.
- Retrieval quality depends on the manuals in `data/kb/`, MongoDB availability,
  and (for vector mode) embeddings and Atlas index readiness.
- Demo accounts are available on the login page for evaluator convenience. You can also register custom reporter accounts directly from the UI.
- Before final submission, ensure the hosted URL and review credentials work,
  and document the live deployment details in your submission remarks.
