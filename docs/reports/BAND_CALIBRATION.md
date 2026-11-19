# Band calibration — reference frames under the three band schemes

Status: evidence for the W0 band decision (2026-11-19), see `docs/reports/METRIC_SPEC.md` §"Band policy W0". Script: `tools/capture/metrics.py` v2.1; formulas unchanged from v1.

## Method

- All 20 prologue reference frames (`ref/reference/prolog-kit/study/05-prologue-roofs`, 1280×720 JPG) are passed back through the script **as candidates**, i.e. the same loader, resize (960 px LANCZOS), 13 formulas and band definitions as our captures. No per-image adjustment.
- Three band schemes are evaluated per frame/metric:
  - `shifted` — proposed W0 acceptance: plan §2.1 band shifted by `delta = measured_ref_mean - legacy_ref` (widths/margins preserved 1:1); PASS/FAIL.
  - `tolerance` — v1 regression gauge: `|value - measured_ref_mean| <= v1 tolerance`; PASS/WATCH.
  - `legacy` — raw plan §2.1 band, traceability only; PASS/FAIL.
- The 20-frame set is **not** the six fixed acceptance shots; it is a 20-composition sample of the reference look (different rooftops, sun angle, sky share). Per-frame pass rates therefore describe the reference set, not the acceptance gate.

Reproduce:

```
PY=/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
cd /Users/igorhodorchenko/Project/glassline
"$PY" tools/capture/metrics.py \
    --candidate 'ref/reference/prolog-kit/study/05-prologue-roofs/*.jpg' \
    --bands --json /tmp/calib.json
```

## Headline numbers

- Measured reference **mean** passes **13/13** shifted bands (asserted by the script at runtime) and 10/13 raw legacy bands.
- Mean number of passing metrics per reference frame: shifted 7.05/13, tolerance 8.75/13, legacy 7.25/13.
- Maximum passing metrics on a single reference frame: shifted 11/13, tolerance 12/13, legacy 11/13.
- Reference frames passing all 13 metrics: shifted 0/20, tolerance 0/20, legacy 0/20.
- Cause: the 20-frame set spans compositions/time-of-day whose own spread exceeds several legacy band widths (e.g. `near_white` sd 18.24 pp vs band width 13 pp; `split` sd 25.57 vs width 15; `p25` sd 13.89 vs width 9). The bands are a **mean-level** target for fixed shots, not a per-frame membership test for the reference set.

## Shifted bands (computed from data, `delta` per metric)

| Metric | Unit | Legacy ref | Delta = measured − legacy | Legacy band | Shifted band | Reference mean inside shifted? |
|---|---:|---:|---:|---|---|:---:|
| Luma mean | 0..1 | 0.589 | +0.0262 | 0.48 .. 0.62 | 0.506224 .. 0.646224 | YES |
| Luma std | 0..1 | 0.272 | +0.0226 | >= 0.22 | >= 0.242584 | YES |
| Luma p25 | 0..1 | 0.37 | +0.0010 | 0.33 .. 0.42 | 0.330988 .. 0.420988 | YES |
| Luma p95 | 0..1 | 0.979 | +0.0016 | >= 0.93 | >= 0.9316 | YES |
| Near-white share | % | 27.3 | +7.1913 | 15 .. 28 | 22.1913 .. 35.1913 | YES |
| Deep-shadow share | % | 3 | -2.3219 | <= 6 | <= 3.6781 | YES |
| Saturation | 0..1 | 0.359 | -0.0590 | 0.3 .. 0.38 | 0.241027 .. 0.321027 | YES |
| Local contrast | 0..1 | 0.0713 | +0.2137 | >= 0.06 | >= 0.273703 | YES |
| Edge energy | 0..1 | 0.0341 | -0.0147 | >= 0.028 | >= 0.0132946 | YES |
| Sky-blue area | % | 53.1 | -9.8417 | 35 .. 55 | 25.1583 .. 45.1583 | YES |
| Top-third contrast | 0..1 | 0.0585 | +0.1848 | >= 0.05 | >= 0.234796 | YES |
| Split-tone dark R-B | R-B*255 | -48.6 | +26.7931 | -55 .. -40 | -28.2069 .. -13.2069 | YES |
| Red accent share | % | 4.2 | -1.8062 | 2 .. 5 | 0.193789 .. 3.19379 | YES |

## Per-metric pass rate across the 20 reference frames

