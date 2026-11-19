# Round 28 audio evidence — live in-engine recording

Recorded 2026-11-19 from the running dev build in headless Edge through a
trusted click, tapping the post-limiter master with a ScriptProcessor:

```bash
node tools/capture/audio-probe.mjs \
  --record docs/evidence/audio/round-28/live-high-route.wav \
  --seconds 6 \
  --json docs/evidence/audio/round-28/live-high-route.json
```

The player is teleported to the high finish roof; the recording captures
altitude wind, metal catwalk footsteps every 320 ms, a metal landing at the end,
and the active music bed.

| Metric | Value |
|---|---:|
| Sample rate / channels | 44100 Hz / stereo |
| Duration | 6.32 s |
| Peak | −3.65 dBFS |
| LUFS (approx.) | −22.15 |
| Low-band share | 0.863 |
| High-band share | 0.034 |
| Per-second RMS range | 5.1 dB |

Files:

- [`live-high-route.wav`](live-high-route.wav) — actual in-engine stereo WAV
- [`live-high-route-waveform.png`](live-high-route-waveform.png)
- [`metrics.json`](metrics.json) — values, per-second RMS
- [`live-high-route.json`](live-high-route.json) — probe report/snapshot

This is a real gameplay-output recording, but it still needs a human listening
verdict; the short 6 s clip is intentionally dense and loud.
