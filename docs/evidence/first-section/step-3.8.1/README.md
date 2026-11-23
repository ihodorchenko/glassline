# Step 3.8.1 — critical toast ordering, browser evidence

`report.json` is the unedited output of the Step 3.8.1 corrective browser run:

```bash
node tools/capture/playtest.mjs \
  --no-walkthrough --no-failure-modes \
  --out-dir docs/evidence/first-section/step-3.8.1 \
  --report  docs/evidence/first-section/step-3.8.1/report.json
```

Result: **PASS — 13/13 checks**, 6 frames, 0 console/page errors, 0 failed
requests. Host load during the run: `loadAvg 5.81 / 8.15 / 6.96` on 8 cores.

## What changed

`ToastQueue.tick()` promoted the interrupted routine toast **before** any queued
critical toast, so a second checkpoint confirmation (`CP2`) waited behind the
restored `Move` reminder, and a queued routine toast (`Jump`) could be shown
between the two confirmations. It now promotes queued critical messages first
(arrival order), then the interrupted routine toast, then the rest of the
backlog. Normal-toast FIFO under the backlog cap, preemption by a critical, the
interrupted-toast restoration and the public API are unchanged.

## How the sequence was produced

The authored checkpoints are 31 m apart (>3.7 s at sprint) while a toast lasts
2.2 s, so two checkpoint confirmations cannot overlap through normal play. The
`Move → CP1 → CP2` sequence is therefore injected at the **UIManager boundary**
on a fresh profile with an empty toast queue, through the production queue and
renderer:

- `ui.showToast("Move", now, 1800)` — routine tutorial toast;
- +120 ms: `ui.showToast("Checkpoint reached: CP1", now, 2200, "critical")`;
- +240 ms: `ui.showToast("Checkpoint reached: CP2", now, 2200, "critical")`.

The DOM is sampled every ~24 ms. This is not a gameplay assertion (checkpoints,
route and physics are untouched); it exercises the notification mechanism and
its observable order, which is what Step 3.8.1 corrects. The natural fresh-profile
`Move → CP1` ordering is covered in the same run by the existing gameplay checks
(`checkpointDelay = 0 ms`).

## Observed sequence (`scenarios.polish.toastCriticalSequence.segments`)

| Message | Start | End | Duration |
|---|---:|---:|---:|
| `Move` | 1 ms | 135 ms | 134 ms (preempted by CP1, Step 3.8 behaviour) |
| `Checkpoint reached: CP1` | 135 ms | 2369 ms | **2234 ms** (not replaced early) |
| `Checkpoint reached: CP2` | 2369 ms | 4548 ms | **2179 ms** (starts 0 ms after CP1) |
| `Move` | 4548 ms | 6243 ms | 1695 ms (interrupted remainder restored) |

Then the slot hides (`finalVisible: false`); no visible-but-empty sample and no
duplicate message. Before the fix the same run produced
`Move → CP1 → Move → CP2` (the second confirmation delayed behind a tutorial
reminder), which the regression test `tests/unit/toast-priority.test.ts`
reproduces deterministically.

## Frames

| File | Content |
|---|---|
| `61-toast-critical-sequence.jpg` | `Checkpoint reached: CP2` on screen after CP1 finished (no premature replacement) |
| `55-checkpoint-toast-priority.jpg` | Natural fresh-profile checkpoint toast appearing at activation |
| `56`–`59-duct-*` | Unchanged Step 3.8 duct-camera checks re-run in the same session |
