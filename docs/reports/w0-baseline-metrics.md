# Glassline metrics report

Script: `tools/capture/metrics.py` (v2.1; formulas unchanged from v1). Band policy: `docs/reports/METRIC_SPEC.md` (shifted bands = plan §2.1 + `delta = measured_ref_mean - legacy_ref`).
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

## Candidates

### `captures/w0/finish-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.7399 | 0.6152 | +0.1246 | 0.506224..0.646224 | -0.0936 | FAIL | WATCH | FAIL |
| Luma std | 0.1845 | 0.2946 | -0.1100 | >=0.242584 | -0.0580 | FAIL | WATCH | FAIL |
| Luma p25 | 0.6199 | 0.3710 | +0.2489 | 0.330988..0.420988 | -0.1989 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9546 | 0.9806 | -0.0260 | >=0.9316 | +0.0230 | PASS | PASS | PASS |
| Near-white share | 20.2921 | 34.4913 | -14.1993 | 22.1913..35.1913 | -1.8993 | FAIL | PASS | PASS |
| Deep-shadow share | 0.5966 | 0.6781 | -0.0815 | <=3.6781 | +3.0815 | PASS | PASS | PASS |
| Saturation | 0.1544 | 0.3000 | -0.1457 | 0.241027..0.321027 | -0.0867 | FAIL | WATCH | FAIL |
| Local contrast | 0.1748 | 0.2850 | -0.1102 | >=0.273703 | -0.0989 | FAIL | WATCH | PASS |
| Edge energy | 0.0172 | 0.0194 | -0.0022 | >=0.0132946 | +0.0039 | PASS | PASS | FAIL |
| Sky-blue area | 44.0397 | 43.2583 | +0.7813 | 25.1583..45.1583 | +1.1187 | PASS | PASS | PASS |
| Top-third contrast | 0.1266 | 0.2433 | -0.1167 | >=0.234796 | -0.1082 | FAIL | WATCH | PASS |
| Split-tone dark R-B | 52.2469 | -21.8069 | +74.0538 | -28.2069..-13.2069 | -65.4538 | FAIL | WATCH | FAIL |
| Red accent share | 1.9361 | 2.3938 | -0.4576 | 0.193789..3.19379 | +1.2576 | PASS | PASS | FAIL |

**5/13 shifted PASS, 8 FAIL | 6/13 tolerance PASS, 7 WATCH | 6/13 legacy PASS, 7 FAIL**

### `captures/w0/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6598 | 0.6152 | +0.0445 | 0.506224..0.646224 | -0.0135 | FAIL | PASS | FAIL |
| Luma std | 0.2146 | 0.2946 | -0.0800 | >=0.242584 | -0.0280 | FAIL | WATCH | FAIL |
| Luma p25 | 0.5295 | 0.3710 | +0.1585 | 0.330988..0.420988 | -0.1085 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9428 | 0.9806 | -0.0378 | >=0.9316 | +0.0112 | PASS | PASS | PASS |
| Near-white share | 16.1267 | 34.4913 | -18.3646 | 22.1913..35.1913 | -6.0646 | FAIL | WATCH | PASS |
| Deep-shadow share | 0.4248 | 0.6781 | -0.2533 | <=3.6781 | +3.2533 | PASS | PASS | PASS |
| Saturation | 0.2305 | 0.3000 | -0.0695 | 0.241027..0.321027 | -0.0105 | FAIL | PASS | FAIL |
| Local contrast | 0.1980 | 0.2850 | -0.0870 | >=0.273703 | -0.0757 | FAIL | WATCH | PASS |
| Edge energy | 0.0278 | 0.0194 | +0.0084 | >=0.0132946 | +0.0145 | PASS | PASS | FAIL |
| Sky-blue area | 52.6355 | 43.2583 | +9.3771 | 25.1583..45.1583 | -7.4771 | FAIL | PASS | PASS |
| Top-third contrast | 0.2053 | 0.2433 | -0.0380 | >=0.234796 | -0.0295 | FAIL | PASS | PASS |
| Split-tone dark R-B | -22.9052 | -21.8069 | -1.0983 | -28.2069..-13.2069 | +5.3017 | PASS | PASS | FAIL |
| Red accent share | 0.5469 | 2.3938 | -1.8469 | 0.193789..3.19379 | +0.3531 | PASS | PASS | FAIL |

