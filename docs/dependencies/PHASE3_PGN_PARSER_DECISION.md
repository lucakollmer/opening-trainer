# PHASE-3 PGN parser decision

## Decision

PHASE-3 keeps `chess.js` 1.4.0 as the sole chess-rules, legality, SAN/UCI and FEN engine, but does not use `chess.js` PGN loading as the structural repertoire parser.

The Phase-3 import boundary uses the project-owned adapter `src/domain/repertoire/pgnImport.ts`, versioned as `opening-trainer-pgn-rav-v1`. It tokenizes only the bounded PGN structure needed by this phase and replays every parsed move through `chess.js` before a graph can be committed.

No dependency or lockfile change is introduced by this decision.

## Why `chess.js` PGN loading is insufficient here

The repertoire contract requires recursive annotation variations (RAV), comments, NAGs and source-located import failures to survive preview. The installed `chess.js` API is retained for move legality, but its PGN loading path is not treated as an adequate recursive repertoire-tree parser for this contract. PHASE-3 therefore fails closed rather than flattening variations.

## Focused parser alternatives evaluated

Two focused parser packages were considered for the adapter boundary:

- `@echecs/pgn`: permissive MIT licence, TypeScript implementation, recursive variations and structured parser diagnostics.
- `@mliebelt/pgn-parser`: permissive Apache-2.0 licence, mature PGN parser with variation support and TypeScript declarations.

Either remains a viable future implementation behind the same import boundary. PHASE-3 does not add one because the required synthetic fixture surface is small and bounded, and avoiding an additional parser dependency keeps the accepted locked dependency graph unchanged.

## Project-owned parser limits and safeguards

`opening-trainer-pgn-rav-v1` deliberately has a narrow scope:

- maximum input size is 1,000,000 UTF-8 bytes;
- recursive parentheses must balance or preview fails;
- brace and semicolon comments are preserved, including a comment at the start of a variation;
- numeric and symbolic NAGs are preserved as imported metadata only;
- result markers are ignored for repertoire correctness;
- headers are preserved as source metadata;
- unsupported or malformed tokens become explicit preview errors rather than being dropped;
- every SAN move is replayed through `chess.js` from the correct parent FEN;
- canonical positions, edges and contextual occurrences are validated before commit;
- preview is isolated and the in-memory repository receives a graph only after full validation.

The source fingerprint currently uses a deterministic `fnv1a32:` content fingerprint. It is provenance/deduplication metadata, not a security or authenticity digest.

## Maintenance boundary

The parser is not a second chess engine. It may identify PGN structure only; it must never independently decide move legality or resulting chess state. A later parser-package adoption can replace the tokenizer/parser behind the same candidate interface without changing repertoire graph semantics, training identity or the PHASE-4 persistence boundary.
