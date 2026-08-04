# Synthetic fixture catalogue

All committed fixtures are synthetic or drawn from clearly reusable public chess move sequences without proprietary annotations.

## FIX-01 — Branching white repertoire

Purpose: primary vertical slice.

Shape:

- starts `1.e4`;
- opponent has at least two replies;
- each reply contains at least two user branches;
- one branch has a deeper target;
- includes user-authored neutral test notes.

Proves tree projection, masking, deterministic opponent selection, accepted alternatives and complete-line replay.

## FIX-02 — Black repertoire

Purpose: orientation and side-to-move coverage.

Proves black board orientation, opponent/user actor assignment and move-number display.

## FIX-03 — Exact transposition

Two legal move orders reach the same canonical position with the same normal accepted move set.

Proves shared position node and shared normal-mode memory eligibility.

## FIX-04 — Contextual non-sharing

Two contexts reach the same canonical position but intentionally test different accepted user moves or strict move order.

Proves separate training identity.

## FIX-05 — Multiple accepted user moves

One position has two included user moves. Both are valid. One preserves the original selected deep target; one diverts to another accepted branch.

Proves no false error and replacement-target scheduling.

## FIX-06 — Wrong sibling variation

The user move is legal and exists in a sibling context but not the current prompt's accepted set.

Proves variation-confusion classification and contrast relation.

## FIX-07 — Position-key edge cases

Separate cases:

- same board/different side;
- same board/turn/different castling;
- nominal en-passant square without legal capture;
- legal en-passant capture;
- promotion choices.

## FIX-08 — Deep target with mature prefix

At least twelve user/opponent plies with a deep due target and mature prefix items.

Proves route context and incidental-positive non-inflation.

## FIX-09 — Recursive PGN

A small PGN containing:

- headers;
- main line;
- recursive variations;
- comments;
- NAG;
- transposition/duplicate continuation where legal.

The expected intermediate representation is documented in test code. No silent variation flattening.

## FIX-10 — Invalid PGN/import

Cases:

- syntax error;
- illegal move;
- unsupported element;
- duplicate conflicting branch;
- oversized/bounded-error case.

Proves preview errors and zero database mutation.

## FIX-11 — Backup round trip

A complete populated synthetic database with repertoire, playlist, items, reviews, session, settings, names and confusion relation.

Proves deterministic export and clean restore equivalence.

## FIX-12 — Previous database schema

Created when the first real schema migration exists. Proves forward migration and review identity preservation.

## FIX-13 — Scheduler scenarios

Parameterized synthetic items for new, learning, mature, lapse, hint, incidental, confusion and same-session repair cases with injected clock.

## Fixture rules

- Stable IDs where tests need exact snapshots; otherwise generated through injected deterministic ID source.
- No real names, accounts, tokens or private repertoire annotations.
- No remote network dependency.
- Every fixture states the invariant it proves.
- Do not use one overloaded fixture for every test when a smaller focused fixture is clearer.
