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
| Luma mean | 0.7602 | 0.6152 | +0.1450 | 0.506224..0.646224 | -0.1140 | FAIL | WATCH | FAIL |
| Luma std | 0.2028 | 0.2946 | -0.0918 | >=0.242584 | -0.0398 | FAIL | WATCH | FAIL |
| Luma p25 | 0.6549 | 0.3710 | +0.2839 | 0.330988..0.420988 | -0.2339 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9621 | 0.9806 | -0.0185 | >=0.9316 | +0.0305 | PASS | PASS | PASS |
| Near-white share | 30.7263 | 34.4913 | -3.7651 | 22.1913..35.1913 | +4.4651 | PASS | PASS | FAIL |
| Deep-shadow share | 0.5785 | 0.6781 | -0.0996 | <=3.6781 | +3.0996 | PASS | PASS | PASS |
| Saturation | 0.1551 | 0.3000 | -0.1449 | 0.241027..0.321027 | -0.0859 | FAIL | WATCH | FAIL |
| Local contrast | 0.1957 | 0.2850 | -0.0893 | >=0.273703 | -0.0780 | FAIL | WATCH | PASS |
| Edge energy | 0.0167 | 0.0194 | -0.0027 | >=0.0132946 | +0.0034 | PASS | PASS | FAIL |
| Sky-blue area | 38.9920 | 43.2583 | -4.2664 | 25.1583..45.1583 | +6.1664 | PASS | PASS | PASS |
| Top-third contrast | 0.1872 | 0.2433 | -0.0561 | >=0.234796 | -0.0476 | FAIL | WATCH | PASS |
| Split-tone dark R-B | 61.2917 | -21.8069 | +83.0986 | -28.2069..-13.2069 | -74.4986 | FAIL | WATCH | FAIL |
| Red accent share | 1.6865 | 2.3938 | -0.7073 | 0.193789..3.19379 | +1.4927 | PASS | PASS | FAIL |

**6/13 shifted PASS, 7 FAIL | 6/13 tolerance PASS, 7 WATCH | 5/13 legacy PASS, 8 FAIL**

### `captures/w0/first-gap.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6355 | 0.6152 | +0.0202 | 0.506224..0.646224 | +0.0108 | PASS | PASS | FAIL |
| Luma std | 0.2199 | 0.2946 | -0.0747 | >=0.242584 | -0.0227 | FAIL | WATCH | FAIL |
| Luma p25 | 0.4953 | 0.3710 | +0.1243 | 0.330988..0.420988 | -0.0743 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9462 | 0.9806 | -0.0344 | >=0.9316 | +0.0146 | PASS | PASS | PASS |
| Near-white share | 14.3619 | 34.4913 | -20.1295 | 22.1913..35.1913 | -7.8295 | FAIL | WATCH | FAIL |
| Deep-shadow share | 0.5243 | 0.6781 | -0.1538 | <=3.6781 | +3.1538 | PASS | PASS | PASS |
| Saturation | 0.2339 | 0.3000 | -0.0661 | 0.241027..0.321027 | -0.0071 | FAIL | PASS | FAIL |
| Local contrast | 0.2038 | 0.2850 | -0.0812 | >=0.273703 | -0.0699 | FAIL | WATCH | PASS |
| Edge energy | 0.0278 | 0.0194 | +0.0084 | >=0.0132946 | +0.0145 | PASS | PASS | FAIL |
| Sky-blue area | 39.6670 | 43.2583 | -3.5913 | 25.1583..45.1583 | +5.4913 | PASS | PASS | PASS |
| Top-third contrast | 0.2087 | 0.2433 | -0.0346 | >=0.234796 | -0.0261 | FAIL | PASS | PASS |
| Split-tone dark R-B | -4.5703 | -21.8069 | +17.2366 | -28.2069..-13.2069 | -8.6366 | FAIL | WATCH | FAIL |
| Red accent share | 0.9290 | 2.3938 | -1.4648 | 0.193789..3.19379 | +0.7352 | PASS | PASS | FAIL |

**6/13 shifted PASS, 7 FAIL | 8/13 tolerance PASS, 5 WATCH | 5/13 legacy PASS, 8 FAIL**

