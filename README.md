# Opening Trainer

Opening Trainer is a web-first React/TypeScript chess repertoire trainer deployed as a Cloudflare Worker at `openings.lucakollmer.com`.

## Current authority and workflow

Repository operating authority is `AGENTS.md` plus the GitHub Assistant Memory project `PRJ-CHESS-OPENING-TRAINER`. Google Drive and the older ChatGPT + GitHub Actions workflow documents in this repository are historical/recovery material only.

The accepted development mode is `cloud` and the accepted validation workflow is `cloudflare-workers-direct`:

1. publish an exact candidate SHA on the intended GitHub branch;
2. require the Cloudflare Workers Build for that exact SHA to reach terminal success;
3. require the immutable Worker Version Preview and exact `/deployment.json` SHA readback;
4. perform proportionate browser/runtime validation on the immutable preview;
5. stop at the applicable Luca Product/merge gate.

GitHub Actions is not part of the accepted validation workflow and must not be intentionally invoked for validation.

Canonical provider commands are:

```text
build: pnpm validate && git diff --check
preview deploy: npx wrangler versions upload
production deploy: npx wrangler deploy
```

## Product programme

The MVP is implemented through explicit phases. Accepted work currently includes the responsive board/tree/task shell and deterministic complete-line training vertical slice. `plans.md` retains the detailed PHASE-0 through PHASE-8 product programme; where its historical workflow prose conflicts with `AGENTS.md` or current Assistant Memory, the current GitHub/Workers workflow governs.

The product direction includes:

- complete-line repertoire recall from the initial position;
- deterministic repertoire opponent behaviour without a chess engine;
- contextual repertoire graph and transpositions;
- multiple accepted moves and PGN import;
- local persistence and portable backup/restore;
- scheduler-neutral raw review evidence and later FSRS scheduling;
- responsive, accessible PWA delivery.

## Development commands

The application uses Node 24 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm validate
pnpm build
pnpm preview
```

`pnpm validate` covers repository integrity, ESLint, strict TypeScript, deterministic tests, production build, generated PWA checks and Prettier. `git diff --check` is additionally part of the Workers Build command.

## Key files

- `AGENTS.md` — current repository operating and validation rules.
- `CHATGPT_WORKFLOW_PROFILE.md` — current cloud/Workers execution profile.
- `plans.md` — detailed product phase programme; legacy workflow prose is historical.
- `docs/product/PRODUCT_CONTRACT.md` — product behaviour contract.
- `docs/architecture/ARCHITECTURE.md` — module and dependency boundaries.
- `docs/domain/REPERTOIRE_DOMAIN_MODEL.md` — canonical repertoire/context model.
- `docs/training/TRAINING_AND_SCHEDULING.md` — evidence/session/scheduling contract.
- `docs/ui/UI_AND_INTERACTION_CONTRACT.md` — responsive and accessibility contract.
- `SHA256SUMS.txt` — repository integrity manifest.

## Safety boundaries

Do not merge a phase candidate, start a later phase, change production routing, retire the retained Pages recovery project, or broaden Product scope without the authority required by `AGENTS.md` and current Assistant Memory. Never force-push or rewrite product history.
