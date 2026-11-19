# Round 31 video evidence — continuous gameplay through the slide tunnel

Captured 2026-11-19 with the input-driven `route-video.mjs` autopilot (injected
held keys + grounded slide timing).

| File | Content |
|---|---|
| [`gameplay-route.mp4`](gameplay-route.mp4) | 9 s, 1280×720/30 fps, start → slide tunnel → lower roof → construction stairs |
| [`gameplay-route.wav`](gameplay-route.wav) | Live post-limiter game audio, no review gain |
| [`poster.jpg`](poster.jpg) | Construction checkpoint/stairs |
| [`start.jpg`](start.jpg) | Start regression (13/13 metrics) |
| [`audio-metrics.json`](audio-metrics.json) | Peak/LUFS/spectral values |

The clip is real input-driven gameplay with HUD and arms, unlike the Round 30
cinematic camera. Audio peak −3.44 dBFS / LUFS ≈ −22.19; the limiter is engaged.

The video documents the Round 31 tunnel fix: the slide tunnel clearance was
raised from 1.05 m to 1.35 m so crouch/slide passes reliably while standing
(1.75 m) still blocks. The autopilot can still stall later on the route; this clip
is trimmed before that point.
