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

### `captures/postg51-final/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5609 | 0.6152 | -0.0543 | 0.506224..0.646224 | +0.0547 | PASS | PASS | PASS |
| Luma std | 0.2500 | 0.2946 | -0.0445 | >=0.242584 | +0.0075 | PASS | PASS | PASS |
| Luma p25 | 0.3809 | 0.3710 | +0.0100 | 0.330988..0.420988 | +0.0400 | PASS | PASS | PASS |
| Luma p95 | 0.9555 | 0.9806 | -0.0251 | >=0.9316 | +0.0239 | PASS | PASS | PASS |
| Near-white share | 16.0546 | 34.4913 | -18.4367 | 22.1913..35.1913 | -6.1367 | FAIL | WATCH | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.4011 | 0.3000 | +0.1011 | 0.241027..0.321027 | -0.0801 | FAIL | WATCH | FAIL |
| Local contrast | 0.2351 | 0.2850 | -0.0499 | >=0.273703 | -0.0386 | FAIL | WATCH | PASS |
| Edge energy | 0.0240 | 0.0194 | +0.0046 | >=0.0132946 | +0.0107 | PASS | PASS | FAIL |
| Sky-blue area | 73.3532 | 43.2583 | +30.0949 | 25.1583..45.1583 | -28.1949 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.1899 | 0.2433 | -0.0534 | >=0.234796 | -0.0449 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -34.3845 | -21.8069 | -12.5776 | -28.2069..-13.2069 | -6.1776 | FAIL | PASS | FAIL |
| Red accent share | 1.2743 | 2.3938 | -1.1195 | 0.193789..3.19379 | +1.0805 | PASS | PASS | FAIL |

**7/13 shifted PASS, 6 FAIL | 8/13 tolerance PASS, 5 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 8.0868 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0038 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.5044 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9247 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 73.4 % -> sky mask 8.1 % (11 % of the primary share looks like sky; lit-wall exclusion removed 8.1 pp).

### `captures/postg51-final/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6084 | 0.6152 | -0.0069 | 0.506224..0.646224 | +0.0379 | PASS | PASS | PASS |
| Luma std | 0.2838 | 0.2946 | -0.0108 | >=0.242584 | +0.0412 | PASS | PASS | PASS |
| Luma p25 | 0.3375 | 0.3710 | -0.0334 | 0.330988..0.420988 | +0.0066 | PASS | PASS | PASS |
| Luma p95 | 0.9569 | 0.9806 | -0.0237 | >=0.9316 | +0.0253 | PASS | PASS | PASS |
| Near-white share | 26.8453 | 34.4913 | -7.6460 | 22.1913..35.1913 | +4.6540 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2786 | 0.3000 | -0.0214 | 0.241027..0.321027 | +0.0376 | PASS | PASS | FAIL |
| Local contrast | 0.2540 | 0.2850 | -0.0310 | >=0.273703 | -0.0197 | FAIL | PASS | PASS |
| Edge energy | 0.0415 | 0.0194 | +0.0221 | >=0.0132946 | +0.0282 | PASS | WATCH | PASS |
| Sky-blue area | 47.4359 | 43.2583 | +4.1776 | 25.1583..45.1583 | -2.2776 | FAIL | PASS | PASS |
| Top-third contrast | 0.2660 | 0.2433 | +0.0227 | >=0.234796 | +0.0312 | PASS | PASS | PASS |
| Split-tone dark R-B | -34.6027 | -21.8069 | -12.7958 | -28.2069..-13.2069 | -6.3958 | FAIL | PASS | FAIL |
| Red accent share | 1.7998 | 2.3938 | -0.5940 | 0.193789..3.19379 | +1.3940 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 10/13 legacy PASS, 3 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 5.4576 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0044 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.3075 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9720 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 47.4 % -> sky mask 5.5 % (12 % of the primary share looks like sky; lit-wall exclusion removed 5.5 pp).

