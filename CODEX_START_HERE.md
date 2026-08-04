# CODEX_START_HERE.md — Start Opening Trainer development

## 0. Purpose

This file tells a fresh Codex chat how to begin and how to interpret short phase commands after this pack is committed to `lucakollmer/opening-trainer`.

## 1. Required first read

Read in this order:

```text
AGENTS.md
context.md
plans.md
CODEX_START_HERE.md
CODEX_PROMPT_PROFILE.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
```

Then read the focused documents listed by the named phase.

## 2. Short-command routing

- `start` or `start development` -> execute PHASE-0 only.
- `continue with phase 1` -> execute PHASE-1 only.
- `continue with phase 5` -> execute PHASE-5 only.
- Any `continue with phase N` command -> execute only PHASE-N and first enforce its entry gate.
- `continue` without a number -> use `context.md` only when its `next_phase` and predecessor acceptance are unambiguous; otherwise stop and report the missing authority.

A phase command authorises implementation, local validation, commit, push and one draft PR. It does not authorise merging or the next phase.

## 3. First Codex instruction

After the pack is committed on `main`, the preferred first instruction is:

```text
Start development. Read AGENTS.md, context.md, plans.md, CODEX_START_HERE.md, CODEX_PROMPT_PROFILE.md, docs/product/PRODUCT_CONTRACT.md and docs/architecture/ARCHITECTURE.md. Execute PHASE-0 only. Verify the entry gate, create branch phase-0-foundation from current origin/main, establish the React/TypeScript/Vite/pnpm foundation and repository quality gates defined by PHASE-0, use local validation, commit, push and open one draft PR to main. Do not implement PHASE-1, do not add product features beyond the PHASE-0 demonstration boundary, do not merge, and stop at Luca's PHASE-0 manual acceptance gate with the required self-contained completion report.
```

The exact archived executable version is in:

```text
prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md
```

## 4. Expected PHASE-0 terminal state

- one Vite React TypeScript application managed by pnpm;
- accepted dependencies installed and locked;
- directory/architecture skeleton established;
- MUI theme and minimal application shell compile;
- one synthetic demonstration fixture, not a full training feature;
- lint, formatting, typecheck, tests, build and PWA validation commands established;
- repository docs updated with observed versions and commands;
- branch pushed and one draft PR into `main`;
- no engine, backend, sync, native wrapper or later-phase feature;
- manual checklist for Luca;
- no merge and no PHASE-1 work.

## 5. After each phase

1. Read the Codex completion report.
2. Run the supplied manual checklist.
3. Return failures to the same Codex branch/PR using a new correction instruction.
4. Explicitly accept or reject the phase.
5. Only after acceptance, explicitly instruct Codex to merge or merge the PR yourself.
6. Ensure the accepted commit is in `origin/main`.
7. Start the next phase with `continue with phase N`.

## 6. Merge instruction pattern

A technically complete phase remains a draft PR until Luca accepts it. A suitable merge instruction is:

```text
I have completed the PHASE-N manual checklist and accept PHASE-N. Re-read AGENTS.md, context.md and the PHASE-N section of plans.md. Verify the draft PR head and local validation evidence have not changed, update context.md to record this explicit acceptance, commit and push that documentation update on the same branch, then merge the accepted PR into main without beginning PHASE-(N+1). Return the merge commit and exact next authorised command.
```

Use this only after actually completing the manual checklist.

## 7. Correction instruction pattern

```text
Correct PHASE-N on the existing phase branch and draft PR only. The failed manual item is: <item>. Observed: <result>. Expected: <result>. Read AGENTS.md, context.md, plans.md and the relevant phase documents. Diagnose and repair the smallest complete cause, rerun all applicable PHASE-N validation, update the same draft PR and return the full completion report. Do not merge or begin another phase.
```