### `captures/w0/service-block.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.6046 | 0.6152 | -0.0106 | 0.506224..0.646224 | +0.0416 | PASS | PASS | PASS |
| Luma std | 0.2906 | 0.2946 | -0.0040 | >=0.242584 | +0.0480 | PASS | PASS | PASS |
| Luma p25 | 0.3206 | 0.3710 | -0.0504 | 0.330988..0.420988 | -0.0104 | FAIL | PASS | FAIL |
| Luma p95 | 0.9700 | 0.9806 | -0.0106 | >=0.9316 | +0.0384 | PASS | PASS | PASS |
| Near-white share | 18.6566 | 34.4913 | -15.8347 | 22.1913..35.1913 | -3.5347 | FAIL | PASS | PASS |
| Deep-shadow share | 2.9018 | 0.6781 | +2.2237 | <=3.6781 | +0.7763 | PASS | PASS | PASS |
| Saturation | 0.2805 | 0.3000 | -0.0195 | 0.241027..0.321027 | +0.0395 | PASS | PASS | FAIL |
| Local contrast | 0.2849 | 0.2850 | -0.0001 | >=0.273703 | +0.0112 | PASS | PASS | PASS |
| Edge energy | 0.0255 | 0.0194 | +0.0061 | >=0.0132946 | +0.0122 | PASS | PASS | FAIL |
| Sky-blue area | 2.7174 | 43.2583 | -40.5409 | 25.1583..45.1583 | -22.4409 | FAIL | WATCH | FAIL |
| Top-third contrast | 0.2326 | 0.2433 | -0.0107 | >=0.234796 | -0.0022 | FAIL | PASS | PASS |
| Split-tone dark R-B | -65.4001 | -21.8069 | -43.5932 | -28.2069..-13.2069 | -37.1932 | FAIL | WATCH | FAIL |
| Red accent share | 1.8256 | 2.3938 | -0.5682 | 0.193789..3.19379 | +1.3682 | PASS | PASS | FAIL |

**8/13 shifted PASS, 5 FAIL | 11/13 tolerance PASS, 2 WATCH | 7/13 legacy PASS, 6 FAIL**

### `captures/w0/skybridge.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5609 | 0.6152 | -0.0543 | 0.506224..0.646224 | +0.0547 | PASS | PASS | PASS |
| Luma std | 0.2456 | 0.2946 | -0.0490 | >=0.242584 | +0.0030 | PASS | PASS | PASS |
| Luma p25 | 0.3625 | 0.3710 | -0.0085 | 0.330988..0.420988 | +0.0315 | PASS | PASS | PASS |
| Luma p95 | 0.9462 | 0.9806 | -0.0344 | >=0.9316 | +0.0146 | PASS | PASS | PASS |
| Near-white share | 10.8926 | 34.4913 | -23.5988 | 22.1913..35.1913 | -11.2988 | FAIL | WATCH | FAIL |
| Deep-shadow share | 1.4448 | 0.6781 | +0.7667 | <=3.6781 | +2.2333 | PASS | PASS | PASS |
| Saturation | 0.3877 | 0.3000 | +0.0876 | 0.241027..0.321027 | -0.0666 | FAIL | WATCH | FAIL |
| Local contrast | 0.2346 | 0.2850 | -0.0504 | >=0.273703 | -0.0391 | FAIL | WATCH | PASS |
| Edge energy | 0.0213 | 0.0194 | +0.0019 | >=0.0132946 | +0.0080 | PASS | PASS | FAIL |
| Sky-blue area | 54.1912 | 43.2583 | +10.9329 | 25.1583..45.1583 | -9.0329 | FAIL | PASS | PASS |
| Top-third contrast | 0.1663 | 0.2433 | -0.0770 | >=0.234796 | -0.0685 | FAIL | WATCH | PASS |
| Split-tone dark R-B | -66.4513 | -21.8069 | -44.6444 | -28.2069..-13.2069 | -38.2444 | FAIL | WATCH | FAIL |
| Red accent share | 0.6208 | 2.3938 | -1.7730 | 0.193789..3.19379 | +0.4270 | PASS | PASS | FAIL |

**7/13 shifted PASS, 6 FAIL | 8/13 tolerance PASS, 5 WATCH | 8/13 legacy PASS, 5 FAIL**

