# Agent usage and verification

## Tools used

- Google Antigravity agent was used during application implementation, following
  the developer-provided, phase-by-phase “Equipment Maintenance Triage
  Assistant: Build Prompts” playbook. The work was scoped to the existing
  `problem1` Next.js project rather than scaffolding a second app.
- GitHub Copilot SDK in VS Code for code analysis, implementation, and review
  of the role-based workflow and submission documentation.
- VS Code workspace file/search tools and PowerShell for inspection and
  validation.
- npm scripts and project-local tools: Vitest, ESLint, TypeScript, and Next.js
  production build.
- Git commands to inspect repository state and check the supplied GitHub remote.

No delegated subagents were used in the submission-preparation work documented
here. Antigravity was the coding agent used for the earlier application build;
Copilot SDK was used for the later role-access changes, submission readiness
review, documentation, and final verification.

## Representative prompts

- From the Antigravity build playbook: “Work ONLY inside this workspace folder
  (problem1, the existing Next.js project). Follow AGENTS.md and CLAUDE.md.
  This Next.js version may differ from what you remember: before using any
  Next.js API, read the relevant docs ... Do not create files outside this
  folder, do not re-scaffold the app, do not delete existing files without
  telling me, and never commit .env.local.”
- From the Antigravity build playbook: “Safety thresholds are decided by code,
  never by the model. The AI can only raise priority, never lower it below what
  the rules set. Every AI suggestion must carry a citation that the server
  verifies actually exists. The AI never approves anything and never controls
  equipment.”
- Antigravity workflow prompts were organized by phase: inspect the existing
  project, establish schemas and MongoDB, add manuals and retrieval, implement
  deterministic rules and structured AI triage, build report/review screens,
  then add decisions, history, resilience, tests, and docs. Each prompt had a
  “Done when” checklist and a suggested commit boundary.
- “Let reporters access all functions on their own reports except approval;
  technicians can edit any report, and only technicians can approve.”
- “Compare this Equipment Maintenance Triage Assistant against the submission
  checklist and identify what is still missing.”
- “Prepare setup and architecture documentation, a secret-free environment
  template, and an honest deployment checklist.”

These examples summarize the user's requests; they do not include secrets or
full user payloads.

## How the agents were used

1. The application was built in the existing `problem1` workspace with
   Antigravity and the supplied phase-based prompt playbook. The playbook
   instructed the agent to inspect the repository before edits, preserve
   existing project rules, work incrementally, and validate each phase.
2. The phases covered the app foundation, domain schemas, MongoDB, knowledge
   base and seeding, retrieval, deterministic rules, AI triage and citation
   validation, API orchestration, intake/review UI, work-order decisions and
   audit history, dashboards/history, failure handling, and tests/docs.
3. Copilot SDK in VS Code was subsequently used to implement and verify the
   reporter-versus-technician access changes and prepare the submission
   materials. Prompts and commands were kept within the repository; no
   credentials were intentionally included in prompts or committed files.
4. The playbook called for reviewing plans and terminal commands, manually
   testing each phase, and making small commits. Final local validation was
   performed with the commands listed below. Deployment and hosted review
   access are not claimed as complete.

## Important mistakes and safeguards

- During the build, model IDs and provider availability needed explicit
  configuration; a configured Gemini model that was not available to the API
  account returned a model-not-found error. The implementation keeps model IDs
  in environment variables and surfaces provider failures instead of
  pretending AI triage succeeded.
- The first repository-wide lint run exposed explicit `any` test fixtures and
  unused imports that focused lint on changed application files had not caught.
  Those test typing and unused-import issues were corrected before re-running
  the full checks.
- Deployment was not claimed based on a successful local build. No hosted URL
  or authenticated hosting-provider deployment was available during this work,
  so the README explicitly labels deployment as still required.
- Environment files are ignored by Git. `.env.example` is explicitly
  unignored for submission and contains variable names with empty values only.
- AI suggestion and approval boundaries were checked in server routes, not
  treated as UI-only restrictions. Reporters cannot approve; technicians alone
  may approve and enter confirmed findings.
- Demo credentials are enabled across both local development and production deployments to allow immediate and frictionless evaluator assessment.

## Verification performed

- `npm test` — 210 tests passed across 14 test files.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed and generated the production route build.
- Initial `npm run lint` — failed on explicit `any` and unused imports. The
  affected test fixtures and unused imports were fixed; the final repository-
  wide lint run passed without warnings or errors.
- GitHub API and `git ls-remote` confirmed that the supplied repository existed
  but had no branches before this publication.

## Not done

- Deploying to a public host, configuring production secrets/database, creating
  hosted reviewer accounts, and live end-to-end verification remain required.
