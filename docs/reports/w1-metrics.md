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

### `captures/w1-final2/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.7114 | 0.6152 | +0.0962 | 0.506224..0.646224 | -0.0652 | FAIL | WATCH | FAIL |
| Luma std | 0.2665 | 0.2946 | -0.0281 | >=0.242584 | +0.0239 | PASS | PASS | PASS |
| Luma p25 | 0.5215 | 0.3710 | +0.1505 | 0.330988..0.420988 | -0.1005 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 28.6389 | 34.4913 | -5.8524 | 22.1913..35.1913 | +6.4476 | PASS | PASS | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1655 | 0.3000 | -0.1345 | 0.241027..0.321027 | -0.0755 | FAIL | WATCH | FAIL |
| Local contrast | 0.2489 | 0.2850 | -0.0361 | >=0.273703 | -0.0248 | FAIL | PASS | PASS |
| Edge energy | 0.0240 | 0.0194 | +0.0046 | >=0.0132946 | +0.0107 | PASS | PASS | FAIL |
| Sky-blue area | 32.5035 | 43.2583 | -10.7548 | 25.1583..45.1583 | +7.3452 | PASS | PASS | FAIL |
| Top-third contrast | 0.2411 | 0.2433 | -0.0022 | >=0.234796 | +0.0063 | PASS | PASS | PASS |
| Split-tone dark R-B | -13.3201 | -21.8069 | +8.4868 | -28.2069..-13.2069 | +0.1132 | PASS | PASS | FAIL |
| Red accent share | 2.3818 | 2.3938 | -0.0120 | 0.193789..3.19379 | +0.8120 | PASS | PASS | PASS |

**9/13 shifted PASS, 4 FAIL | 10/13 tolerance PASS, 3 WATCH | 6/13 legacy PASS, 7 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 4.6933 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0063 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 1.4686 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9855 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 32.5 % -> sky mask 4.7 % (14 % of the primary share looks like sky; lit-wall exclusion removed 2.9 pp).

### `captures/w1-final2/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6093 | 0.6152 | -0.0059 | 0.506224..0.646224 | +0.0369 | PASS | PASS | PASS |
| Luma std | 0.2840 | 0.2946 | -0.0106 | >=0.242584 | +0.0414 | PASS | PASS | PASS |
| Luma p25 | 0.3203 | 0.3710 | -0.0507 | 0.330988..0.420988 | -0.0107 | FAIL | PASS | FAIL |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 24.6620 | 34.4913 | -9.8293 | 22.1913..35.1913 | +2.4707 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1916 | 0.3000 | -0.1085 | 0.241027..0.321027 | -0.0495 | FAIL | WATCH | FAIL |
| Local contrast | 0.2536 | 0.2850 | -0.0314 | >=0.273703 | -0.0201 | FAIL | PASS | PASS |
| Edge energy | 0.0401 | 0.0194 | +0.0207 | >=0.0132946 | +0.0268 | PASS | WATCH | PASS |
| Sky-blue area | 38.8864 | 43.2583 | -4.3720 | 25.1583..45.1583 | +6.2720 | PASS | PASS | PASS |
| Top-third contrast | 0.2600 | 0.2433 | +0.0167 | >=0.234796 | +0.0252 | PASS | PASS | PASS |
| Split-tone dark R-B | -19.0482 | -21.8069 | +2.7588 | -28.2069..-13.2069 | +5.8412 | PASS | PASS | FAIL |
| Red accent share | 1.0033 | 2.3938 | -1.3905 | 0.193789..3.19379 | +0.8095 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 11/13 tolerance PASS, 2 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 6.7008 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0063 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.3073 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9708 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 38.9 % -> sky mask 6.7 % (17 % of the primary share looks like sky; lit-wall exclusion removed 4.4 pp).

