---
name: electron-fullstack-pipeline
description: Use this to build, extend, or ship a pear-desktop (Electron + SolidJS + Hono) feature end to end — coordinating design, frontend, backend, and QA as a team from wireframe to deployment. Trigger for "build a feature/plugin", "add a setting", "wire up UI to backend", "from wireframe to deployment", "ship this feature". ALSO trigger for follow-ups: "redo/re-run", "update", "fix", "extend", "revise", "improve the previous result", "just the frontend/backend/design again", "QA the change". For a trivial one-line edit or a pure question, answer directly instead.
---

# Electron Full-Stack Pipeline Orchestrator

Coordinates the design → frontend ∥ backend → QA → deployment pipeline for a pear-desktop feature.
You are the **leader**: form the team, assign work, monitor, integrate, and ship.

## Execution mode: Agent Team

Frontend and backend must negotiate the IPC/API contract in real time, and QA cross-checks both
boundaries incrementally — this is collaboration, not isolated fan-out. Use a team so members
coordinate via `SendMessage` and a shared task list. All members use `model: "opus"`.

## Team composition

| Member | Agent type | Role | Skill | Output |
|--------|-----------|------|-------|--------|
| design-architect | design-architect | Wireframe → spec + IPC/API contract | ui-wireframe-design | `_workspace/01_design_spec.md` |
| frontend-engineer | frontend-engineer | SolidJS renderer, styles, menu | solid-renderer-dev | renderer files + `_workspace/02_frontend_notes.md` |
| backend-engineer | backend-engineer | Electron main, IPC, Hono routes | electron-backend-dev | backend files + `_workspace/03_backend_notes.md` |
| qa-engineer | qa-engineer | Cross-boundary QA, quality gates | electron-qa-verification | `_workspace/04_qa_report.md` |

## Workflow

