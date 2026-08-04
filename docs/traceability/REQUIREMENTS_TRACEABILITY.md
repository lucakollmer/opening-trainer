# Requirements traceability

| Requirement | Contract owner | First proving phase |
|---|---|---|
| Browser/mobile-capable application | `ARCHITECTURE.md`, UI contract | PHASE-1, PHASE-7 |
| Out-of-box UI components | `AGENTS.md`, UI contract | PHASE-0, PHASE-1 |
| Board/tree/task single surface | Product/UI contracts | PHASE-1 |
| Complete line from initial position | Product/training contracts | PHASE-2 |
| Deterministic repertoire opponent | Product/training contracts | PHASE-2 |
| No chess engine | Product/architecture contracts | PHASE-0 onward |
| Move legality and SAN/FEN | Architecture/domain contracts | PHASE-2 |
| Branching repertoire tree | Domain/UI contracts | PHASE-1, PHASE-3 |
| Future answer masking | Product/UI contracts | PHASE-1, PHASE-2 |
| Multiple accepted moves | Domain/training contracts | PHASE-3 |
| Transpositions | Domain contract | PHASE-3 |
| PGN variations/import | Domain/storage contracts | PHASE-3 |
| Playlists | Domain/product contracts | PHASE-3, PHASE-6 |
| Local persistence | Storage contract | PHASE-4 |
| Complete JSON backup/restore | Storage contract | PHASE-4 |
| Contextual training items | Domain/training contracts | PHASE-3, PHASE-5 |
| FSRS behind adapter | Architecture/training contracts | PHASE-5 |
| Target/incidental evidence | Training contract | PHASE-5 |
| Hints and same-session repair | Training/product contracts | PHASE-2, PHASE-5 |
| Contrast drills | Training contract | PHASE-5/PHASE-6 |
| Separate opening-name recall | Product/training contracts | PHASE-6 |
| Progress by decision/branch | Product contract | PHASE-6 |
| PWA install/offline/update | Storage/test contracts | PHASE-7 |
| Accessibility and compact layouts | UI/test contracts | PHASE-1, PHASE-7 |
| Deployment/release decision | plans | PHASE-8 |
| Native packaging deferred | decisions/dependency policy | PHASE-8 decision only |
| Portable user data | Storage contract | PHASE-4, PHASE-8 |
| No next phase without acceptance | `AGENTS.md`, `plans.md` | Every phase |
