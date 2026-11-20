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

### `captures/w2-final2/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.7123 | 0.6152 | +0.0971 | 0.506224..0.646224 | -0.0661 | FAIL | WATCH | FAIL |
| Luma std | 0.2184 | 0.2946 | -0.0762 | >=0.242584 | -0.0242 | FAIL | WATCH | FAIL |
| Luma p25 | 0.6026 | 0.3710 | +0.2316 | 0.330988..0.420988 | -0.1816 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9602 | 0.9806 | -0.0204 | >=0.9316 | +0.0286 | PASS | PASS | PASS |
| Near-white share | 25.3073 | 34.4913 | -9.1840 | 22.1913..35.1913 | +3.1160 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.2555 | 0.3000 | -0.0446 | 0.241027..0.321027 | +0.0144 | PASS | PASS | FAIL |
| Local contrast | 0.2037 | 0.2850 | -0.0813 | >=0.273703 | -0.0700 | FAIL | WATCH | PASS |
| Edge energy | 0.0171 | 0.0194 | -0.0023 | >=0.0132946 | +0.0038 | PASS | PASS | FAIL |
| Sky-blue area | 75.3049 | 43.2583 | +32.0466 | 25.1583..45.1583 | -30.1466 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.1367 | 0.2433 | -0.1066 | >=0.234796 | -0.0981 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -8.0000 | -21.8069 | +13.8069 | -28.2069..-13.2069 | -5.2069 | FAIL | PASS | FAIL |
| Red accent share | 2.4632 | 2.3938 | +0.0694 | 0.193789..3.19379 | +0.7306 | PASS | PASS | PASS |

**6/13 shifted PASS, 7 FAIL | 7/13 tolerance PASS, 6 WATCH | 6/13 legacy PASS, 7 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 10.1020 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0043 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.1335 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9821 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 75.3 % -> sky mask 10.1 % (13 % of the primary share looks like sky; lit-wall exclusion removed 10.5 pp).

### `captures/w2-final2/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6413 | 0.6152 | +0.0261 | 0.506224..0.646224 | +0.0049 | PASS | PASS | FAIL |
| Luma std | 0.2765 | 0.2946 | -0.0181 | >=0.242584 | +0.0339 | PASS | PASS | PASS |
| Luma p25 | 0.3587 | 0.3710 | -0.0123 | 0.330988..0.420988 | +0.0277 | PASS | PASS | PASS |
| Luma p95 | 0.9605 | 0.9806 | -0.0201 | >=0.9316 | +0.0289 | PASS | PASS | PASS |
| Near-white share | 26.3966 | 34.4913 | -8.0947 | 22.1913..35.1913 | +4.2053 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1982 | 0.3000 | -0.1019 | 0.241027..0.321027 | -0.0429 | FAIL | WATCH | FAIL |
| Local contrast | 0.2483 | 0.2850 | -0.0367 | >=0.273703 | -0.0254 | FAIL | PASS | PASS |
| Edge energy | 0.0386 | 0.0194 | +0.0192 | >=0.0132946 | +0.0253 | PASS | WATCH | PASS |
| Sky-blue area | 45.4108 | 43.2583 | +2.1525 | 25.1583..45.1583 | -0.2525 | FAIL | PASS | PASS |
| Top-third contrast | 0.2588 | 0.2433 | +0.0155 | >=0.234796 | +0.0240 | PASS | PASS | PASS |
| Split-tone dark R-B | -19.4874 | -21.8069 | +2.3195 | -28.2069..-13.2069 | +6.2805 | PASS | PASS | FAIL |
| Red accent share | 1.7643 | 2.3938 | -0.6295 | 0.193789..3.19379 | +1.4295 | PASS | PASS | FAIL |

**10/13 shifted PASS, 3 FAIL | 11/13 tolerance PASS, 2 WATCH | 9/13 legacy PASS, 4 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 1.8598 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0047 | 0.0029 | 0.0011..0.0047 | above p10-p90 |
| Red route share | 0.3071 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9711 | 0.6682 | 0.3897..0.9428 | above p10-p90 |

sky check: primary sky-blue 45.4 % -> sky mask 1.9 % (4 % of the primary share looks like sky; lit-wall exclusion removed 3.8 pp).

