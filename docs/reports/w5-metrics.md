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

### `captures/w5-final/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5805 | 0.6152 | -0.0347 | 0.506224..0.646224 | +0.0657 | PASS | PASS | PASS |
| Luma std | 0.2533 | 0.2946 | -0.0413 | >=0.242584 | +0.0107 | PASS | PASS | PASS |
| Luma p25 | 0.3889 | 0.3710 | +0.0180 | 0.330988..0.420988 | +0.0320 | PASS | PASS | PASS |
| Luma p95 | 0.9560 | 0.9806 | -0.0246 | >=0.9316 | +0.0244 | PASS | PASS | PASS |
| Near-white share | 17.7519 | 34.4913 | -16.7394 | 22.1913..35.1913 | -4.4394 | FAIL | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.3862 | 0.3000 | +0.0862 | 0.241027..0.321027 | -0.0652 | FAIL | WATCH | FAIL |
| Local contrast | 0.2375 | 0.2850 | -0.0475 | >=0.273703 | -0.0362 | FAIL | WATCH | PASS |
| Edge energy | 0.0232 | 0.0194 | +0.0038 | >=0.0132946 | +0.0099 | PASS | PASS | FAIL |
| Sky-blue area | 73.8966 | 43.2583 | +30.6383 | 25.1583..45.1583 | -28.7383 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.1878 | 0.2433 | -0.0555 | >=0.234796 | -0.0470 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -34.3325 | -21.8069 | -12.5256 | -28.2069..-13.2069 | -6.1256 | FAIL | PASS | FAIL |
| Red accent share | 1.6669 | 2.3938 | -0.7269 | 0.193789..3.19379 | +1.4731 | PASS | PASS | FAIL |

**7/13 shifted PASS, 6 FAIL | 9/13 tolerance PASS, 4 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 8.4149 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0038 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.5052 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9264 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 73.9 % -> sky mask 8.4 % (11 % of the primary share looks like sky; lit-wall exclusion removed 8.0 pp).

### `captures/w5-final/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6082 | 0.6152 | -0.0070 | 0.506224..0.646224 | +0.0380 | PASS | PASS | PASS |
| Luma std | 0.2837 | 0.2946 | -0.0109 | >=0.242584 | +0.0411 | PASS | PASS | PASS |
| Luma p25 | 0.3373 | 0.3710 | -0.0337 | 0.330988..0.420988 | +0.0063 | PASS | PASS | PASS |
| Luma p95 | 0.9569 | 0.9806 | -0.0237 | >=0.9316 | +0.0253 | PASS | PASS | PASS |
| Near-white share | 26.6950 | 34.4913 | -7.7963 | 22.1913..35.1913 | +4.5037 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2788 | 0.3000 | -0.0213 | 0.241027..0.321027 | +0.0377 | PASS | PASS | FAIL |
| Local contrast | 0.2541 | 0.2850 | -0.0309 | >=0.273703 | -0.0196 | FAIL | PASS | PASS |
| Edge energy | 0.0415 | 0.0194 | +0.0221 | >=0.0132946 | +0.0282 | PASS | WATCH | PASS |
| Sky-blue area | 47.3768 | 43.2583 | +4.1185 | 25.1583..45.1583 | -2.2185 | FAIL | PASS | PASS |
| Top-third contrast | 0.2657 | 0.2433 | +0.0224 | >=0.234796 | +0.0309 | PASS | PASS | PASS |
| Split-tone dark R-B | -34.5991 | -21.8069 | -12.7922 | -28.2069..-13.2069 | -6.3922 | FAIL | PASS | FAIL |
| Red accent share | 1.7975 | 2.3938 | -0.5963 | 0.193789..3.19379 | +1.3963 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 10/13 legacy PASS, 3 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 5.5266 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0044 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.3075 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9720 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 47.4 % -> sky mask 5.5 % (12 % of the primary share looks like sky; lit-wall exclusion removed 5.5 pp).

