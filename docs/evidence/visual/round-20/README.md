# Round 20 visual evidence — Training yard parity

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `before.jpg` | Training yard before: dark boundary walls, flat color skyline |
| `after.jpg` | Training yard after: light parapets/red coping, city towers, signage, service kit |

Boundary walls are now light concrete with red coping, the backdrop uses five
material-based city towers with lit bands, and the yard has `TRAVERSAL`/`FINISH`
board signs, section signs, AC/duct/crate kit, and an overhead pipe. Course,
collision, triggers, and Prologue metrics are unchanged. `npm run validate` is
green with **275 tests in 36 files**.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-20/after.png
```
