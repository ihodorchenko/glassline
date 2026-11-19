# Round 2 audio evidence

Rendered 2026-11-19 with the dev build and the tools in `tools/capture/`.

| File | What it is |
|---|---|
| `mix.wav` | 24 s deterministic offline demo: quiet ambience intro, footsteps across surfaces, jump/landing/vault, slide/wall-run loops, score |
| `waveform.png` | Waveform and log-magnitude spectrogram of `mix.wav` |
| `metrics.json` | Band shares, gated loudness, peak, short-term range, target bands |
| `live-probe.json` | Live post-limiter analyser output and audio graph snapshot after a trusted gesture |
| `reference-prologue.json` | Reference Prologue 500–800 s segment measured by the same script (derived from local `ref/` audio, not redistributed) |

## Commands

```bash
npm run dev -- --port 5199 --host 127.0.0.1
# Browser with CDP on port 9222 (see ../../../tools/capture/README.md)

npm run audio:render -- --out docs/evidence/audio/round-2/mix.wav --seconds 24
npm run audio:metrics -- --wav docs/evidence/audio/round-2/mix.wav \
  --json docs/evidence/audio/round-2/metrics.json
npm run audio:probe -- --json docs/evidence/audio/round-2/live-probe.json
```

## Result

The demo passes all five planned audio bands:

| Metric | Demo | Reference segment | Target |
|---|---:|---:|---:|
| Energy < 500 Hz | 0.896 | 0.909 | 0.85–0.94 |
| Energy > 2 kHz | 0.060 | 0.026 | 0.03–0.08 |
| Gated loudness | −26.0 LUFS | −26.6 LUFS | −31…−26 |
| Sample peak | −5.26 dBFS | −1.94 dBFS | ≤ −3 dBFS |
| Short-term p95−p5 | 22.9 dB | 12.9 dB | 18–26 dB |

The live probe peaks at −3.7 dBFS after the limiter with a deterministic
footstep/landing stress sequence, the audio context is running, three ambience
sources and the score are active, and no console errors were recorded.

These are engineering measurements, not a listening verdict. The next pass
should audition the mix on headphones and ordinary desktop speakers.
