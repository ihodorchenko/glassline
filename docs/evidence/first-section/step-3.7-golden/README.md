# Step 3.7 — First Section golden-path evidence

`report.json` is the unedited output of the Step 3.7 golden-path run:

```bash
node tools/capture/dev-route.mjs \
  --out-dir docs/evidence/first-section/step-3.7-golden \
  --report  docs/evidence/first-section/step-3.7-golden/report.json \
  --no-record --no-perf
```

Result: **PASS — 52/52 checks**, 12 screenshots, 0 console/page errors, 0 failed
requests. The report contains the full check list, route measurements, checkpoint /
respawn / restart state, completion (`levelId: first_section`,
`prologueCompleted: false`) and the production/dev diagnostics.

Only `10-results.png` (the Results screen) was retained. The other eleven route
screenshots duplicate the Step 3.6 evidence and are not diagnostic for Step 3.7
(F-01/F-04); the run is fully reproducible with the command above.
`report.json.screenshots` still lists all twelve files that were generated.

The Prologue menu/gameplay smoke is a separate run documented under
`../step-3.7-prologue/`.
