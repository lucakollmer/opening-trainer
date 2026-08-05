# Repository decision record

This file summarises accepted design decisions for repository execution. Historical supersession belongs in Assistant Memory; repository updates must preserve older entries or mark them superseded.

## D-001 — Complete-line replay

Status: accepted.

Training normally begins from the initial position rather than isolated target positions.

## D-002 — No engine in MVP

Status: accepted.

The opponent follows repertoire moves. `chess.js` supplies rules/state, not evaluation.

## D-003 — Move recall primary

Status: accepted.

Opening names are separate secondary memory items.

## D-004 — Branching visible repertoire

Status: accepted.

The user sees a tree projection; canonical storage may be a graph.

## D-005 — Board/tree/task single surface

Status: accepted.

Use a board-dominant persistent workspace and responsive panel transformations.

## D-006 — Mask future answers

Status: accepted.

Train mode reveals the played path but not future move labels in visible or accessible DOM content.

## D-007 — Contextual position-to-move memory

Status: accepted direction.

Track memory at contextual decisions while replaying complete lines. Exact implementation is specified in the domain/training contracts.

## D-008 — Targeted/incidental evidence split

Status: accepted.

Positive incidental prefix traversal cannot repeatedly inflate FSRS intervals; incidental failure promotes targeted review.

## D-009 — Accepted alternatives are valid

Status: accepted.

Any active repertoire move is correct in normal mode. Replan rather than falsely grade it wrong.

## D-010 — Distinct error classes

Status: accepted.

Illegal, legal outside-repertoire and wrong sibling variation are distinct.

## D-011 — Web-first stack

Status: accepted.

React, TypeScript, Vite, MUI, MUI X Tree View Community, react-chessboard, chess.js, Dexie, ts-fsrs and vite-plugin-pwa. Native wrappers deferred.

## D-012 — Standard components over bespoke UI

Status: accepted.

Use MUI for ordinary controls. Keep project-owned UI limited to chess-specific composition/adapters.

## D-013 — Local-first, complete portable backup

Status: accepted.

IndexedDB is operational storage. Versioned JSON preserves complete user data; PGN alone is not a full backup.

## D-014 - Phase-gated implementation programme

Status: accepted.

One named phase per branch/draft PR. Luca manually accepts each phase before the next.

## D-015 - ChatGPT + GitHub Actions execution workflow

Status: accepted on 2026-08-04.

Google Drive remains the canonical project record. ChatGPT authors bounded changes through the connected GitHub application. GitHub Actions validates the exact candidate tree and publishes structured technical evidence and responsive review artifacts. Luca alone accepts visible behaviour, authorises merge and authorises continuation. The historical local-Codex execution mechanism is superseded; the product stack and PHASE-0 to PHASE-8 gates remain.
