# Issued Codex prompts

Each substantial Codex instruction is one immutable Markdown file with one active instruction, required front matter and `END_OF_CODEX_PROMPT` as its final content line.

The pack includes the initial PHASE-0 implementation prompt. Later prompts may be generated from the accepted repository state, but the short commands in `docs/codex/PHASE_COMMANDS.md` are sufficient once `AGENTS.md` and `plans.md` are installed.

Corrections and continuations receive new IDs and link to the parent prompt. Do not edit an issued prompt in place.
