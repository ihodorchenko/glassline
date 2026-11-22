# Step 3.8 — First Section golden-path evidence

`report.json` is the unedited output of the Step 3.8 golden-path run:

```bash
node tools/capture/dev-route.mjs \
  --out-dir docs/evidence/first-section/step-3.8-golden \
  --report  docs/evidence/first-section/step-3.8-golden/report.json \
  --no-record --no-perf
```

Result: **PASS — 52/52 checks**, 12 screenshots, 0 console/page errors, 0 failed
requests. The report contains the full check list, route measurements, checkpoint /
respawn / restart state, completion (`levelId: first_section`,
`prologueCompleted: false`) and the production/dev diagnostics.

Retained frames: `07-slide-duct.png` (the duct crossing, relevant to F-03) and
`10-results.png` (the Results screen). The other ten route screenshots duplicate
the Step 3.8 exploratory evidence
(`../step-3.8/01-…`, `09-…`–`16-…`, `25-…`, `28-…`); the run is fully
reproducible with the command above. `report.json.screenshots` still lists all
twelve files that were generated.

The Prologue menu/gameplay smoke is a separate run documented under
`../step-3.8-prologue/`.