### `captures/w1-final2/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5635 | 0.6152 | -0.0517 | 0.506224..0.646224 | +0.0573 | PASS | PASS | PASS |
| Luma std | 0.2274 | 0.2946 | -0.0672 | >=0.242584 | -0.0152 | FAIL | WATCH | PASS |
| Luma p25 | 0.3849 | 0.3710 | +0.0140 | 0.330988..0.420988 | +0.0360 | PASS | PASS | PASS |
| Luma p95 | 0.8790 | 0.9806 | -0.1016 | >=0.9316 | -0.0526 | FAIL | WATCH | FAIL |
| Near-white share | 1.4770 | 34.4913 | -33.0143 | 22.1913..35.1913 | -20.7143 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1276 | 0.3000 | -0.1724 | 0.241027..0.321027 | -0.1134 | FAIL | WATCH | FAIL |
| Local contrast | 0.2150 | 0.2850 | -0.0700 | >=0.273703 | -0.0587 | FAIL | WATCH | PASS |
| Edge energy | 0.0251 | 0.0194 | +0.0057 | >=0.0132946 | +0.0118 | PASS | PASS | FAIL |
| Sky-blue area | 48.6403 | 43.2583 | +5.3819 | 25.1583..45.1583 | -3.4819 | FAIL | PASS | PASS |
| Top-third contrast | 0.2244 | 0.2433 | -0.0189 | >=0.234796 | -0.0104 | FAIL | PASS | PASS |
| Split-tone dark R-B | 19.7725 | -21.8069 | +41.5795 | -28.2069..-13.2069 | -32.9795 | FAIL | WATCH | FAIL |
| Red accent share | 1.8021 | 2.3938 | -0.5917 | 0.193789..3.19379 | +1.3917 | PASS | PASS | FAIL |

**5/13 shifted PASS, 8 FAIL | 7/13 tolerance PASS, 6 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 19.7278 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0056 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.3949 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.7772 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 48.6 % -> sky mask 19.7 % (41 % of the primary share looks like sky; lit-wall exclusion removed 1.3 pp).

### `captures/w1-final2/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6639 | 0.6152 | +0.0487 | 0.506224..0.646224 | -0.0177 | FAIL | PASS | FAIL |
| Luma std | 0.2765 | 0.2946 | -0.0180 | >=0.242584 | +0.0340 | PASS | PASS | PASS |
| Luma p25 | 0.3680 | 0.3710 | -0.0030 | 0.330988..0.420988 | +0.0370 | PASS | PASS | PASS |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 25.3694 | 34.4913 | -9.1219 | 22.1913..35.1913 | +3.1781 | PASS | PASS | PASS |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.1717 | 0.3000 | -0.1284 | 0.241027..0.321027 | -0.0694 | FAIL | WATCH | FAIL |
| Local contrast | 0.2590 | 0.2850 | -0.0260 | >=0.273703 | -0.0147 | FAIL | PASS | PASS |
| Edge energy | 0.0281 | 0.0194 | +0.0087 | >=0.0132946 | +0.0148 | PASS | PASS | PASS |
| Sky-blue area | 42.7259 | 43.2583 | -0.5324 | 25.1583..45.1583 | +2.4324 | PASS | PASS | PASS |
| Top-third contrast | 0.2538 | 0.2433 | +0.0105 | >=0.234796 | +0.0190 | PASS | PASS | PASS |
| Split-tone dark R-B | -25.3192 | -21.8069 | -3.5123 | -28.2069..-13.2069 | +2.8877 | PASS | PASS | FAIL |
| Red accent share | 0.7541 | 2.3938 | -1.6397 | 0.193789..3.19379 | +0.5603 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 7.6456 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0059 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.5760 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.7308 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 42.7 % -> sky mask 7.6 % (18 % of the primary share looks like sky; lit-wall exclusion removed 5.2 pp).

