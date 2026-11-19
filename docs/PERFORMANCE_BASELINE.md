# Performance baseline — Round 77

Captured on the dev build at the start pose `(0, 0.93, 6)`, 1592×769,
pixelRatio 1.

| Metric | Value |
|---|---:|
| FPS | 60.2 |
| avg frame | 16.6 ms |
| p95 frame | 16.7 ms |
| Draw calls / frame | **1040** |
| Triangles / frame | **3,994,404** |
| Geometries | 111 |
| Textures | 49 |
| Programs | 27 |

Method: set `threeRenderer.info.autoReset = false`, reset, wait two rAF,
read `info`, restore. This counts **all composer/shadow passes**, not just the
main scene, so it is an upper-bound workload indicator.

## Round 78 optimization — static merge

Static boxes are now merged per material into one buffer per material. Same
start pose, same method:

| Metric | Round 77 | Round 78 | Change |
|---|---:|---:|---:|
| Draw calls | 1040 | **488** | −53% |
| Triangles | 3.99M | 4.02M | +0.8% |
| Geometries | 111 | **54** | −51% |
| FPS | 60.2 | 60.3 | — |

The merged mesh loses per-box frustum culling, so triangle count stays flat, but
the call reduction is meaningful for CPU-bound browsers. A full spawn→finish
vehicle run still completed (1 stochastic checkpoint respawn).

## Interpretation

The visual pass (bevels, two-scale triplanar, parallax, puddles, 4K shadows)
still holds 60 fps in this Chromium/SwiftShader environment, but draw calls and
triangles are high for lower-end GPUs and Safari. Next optimization targets:

1. Merge static geometry by material (draw calls).
2. Reduce shadow casters for small props.
3. Consider 2048 shadows on low-power devices.
4. Re-measure Safari once remote automation is enabled.

This is a **baseline**, not a claim of broad performance coverage.
