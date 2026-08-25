# CHATGPT_WORKFLOW_PROFILE.md — Opening Trainer execution profile

## Identity

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
repository: lucakollmer/opening-trainer
integration_branch: main
programme: MVP
development_mode: cloud
validation_workflow: cloudflare-workers-direct
worker: opening-trainer
profile_version: 3.0
```

Durable project state is resolved from the private GitHub Assistant Memory repository `lucakollmer/assistant` using its verified numeric trust anchor. Google Drive is recovery/audit-only.

## Responsibility split

- Luca owns Product acceptance, visual/manual interaction acceptance, merge authorization, production-domain cutover and continuation to later phases.
- Browser ChatGPT owns Assistant Memory bootstrap, scope resolution, GitHub source/ref operations, Cloudflare provider observation, browser/HTTP validation and user-facing handoff evidence.
- Codex may own bounded implementation when delegated, but it must verify live product-repository facts and return the exact candidate SHA/ref.
- Cloudflare Workers Builds owns the authoritative exact-SHA final build/deployment gate.
- GitHub Actions is excluded from the accepted validation workflow.

## Candidate workflow

For a reviewable exact candidate:

1. verify current product base/ref coordinates;
2. make only authorized repository changes;
3. run the maximum feasible focused/runtime checks;
4. publish and verify the exact Git SHA;
5. locate the Workers Build with matching `commitHash`;
6. require terminal success for `pnpm validate && git diff --check`;
7. for non-production branches require successful `npx wrangler versions upload`;
8. retrieve the provider-authored immutable Version Preview URL;
9. require `/deployment.json` to report the same Git SHA;
10. perform browser/HTTP smoke validation against that immutable preview;
11. hand the exact preview to Luca when manual Product review is required.

Pending or failed provider/browser evidence blocks technical-readiness claims.

Production `main` uses the same build command followed by `npx wrangler deploy`.

## Validation contents

`pnpm validate` owns repository integrity, lint, typecheck, deterministic tests, production build, PWA validation and Prettier. Workers Builds additionally runs `git diff --check`.

Focused checks during implementation may overlap the final gate for feedback, but do not repeatedly run the full aggregate gate without a changed candidate or diagnostic reason.

For visible changes, test relevant desktop/tablet/phone, keyboard/touch, focus, error-boundary and answer-disclosure behavior. Automated evidence never substitutes for Luca's visual/Product acceptance.

## Cloudflare capability routing

Use the dedicated Workers Builds capability for exact-SHA build listing/details/logs when available.

Use Cloudflare API Full for authorized Cloudflare writes and as the backup observation API when the dedicated Workers Builds capability cannot expose required evidence.

Provider mutation scope remains bounded. Production domains, DNS, deletion of the Pages project and unrelated account configuration remain separately gated.

## Phase and merge safety

Luca retains phase acceptance, merge, and continuation authority.

A successful Worker build or preview does not authorize merge. Do not start PHASE-3 or merge PHASE-2 without the required explicit acceptance. Infrastructure migration acceptance is also separate from the PHASE-2 Product gate.

## Repository integrity

Every tracked repository content change must be represented in `SHA256SUMS.txt`. Final validation must pass `pnpm integrity:check` without regenerating the manifest first.

Historical repository documents may still describe the former Google Drive / GitHub Actions workflow. They are historical evidence only. Current Assistant Memory, `AGENTS.md`, and this profile govern current execution.

## Completion evidence

Report the exact Git SHA/ref, changed paths, runtime checks, Worker name/tag, exact build UUID, build outcome, build/deploy commands, Worker version ID, immutable preview URL, `/deployment.json` readback, browser smoke result, superseded failed iterations, and every remaining manual/merge/production gate.