### `captures/w5-final/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5961 | 0.6152 | -0.0191 | 0.506224..0.646224 | +0.0501 | PASS | PASS | PASS |
| Luma std | 0.2388 | 0.2946 | -0.0558 | >=0.242584 | -0.0038 | FAIL | WATCH | PASS |
| Luma p25 | 0.3531 | 0.3710 | -0.0179 | 0.330988..0.420988 | +0.0221 | PASS | PASS | PASS |
| Luma p95 | 0.9171 | 0.9806 | -0.0635 | >=0.9316 | -0.0145 | FAIL | WATCH | FAIL |
| Near-white share | 5.6414 | 34.4913 | -28.8499 | 22.1913..35.1913 | -16.5499 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0006 | 0.6781 | -0.6775 | <=3.6781 | +3.6775 | PASS | PASS | PASS |
| Saturation | 0.1742 | 0.3000 | -0.1258 | 0.241027..0.321027 | -0.0668 | FAIL | WATCH | FAIL |
| Local contrast | 0.2281 | 0.2850 | -0.0569 | >=0.273703 | -0.0456 | FAIL | WATCH | PASS |
| Edge energy | 0.0234 | 0.0194 | +0.0040 | >=0.0132946 | +0.0101 | PASS | PASS | FAIL |
| Sky-blue area | 53.1639 | 43.2583 | +9.9056 | 25.1583..45.1583 | -8.0056 | FAIL | PASS | PASS |
| Top-third contrast | 0.2576 | 0.2433 | +0.0143 | >=0.234796 | +0.0228 | PASS | PASS | PASS |
| Split-tone dark R-B | -16.6838 | -21.8069 | +5.1231 | -28.2069..-13.2069 | +3.4769 | PASS | PASS | FAIL |
| Red accent share | 5.2739 | 2.3938 | +2.8801 | 0.193789..3.19379 | -2.0801 | FAIL | WATCH | FAIL |

**6/13 shifted PASS, 7 FAIL | 7/13 tolerance PASS, 6 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 3.5241 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0037 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 2.2326 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.6230 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 53.2 % -> sky mask 3.5 % (7 % of the primary share looks like sky; lit-wall exclusion removed 2.2 pp).

### `captures/w5-final/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6224 | 0.6152 | +0.0071 | 0.506224..0.646224 | +0.0239 | PASS | PASS | FAIL |
| Luma std | 0.2744 | 0.2946 | -0.0202 | >=0.242584 | +0.0318 | PASS | PASS | PASS |
| Luma p25 | 0.3666 | 0.3710 | -0.0043 | 0.330988..0.420988 | +0.0357 | PASS | PASS | PASS |
| Luma p95 | 0.9594 | 0.9806 | -0.0212 | >=0.9316 | +0.0278 | PASS | PASS | PASS |
| Near-white share | 28.0540 | 34.4913 | -6.4373 | 22.1913..35.1913 | +5.8627 | PASS | PASS | FAIL |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.2715 | 0.3000 | -0.0286 | 0.241027..0.321027 | +0.0304 | PASS | PASS | FAIL |
| Local contrast | 0.2525 | 0.2850 | -0.0325 | >=0.273703 | -0.0212 | FAIL | PASS | PASS |
| Edge energy | 0.0284 | 0.0194 | +0.0090 | >=0.0132946 | +0.0151 | PASS | PASS | PASS |
| Sky-blue area | 48.1016 | 43.2583 | +4.8433 | 25.1583..45.1583 | -2.9433 | FAIL | PASS | PASS |
| Top-third contrast | 0.2592 | 0.2433 | +0.0159 | >=0.234796 | +0.0244 | PASS | PASS | PASS |
| Split-tone dark R-B | -0.1251 | -21.8069 | +21.6819 | -28.2069..-13.2069 | -13.0819 | FAIL | WATCH | FAIL |
| Red accent share | 1.6184 | 2.3938 | -0.7753 | 0.193789..3.19379 | +1.4247 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 5.8970 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0039 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.1404 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9455 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 48.1 % -> sky mask 5.9 % (12 % of the primary share looks like sky; lit-wall exclusion removed 5.1 pp).

