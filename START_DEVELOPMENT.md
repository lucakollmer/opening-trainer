# Starting Opening Trainer development

Use a chat inside the Opening Trainer ChatGPT Project and begin with `CHATGPT_START_HERE.md`.

The old PHASE-0 migration instructions, Google Drive bootstrap and ChatGPT + GitHub Actions workflow are historical evidence only. Do not recreate the repository or rerun earlier phase scaffolding from those documents.

Current authority and execution sequence:

1. bootstrap `PRJ-CHESS-OPENING-TRAINER` from the verified private GitHub Assistant Memory repository;
2. inspect current `lucakollmer/opening-trainer` refs/PRs live;
3. read `AGENTS.md`, `docs/workflow/CURRENT_EXECUTION_WORKFLOW.md`, `CHATGPT_WORKFLOW_PROFILE.md`, then the named phase contracts in `plans.md`;
4. implement only the currently authorized bounded phase/correction;
5. run the maximum reliable runtime review before publication;
6. publish one exact candidate SHA without force;
7. deliberately run the accepted exact-SHA Cloudflare Workers packaging/version-upload gate;
8. verify immutable-preview deployment metadata and affected browser behavior;
9. stop for Luca's manual Product acceptance;
10. merge, production promotion and continuation occur only after explicit authority.

A terminal with the repository available may use the full developer command:

```sh
pnpm install --frozen-lockfile
pnpm validate
```

The optimized provider build is intentionally narrower:

```text
pnpm integrity:check && pnpm build && pnpm test:pwa && git diff --check
npx wrangler@4.126.0 versions upload
```

That provider upload creates a reviewable Worker Version but does not change production traffic.