### `captures/w1-final2/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6466 | 0.6152 | +0.0314 | 0.506224..0.646224 | -0.0004 | FAIL | PASS | FAIL |
| Luma std | 0.2678 | 0.2946 | -0.0268 | >=0.242584 | +0.0252 | PASS | PASS | PASS |
| Luma p25 | 0.3854 | 0.3710 | +0.0144 | 0.330988..0.420988 | +0.0356 | PASS | PASS | PASS |
| Luma p95 | 0.9600 | 0.9806 | -0.0206 | >=0.9316 | +0.0284 | PASS | PASS | PASS |
| Near-white share | 25.5164 | 34.4913 | -8.9749 | 22.1913..35.1913 | +3.3251 | PASS | PASS | PASS |
| Deep-shadow share | 0.0004 | 0.6781 | -0.6777 | <=3.6781 | +3.6777 | PASS | PASS | PASS |
| Saturation | 0.1935 | 0.3000 | -0.1065 | 0.241027..0.321027 | -0.0475 | FAIL | WATCH | FAIL |
| Local contrast | 0.2489 | 0.2850 | -0.0361 | >=0.273703 | -0.0248 | FAIL | PASS | PASS |
| Edge energy | 0.0296 | 0.0194 | +0.0102 | >=0.0132946 | +0.0163 | PASS | PASS | PASS |
| Sky-blue area | 55.3359 | 43.2583 | +12.0776 | 25.1583..45.1583 | -10.1776 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2430 | 0.2433 | -0.0003 | >=0.234796 | +0.0082 | PASS | PASS | PASS |
| Split-tone dark R-B | -13.9516 | -21.8069 | +7.8553 | -28.2069..-13.2069 | +0.7447 | PASS | PASS | FAIL |
| Red accent share | 1.9853 | 2.3938 | -0.4084 | 0.193789..3.19379 | +1.2084 | PASS | PASS | FAIL |

**9/13 shifted PASS, 4 FAIL | 11/13 tolerance PASS, 2 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 14.4008 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0053 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.4562 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.8680 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 55.3 % -> sky mask 14.4 % (26 % of the primary share looks like sky; lit-wall exclusion removed 6.8 pp).

### `captures/w1-final2/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4949 | 0.6152 | -0.1203 | 0.506224..0.646224 | -0.0113 | FAIL | WATCH | PASS |
| Luma std | 0.2956 | 0.2946 | +0.0010 | >=0.242584 | +0.0530 | PASS | PASS | PASS |
| Luma p25 | 0.1959 | 0.3710 | -0.1751 | 0.330988..0.420988 | -0.1351 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9521 | 0.9806 | -0.0285 | >=0.9316 | +0.0205 | PASS | PASS | PASS |
| Near-white share | 12.9757 | 34.4913 | -21.5156 | 22.1913..35.1913 | -9.2156 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2500 | 0.3000 | -0.0500 | 0.241027..0.321027 | +0.0090 | PASS | PASS | FAIL |
| Local contrast | 0.2818 | 0.2850 | -0.0032 | >=0.273703 | +0.0081 | PASS | PASS | PASS |
| Edge energy | 0.0297 | 0.0194 | +0.0103 | >=0.0132946 | +0.0164 | PASS | PASS | PASS |
| Sky-blue area | 27.6381 | 43.2583 | -15.6202 | 25.1583..45.1583 | +2.4798 | PASS | WATCH | FAIL |
| Top-third contrast | 0.2278 | 0.2433 | -0.0155 | >=0.234796 | -0.0070 | FAIL | PASS | PASS |
| Split-tone dark R-B | -19.9031 | -21.8069 | +1.9038 | -28.2069..-13.2069 | +6.6962 | PASS | PASS | FAIL |
| Red accent share | 2.1345 | 2.3938 | -0.2593 | 0.193789..3.19379 | +1.0593 | PASS | PASS | PASS |

**9/13 shifted PASS, 4 FAIL | 9/13 tolerance PASS, 4 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 4.9470 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0092 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 1.9979 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9161 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 27.6 % -> sky mask 4.9 % (18 % of the primary share looks like sky; lit-wall exclusion removed 1.3 pp).

