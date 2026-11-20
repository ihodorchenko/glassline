# Glassline metrics report

Script: `tools/capture/metrics.py` (v2.2; formulas unchanged from v1). Band policy: `docs/reports/METRIC_SPEC.md` (shifted bands = plan §2.1 + `delta = measured_ref_mean - legacy_ref`).
Reference: `ref/reference/prolog-kit/study/05-prologue-roofs` (20 frames, set `prolog`).

## Reference recomputed by this script

| Metric | Mean ± SD | Min | p10 | p50 | p90 | Legacy | Δ | Δ % | v1 tol | Legacy band | Shifted band | Ref shifted | Ref legacy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|:---:|:---:|
| Luma mean | 0.6152 ± 0.1334 | 0.3276 | 0.4715 | 0.6217 | 0.7639 | 0.5890 | +0.0262 | +4.5 % | 0.0800 | 0.48..0.62 | 0.506224..0.646224 | PASS | PASS |
| Luma std | 0.2946 ± 0.0492 | 0.1904 | 0.2204 | 0.2936 | 0.3504 | 0.2720 | +0.0226 | +8.3 % | 0.0500 | >=0.22 | >=0.242584 | PASS | PASS |
| Luma p25 | 0.3710 ± 0.1389 | 0.1619 | 0.2191 | 0.3694 | 0.5757 | 0.3700 | +0.0010 | +0.3 % | 0.1000 | 0.33..0.42 | 0.330988..0.420988 | PASS | PASS |
| Luma p95 | 0.9806 ± 0.0453 | 0.8522 | 0.9158 | 1.0000 | 1.0000 | 0.9790 | +0.0016 | +0.2 % | 0.0500 | >=0.93 | >=0.9316 | PASS | PASS |
| Near-white share | 34.4913 ± 18.2421 | 3.2222 | 6.1797 | 32.5802 | 51.6213 | 27.3000 | +7.1913 | +26.3 % | 18.0000 | 15..28 | 22.1913..35.1913 | PASS | FAIL |
| Deep-shadow share | 0.6781 ± 1.6127 | 0.0006 | 0.0022 | 0.1254 | 1.4190 | 3.0000 | -2.3219 | -77.4 % | 3.0000 | <=6 | <=3.6781 | PASS | PASS |
| Saturation | 0.3000 ± 0.1410 | 0.1578 | 0.1802 | 0.2682 | 0.4816 | 0.3590 | -0.0590 | -16.4 % | 0.0800 | 0.3..0.38 | 0.241027..0.321027 | PASS | PASS |
| Local contrast | 0.2850 ± 0.0484 | 0.1874 | 0.2178 | 0.2833 | 0.3407 | 0.0713 | +0.2137 | +299.7 % | 0.0400 | >=0.06 | >=0.273703 | PASS | PASS |
| Edge energy | 0.0194 ± 0.0093 | 0.0068 | 0.0097 | 0.0181 | 0.0293 | 0.0341 | -0.0147 | -43.1 % | 0.0120 | >=0.028 | >=0.0132946 | PASS | FAIL |
| Sky-blue area | 43.2583 ± 16.8632 | 13.1493 | 20.2221 | 42.9366 | 63.4790 | 53.1000 | -9.8417 | -18.5 % | 12.0000 | 35..55 | 25.1583..45.1583 | PASS | PASS |
| Top-third contrast | 0.2433 ± 0.0555 | 0.1438 | 0.1786 | 0.2498 | 0.3089 | 0.0585 | +0.1848 | +315.9 % | 0.0500 | >=0.05 | >=0.234796 | PASS | PASS |
| Split-tone dark R-B | -21.8069 ± 25.5737 | -54.9619 | -42.5112 | -28.1224 | -3.9531 | -48.6000 | +26.7931 | -55.1 % | 15.0000 | -55..-40 | -28.2069..-13.2069 | PASS | FAIL |
| Red accent share | 2.3938 ± 2.8508 | 0.0000 | 0.0507 | 2.0201 | 4.6508 | 4.2000 | -1.8062 | -43.0 % | 2.5000 | 2..5 | 0.193789..3.19379 | PASS | PASS |

## Perceptual guardrails (W1, diagnostic only)

These are **not** part of the 13 §2.1 metrics and **not** PASS/FAIL gates. They are review inputs that expose blue-glass-sky, flat-clipped-white and salmon/fragmented-route failure modes. Definitions and limitations: `docs/reports/METRIC_SPEC.md`.

