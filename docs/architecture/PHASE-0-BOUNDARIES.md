# PHASE-0 architecture boundaries

The foundation proves compilation and test boundaries without implementing product behaviour.

- `src/app`: application composition, global providers, theme and boot failure handling.
- `src/features`: bounded presentation adapters for the board, synthetic repertoire tree and task card.
- `src/domain/chess`: chess.js adapter and canonical position-key invariant.
- `src/domain/scheduling`: project-owned scheduling port with a construction-only ts-fsrs adapter.
- `src/infrastructure/db`: isolated Dexie smoke database; it is not a production schema.
- `src/fixtures`: synthetic, non-repertoire fixture values.
- `src/test`: common deterministic test setup.

No router, global state library, training state machine, repertoire graph, permanent database schema or scheduler policy is established in PHASE-0.
