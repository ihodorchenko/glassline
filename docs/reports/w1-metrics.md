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

### `captures/w1-final/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.7117 | 0.6152 | +0.0965 | 0.506224..0.646224 | -0.0655 | FAIL | WATCH | FAIL |
| Luma std | 0.2661 | 0.2946 | -0.0285 | >=0.242584 | +0.0235 | PASS | PASS | PASS |
| Luma p25 | 0.5213 | 0.3710 | +0.1503 | 0.330988..0.420988 | -0.1003 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 28.8283 | 34.4913 | -5.6630 | 22.1913..35.1913 | +6.3630 | PASS | PASS | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1910 | 0.3000 | -0.1090 | 0.241027..0.321027 | -0.0500 | FAIL | WATCH | FAIL |
| Local contrast | 0.2485 | 0.2850 | -0.0365 | >=0.273703 | -0.0252 | FAIL | PASS | PASS |
| Edge energy | 0.0239 | 0.0194 | +0.0045 | >=0.0132946 | +0.0106 | PASS | PASS | FAIL |
| Sky-blue area | 32.8842 | 43.2583 | -10.3742 | 25.1583..45.1583 | +7.7258 | PASS | PASS | FAIL |
| Top-third contrast | 0.2405 | 0.2433 | -0.0028 | >=0.234796 | +0.0057 | PASS | PASS | PASS |
| Split-tone dark R-B | -9.9716 | -21.8069 | +11.8353 | -28.2069..-13.2069 | -3.2353 | FAIL | PASS | FAIL |
| Red accent share | 2.3802 | 2.3938 | -0.0136 | 0.193789..3.19379 | +0.8136 | PASS | PASS | PASS |

**8/13 shifted PASS, 5 FAIL | 10/13 tolerance PASS, 3 WATCH | 6/13 legacy PASS, 7 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 4.6717 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0062 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 1.4686 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9855 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 32.9 % -> sky mask 4.7 % (14 % of the primary share looks like sky; lit-wall exclusion removed 2.9 pp).

### `captures/w1-final/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6260 | 0.6152 | +0.0108 | 0.506224..0.646224 | +0.0202 | PASS | PASS | FAIL |
| Luma std | 0.2830 | 0.2946 | -0.0116 | >=0.242584 | +0.0404 | PASS | PASS | PASS |
| Luma p25 | 0.3317 | 0.3710 | -0.0393 | 0.330988..0.420988 | +0.0007 | PASS | PASS | PASS |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 26.8553 | 34.4913 | -7.6360 | 22.1913..35.1913 | +4.6640 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2463 | 0.3000 | -0.0538 | 0.241027..0.321027 | +0.0052 | PASS | PASS | FAIL |
| Local contrast | 0.2537 | 0.2850 | -0.0313 | >=0.273703 | -0.0200 | FAIL | PASS | PASS |
| Edge energy | 0.0388 | 0.0194 | +0.0194 | >=0.0132946 | +0.0255 | PASS | WATCH | PASS |
| Sky-blue area | 42.0476 | 43.2583 | -1.2107 | 25.1583..45.1583 | +3.1107 | PASS | PASS | PASS |
| Top-third contrast | 0.2619 | 0.2433 | +0.0186 | >=0.234796 | +0.0271 | PASS | PASS | PASS |
| Split-tone dark R-B | -31.6803 | -21.8069 | -9.8734 | -28.2069..-13.2069 | -3.4734 | FAIL | PASS | FAIL |
| Red accent share | 0.8918 | 2.3938 | -1.5020 | 0.193789..3.19379 | +0.6980 | PASS | PASS | FAIL |

**11/13 shifted PASS, 2 FAIL | 12/13 tolerance PASS, 1 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 6.8283 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0061 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.3148 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9705 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 42.0 % -> sky mask 6.8 % (16 % of the primary share looks like sky; lit-wall exclusion removed 4.4 pp).

### `captures/w1-final/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5632 | 0.6152 | -0.0521 | 0.506224..0.646224 | +0.0569 | PASS | PASS | PASS |
| Luma std | 0.2250 | 0.2946 | -0.0695 | >=0.242584 | -0.0175 | FAIL | WATCH | PASS |
| Luma p25 | 0.3853 | 0.3710 | +0.0143 | 0.330988..0.420988 | +0.0357 | PASS | PASS | PASS |
| Luma p95 | 0.8787 | 0.9806 | -0.1019 | >=0.9316 | -0.0529 | FAIL | WATCH | FAIL |
| Near-white share | 1.4635 | 34.4913 | -33.0278 | 22.1913..35.1913 | -20.7278 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1625 | 0.3000 | -0.1375 | 0.241027..0.321027 | -0.0785 | FAIL | WATCH | FAIL |
| Local contrast | 0.2135 | 0.2850 | -0.0715 | >=0.273703 | -0.0602 | FAIL | WATCH | PASS |
| Edge energy | 0.0248 | 0.0194 | +0.0054 | >=0.0132946 | +0.0115 | PASS | PASS | FAIL |
| Sky-blue area | 56.0955 | 43.2583 | +12.8372 | 25.1583..45.1583 | -10.9372 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2241 | 0.2433 | -0.0192 | >=0.234796 | -0.0107 | FAIL | PASS | PASS |
| Split-tone dark R-B | 40.2427 | -21.8069 | +62.0496 | -28.2069..-13.2069 | -53.4496 | FAIL | WATCH | FAIL |
| Red accent share | 1.7840 | 2.3938 | -0.6098 | 0.193789..3.19379 | +1.4098 | PASS | PASS | FAIL |