Measured on the same reference set (`ref/reference/prolog-kit/study/05-prologue-roofs`, 20 frames):

| Guardrail | Ref mean | SD | p10 | p90 |
|---|---:|---:|---:|---:|
| Sky mask share | 5.0636 | 4.3917 | 0.5925 | 11.1641 |
| Near-white seam energy | 0.0029 | 0.0018 | 0.0011 | 0.0047 |
| Red route share | 2.8745 | 4.9466 | 0.0836 | 6.7469 |
| Red route saturation | 0.6682 | 0.2448 | 0.3897 | 0.9428 |

Reading: read `Sky mask share` next to the primary `Sky-blue area` row — a large gap means most blue pixels are not sky. `Near-white seam energy` near 0 means flat clipped white. A small `Red route share` with low `Red route saturation` means a fragmented or salmon route.

## Candidates

### `captures/w2-2-final/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5995 | 0.6152 | -0.0157 | 0.506224..0.646224 | +0.0467 | PASS | PASS | PASS |
| Luma std | 0.2520 | 0.2946 | -0.0426 | >=0.242584 | +0.0094 | PASS | PASS | PASS |
| Luma p25 | 0.3968 | 0.3710 | +0.0258 | 0.330988..0.420988 | +0.0242 | PASS | PASS | PASS |
| Luma p95 | 0.9563 | 0.9806 | -0.0243 | >=0.9316 | +0.0247 | PASS | PASS | PASS |
| Near-white share | 20.1333 | 34.4913 | -14.3580 | 22.1913..35.1913 | -2.0580 | FAIL | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.3711 | 0.3000 | +0.0711 | 0.241027..0.321027 | -0.0501 | FAIL | PASS | PASS |
| Local contrast | 0.2383 | 0.2850 | -0.0467 | >=0.273703 | -0.0354 | FAIL | WATCH | PASS |
| Edge energy | 0.0195 | 0.0194 | +0.0001 | >=0.0132946 | +0.0062 | PASS | PASS | FAIL |
| Sky-blue area | 73.7137 | 43.2583 | +30.4554 | 25.1583..45.1583 | -28.5554 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.1889 | 0.2433 | -0.0544 | >=0.234796 | -0.0459 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -33.6718 | -21.8069 | -11.8648 | -28.2069..-13.2069 | -5.4648 | FAIL | PASS | FAIL |
| Red accent share | 1.7108 | 2.3938 | -0.6829 | 0.193789..3.19379 | +1.4829 | PASS | PASS | FAIL |

**7/13 shifted PASS, 6 FAIL | 10/13 tolerance PASS, 3 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 8.4925 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0036 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.5394 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9097 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 73.7 % -> sky mask 8.5 % (12 % of the primary share looks like sky; lit-wall exclusion removed 7.8 pp).

### `captures/w2-2-final/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6135 | 0.6152 | -0.0018 | 0.506224..0.646224 | +0.0328 | PASS | PASS | PASS |
| Luma std | 0.2852 | 0.2946 | -0.0094 | >=0.242584 | +0.0426 | PASS | PASS | PASS |
| Luma p25 | 0.3398 | 0.3710 | -0.0312 | 0.330988..0.420988 | +0.0088 | PASS | PASS | PASS |
| Luma p95 | 0.9569 | 0.9806 | -0.0237 | >=0.9316 | +0.0253 | PASS | PASS | PASS |
| Near-white share | 27.8277 | 34.4913 | -6.6636 | 22.1913..35.1913 | +5.6364 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2755 | 0.3000 | -0.0245 | 0.241027..0.321027 | +0.0345 | PASS | PASS | FAIL |
| Local contrast | 0.2556 | 0.2850 | -0.0294 | >=0.273703 | -0.0181 | FAIL | PASS | PASS |
| Edge energy | 0.0406 | 0.0194 | +0.0212 | >=0.0132946 | +0.0273 | PASS | WATCH | PASS |
| Sky-blue area | 47.0950 | 43.2583 | +3.8367 | 25.1583..45.1583 | -1.9367 | FAIL | PASS | PASS |
| Top-third contrast | 0.2657 | 0.2433 | +0.0224 | >=0.234796 | +0.0309 | PASS | PASS | PASS |
| Split-tone dark R-B | -34.9427 | -21.8069 | -13.1357 | -28.2069..-13.2069 | -6.7357 | FAIL | PASS | FAIL |
| Red accent share | 1.7913 | 2.3938 | -0.6025 | 0.193789..3.19379 | +1.4025 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 10/13 legacy PASS, 3 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 1.5953 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0043 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.3075 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9720 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 47.1 % -> sky mask 1.6 % (3 % of the primary share looks like sky; lit-wall exclusion removed 2.8 pp).

