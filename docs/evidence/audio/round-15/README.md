# Round 15 audio evidence — high-route profile

Rendered 2026-11-19 with:

```bash
npm run audio:render -- --high-route --seconds 14 \
  --out docs/evidence/audio/round-15/high-route.wav
python3 tools/capture/audio-metrics.py \
  --wav docs/evidence/audio/round-15/high-route.wav
```

Profile layers: altitude wind bed with a 6.4–8.3 s lull and 9.2 s gust, metal
catwalk footsteps, jump whoosh, metal landings, cable creak, 58/87 Hz structural
hum, and a low finish boom.

| Metric | Value | Custom band |
|---|---:|---:|
| Low-band share | 0.853 | 0.82–0.92 |
| High-band share | 0.040 | 0.025–0.09 |
| LUFS | −23.86 | −26…−23 |
| Peak | −4.83 dBFS | −6…−3 |
| Per-second RMS range | 24.4 dB | 12–26 |

Per-second RMS falls from ~−21.7 dB to −40.3 dB in the wind lull. This is an
offline synthesized demo, not a live gameplay recording or human listening
verdict. The prologue 24 s render still passes 5/5 reference mix targets.

Files:

- [`high-route.wav`](high-route.wav) — 14 s stereo 48 kHz render
- [`high-route-waveform.png`](high-route-waveform.png) — waveform with 1 s markers
- [`metrics.json`](metrics.json) — values, custom bands, per-second RMS