### `captures/postg51-final/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5965 | 0.6152 | -0.0187 | 0.506224..0.646224 | +0.0497 | PASS | PASS | PASS |
| Luma std | 0.2384 | 0.2946 | -0.0562 | >=0.242584 | -0.0042 | FAIL | WATCH | PASS |
| Luma p25 | 0.3547 | 0.3710 | -0.0162 | 0.330988..0.420988 | +0.0238 | PASS | PASS | PASS |
| Luma p95 | 0.9171 | 0.9806 | -0.0635 | >=0.9316 | -0.0145 | FAIL | WATCH | FAIL |
| Near-white share | 5.6981 | 34.4913 | -28.7932 | 22.1913..35.1913 | -16.4932 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0004 | 0.6781 | -0.6777 | <=3.6781 | +3.6777 | PASS | PASS | PASS |
| Saturation | 0.1741 | 0.3000 | -0.1259 | 0.241027..0.321027 | -0.0669 | FAIL | WATCH | FAIL |
| Local contrast | 0.2277 | 0.2850 | -0.0573 | >=0.273703 | -0.0460 | FAIL | WATCH | PASS |
| Edge energy | 0.0235 | 0.0194 | +0.0041 | >=0.0132946 | +0.0102 | PASS | PASS | FAIL |
| Sky-blue area | 53.3199 | 43.2583 | +10.0615 | 25.1583..45.1583 | -8.1615 | FAIL | PASS | PASS |
| Top-third contrast | 0.2579 | 0.2433 | +0.0146 | >=0.234796 | +0.0231 | PASS | PASS | PASS |
| Split-tone dark R-B | -16.6939 | -21.8069 | +5.1130 | -28.2069..-13.2069 | +3.4870 | PASS | PASS | FAIL |
| Red accent share | 5.2774 | 2.3938 | +2.8836 | 0.193789..3.19379 | -2.0836 | FAIL | WATCH | FAIL |

**6/13 shifted PASS, 7 FAIL | 7/13 tolerance PASS, 6 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 3.5243 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0037 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 2.2326 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.6230 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 53.3 % -> sky mask 3.5 % (7 % of the primary share looks like sky; lit-wall exclusion removed 2.2 pp).

### `captures/postg51-final/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5971 | 0.6152 | -0.0182 | 0.506224..0.646224 | +0.0492 | PASS | PASS | PASS |
| Luma std | 0.2692 | 0.2946 | -0.0253 | >=0.242584 | +0.0267 | PASS | PASS | PASS |
| Luma p25 | 0.3560 | 0.3710 | -0.0150 | 0.330988..0.420988 | +0.0250 | PASS | PASS | PASS |
| Luma p95 | 0.9569 | 0.9806 | -0.0237 | >=0.9316 | +0.0253 | PASS | PASS | PASS |
| Near-white share | 24.0667 | 34.4913 | -10.4246 | 22.1913..35.1913 | +1.8754 | PASS | PASS | PASS |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.2892 | 0.3000 | -0.0109 | 0.241027..0.321027 | +0.0319 | PASS | PASS | FAIL |
| Local contrast | 0.2462 | 0.2850 | -0.0388 | >=0.273703 | -0.0275 | FAIL | PASS | PASS |
| Edge energy | 0.0291 | 0.0194 | +0.0097 | >=0.0132946 | +0.0158 | PASS | PASS | PASS |
| Sky-blue area | 47.8236 | 43.2583 | +4.5653 | 25.1583..45.1583 | -2.6653 | FAIL | PASS | PASS |
| Top-third contrast | 0.2598 | 0.2433 | +0.0165 | >=0.234796 | +0.0250 | PASS | PASS | PASS |
| Split-tone dark R-B | 4.1663 | -21.8069 | +25.9732 | -28.2069..-13.2069 | -17.3732 | FAIL | WATCH | FAIL |
| Red accent share | 1.6181 | 2.3938 | -0.7757 | 0.193789..3.19379 | +1.4243 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 12/13 tolerance PASS, 1 WATCH | 10/13 legacy PASS, 3 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 5.9045 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0040 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.1047 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9556 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 47.8 % -> sky mask 5.9 % (12 % of the primary share looks like sky; lit-wall exclusion removed 5.0 pp).