### `captures/w2-2-final/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4883 | 0.6152 | -0.1269 | 0.506224..0.646224 | -0.0179 | FAIL | WATCH | PASS |
| Luma std | 0.2465 | 0.2946 | -0.0481 | >=0.242584 | +0.0039 | PASS | PASS | PASS |
| Luma p25 | 0.2133 | 0.3710 | -0.1577 | 0.330988..0.420988 | -0.1177 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9185 | 0.9806 | -0.0621 | >=0.9316 | -0.0131 | FAIL | WATCH | FAIL |
| Near-white share | 5.7766 | 34.4913 | -28.7147 | 22.1913..35.1913 | -16.4147 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0004 | 0.6781 | -0.6777 | <=3.6781 | +3.6777 | PASS | PASS | PASS |
| Saturation | 0.2483 | 0.3000 | -0.0517 | 0.241027..0.321027 | +0.0073 | PASS | PASS | FAIL |
| Local contrast | 0.2372 | 0.2850 | -0.0478 | >=0.273703 | -0.0365 | FAIL | WATCH | PASS |
| Edge energy | 0.0183 | 0.0194 | -0.0011 | >=0.0132946 | +0.0050 | PASS | PASS | FAIL |
| Sky-blue area | 46.2585 | 43.2583 | +3.0001 | 25.1583..45.1583 | -1.1001 | FAIL | PASS | PASS |
| Top-third contrast | 0.2466 | 0.2433 | +0.0033 | >=0.234796 | +0.0118 | PASS | PASS | PASS |
| Split-tone dark R-B | -1.2673 | -21.8069 | +20.5396 | -28.2069..-13.2069 | -11.9396 | FAIL | WATCH | FAIL |
| Red accent share | 5.3619 | 2.3938 | +2.9681 | 0.193789..3.19379 | -2.1681 | FAIL | WATCH | FAIL |

**5/13 shifted PASS, 8 FAIL | 6/13 tolerance PASS, 7 WATCH | 6/13 legacy PASS, 7 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 11.8349 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0037 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 2.2521 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9926 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 46.3 % -> sky mask 11.8 % (26 % of the primary share looks like sky; lit-wall exclusion removed 2.0 pp).

### `captures/w2-2-final/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6496 | 0.6152 | +0.0344 | 0.506224..0.646224 | -0.0034 | FAIL | PASS | FAIL |
| Luma std | 0.2763 | 0.2946 | -0.0183 | >=0.242584 | +0.0337 | PASS | PASS | PASS |
| Luma p25 | 0.3927 | 0.3710 | +0.0217 | 0.330988..0.420988 | +0.0283 | PASS | PASS | PASS |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 32.8804 | 34.4913 | -1.6109 | 22.1913..35.1913 | +2.3109 | PASS | PASS | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2522 | 0.3000 | -0.0478 | 0.241027..0.321027 | +0.0112 | PASS | PASS | FAIL |
| Local contrast | 0.2571 | 0.2850 | -0.0279 | >=0.273703 | -0.0166 | FAIL | PASS | PASS |
| Edge energy | 0.0255 | 0.0194 | +0.0061 | >=0.0132946 | +0.0122 | PASS | PASS | FAIL |
| Sky-blue area | 47.6399 | 43.2583 | +4.3815 | 25.1583..45.1583 | -2.4815 | FAIL | PASS | PASS |
| Top-third contrast | 0.2594 | 0.2433 | +0.0161 | >=0.234796 | +0.0246 | PASS | PASS | PASS |
| Split-tone dark R-B | 12.4393 | -21.8069 | +34.2462 | -28.2069..-13.2069 | -25.6462 | FAIL | WATCH | FAIL |
| Red accent share | 1.6609 | 2.3938 | -0.7329 | 0.193789..3.19379 | +1.4671 | PASS | PASS | FAIL |

