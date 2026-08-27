# AGENTS.md — Opening Trainer

## Authority and project identity

Opening Trainer is the managed product repository `lucakollmer/opening-trainer` for Assistant Memory project `PRJ-CHESS-OPENING-TRAINER`.

Durable project authority lives in the private GitHub Assistant Memory repository `lucakollmer/assistant`, repository ID `1327919572`, node ID `R_kgDOTyZx1A`, default branch `main`. A modifying session must verify that exact trust anchor, pin current Assistant Memory `main`, read `START_HERE.md`, then read `projects/PRJ-CHESS-OPENING-TRAINER/context.json` at the same cut and apply valid later project events before inferring current state. Google Drive is recovery/audit-only and is not a normal semantic authority.

Mutable product-repository facts must also be checked live before mutation.

## Current execution documents

Read `docs/workflow/CURRENT_EXECUTION_WORKFLOW.md` before `plans.md`. The phase goals, scope, tests, manual checklists and phase gates in `plans.md` remain the programme plan. Its legacy Drive / GitHub Actions execution mechanics and historical phase-status blocks are superseded by current Assistant Memory, this file, `CHATGPT_START_HERE.md`, `CHATGPT_WORKFLOW_PROFILE.md` and `docs/workflow/CURRENT_EXECUTION_WORKFLOW.md`.

The historical phrases `Google Drive Assistant Memory` and `ChatGPT + GitHub Actions` are retained in old evidence and compatibility checks only. They do not describe current authority or validation.

## Current development and validation workflow

The accepted development mode is `cloud` and the accepted validation workflow is `cloudflare-workers-direct`. GitHub Actions is excluded from the accepted product validation workflow.

Runtime review owns the maximum reliable implementation checks before publication: focused tests, lint, strict TypeScript, formatting review and relevant browser/static inspection when the current runtime exposes those capabilities. Do not spend provider build minutes on defects that can be found reliably before publication.

Cloudflare Workers Builds is the exact-SHA packaging/deployment gate. Automatic non-production branch builds are disabled. A review candidate is built deliberately from its exact Git commit using the retained production trigger configured as `Upload version - main - no traffic change`.

Current provider commands:

- build: `pnpm integrity:check && pnpm build && pnpm test:pwa && git diff --check`
- non-traffic deploy: `npx wrangler@4.126.0 versions upload`

Current provider coordinates:

- Worker: `opening-trainer`
- Worker tag: `a3b7d0830d3046268ba91f587c25fa70`
- exact-SHA trigger UUID: `c9def933-0eb2-47ba-93bd-d55912a228c4`

For a reviewable candidate:

1. finish the bounded source change and runtime review;
2. publish one exact candidate SHA to the intended branch without force;
3. verify the branch ref points to that SHA;
4. deliberately trigger the retained Workers Build using that exact commit SHA;
5. require terminal provider success and a Worker Version upload with no traffic change;
6. obtain the provider-authored immutable Version Preview URL;
7. require `/deployment.json` on that immutable preview to match the candidate SHA, branch and provider build UUID;
8. perform affected-route browser/HTTP smoke checks at relevant desktop/mobile sizes;
9. hand the exact immutable preview to Luca for Product review.

Any later branch-head change invalidates earlier exact-SHA provider or browser evidence. Pending or failed required evidence blocks technical-readiness claims.

Production traffic promotion is a separate operation after Product acceptance and merge authorization. Do not infer it from a successful version upload.

## Product and phase gates

Luca retains phase acceptance, merge, and continuation authority.

Automated validation, a successful Worker Version upload, a preview URL or an open pull request never implies Product acceptance.

Do not:

- merge a phase candidate without Luca's current explicit authorization;
- start a later phase without the required separate authority;
- promote production traffic, change production domains/DNS or delete the retained Pages project without explicit authority;
- force-push or rewrite history;
- broaden bounded implementation into a new Product decision.

## Implementation defaults

Prefer existing architecture and shared components over new primitives. Domain transitions remain outside React. The repository `package.json` full `pnpm validate` command remains useful when an appropriate runtime is available; the optimized Workers provider gate intentionally does not duplicate lint, unit tests or Prettier.

When visible UI changes, preserve desktop, tablet, phone, keyboard, touch, focus, promotion, answer-masking and error-boundary behavior as applicable. Browser evidence does not substitute for Luca's Product acceptance.

## Repository integrity

`SHA256SUMS.txt` is the full-tree integrity manifest. Every repository content addition, removal or change must be reflected in it. Run `pnpm integrity:update` only while intentionally preparing a candidate. The final candidate must pass `pnpm integrity:check` without first rewriting the manifest.

Text files use UTF-8 without BOM, LF endings, no trailing whitespace and one terminal LF.

Issued work-request artifacts under `prompts/` are immutable historical records unless a governing workflow explicitly creates a new revision.

## Completion reporting

For a candidate handoff report include:

- exact product Git SHA and ref;
- changed paths and dependency/licence/data effects;
- runtime checks actually performed and unavailable checks stated explicitly;
- Cloudflare Worker/tag, exact build UUID and terminal outcome;
- exact provider build/deploy commands;
- Worker version ID and immutable Version Preview URL;
- `/deployment.json` exact readback;
- affected-route/browser smoke results;
- superseded failed/diagnostic candidate SHAs where relevant;
- numbered manual Product checklist;
- remaining Product, merge, release or production-promotion gate.

Do not call a candidate technically ready while required exact-SHA provider or browser evidence is pending, failed or unavailable.