**5/13 shifted PASS, 8 FAIL | 9/13 tolerance PASS, 4 WATCH | 6/13 legacy PASS, 7 FAIL**

### `captures/w0/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5080 | 0.6152 | -0.1072 | 0.506224..0.646224 | +0.0018 | PASS | WATCH | PASS |
| Luma std | 0.2191 | 0.2946 | -0.0755 | >=0.242584 | -0.0235 | FAIL | WATCH | FAIL |
| Luma p25 | 0.4374 | 0.3710 | +0.0664 | 0.330988..0.420988 | -0.0164 | FAIL | PASS | FAIL |
| Luma p95 | 0.7943 | 0.9806 | -0.1863 | >=0.9316 | -0.1373 | FAIL | WATCH | FAIL |
| Near-white share | 0.1765 | 34.4913 | -34.3148 | 22.1913..35.1913 | -22.0148 | FAIL | WATCH | FAIL |
| Deep-shadow share | 3.5505 | 0.6781 | +2.8724 | <=3.6781 | +0.1276 | PASS | PASS | PASS |
| Saturation | 0.2681 | 0.3000 | -0.0319 | 0.241027..0.321027 | +0.0271 | PASS | PASS | FAIL |
| Local contrast | 0.2056 | 0.2850 | -0.0794 | >=0.273703 | -0.0681 | FAIL | WATCH | PASS |
| Edge energy | 0.0275 | 0.0194 | +0.0081 | >=0.0132946 | +0.0142 | PASS | PASS | FAIL |
| Sky-blue area | 8.6561 | 43.2583 | -34.6023 | 25.1583..45.1583 | -16.5023 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2480 | 0.2433 | +0.0047 | >=0.234796 | +0.0132 | PASS | PASS | PASS |
| Split-tone dark R-B | -48.9960 | -21.8069 | -27.1891 | -28.2069..-13.2069 | -20.7891 | FAIL | WATCH | PASS |
| Red accent share | 1.0552 | 2.3938 | -1.3386 | 0.193789..3.19379 | +0.8614 | PASS | PASS | FAIL |

**6/13 shifted PASS, 7 FAIL | 6/13 tolerance PASS, 7 WATCH | 5/13 legacy PASS, 8 FAIL**

### `captures/w0/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6611 | 0.6152 | +0.0459 | 0.506224..0.646224 | -0.0149 | FAIL | PASS | FAIL |
| Luma std | 0.1959 | 0.2946 | -0.0987 | >=0.242584 | -0.0467 | FAIL | WATCH | FAIL |
| Luma p25 | 0.5567 | 0.3710 | +0.1857 | 0.330988..0.420988 | -0.1357 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9459 | 0.9806 | -0.0347 | >=0.9316 | +0.0143 | PASS | PASS | PASS |
| Near-white share | 13.1182 | 34.4913 | -21.3731 | 22.1913..35.1913 | -9.0731 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.4618 | 0.6781 | -0.2163 | <=3.6781 | +3.2163 | PASS | PASS | PASS |
| Saturation | 0.2296 | 0.3000 | -0.0705 | 0.241027..0.321027 | -0.0115 | FAIL | PASS | FAIL |
| Local contrast | 0.1847 | 0.2850 | -0.1003 | >=0.273703 | -0.0890 | FAIL | WATCH | PASS |
| Edge energy | 0.0197 | 0.0194 | +0.0003 | >=0.0132946 | +0.0064 | PASS | PASS | FAIL |
| Sky-blue area | 48.4758 | 43.2583 | +5.2175 | 25.1583..45.1583 | -3.3175 | FAIL | PASS | PASS |
| Top-third contrast | 0.1720 | 0.2433 | -0.0713 | >=0.234796 | -0.0628 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -37.1709 | -21.8069 | -15.3640 | -28.2069..-13.2069 | -8.9640 | FAIL | WATCH | FAIL |
| Red accent share | 0.1811 | 2.3938 | -2.2127 | 0.193789..3.19379 | -0.0127 | FAIL | PASS | FAIL |

**3/13 shifted PASS, 10 FAIL | 7/13 tolerance PASS, 6 WATCH | 5/13 legacy PASS, 8 FAIL**