**9/13 shifted PASS, 4 FAIL | 12/13 tolerance PASS, 1 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 5.8414 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0038 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.1817 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9357 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 47.6 % -> sky mask 5.8 % (12 % of the primary share looks like sky; lit-wall exclusion removed 5.1 pp).

### `captures/w2-2-final/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6237 | 0.6152 | +0.0084 | 0.506224..0.646224 | +0.0226 | PASS | PASS | FAIL |
| Luma std | 0.2609 | 0.2946 | -0.0337 | >=0.242584 | +0.0183 | PASS | PASS | PASS |
| Luma p25 | 0.4063 | 0.3710 | +0.0353 | 0.330988..0.420988 | +0.0147 | PASS | PASS | PASS |
| Luma p95 | 0.9572 | 0.9806 | -0.0234 | >=0.9316 | +0.0256 | PASS | PASS | PASS |
| Near-white share | 25.6703 | 34.4913 | -8.8210 | 22.1913..35.1913 | +3.4790 | PASS | PASS | PASS |
| Deep-shadow share | 0.0008 | 0.6781 | -0.6773 | <=3.6781 | +3.6773 | PASS | PASS | PASS |
| Saturation | 0.2953 | 0.3000 | -0.0047 | 0.241027..0.321027 | +0.0257 | PASS | PASS | FAIL |
| Local contrast | 0.2411 | 0.2850 | -0.0439 | >=0.273703 | -0.0326 | FAIL | WATCH | PASS |
| Edge energy | 0.0283 | 0.0194 | +0.0089 | >=0.0132946 | +0.0150 | PASS | PASS | PASS |
| Sky-blue area | 68.0314 | 43.2583 | +24.7730 | 25.1583..45.1583 | -22.8730 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2291 | 0.2433 | -0.0142 | >=0.234796 | -0.0057 | FAIL | PASS | PASS |
| Split-tone dark R-B | -26.0947 | -21.8069 | -4.2878 | -28.2069..-13.2069 | +2.1122 | PASS | PASS | FAIL |
| Red accent share | 1.9342 | 2.3938 | -0.4596 | 0.193789..3.19379 | +1.2596 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 11/13 tolerance PASS, 2 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 12.7627 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0038 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.2695 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.8776 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 68.0 % -> sky mask 12.8 % (19 % of the primary share looks like sky; lit-wall exclusion removed 7.0 pp).

### `captures/w2-2-final/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4846 | 0.6152 | -0.1306 | 0.506224..0.646224 | -0.0216 | FAIL | WATCH | PASS |
| Luma std | 0.3120 | 0.2946 | +0.0174 | >=0.242584 | +0.0694 | PASS | PASS | PASS |
| Luma p25 | 0.1783 | 0.3710 | -0.1927 | 0.330988..0.420988 | -0.1527 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9558 | 0.9806 | -0.0248 | >=0.9316 | +0.0242 | PASS | PASS | PASS |
| Near-white share | 16.7683 | 34.4913 | -17.7230 | 22.1913..35.1913 | -5.4230 | FAIL | PASS | PASS |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.3236 | 0.3000 | +0.0235 | 0.241027..0.321027 | -0.0025 | FAIL | PASS | PASS |
| Local contrast | 0.3010 | 0.2850 | +0.0160 | >=0.273703 | +0.0273 | PASS | PASS | PASS |
| Edge energy | 0.0218 | 0.0194 | +0.0024 | >=0.0132946 | +0.0085 | PASS | PASS | FAIL |
| Sky-blue area | 27.0353 | 43.2583 | -16.2230 | 25.1583..45.1583 | +1.8770 | PASS | WATCH | FAIL |
| Top-third contrast | 0.2813 | 0.2433 | +0.0380 | >=0.234796 | +0.0465 | PASS | PASS | PASS |
| Split-tone dark R-B | -29.4531 | -21.8069 | -7.6461 | -28.2069..-13.2069 | -1.2461 | FAIL | PASS | FAIL |
| Red accent share | 2.0224 | 2.3938 | -0.3714 | 0.193789..3.19379 | +1.1714 | PASS | PASS | PASS |

**8/13 shifted PASS, 5 FAIL | 10/13 tolerance PASS, 3 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 1.4414 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0032 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.5716 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9763 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 27.0 % -> sky mask 1.4 % (5 % of the primary share looks like sky; lit-wall exclusion removed 1.5 pp).

