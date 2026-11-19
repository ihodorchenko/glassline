# Round 16 audio evidence — live high-route probe

Captured 2026-11-19 from the running dev build with a trusted click and the game
audio manager's post-limiter analyser:

```bash
node tools/capture/audio-probe.mjs --high-route \
  --json docs/evidence/audio/round-16/live-high-route.json
```

The probe resets the player to the start roof, measures 1.1 s of live ambience,
teleports to the high finish roof, waits 1.4 s, then measures 1.8 s while
triggering metal footsteps and a landing.

| Measurement | Ground | High roof |
|---|---:|---:|
| RMS | 0.0238 | 0.1240 |
| Peak | 0.0930 | 0.6566 |
| Low share | 0.839 | 0.835 |
| Mid share | 0.008 | 0.114 |
| High share | 0.116 | 0.028 |
| Wind gain | 0.0131 | 0.0197 |
| Wind cutoff | 263 Hz | 418 Hz |

The elevated wind gain/cutoff and mid-band metal-footstep energy confirm the
in-engine altitude/metal path. This is an analyser measurement, not a recorded
WAV or human listening verdict. The high segment includes eleven footsteps and
one landing, so RMS/peak are not ambience-only.