### `captures/w2-final2/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5256 | 0.6152 | -0.0896 | 0.506224..0.646224 | +0.0194 | PASS | WATCH | PASS |
| Luma std | 0.2518 | 0.2946 | -0.0427 | >=0.242584 | +0.0093 | PASS | PASS | PASS |
| Luma p25 | 0.2521 | 0.3710 | -0.1188 | 0.330988..0.420988 | -0.0788 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9202 | 0.9806 | -0.0604 | >=0.9316 | -0.0114 | FAIL | WATCH | FAIL |
| Near-white share | 5.3802 | 34.4913 | -29.1111 | 22.1913..35.1913 | -16.8111 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.0006 | 0.6781 | -0.6775 | <=3.6781 | +3.6775 | PASS | PASS | PASS |
| Saturation | 0.1514 | 0.3000 | -0.1487 | 0.241027..0.321027 | -0.0897 | FAIL | WATCH | FAIL |
| Local contrast | 0.2417 | 0.2850 | -0.0433 | >=0.273703 | -0.0320 | FAIL | WATCH | PASS |
| Edge energy | 0.0202 | 0.0194 | +0.0008 | >=0.0132946 | +0.0069 | PASS | PASS | FAIL |
| Sky-blue area | 39.2711 | 43.2583 | -3.9872 | 25.1583..45.1583 | +5.8872 | PASS | PASS | PASS |
| Top-third contrast | 0.2587 | 0.2433 | +0.0154 | >=0.234796 | +0.0239 | PASS | PASS | PASS |
| Split-tone dark R-B | 10.6025 | -21.8069 | +32.4095 | -28.2069..-13.2069 | -23.8095 | FAIL | WATCH | FAIL |
| Red accent share | 5.4630 | 2.3938 | +3.0692 | 0.193789..3.19379 | -2.2692 | FAIL | WATCH | FAIL |

**6/13 shifted PASS, 7 FAIL | 5/13 tolerance PASS, 8 WATCH | 6/13 legacy PASS, 7 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 12.7404 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0031 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 2.2539 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9061 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 39.3 % -> sky mask 12.7 % (32 % of the primary share looks like sky; lit-wall exclusion removed 2.5 pp).

### `captures/w2-final2/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6912 | 0.6152 | +0.0760 | 0.506224..0.646224 | -0.0450 | FAIL | PASS | FAIL |
| Luma std | 0.2492 | 0.2946 | -0.0454 | >=0.242584 | +0.0066 | PASS | PASS | PASS |
| Luma p25 | 0.4427 | 0.3710 | +0.0718 | 0.330988..0.420988 | -0.0218 | FAIL | PASS | FAIL |
| Luma p95 | 0.9631 | 0.9806 | -0.0175 | >=0.9316 | +0.0315 | PASS | PASS | PASS |
| Near-white share | 27.6759 | 34.4913 | -6.8154 | 22.1913..35.1913 | +5.4846 | PASS | PASS | PASS |
| Deep-shadow share | 0.0000 | 0.6781 | -0.6781 | <=3.6781 | +3.6781 | PASS | PASS | PASS |
| Saturation | 0.1931 | 0.3000 | -0.1069 | 0.241027..0.321027 | -0.0479 | FAIL | WATCH | FAIL |
| Local contrast | 0.2322 | 0.2850 | -0.0528 | >=0.273703 | -0.0415 | FAIL | WATCH | PASS |
| Edge energy | 0.0232 | 0.0194 | +0.0038 | >=0.0132946 | +0.0099 | PASS | PASS | FAIL |
| Sky-blue area | 48.6028 | 43.2583 | +5.3445 | 25.1583..45.1583 | -3.4445 | FAIL | PASS | PASS |
| Top-third contrast | 0.2466 | 0.2433 | +0.0033 | >=0.234796 | +0.0118 | PASS | PASS | PASS |
| Split-tone dark R-B | -22.5315 | -21.8069 | -0.7245 | -28.2069..-13.2069 | +5.6755 | PASS | PASS | FAIL |
| Red accent share | 1.4230 | 2.3938 | -0.9708 | 0.193789..3.19379 | +1.2292 | PASS | PASS | FAIL |

**8/13 shifted PASS, 5 FAIL | 11/13 tolerance PASS, 2 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 5.4890 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0040 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.1780 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.7860 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 48.6 % -> sky mask 5.5 % (11 % of the primary share looks like sky; lit-wall exclusion removed 7.3 pp).