### `captures/w5-final/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6106 | 0.6152 | -0.0047 | 0.506224..0.646224 | +0.0357 | PASS | PASS | PASS |
| Luma std | 0.2600 | 0.2946 | -0.0345 | >=0.242584 | +0.0175 | PASS | PASS | PASS |
| Luma p25 | 0.3976 | 0.3710 | +0.0266 | 0.330988..0.420988 | +0.0234 | PASS | PASS | PASS |
| Luma p95 | 0.9569 | 0.9806 | -0.0237 | >=0.9316 | +0.0253 | PASS | PASS | PASS |
| Near-white share | 23.6854 | 34.4913 | -10.8060 | 22.1913..35.1913 | +1.4940 | PASS | PASS | PASS |
| Deep-shadow share | 0.0004 | 0.6781 | -0.6777 | <=3.6781 | +3.6777 | PASS | PASS | PASS |
| Saturation | 0.3038 | 0.3000 | +0.0037 | 0.241027..0.321027 | +0.0173 | PASS | PASS | PASS |
| Local contrast | 0.2392 | 0.2850 | -0.0458 | >=0.273703 | -0.0345 | FAIL | WATCH | PASS |
| Edge energy | 0.0302 | 0.0194 | +0.0108 | >=0.0132946 | +0.0169 | PASS | PASS | PASS |
| Sky-blue area | 68.5346 | 43.2583 | +25.2763 | 25.1583..45.1583 | -23.3763 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2277 | 0.2433 | -0.0156 | >=0.234796 | -0.0071 | FAIL | PASS | PASS |
| Split-tone dark R-B | -29.7609 | -21.8069 | -7.9539 | -28.2069..-13.2069 | -1.5539 | FAIL | PASS | FAIL |
| Red accent share | 1.6813 | 2.3938 | -0.7125 | 0.193789..3.19379 | +1.4875 | PASS | PASS | FAIL |

**9/13 shifted PASS, 4 FAIL | 11/13 tolerance PASS, 2 WATCH | 10/13 legacy PASS, 3 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 12.8011 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0039 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.2695 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.8776 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 68.5 % -> sky mask 12.8 % (19 % of the primary share looks like sky; lit-wall exclusion removed 7.1 pp).

### `captures/w5-final/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4517 | 0.6152 | -0.1635 | 0.506224..0.646224 | -0.0545 | FAIL | WATCH | FAIL |
| Luma std | 0.2937 | 0.2946 | -0.0009 | >=0.242584 | +0.0511 | PASS | PASS | PASS |
| Luma p25 | 0.1775 | 0.3710 | -0.1935 | 0.330988..0.420988 | -0.1535 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9521 | 0.9806 | -0.0285 | >=0.9316 | +0.0205 | PASS | PASS | PASS |
| Near-white share | 12.4468 | 34.4913 | -22.0446 | 22.1913..35.1913 | -9.7446 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.3469 | 0.3000 | +0.0469 | 0.241027..0.321027 | -0.0259 | FAIL | PASS | PASS |
| Local contrast | 0.2807 | 0.2850 | -0.0043 | >=0.273703 | +0.0070 | PASS | PASS | PASS |
| Edge energy | 0.0231 | 0.0194 | +0.0037 | >=0.0132946 | +0.0098 | PASS | PASS | FAIL |
| Sky-blue area | 27.1258 | 43.2583 | -16.1326 | 25.1583..45.1583 | +1.9674 | PASS | WATCH | FAIL |
| Top-third contrast | 0.2809 | 0.2433 | +0.0376 | >=0.234796 | +0.0461 | PASS | PASS | PASS |
| Split-tone dark R-B | -29.5482 | -21.8069 | -7.7412 | -28.2069..-13.2069 | -1.3412 | FAIL | PASS | FAIL |
| Red accent share | 2.0214 | 2.3938 | -0.3724 | 0.193789..3.19379 | +1.1724 | PASS | PASS | PASS |

**8/13 shifted PASS, 5 FAIL | 9/13 tolerance PASS, 4 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 1.4668 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0031 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.5689 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9768 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 27.1 % -> sky mask 1.5 % (5 % of the primary share looks like sky; lit-wall exclusion removed 1.4 pp).

