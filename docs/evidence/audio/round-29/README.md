# Round 29 audio evidence — normal-cadence high vs ground

Recorded 2026-11-19 from the live dev build through a trusted click. Both clips
use a normal 650 ms footstep cadence and a final landing, so they are easier to
listen to than the dense Round 28 clip.

```bash
node tools/capture/audio-probe.mjs \
  --record docs/evidence/audio/round-29/high-10s.wav \
  --seconds 10 --cadence 650 --at high \
  --json docs/evidence/audio/round-29/high-10s.json

node tools/capture/audio-probe.mjs \
  --record docs/evidence/audio/round-29/ground-8s.wav \
  --seconds 8 --cadence 650 --at ground \
  --json docs/evidence/audio/round-29/ground-8s.json
```

| Metric | High roof (10.3 s) | Ground (8.3 s) |
|---|---:|---:|
| Peak | −3.70 dBFS | −3.55 dBFS |
| RMS | −23.78 dBFS | −24.74 dBFS |
| LUFS (approx.) | −24.67 | −26.52 |
| Low-band share | 0.867 | 0.952 |
| High-band share | 0.038 | 0.037 |

The high clip is ~1.0 dB louder in RMS (~1.85 LUFS) and has less low-band share,
consistent with altitude wind adding mid/high energy over the ground wind bed.

Files:

- [`high-10s.wav`](high-10s.wav) — high roof, metal steps, wind, music, landing
- [`ground-8s.wav`](ground-8s.wav) — ground concrete steps, wind, music, landing
- [`live-waveforms.png`](live-waveforms.png)
- [`metrics.json`](metrics.json) — RMS/peak/per-second + spectral values
- `high-10s.json`, `ground-8s.json` — probe reports/snapshots

These are real gameplay-output recordings, but the footsteps/landing are
synthetic triggers; a human listening verdict is still required.
