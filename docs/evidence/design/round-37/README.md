# Round 37 design evidence — direct vs bypass timing

Deterministic physics simulation (`tests/unit/bypass-benchmark.test.ts`) from
x=50 to x=25 on the return catwalk at 60 Hz:

| Line | Frames | Time | Jumps | Extra |
|---|---:|---:|---:|---|
| Direct two-jump | 378 | 6.30 s | 2 | barriers x=39, x=34 |
| Lower bypass | 405 | 6.75 s | 1 | drop + climb |

The direct line is **~0.45 s faster**; the bypass costs time but removes the
second timed jump and lowers the precision requirement. This is a real
speed-vs-risk choice rather than a strictly better route. The timing test now
guards both the absolute range and the relative gap.

No route/visual/audio changes in this round.