### `captures/postg51-final/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6115 | 0.6152 | -0.0037 | 0.506224..0.646224 | +0.0347 | PASS | PASS | PASS |
| Luma std | 0.2595 | 0.2946 | -0.0351 | >=0.242584 | +0.0169 | PASS | PASS | PASS |
| Luma p25 | 0.3991 | 0.3710 | +0.0281 | 0.330988..0.420988 | +0.0219 | PASS | PASS | PASS |
| Luma p95 | 0.9569 | 0.9806 | -0.0237 | >=0.9316 | +0.0253 | PASS | PASS | PASS |
| Near-white share | 23.8040 | 34.4913 | -10.6873 | 22.1913..35.1913 | +1.6127 | PASS | PASS | PASS |
| Deep-shadow share | 0.0004 | 0.6781 | -0.6777 | <=3.6781 | +3.6777 | PASS | PASS | PASS |
| Saturation | 0.3032 | 0.3000 | +0.0031 | 0.241027..0.321027 | +0.0179 | PASS | PASS | PASS |
| Local contrast | 0.2384 | 0.2850 | -0.0466 | >=0.273703 | -0.0353 | FAIL | WATCH | PASS |
| Edge energy | 0.0302 | 0.0194 | +0.0108 | >=0.0132946 | +0.0169 | PASS | PASS | PASS |
| Sky-blue area | 68.5449 | 43.2583 | +25.2865 | 25.1583..45.1583 | -23.3865 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2279 | 0.2433 | -0.0154 | >=0.234796 | -0.0069 | FAIL | PASS | PASS |
| Split-tone dark R-B | -29.5580 | -21.8069 | -7.7510 | -28.2069..-13.2069 | -1.3510 | FAIL | PASS | FAIL |
| Red accent share | 1.6811 | 2.3938 | -0.7127 | 0.193789..3.19379 | +1.4873 | PASS | PASS | FAIL |

**9/13 shifted PASS, 4 FAIL | 11/13 tolerance PASS, 2 WATCH | 10/13 legacy PASS, 3 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 12.7888 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0039 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.2695 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.8776 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 68.5 % -> sky mask 12.8 % (19 % of the primary share looks like sky; lit-wall exclusion removed 7.1 pp).

### `captures/postg51-final/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4594 | 0.6152 | -0.1558 | 0.506224..0.646224 | -0.0468 | FAIL | WATCH | FAIL |
| Luma std | 0.2931 | 0.2946 | -0.0015 | >=0.242584 | +0.0505 | PASS | PASS | PASS |
| Luma p25 | 0.1800 | 0.3710 | -0.1910 | 0.330988..0.420988 | -0.1510 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9521 | 0.9806 | -0.0285 | >=0.9316 | +0.0205 | PASS | PASS | PASS |
| Near-white share | 12.7747 | 34.4913 | -21.7166 | 22.1913..35.1913 | -9.4166 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.3418 | 0.3000 | +0.0418 | 0.241027..0.321027 | -0.0208 | FAIL | PASS | PASS |
| Local contrast | 0.2800 | 0.2850 | -0.0050 | >=0.273703 | +0.0063 | PASS | PASS | PASS |
| Edge energy | 0.0234 | 0.0194 | +0.0040 | >=0.0132946 | +0.0101 | PASS | PASS | FAIL |
| Sky-blue area | 27.0318 | 43.2583 | -16.2265 | 25.1583..45.1583 | +1.8735 | PASS | WATCH | FAIL |
| Top-third contrast | 0.2816 | 0.2433 | +0.0383 | >=0.234796 | +0.0468 | PASS | PASS | PASS |
| Split-tone dark R-B | -29.4555 | -21.8069 | -7.6485 | -28.2069..-13.2069 | -1.2485 | FAIL | PASS | FAIL |
| Red accent share | 2.0143 | 2.3938 | -0.3795 | 0.193789..3.19379 | +1.1795 | PASS | PASS | PASS |

**8/13 shifted PASS, 5 FAIL | 9/13 tolerance PASS, 4 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 1.4985 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0031 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.5635 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9743 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 27.0 % -> sky mask 1.5 % (6 % of the primary share looks like sky; lit-wall exclusion removed 1.4 pp).

