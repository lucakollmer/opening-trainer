# Precise start instructions — Opening Trainer with Codex on Windows

These instructions assume Windows 11, PowerShell and a private GitHub repository named `lucakollmer/opening-trainer`.

## 1. Install prerequisites

### Git

Check:

```powershell
git --version
```

When missing, install Git for Windows using the official installer or:

```powershell
winget install --id Git.Git -e
```

Open a new PowerShell window after installation.

### Node.js

Install the current Node.js 24 LTS release. Check:

```powershell
node --version
npm --version
```

The major Node version should be `24`.

### pnpm

Install pnpm 10 through npm:

```powershell
npm install --global pnpm@10
pnpm --version
```

### Codex

Preferred official Windows installer:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"
```

Alternative npm installation:

```powershell
npm install --global @openai/codex
```

Verify:

```powershell
codex --version
```

Run `codex` once and choose **Sign in with ChatGPT**.

## 2. Create the private GitHub repository

Create a new private repository with:

```text
Owner: lucakollmer
Repository name: opening-trainer
Visibility: Private
Default branch: main
```

Do not initialise it with a README, `.gitignore` or licence because this pack supplies the initial files.

Copy the repository HTTPS URL.

## 3. Clone the empty repository

Choose a local development parent, for example `C:\dev`:

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
Set-Location C:\dev
git clone https://github.com/lucakollmer/opening-trainer.git
Set-Location .\opening-trainer
```

An empty-repository warning is expected.

## 4. Extract this pack into the repository root

Suppose the downloaded archive is in `Downloads`:

```powershell
$pack = Join-Path $HOME 'Downloads\opening-trainer-codex-pack.zip'
$staging = Join-Path $env:TEMP 'opening-trainer-codex-pack'
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $pack -DestinationPath $staging -Force
Copy-Item -Path (Join-Path $staging 'opening-trainer-codex-pack\*') -Destination . -Recurse -Force
```

The repository root should now contain:

```text
AGENTS.md
context.md
plans.md
CODEX_START_HERE.md
CODEX_PROMPT_PROFILE.md
PACK_MANIFEST.md
START_DEVELOPMENT.md
docs\
prompts\
scripts\
```

Check:

```powershell
Get-ChildItem
```

## 5. Verify pack integrity

```powershell
node .\scripts\verify-pack.mjs
```

Expected result:

```text
PACK_VERIFICATION_OK
```

Also run:

```powershell
git diff --check
```

Before the first commit, `git diff --check` may show nothing because files are untracked; the pack verifier is the primary integrity check at this point.

## 6. Commit the agentic pack on `main`

```powershell
git add .
git diff --cached --check
git status --short
git commit -m "Install Opening Trainer Codex agentic pack"
git push -u origin main
```

Confirm:

```powershell
git status --short --branch
git log -1 --oneline
```

The tree should be clean and tracking `origin/main`.

## 7. Start Codex in the repository

From the repository root:

```powershell
codex
```

Use the strongest generally available Codex coding model/reasoning setting in your account. Do not turn off approvals or sandboxing merely to make setup faster. Permit normal repository writes, package installation, tests, Git commit/push and draft-PR creation as Codex requests them.

Paste this first instruction:

```text
Start development. Read AGENTS.md, context.md, plans.md, CODEX_START_HERE.md, CODEX_PROMPT_PROFILE.md, docs/product/PRODUCT_CONTRACT.md and docs/architecture/ARCHITECTURE.md. Execute PHASE-0 only. Verify the entry gate, create branch phase-0-foundation from current origin/main, establish the React/TypeScript/Vite/pnpm foundation and repository quality gates defined by PHASE-0, use local validation, commit, push and open one draft PR to main. Do not implement PHASE-1, do not add product features beyond the PHASE-0 demonstration boundary, do not merge, and stop at Luca's PHASE-0 manual acceptance gate with the required self-contained completion report.
```

Alternatively, paste the complete executable prompt from:

```text
prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md
```

## 8. Review PHASE-0

Codex should return:

- `COMPLETE_FOR_MANUAL_REVIEW`, `BLOCKED` or `INCOMPLETE`;
- branch, head SHA and draft PR;
- every changed file;
- exact local validation commands/results;
- a numbered manual checklist;
- rollback, acceptance-state proposal and exact next action;
- `END_OF_COMPLETION_REPORT`.

Do not start PHASE-1 immediately.

Run each manual checklist item. Record pass/fail. When an item fails, continue in the same Codex thread or start a new one on the same branch with:

```text
Correct PHASE-0 on the existing phase-0-foundation branch and draft PR only. The failed manual item is: <item>. Observed: <result>. Expected: <result>. Read AGENTS.md, context.md, plans.md and the PHASE-0 contracts. Diagnose and repair the complete cause, rerun all applicable PHASE-0 validation, update the same draft PR and return the full completion report. Do not merge or begin PHASE-1.
```

## 9. Accept and merge a phase

Only after the manual checklist passes, give Codex this separate instruction:

```text
I have completed the PHASE-0 manual checklist and accept PHASE-0. Re-read AGENTS.md, context.md and the PHASE-0 section of plans.md. Verify the draft PR head and validation evidence have not changed, update context.md to record this explicit acceptance, commit and push that documentation update on the same branch, then merge the accepted PR into main without beginning PHASE-1. Return the merge commit and exact next authorised command.
```

Check locally after merge:

```powershell
git switch main
git pull --ff-only origin main
git status --short --branch
```

## 10. Continue with later phases

Start a new Codex chat from the updated repository root or continue the existing one.

Examples:

```text
Continue with phase 1.
```

```text
Continue with phase 5.
```

Because `AGENTS.md` and `plans.md` define the phrase mapping, Codex must:

- enforce predecessor acceptance and merge;
- execute exactly the named phase;
- create the phase's fixed branch;
- run through implementation, local validation, commit, push and one draft PR;
- stop at manual acceptance;
- not merge or start another phase.

Before `continue with phase 5`, PHASE-0 through PHASE-4 must be accepted and merged into `origin/main`.

## 11. Recommended operating habit

For each phase:

1. Update local `main`.
2. Start Codex in the repository root.
3. Issue one named phase command.
4. Let Codex continue through repairable failures.
5. Review its completion report and draft PR.
6. Execute the manual checklist.
7. Send correction prompts on the same branch/PR until it passes.
8. Explicitly accept and merge in a separate instruction.
9. Pull updated `main` before the next phase.

Do not paste Google Drive project memory into Codex. The repository pack contains the execution-grounded requirements Codex needs.
