# Opening Trainer Codex agentic pack

This pack is the repository-grounded execution contract for `PRJ-CHESS-OPENING-TRAINER`.

It contains:

- `AGENTS.md` — repository-wide authority, safety, architecture, validation and reporting rules;
- `context.md` — accepted product and execution state;
- `plans.md` — the complete phase programme;
- `CODEX_START_HERE.md` — short-command routing and the first instruction;
- `CODEX_PROMPT_PROFILE.md` — project adaptation of the Codex prompt framework;
- focused product, architecture, domain, training, UI, storage, testing, dependency and fixture contracts under `docs/`;
- one executable PHASE-0 prompt under `prompts/`;
- `START_DEVELOPMENT.md` — precise human setup instructions;
- `PACK_MANIFEST.md`, `SHA256SUMS.txt` and `scripts/verify-pack.mjs` — integrity verification.

The pack does not contain application implementation. Commit it to a new private repository, verify it, then start Codex with PHASE-0.

## Phase programme

```text
PHASE-0  Repository and application foundation
PHASE-1  Responsive board/tree/task training shell
PHASE-2  Deterministic training vertical slice
PHASE-3  Repertoire graph, transpositions, playlists and PGN import
PHASE-4  Offline persistence, recovery and portability
PHASE-5  FSRS adapter and adaptive session generator
PHASE-6  Repertoire management, progress and name recall
PHASE-7  PWA, mobile, accessibility and operational hardening
PHASE-8  Release candidate, deployment and packaging decision
```

Every phase is one branch and one draft PR. Technical completion stops at Luca's manual acceptance gate. No phase implicitly authorises the next.