### Phase 0: Context check (supports follow-ups)
1. Check whether `_workspace/` exists.
2. Decide the run mode:
   - **No `_workspace/`** → initial run. Proceed to Phase 1.
   - **`_workspace/` exists + partial-change request** (e.g. "just fix the frontend", "revise the
     design") → partial re-run. Skip to forming a team with only the needed members, pass them the
     existing artifact paths to read and improve, and overwrite only the affected outputs.
   - **`_workspace/` exists + a new feature** → new run. Move existing `_workspace/` to
     `_workspace_prev/` (timestamped if needed), then proceed to Phase 1.

### Phase 1: Prepare
1. Analyze the request: which plugin (`src/plugins/{name}/`), which contexts (renderer/backend/
   preload/menu/config), is this a new plugin or a change to an existing one.
2. Create `_workspace/`. Save the request + any reference wireframe to `_workspace/00_input/`.

### Phase 2: Form the team
```
TeamCreate(team_name: "electron-fullstack-team", members: [
  { name: "design-architect",   agent_type: "design-architect",   model: "opus" },
  { name: "frontend-engineer",  agent_type: "frontend-engineer",  model: "opus" },
  { name: "backend-engineer",   agent_type: "backend-engineer",   model: "opus" },
  { name: "qa-engineer",        agent_type: "qa-engineer",        model: "opus" },
])
```
Register tasks with dependencies:
```
TaskCreate(tasks: [
  { title: "Design spec + IPC/API contract", assignee: "design-architect" },
  { title: "Implement renderer", assignee: "frontend-engineer", depends_on: ["Design spec + IPC/API contract"] },
  { title: "Implement backend",  assignee: "backend-engineer",  depends_on: ["Design spec + IPC/API contract"] },
  { title: "Incremental boundary QA per module", assignee: "qa-engineer", depends_on: ["Design spec + IPC/API contract"] },
  { title: "Final QA: quality gates + full boundary sweep", assignee: "qa-engineer", depends_on: ["Implement renderer", "Implement backend"] },
])
```

### Phase 3: Design
**Mode:** agent team. design-architect produces `_workspace/01_design_spec.md` and SendMessages the
finalized contract to **both** engineers. Nothing downstream starts until the contract exists.

### Phase 4: Build (frontend ∥ backend, with incremental QA)
**Mode:** agent team — the core collaboration phase.
- frontend-engineer and backend-engineer build **in parallel** against the contract.
- They reconcile shape disagreements directly via `SendMessage` *before* hard-coding; any contract
  change goes back through design-architect, who re-broadcasts to both so they never drift.
- qa-engineer runs **incrementally**: the moment a backend handler and its renderer caller both
  exist, it cross-checks that one boundary and SendMessages findings (file:line + fix) to the owner —
  a boundary mismatch goes to **both** engineers.
- Leader monitors via `TaskGet`; nudge or reassign if a member stalls.

### Phase 5: Final QA
**Mode:** agent team. Once both builds complete, qa-engineer runs the full boundary sweep + quality
gates (`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`) and writes `_workspace/04_qa_report.md`
(PASS / FAIL / UNVERIFIED). FAILs loop back to the owning engineer; re-verify after fixes. Do not
proceed to deployment with open FAILs unless the user accepts them.

### Phase 6: Deployment
**Mode:** leader (no agent needed for the build itself).
1. Confirm QA is green. Run `pnpm check` (lint + format + typecheck) as the final gate.
2. Build the distributable per the user's target:
   - All platforms: `pnpm dist` · macOS arm64: `pnpm dist:mac:arm64` · Linux: `pnpm dist:linux`
     · Windows: `pnpm dist:win`. (Local-only build uses `-p never`; `release:*` scripts publish.)
3. Report the build artifact location and the QA summary. **Do not publish/release** (`release:*`)
   without explicit user confirmation — publishing is outward-facing.

### Phase 7: Cleanup & evolution
1. SendMessage members to wind down; `TeamDelete`.
2. Preserve `_workspace/` (audit trail). 3. Summarize results to the user and ask if anything in the
   result or the team/workflow should change — fold feedback back into agents/skills and log it in
   CLAUDE.md's change history.

## Data flow

```
[leader] → TeamCreate → design-architect
                            │ 01_design_spec.md (contract) ──SendMessage──┐
                            ▼                                             ▼
                   frontend-engineer  ←──── SendMessage ────►  backend-engineer
                            │ 02_frontend_notes.md                       │ 03_backend_notes.md
                            └──────────────► qa-engineer ◄───────────────┘
                                  (incremental + final, reads both notes)
                                        │ 04_qa_report.md
                                        ▼
                                 [leader: gate → build → report]
```
Data passing: **task-based** (coordination) + **message-based** (contract negotiation, findings) +
**file-based** (`_workspace/` artifacts + the actual `src/plugins/{name}/` code).

## Error handling

| Situation | Strategy |
|-----------|----------|
| A member stalls/dies | Leader detects via idle/TaskGet → SendMessage to check → restart once → else reassign |
| Contract conflict between FE/BE | design-architect is the tiebreaker; updated spec re-broadcast to both; sources noted, nothing silently deleted |
| QA finds FAILs late | Loop back to owner, re-verify; block deployment on unresolved FAILs unless user accepts |
| Quality gate fails | Report the exact command output; do not claim pass without it; fix and re-run |
| Majority of team fails | Stop, report partial state to the user, confirm whether to continue |

## Test scenarios

**Normal flow:** user requests a feature → Phase 1 scopes the plugin → team forms (4 members) →
design-architect writes the contract → FE/BE build in parallel, reconciling via SendMessage → QA
cross-checks incrementally then runs final gates green → leader builds the distributable → reports
artifact + QA summary. Expected: working plugin under `src/plugins/{name}/`, green gates, build artifact.

**Error flow:** in Phase 4, QA finds the backend returns a bare array while the renderer expects
`{ items }` → SendMessages **both** engineers with file:line + fix → design-architect confirms the
contract shape → backend fixes, QA re-verifies that boundary → pipeline continues → final report
notes the caught mismatch.