| Metric | shifted PASS | tolerance PASS | legacy PASS |
|---|---:|---:|---:|
| Luma mean | 35 % | 45 % | 40 % |
| Luma std | 80 % | 65 % | 90 % |
| Luma p25 | 35 % | 40 % | 35 % |
| Luma p95 | 85 % | 85 % | 85 % |
| Near-white share | 35 % | 75 % | 20 % |
| Deep-shadow share | 95 % | 95 % | 95 % |
| Saturation | 35 % | 50 % | 30 % |
| Local contrast | 55 % | 60 % | 100 % |
| Edge energy | 75 % | 80 % | 20 % |
| Sky-blue area | 40 % | 65 % | 50 % |
| Top-third contrast | 55 % | 55 % | 100 % |
| Split-tone dark R-B | 25 % | 70 % | 15 % |
| Red accent share | 55 % | 90 % | 45 % |

## Per-frame pass-count distribution

| Passing metrics (of 13) | shifted frames | tolerance frames | legacy frames |
|---:|---:|---:|---:|
| 2 | 1 | 1 | 0 |
| 3 | 1 | 0 | 0 |
| 4 | 3 | 1 | 1 |
| 5 | 2 | 0 | 2 |
| 6 | 2 | 3 | 4 |
| 7 | 1 | 2 | 5 |
| 8 | 2 | 0 | 4 |
| 9 | 2 | 2 | 1 |
| 10 | 5 | 3 | 2 |
| 11 | 1 | 7 | 1 |
| 12 | 0 | 1 | 0 |

## Per-frame detail

| Frame | shifted | tolerance | legacy |
|---|---:|---:|---:|
| `0824-prologue-roofs.jpg` | 5/13 | 11/13 | 8/13 |
| `0834-prologue-roofs.jpg` | 10/13 | 11/13 | 11/13 |
| `0844-prologue-roofs.jpg` | 10/13 | 11/13 | 9/13 |
| `0854-prologue-roofs.jpg` | 4/13 | 6/13 | 7/13 |
| `0904-prologue-roofs.jpg` | 5/13 | 10/13 | 6/13 |
| `0916-prologue-roofs.jpg` | 10/13 | 12/13 | 8/13 |
| `0926-prologue-roofs.jpg` | 3/13 | 4/13 | 5/13 |
| `0950-prologue-roofs.jpg` | 6/13 | 10/13 | 6/13 |
| `1004-prologue-roofs.jpg` | 2/13 | 2/13 | 4/13 |
| `1054-prologue-roofs.jpg` | 10/13 | 10/13 | 6/13 |
| `1104-prologue-roofs.jpg` | 8/13 | 11/13 | 10/13 |
| `1114-prologue-roofs.jpg` | 6/13 | 7/13 | 7/13 |
| `1124-prologue-roofs.jpg` | 11/13 | 11/13 | 7/13 |
| `1134-prologue-roofs.jpg` | 7/13 | 6/13 | 7/13 |
| `1144-prologue-roofs.jpg` | 4/13 | 9/13 | 5/13 |
| `1154-prologue-roofs.jpg` | 8/13 | 11/13 | 8/13 |
| `1204-prologue-roofs.jpg` | 10/13 | 7/13 | 7/13 |
| `1224-prologue-roofs.jpg` | 9/13 | 9/13 | 8/13 |
| `1244-prologue-roofs.jpg` | 9/13 | 11/13 | 10/13 |
| `1304-prologue-roofs.jpg` | 4/13 | 6/13 | 6/13 |

## Example candidate: round-93 start frame

`docs/evidence/visual/round-93/start.jpg` under the same three schemes: shifted 9/13 PASS (4 FAIL), tolerance 13/13 PASS, legacy 10/13 PASS. The four shifted FAILs are `near_white` (21.69 vs shifted min 22.19), `saturation` (0.3229 vs shifted max 0.3210), `local_contrast` (0.2523 vs shifted min 0.2737) and `top_contrast` (0.2105 vs shifted min 0.2348) — i.e. the historically shipped frame sits inside the v1 noise envelope but outside the tighter shifted margins. This is a gate-policy question for the lead, not a harness error.

## Reading

- `shifted` and `legacy` have nearly the same per-frame pass profile (mean 7.05 vs 7.25 of 13), so the shift does not make the gate easier or harder in aggregate; it only moves the centre from the predecessor harness to our measurements and guarantees the reference mean passes.
- The stricter-than-set variability comes from the **legacy band widths**, not from the shift: `local_contrast`, `top_contrast`, `split`, `near_white`, `p25` and `sky` bands are narrower than the reference set spread. If the six fixed shots are expected to pass, those widths are the binding constraint to discuss.
- `tolerance` remains the regression gauge with v1 continuity (no reference frame passes 13/13 there either; max 12/13 — individual frames are not expected to).
