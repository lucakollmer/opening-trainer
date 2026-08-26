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
profile_version: 4.0
```

Durable project state comes from the verified private Assistant Memory repository `lucakollmer/assistant`; Google Drive is recovery/audit-only.

## Responsibility split

- Luca owns Product/phase acceptance and continuation.
- ChatGPT resolves Assistant Memory, live GitHub/Cloudflare state, source/ref operations, provider observation, browser validation and handoff evidence.
- Codex may implement bounded changes after verifying live product facts.
- Full correctness validation is front-loaded into ChatGPT/Codex where reliably available.
- Cloudflare Workers Builds is a cheap exact-SHA packaging/provider gate, not the normal debugging loop.
- GitHub Actions is excluded.

## Candidate workflow

1. Verify current base/ref and scope.
2. Run the maximum reliable focused checks while iterating, then `pnpm validate` before the final provider candidate whenever the runtime supports it.
3. Make all candidate source changes without touching `.cloudflare-review`.
4. In the final reviewable candidate commit, change `.cloudflare-review`; this is the only path watched by the non-production Workers trigger.
5. Verify the resulting exact Git SHA/ref.
6. Require the matching Workers Build to pass `pnpm validate:provider`.
7. Require `npx wrangler versions upload`, the provider-authored immutable Version Preview URL and exact `/deployment.json` SHA binding.
8. Run affected browser/HTTP smoke validation against that immutable preview.
9. Merge only when the applicable Product/merge gate is satisfied.

A superseding provider candidate must change `.cloudflare-review` again. Ordinary feature/debug commits therefore consume no Workers Build minutes.

## Production workflow

A `main` build runs `pnpm validate:provider` and `npx wrangler versions upload`; it does not automatically change production traffic.

After the immutable exact-`main` version passes deployment-marker and browser/HTTP validation, explicitly promote that exact version to 100% through the Cloudflare Deployment API. Verify the canonical domain after promotion. Do not rebuild an unchanged SHA merely to promote it.

`openings.lucakollmer.com` is canonical production. The retained `opening-trainer.pages.dev` project is recovery-only; automatic Pages production and preview deployments are disabled.

## Validation ownership

`pnpm validate` owns integrity, lint, standalone typecheck, deterministic tests, production build, PWA validation and Prettier.

`pnpm validate:provider` owns integrity, production build/TypeScript, PWA artifact validation and `git diff --check`.

Pending or failed required exact-SHA provider/browser evidence blocks readiness. Automated evidence never substitutes for Luca's Product acceptance.

## Provider routing and safety

Use the dedicated Workers Builds capability for build listing/details/logs when available. Use Cloudflare API Full for authorized provider writes and fallback observation.

PHASE-2 is accepted and merged. PHASE-3 remains separately gated by current Assistant Memory. Do not force-update history, delete the retained Pages project, or infer Product authority from infrastructure success.

## Repository integrity and completion evidence

Every tracked content change must be represented in `SHA256SUMS.txt`.

Report exact SHA/ref, changed paths, runtime checks, Worker/tag, build UUID/outcome, commands, version/preview, deployment marker, browser smoke, production promotion/deployment identity when applicable, failed/superseded iterations, and remaining Product/phase gates.
