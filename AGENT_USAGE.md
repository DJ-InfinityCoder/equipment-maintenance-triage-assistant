# Agent usage and verification

## Tools used

- GitHub Copilot SDK in VS Code for code analysis, implementation, and review
  of the requested workflow.
- VS Code workspace file/search tools and PowerShell for inspection and
  validation.
- npm scripts and project-local tools: Vitest, ESLint, TypeScript, and Next.js
  production build.
- Git commands to inspect repository state and check the supplied GitHub remote.

No delegated agent work was used for this submission-preparation task.

## Representative prompts

- “Let reporters access all functions on their own reports except approval;
  technicians can edit any report, and only technicians can approve.”
- “Compare this Equipment Maintenance Triage Assistant against the submission
  checklist and identify what is still missing.”
- “Prepare setup and architecture documentation, a secret-free environment
  template, and an honest deployment checklist.”

These examples summarize the user's requests; they do not include secrets or
full user payloads.

## Important mistakes and safeguards

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
- Demo credentials are restricted to non-production and are not presented as
  valid hosted reviewer access.

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
