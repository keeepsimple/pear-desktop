---
name: electron-qa-verification
description: Use when verifying a pear-desktop feature — cross-process boundary coherence (IPC channels, config, HTTP shapes), spec compliance, and the typecheck/lint/build/Playwright quality gates. Trigger for "QA", "verify", "test the feature", "check integration", "boundary check", or after any frontend/backend module lands. Runs incrementally, not just at the end.
---

# Electron QA & Boundary Verification

Catch the bugs a passing build hides. The dominant failure mode in full-stack Electron work is a
**boundary mismatch**: producer and consumer are each individually correct but disagree at the seam.
TypeScript generics and `as`-casts let those compile and crash only at runtime.

> The core discipline: **read both sides at once.** Never verify a channel by looking at one side.

## What to verify, in priority order

1. **Boundary coherence (highest)** — IPC, config, and HTTP shapes agree across processes.
2. **Spec compliance** — every contract channel/route/config field is both implemented and consumed.
3. **Quality gates** — the project's own commands (below).
4. **Design fidelity & code quality** — visual spec, dead code, lifecycle cleanup.

## Boundary checks

Open producer and consumer together and compare channel name + payload + return shape. The full
procedures, the producer/consumer mapping table, and the failure-pattern catalog are in
`references/boundary-checks.md` — **read it before doing boundary work**. In brief:

| Boundary | Producer | Consumer |
|----------|----------|----------|
| Request/response IPC | backend `ipc.handle('ch')` | renderer `ipc.invoke('ch')` |
| Fire-and-forget IPC | renderer `ipc.send('ch')` | backend `ipc.on('ch')` |
| Backend push | backend `ipc.send('ch')` | renderer `ipc.on('ch')` |
| HTTP | route response | caller's expected JSON |
| Config | `config` schema + `setConfig` | `menu.ts` + every `getConfig` read |

Grep both sides, build a 1:1 map of every channel, and flag: dead calls (one side only), shape
divergence (wrapper vs bare, field-name drift), and `as`-casts masking a real mismatch.

## Quality gates

Run and report output for each (don't claim pass without the output):

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint (type-aware)
pnpm build       # electron-vite build
pnpm test        # Playwright
```

`pnpm check` runs lint + format:check + typecheck together. A green build is necessary but **not
sufficient** — it does not prove boundary coherence. Do the cross-checks regardless.

## Incremental QA — don't wait for the end

The moment a backend handler and its renderer caller both exist, cross-check that one boundary
immediately. Early mismatches propagate into later modules; catching them at the seam is far
cheaper than after the whole feature is wired. Re-run the relevant gate after each fix.

## Output

Write `_workspace/04_qa_report.md` with three buckets:
- **PASS** — what was verified and how.
- **FAIL** — `file:line` + concrete fix + owning engineer (`frontend-engineer` / `backend-engineer`).
- **UNVERIFIED** — what you couldn't check and why.

SendMessage each finding to the owning engineer; a boundary mismatch goes to **both** since the fix
may belong on either side. Report the buckets to the leader.