### `captures/w0/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6357 | 0.6152 | +0.0205 | 0.506224..0.646224 | +0.0105 | PASS | PASS | FAIL |
| Luma std | 0.2313 | 0.2946 | -0.0633 | >=0.242584 | -0.0113 | FAIL | WATCH | PASS |
| Luma p25 | 0.4577 | 0.3710 | +0.0867 | 0.330988..0.420988 | -0.0367 | FAIL | PASS | FAIL |
| Luma p95 | 0.9535 | 0.9806 | -0.0271 | >=0.9316 | +0.0219 | PASS | PASS | PASS |
| Near-white share | 15.3376 | 34.4913 | -19.1538 | 22.1913..35.1913 | -6.8538 | FAIL | WATCH | PASS |
| Deep-shadow share | 0.3191 | 0.6781 | -0.3590 | <=3.6781 | +3.3590 | PASS | PASS | PASS |
| Saturation | 0.2655 | 0.3000 | -0.0346 | 0.241027..0.321027 | +0.0244 | PASS | PASS | FAIL |
| Local contrast | 0.2187 | 0.2850 | -0.0663 | >=0.273703 | -0.0550 | FAIL | WATCH | PASS |
| Edge energy | 0.0255 | 0.0194 | +0.0061 | >=0.0132946 | +0.0122 | PASS | PASS | FAIL |
| Sky-blue area | 50.9533 | 43.2583 | +7.6950 | 25.1583..45.1583 | -5.7950 | FAIL | PASS | PASS |
| Top-third contrast | 0.2065 | 0.2433 | -0.0368 | >=0.234796 | -0.0283 | FAIL | PASS | PASS |
| Split-tone dark R-B | 11.9775 | -21.8069 | +33.7844 | -28.2069..-13.2069 | -25.1844 | FAIL | WATCH | FAIL |
| Red accent share | 1.5228 | 2.3938 | -0.8710 | 0.193789..3.19379 | +1.3290 | PASS | PASS | FAIL |

**6/13 shifted PASS, 7 FAIL | 9/13 tolerance PASS, 4 WATCH | 7/13 legacy PASS, 6 FAIL**

### `captures/w0/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.4803 | 0.6152 | -0.1349 | 0.506224..0.646224 | -0.0259 | FAIL | WATCH | PASS |
| Luma std | 0.2600 | 0.2946 | -0.0345 | >=0.242584 | +0.0175 | PASS | PASS | PASS |
| Luma p25 | 0.2752 | 0.3710 | -0.0958 | 0.330988..0.420988 | -0.0558 | FAIL | PASS | FAIL |
| Luma p95 | 0.9072 | 0.9806 | -0.0734 | >=0.9316 | -0.0244 | FAIL | WATCH | FAIL |
| Near-white share | 5.5999 | 34.4913 | -28.8914 | 22.1913..35.1913 | -16.5914 | FAIL | WATCH | FAIL |
| Deep-shadow share | 3.9686 | 0.6781 | +3.2905 | <=3.6781 | -0.2905 | FAIL | WATCH | PASS |
| Saturation | 0.5008 | 0.3000 | +0.2008 | 0.241027..0.321027 | -0.1798 | FAIL | WATCH | FAIL |
| Local contrast | 0.2481 | 0.2850 | -0.0369 | >=0.273703 | -0.0256 | FAIL | PASS | PASS |
| Edge energy | 0.0268 | 0.0194 | +0.0074 | >=0.0132946 | +0.0135 | PASS | PASS | FAIL |
| Sky-blue area | 65.9077 | 43.2583 | +22.6493 | 25.1583..45.1583 | -20.7493 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.1922 | 0.2433 | -0.0510 | >=0.234796 | -0.0425 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -12.6299 | -21.8069 | +9.1770 | -28.2069..-13.2069 | -0.5770 | FAIL | PASS | FAIL |
| Red accent share | 1.8706 | 2.3938 | -0.5232 | 0.193789..3.19379 | +1.3232 | PASS | PASS | FAIL |

**3/13 shifted PASS, 10 FAIL | 6/13 tolerance PASS, 7 WATCH | 5/13 legacy PASS, 8 FAIL**