### `captures/w0/start-roof.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.7003 | 0.6152 | +0.0851 | 0.506224..0.646224 | -0.0541 | FAIL | WATCH | FAIL |
| Luma std | 0.2243 | 0.2946 | -0.0703 | >=0.242584 | -0.0183 | FAIL | WATCH | PASS |
| Luma p25 | 0.5535 | 0.3710 | +0.1825 | 0.330988..0.420988 | -0.1325 | FAIL | WATCH | FAIL |
| Luma p95 | 0.9689 | 0.9806 | -0.0117 | >=0.9316 | +0.0373 | PASS | PASS | PASS |
| Near-white share | 25.5177 | 34.4913 | -8.9736 | 22.1913..35.1913 | +3.3264 | PASS | PASS | PASS |
| Deep-shadow share | 0.5193 | 0.6781 | -0.1588 | <=3.6781 | +3.1588 | PASS | PASS | PASS |
| Saturation | 0.2039 | 0.3000 | -0.0962 | 0.241027..0.321027 | -0.0372 | FAIL | WATCH | FAIL |
| Local contrast | 0.2105 | 0.2850 | -0.0745 | >=0.273703 | -0.0632 | FAIL | WATCH | PASS |
| Edge energy | 0.0258 | 0.0194 | +0.0065 | >=0.0132946 | +0.0126 | PASS | PASS | FAIL |
| Sky-blue area | 37.3800 | 43.2583 | -5.8783 | 25.1583..45.1583 | +7.7783 | PASS | PASS | PASS |
| Top-third contrast | 0.1873 | 0.2433 | -0.0560 | >=0.234796 | -0.0475 | FAIL | WATCH | PASS |
| Split-tone dark R-B | 31.7459 | -21.8069 | +53.5528 | -28.2069..-13.2069 | -44.9528 | FAIL | WATCH | FAIL |
| Red accent share | 1.6242 | 2.3938 | -0.7696 | 0.193789..3.19379 | +1.4304 | PASS | PASS | FAIL |

**6/13 shifted PASS, 7 FAIL | 6/13 tolerance PASS, 7 WATCH | 7/13 legacy PASS, 6 FAIL**

### `captures/w0/wallrun-corridor.png`

| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |
|---|---:|---:|---:|---|---:|:---:|:---:|:---:|
| Luma mean | 0.5926 | 0.6152 | -0.0227 | 0.506224..0.646224 | +0.0537 | PASS | PASS | PASS |
| Luma std | 0.2735 | 0.2946 | -0.0211 | >=0.242584 | +0.0309 | PASS | PASS | PASS |
| Luma p25 | 0.3159 | 0.3710 | -0.0551 | 0.330988..0.420988 | -0.0151 | FAIL | PASS | FAIL |
| Luma p95 | 0.9495 | 0.9806 | -0.0311 | >=0.9316 | +0.0179 | PASS | PASS | PASS |
| Near-white share | 17.3013 | 34.4913 | -17.1900 | 22.1913..35.1913 | -4.8900 | FAIL | PASS | PASS |
| Deep-shadow share | 2.0289 | 0.6781 | +1.3508 | <=3.6781 | +1.6492 | PASS | PASS | PASS |
| Saturation | 0.3650 | 0.3000 | +0.0650 | 0.241027..0.321027 | -0.0440 | FAIL | PASS | PASS |
| Local contrast | 0.2640 | 0.2850 | -0.0210 | >=0.273703 | -0.0097 | FAIL | PASS | PASS |
| Edge energy | 0.0247 | 0.0194 | +0.0054 | >=0.0132946 | +0.0115 | PASS | PASS | FAIL |
| Sky-blue area | 50.0275 | 43.2583 | +6.7692 | 25.1583..45.1583 | -4.8692 | FAIL | PASS | PASS |
| Top-third contrast | 0.2207 | 0.2433 | -0.0226 | >=0.234796 | -0.0141 | FAIL | PASS | PASS |
| Split-tone dark R-B | -26.8415 | -21.8069 | -5.0346 | -28.2069..-13.2069 | +1.3654 | PASS | PASS | FAIL |
| Red accent share | 1.6881 | 2.3938 | -0.7057 | 0.193789..3.19379 | +1.4943 | PASS | PASS | FAIL |

**7/13 shifted PASS, 6 FAIL | 13/13 tolerance PASS, 0 WATCH | 9/13 legacy PASS, 4 FAIL**