**5/13 shifted PASS, 8 FAIL | 6/13 tolerance PASS, 7 WATCH | 6/13 legacy PASS, 7 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 17.8511 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0055 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.3931 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.7672 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 56.1 % -> sky mask 17.9 % (32 % of the primary share looks like sky; lit-wall exclusion removed 1.3 pp).

### `captures/w1-final/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6616 | 0.6152 | +0.0464 | 0.506224..0.646224 | -0.0154 | FAIL | PASS | FAIL |
| Luma std | 0.2794 | 0.2946 | -0.0151 | >=0.242584 | +0.0369 | PASS | PASS | PASS |
| Luma p25 | 0.3531 | 0.3710 | -0.0179 | 0.330988..0.420988 | +0.0221 | PASS | PASS | PASS |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 25.3677 | 34.4913 | -9.1237 | 22.1913..35.1913 | +3.1763 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2370 | 0.3000 | -0.0630 | 0.241027..0.321027 | -0.0040 | FAIL | PASS | FAIL |
| Local contrast | 0.2621 | 0.2850 | -0.0229 | >=0.273703 | -0.0116 | FAIL | PASS | PASS |
| Edge energy | 0.0281 | 0.0194 | +0.0087 | >=0.0132946 | +0.0148 | PASS | PASS | PASS |
| Sky-blue area | 50.1413 | 43.2583 | +6.8830 | 25.1583..45.1583 | -4.9830 | FAIL | PASS | PASS |
| Top-third contrast | 0.2576 | 0.2433 | +0.0143 | >=0.234796 | +0.0228 | PASS | PASS | PASS |
| Split-tone dark R-B | -36.4264 | -21.8069 | -14.6195 | -28.2069..-13.2069 | -8.2195 | FAIL | PASS | FAIL |
| Red accent share | 0.7535 | 2.3938 | -1.6403 | 0.193789..3.19379 | +0.5597 | PASS | PASS | FAIL |

**8/13 shifted PASS, 5 FAIL | 13/13 tolerance PASS, 0 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 7.7982 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0059 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.5760 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.7308 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 50.1 % -> sky mask 7.8 % (16 % of the primary share looks like sky; lit-wall exclusion removed 5.1 pp).

### `captures/w1-final/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6450 | 0.6152 | +0.0297 | 0.506224..0.646224 | +0.0013 | PASS | PASS | FAIL |
| Luma std | 0.2696 | 0.2946 | -0.0250 | >=0.242584 | +0.0270 | PASS | PASS | PASS |
| Luma p25 | 0.3796 | 0.3710 | +0.0086 | 0.330988..0.420988 | +0.0414 | PASS | PASS | PASS |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 25.5141 | 34.4913 | -8.9773 | 22.1913..35.1913 | +3.3227 | PASS | PASS | PASS |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.2456 | 0.3000 | -0.0544 | 0.241027..0.321027 | +0.0046 | PASS | PASS | FAIL |
| Local contrast | 0.2513 | 0.2850 | -0.0337 | >=0.273703 | -0.0224 | FAIL | PASS | PASS |
| Edge energy | 0.0293 | 0.0194 | +0.0099 | >=0.0132946 | +0.0160 | PASS | PASS | PASS |
| Sky-blue area | 58.6850 | 43.2583 | +15.4267 | 25.1583..45.1583 | -13.5267 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2460 | 0.2433 | +0.0027 | >=0.234796 | +0.0112 | PASS | PASS | PASS |
| Split-tone dark R-B | -11.6702 | -21.8069 | +10.1368 | -28.2069..-13.2069 | -1.5368 | FAIL | PASS | FAIL |
| Red accent share | 1.9794 | 2.3938 | -0.4144 | 0.193789..3.19379 | +1.2144 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 14.3434 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0053 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.4500 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.8726 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 58.7 % -> sky mask 14.3 % (24 % of the primary share looks like sky; lit-wall exclusion removed 6.8 pp).

### `captures/w1-final/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4938 | 0.6152 | -0.1214 | 0.506224..0.646224 | -0.0124 | FAIL | WATCH | PASS |
| Luma std | 0.2961 | 0.2946 | +0.0016 | >=0.242584 | +0.0536 | PASS | PASS | PASS |
| Luma p25 | 0.1948 | 0.3710 | -0.1761 | 0.330988..0.420988 | -0.1361 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9521 | 0.9806 | -0.0285 | >=0.9316 | +0.0205 | PASS | PASS | PASS |
| Near-white share | 12.9757 | 34.4913 | -21.5156 | 22.1913..35.1913 | -9.2156 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.3225 | 0.3000 | +0.0225 | 0.241027..0.321027 | -0.0015 | FAIL | PASS | PASS |
| Local contrast | 0.2827 | 0.2850 | -0.0023 | >=0.273703 | +0.0090 | PASS | PASS | PASS |
| Edge energy | 0.0294 | 0.0194 | +0.0101 | >=0.0132946 | +0.0162 | PASS | PASS | PASS |
| Sky-blue area | 30.4843 | 43.2583 | -12.7741 | 25.1583..45.1583 | +5.3259 | PASS | WATCH | FAIL |
| Top-third contrast | 0.2288 | 0.2433 | -0.0145 | >=0.234796 | -0.0060 | FAIL | PASS | PASS |
| Split-tone dark R-B | -28.9605 | -21.8069 | -7.1535 | -28.2069..-13.2069 | -0.7535 | FAIL | PASS | FAIL |
| Red accent share | 2.1279 | 2.3938 | -0.2659 | 0.193789..3.19379 | +1.0659 | PASS | PASS | PASS |

**7/13 shifted PASS, 6 FAIL | 9/13 tolerance PASS, 4 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 4.8881 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0092 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 1.9888 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9175 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 30.5 % -> sky mask 4.9 % (16 % of the primary share looks like sky; lit-wall exclusion removed 1.3 pp).