### `captures/w2-final2/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6713 | 0.6152 | +0.0561 | 0.506224..0.646224 | -0.0251 | FAIL | PASS | FAIL |
| Luma std | 0.2380 | 0.2946 | -0.0566 | >=0.242584 | -0.0046 | FAIL | WATCH | PASS |
| Luma p25 | 0.4816 | 0.3710 | +0.1106 | 0.330988..0.420988 | -0.0606 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9602 | 0.9806 | -0.0204 | >=0.9316 | +0.0286 | PASS | PASS | PASS |
| Near-white share | 22.2220 | 34.4913 | -12.2693 | 22.1913..35.1913 | +0.0307 | PASS | PASS | PASS |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.2260 | 0.3000 | -0.0741 | 0.241027..0.321027 | -0.0151 | FAIL | PASS | FAIL |
| Local contrast | 0.2178 | 0.2850 | -0.0672 | >=0.273703 | -0.0559 | FAIL | WATCH | PASS |
| Edge energy | 0.0268 | 0.0194 | +0.0074 | >=0.0132946 | +0.0135 | PASS | PASS | FAIL |
| Sky-blue area | 69.4005 | 43.2583 | +26.1421 | 25.1583..45.1583 | -24.2421 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.1863 | 0.2433 | -0.0570 | >=0.234796 | -0.0485 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -17.1891 | -21.8069 | +4.6179 | -28.2069..-13.2069 | +3.9821 | PASS | PASS | FAIL |
| Red accent share | 2.0486 | 2.3938 | -0.3452 | 0.193789..3.19379 | +1.1452 | PASS | PASS | PASS |

**6/13 shifted PASS, 7 FAIL | 8/13 tolerance PASS, 5 WATCH | 7/13 legacy PASS, 6 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 13.8426 | 5.0636 | 0.5925..11.1641 | above p10-p90 |
| Near-white seam energy | 0.0041 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 0.4462 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.8654 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 69.4 % -> sky mask 13.8 % (20 % of the primary share looks like sky; lit-wall exclusion removed 8.8 pp).

### `captures/w2-final2/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5137 | 0.6152 | -0.1015 | 0.506224..0.646224 | +0.0075 | PASS | WATCH | PASS |
| Luma std | 0.3098 | 0.2946 | +0.0152 | >=0.242584 | +0.0672 | PASS | PASS | PASS |
| Luma p25 | 0.1959 | 0.3710 | -0.1751 | 0.330988..0.420988 | -0.1351 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9572 | 0.9806 | -0.0234 | >=0.9316 | +0.0256 | PASS | PASS | PASS |
| Near-white share | 17.2874 | 34.4913 | -17.2039 | 22.1913..35.1913 | -4.9039 | FAIL | PASS | PASS |
| Deep-shadow share | 0.0002 | 0.6781 | -0.6779 | <=3.6781 | +3.6779 | PASS | PASS | PASS |
| Saturation | 0.2417 | 0.3000 | -0.0583 | 0.241027..0.321027 | +0.0007 | PASS | PASS | FAIL |
| Local contrast | 0.2985 | 0.2850 | +0.0135 | >=0.273703 | +0.0248 | PASS | PASS | PASS |
| Edge energy | 0.0225 | 0.0194 | +0.0031 | >=0.0132946 | +0.0092 | PASS | PASS | FAIL |
| Sky-blue area | 24.8037 | 43.2583 | -18.4547 | 25.1583..45.1583 | -0.3547 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2806 | 0.2433 | +0.0373 | >=0.234796 | +0.0458 | PASS | PASS | PASS |
| Split-tone dark R-B | -19.9619 | -21.8069 | +1.8450 | -28.2069..-13.2069 | +6.7550 | PASS | PASS | FAIL |
| Red accent share | 2.1304 | 2.3938 | -0.2634 | 0.193789..3.19379 | +1.0634 | PASS | PASS | PASS |

**10/13 shifted PASS, 3 FAIL | 10/13 tolerance PASS, 3 WATCH | 8/13 legacy PASS, 5 FAIL**

#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)

| Guardrail | Value | Ref mean | Ref p10–p90 | Position |
|---|---:|---:|---|---|
| Sky mask share | 4.7627 | 5.0636 | 0.5925..11.1641 | inside p10-p90 |
| Near-white seam energy | 0.0038 | 0.0029 | 0.0011..0.0047 | inside p10-p90 |
| Red route share | 1.9979 | 2.8745 | 0.0836..6.7469 | inside p10-p90 |
| Red route saturation | 0.9161 | 0.6682 | 0.3897..0.9428 | inside p10-p90 |

sky check: primary sky-blue 24.8 % -> sky mask 4.8 % (19 % of the primary share looks like sky; lit-wall exclusion removed 2.7 pp).

