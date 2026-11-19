# Round 30 video evidence — cinematic route overview

Captured 2026-11-19 from the live dev build with `route-video.mjs --cinematic`.

| File | Content |
|---|---|
| [`cinematic-route.mp4`](cinematic-route.mp4) | 17.5 s, 1280×720/30 fps H.264 + AAC |
| [`cinematic-route.wav`](cinematic-route.wav) | Engine ambience extracted, +8 dB for review |
| [`poster.jpg`](poster.jpg) | Catwalk turn frame |
| [`audio-metrics.json`](audio-metrics.json) | Audio analyser values |

The camera follows two shots: start roof → lower service roof → stairs →
skybridge → finish beam, then a cut to the high catwalk turn → finish approach.
HUD and first-person arms are hidden; the audio is the live engine wind/music bed
(no footsteps, since the camera is authored rather than driven by player input).

Audio: peak −9.85 dBFS, LUFS ≈ −24.85 after the +8 dB review gain (raw peak
−17.85, LUFS −32.85). Video: 17.5 s, 30 fps, ~8 MB.

```bash
node tools/capture/route-video.mjs --launch --cinematic \
  --out /tmp/cinematic-route.mp4 --wav /tmp/cinematic-route.wav --seconds 20

# Trim and add review gain:
ffmpeg -y -ss 0 -t 17.5 -i /tmp/cinematic-route.mp4 \
  -c:v libx264 -crf 22 -pix_fmt yuv420p -c:a aac -b:a 160k \
  -af volume=8dB docs/evidence/video/round-30/cinematic-route.mp4
```

This is a **cinematic camera overview**, not a continuous player traversal. The
input-driven gameplay mode of the tool is experimental and can stall at the slide
tunnel.
