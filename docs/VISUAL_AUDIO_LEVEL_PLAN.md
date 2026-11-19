# Visual, Audio and Level Design Pass — Working Plan

> **Status update (2026-11-19):** Round 1 of this plan is committed — W0
> capture/metrics tooling, W1 HDR look foundation, part of W2 (materials, city,
> props), and the first-person body. Round 2 adds the W4 audio foundation:
> buses/limiter/reverb, surface-aware footsteps, parkour set, ambience, score,
> radio, offline render and metrics (5/5 audio targets). See
> [`VISUAL_REFERENCE_PROGRESS.md`](VISUAL_REFERENCE_PROGRESS.md) for measurements
> and evidence. Round 3 advances W3: the Prologue now has a roof drop, sprint
> gap, stair climb, narrow skybridge, and finish roof (~66 m / 5.1 m vertical).
> W3 is still open — the 180–220 m / 8 m target is not met. Round 4 applies the
> reference's paper/ink UI, canvas signage, and speed blur (part of W1/W5). A
> listening pass, menu backdrop, and further W1/W2 polish remain. The plan's anti-hack rule is honored: the
> hard highlight clip was replaced by a gentler shoulder; the remaining
> near-white/highlight gap is assigned to real lighting and content.

**Status:** Draft for owner approval (W0–W2 partially executed, W4 foundation landed)
**Date:** 2026-11-19
**Scope:** Prologue route and Training arenas, renderer/post-processing, materials and city content, audio mix.
**Non-goals:** new gameplay mechanics, new engine/renderer framework, online features, deferred traversal moves.

This plan is the operating contract for the art/audio/level pass. It does not
override the authoritative specifications in `docs/`; it sequences the work of
closing the gap between the current build and the reference prologue footage in
`ref/reference/prolog-kit`.

---

## 0. Snapshot at planning time

| Area | Fact |
|---|---|
| Git | `main`, Round 1 committed (HDR post chain, sky dome, material library, viewmodel, procedural city, content loader rework, capture/metrics tooling) |
| Verification | `npm run typecheck` PASS; `npm test` 250/250 PASS across 34 files |
| Renderer | WebGL2 HDR + `EffectComposer`: GTAO, UnrealBloom, custom ACES grade (vignette, grain, CA), PMREM sky IBL, PCF soft sun shadows. No volumetrics, no calibrated exposure, no quality tiers |
| Materials | `MaterialLibrary` (procedural PBR, triplanar) landed and measured on the start frame |
| Audio | Round 2: six-bus graph + limiter/reverb, procedural noise bank, surface-aware footsteps/landings, parkour one-shots and loops, three-layer ambience, sparse score, radio/ducking. No spatial emitters or speech |
| Level | Prologue colliders: upper roof (y 0) → lower service roof (y −3) → 2.4 m gap → 15-step climb → 3.4 m skybridge (y −0.9) → finish roof (z −62). Five sections/checkpoints preserved; ~66 m and 5.1 m vertical, still short of 180–220 m / 8 m |
| Reference | `ref/reference/prolog-kit`: 827 s video, 829 frames, 24 contact sheets, `shots.csv` (luma/motion per shot), `audio/segments.json` (band shares, LUFS), `study/` grouped by segment |

Baseline is green, so this pass starts from a working tree, not a repair job.

---

## 1. Definition of done

"Done to reference" means three independent axes pass. A pass in one axis does
not compensate for another.

1. **Image** — measured metric bands on six fixed capture points, plus a blind
   review pass by the art director.
2. **Level** — a Prologue route that plays like the reference prologue and is
   geometrically legal for our movement budget.
3. **Audio** — a layered mix that matches the reference band/loudness profile
   and does not clip.

Explicit anti-rule: a metric must not be satisfied by a rendering hack that
looks worse. The current "clip highlights to white" grade step is an example of
what must be replaced by real exposure, lighting and content.

---

## 2. Acceptance bands

### 2.1 Image (measured on the same script for reference frames and our captures)

| Metric | Reference | Target |
|---|---:|---|
| Luma mean | 0.589 | 0.48 – 0.62 |
| Luma std | 0.272 | ≥ 0.22 |
| Luma p25 | 0.370 | 0.33 – 0.42 |
| Luma p95 | 0.979 | ≥ 0.93 |
| Near-white share | 27.3 % | 15 – 28 % |
| Deep-shadow share | 3.0 % | ≤ 6 % |
| Saturation | 0.359 | 0.30 – 0.38 |
| Local contrast | 0.0713 | ≥ 0.060 |
| Edge energy | 0.0341 | ≥ 0.028 |
| Sky-blue area | 53.1 % | 35 – 55 % |
| Top-third contrast | 0.0585 | ≥ 0.050 |
| Split-tone dark R−B | −48.6 | −55 … −40 |
| Red accent share | 4.2 % | 2.0 – 5.0 % |

Plus: 4 of 6 fixed shots blind-`PASS` from the art director against their
reference counterpart, and no shot may regress more than one band to gain another.

### 2.2 Audio

| Metric | Reference | Target |
|---|---:|---|
| Energy < 500 Hz | 0.894 | 0.85 – 0.94 |
| Energy > 2 kHz | 0.056 | 0.03 – 0.08 |
| Integrated loudness | −28.4 LUFS | −31 … −26 LUFS |
| Peak | −2.86 dBFS | ≤ −3 dBFS sample peak, no limiter pumping |
| Short-term range | ~22 dB | 18 – 26 dB |

Plus: the six required layers are audible and separable in a listening pass —
wind, city bed, surface footsteps, parkour set, music bed, radio.

### 2.3 Level

- Route length **180 – 220 m**, five sections, ≥ 8 m total vertical delta.
- First-time completion **2 – 3 min**; familiar **1 – 2 min** (spec 06 §14.2).
- Five checkpoints + finish, all section transitions automatic.
- No soft-lock, no unreachable gap, no route-critical geometry hidden by decoration.
- `validateLevelDefinition` passes; Prologue start-to-finish integration test still passes.
- Every traversal beat sits inside the budget in §4.

---

## 3. Reference beats to reproduce

Story beats from `prolog-kit/study` and `shots.csv` that define the prologue
identity (not the exact layout):

1. Open white rooftop, city canyon on one side, large sky.
2. Short acceleration run into a readable first gap.
3. Wall-run along a glass facade, then a wall-jump to a higher ledge.
4. Drop into a covered service/industrial block, slide under a low duct.
5. Scaffold climb / construction section with a visible vertical chain.
6. Skybridge crossing with a long sightline to the finish.
7. Finish platform with a clean silhouette and a single red marker.

---

## 4. Traversal budget (from `MovementTuning` defaults)

| Move | Parameter | Practical limit |
|---|---|---|
| Jump height | `jumpHeight: 1.25`, `gravity: 22` | ledge up ≤ 1.05 m |
| Sprint gap | `sprintSpeed: 8.5`, airtime ≈ 0.67 s | gap ≤ 5.0 m (5.7 m theoretical) |
| Run gap | `runSpeed: 6.0` | gap ≤ 3.2 m |
| Walk gap | `walkSpeed: 3.5` | gap ≤ 1.8 m |
| Vault | `vaultMinHeight 0.35` / `vaultMaxHeight 1.15` | obstacle 0.35 – 1.15 m |
| Slide clearance | `slideHeight: 0.9` | duct 0.95 – 1.15 m |
| Wall-run span | `wallRunMinSpeed 5`, `wallRunMaxDuration 1.5` | 6 – 10 m |
| Step-up | `maxStepHeight: 0.3` | ≤ 0.3 m without jump |

The first executor task is to verify these limits with a headless movement
probe rather than trusting the table.

---

## 5. Team and roles

| Role | Who | Decides | Produces | Never does |
|---|---|---|---|---|
| Orchestrator | Lead (this session) | sequencing, task cards, acceptance, integration, commits, final verification | plans, briefs, verdicts, diffs review | paints/polishes art or levels directly |
| Art director | Qwen-Max (QwenCloud) | look, palette, material recipes, asset specs, blind review verdicts | art briefs, numeric targets, image-gen prompts, per-shot PASS/FAIL with 3 fixes | writes code, edits files, runs builds |
| Executor | DeepSeek-V4.1-Flash subagents | implementation details inside the card | code, tests, captures, measurement tables, evidence | changes art direction, expands scope, touches files outside the card |
| Asset generator | Qwen-Image / Wan (QwenCloud) | — | texture atlases, decals, sky plates, reference-conditioned variants | ships assets without art-director approval |

### 5.1 Operating protocol

1. **Task card** per increment: id, goal, files owned, files off-limits, acceptance check,
   required evidence (command output, capture paths, numbers).
2. **One writer per file per iteration.** Parallel executors never share a file.
3. **Evidence or it did not happen.** Every card returns commands run and their output.
4. **Blind review.** The art director gets our shot and the reference shot without labels
   or commentary, and answers: PASS/FAIL, three deviations, three concrete fixes.
5. **No silent decisions.** Design or contract changes go to the lead; the lead records them
   in `docs/reports/DECISIONS.md` with a one-line rationale.
6. **Bounded iterations.** Each workstream gets at most 3 review iterations before the lead
   escalates to the owner.

---

## 6. Workstreams

### W0 — Measurement harness (prerequisite for everything)

- Dev-only capture boot: `?capture=1&level=prologue&view=<id>` that skips menus, disables
  the HUD for clean shots, freezes time-of-day, and exposes a deterministic camera pose list.
- `tools/capture.*`: boot Vite, drive Edge, save 1600×900 PNGs to `captures/<iteration>/`.
- `tools/metrics.py` (bundled Python + numpy/PIL): the metric table in §2.1, computed
  identically for `prolog-kit/frames` and our shots.
- `tools/audio_render.*` + `tools/audio_metrics.py`: render a scripted 60 s gameplay mix
  through the Audio System, export WAV, measure LUFS/bands/peak.
- `docs/reports/BASELINE.md`: current numbers, six images, gap per metric.

**Exit:** baseline report with real numbers; reference bands recomputed by our own script.

### W1 — Look foundation

Exposure and white balance calibration; PCSS/soft shadows; PMREM sky IBL; cumulus sky
layer and horizon haze; grade rework (remove the white-clip hack, match split tone and
saturation); AO and bloom tuning; AA; quality tiers and dynamic resolution; frame budget
overlay.

**Exit:** §2.1 bands on 4/6 shots, art-director blind PASS, ≥ 55 fps at 1600×900 high on
this machine.

### W2 — Materials and content language

Atlas quality (concrete, white paint, glass, steel, asphalt) with normal/roughness;
world-space and triplanar UVs; red route language; prop kit (vents, pipes, railings,
stairs, scaffolding, skylights, antennas); facade generator with window bands and
setbacks; near-canyon buildings; instancing and material pooling.

**Exit:** frame density without frame-rate loss; near-white share in band; art-director PASS
on canyon and rooftop shots.

### W3 — Level design

Route rebuild from the reference beats: 180–220 m, five sections, vertical delta, checkpoints
at transitions, finish. Content representation extended only as far as the Level Definition
contracts allow; Level Design owns geometry and metadata, other systems keep ownership.
Training arena polish second.

**Exit:** §2.3 satisfied, route playable in-browser, validator and integration tests green,
timed run inside target.

### W4 — Audio

Bus structure (music/ambience/sfx/ui), reverb send, compressor/limiter, ducking; wind and
city ambience layers with height/interior crossfades; surface-aware layered footsteps;
jump/land/slide/vault/wallrun set; sparse score with intensity following motion; radio cue.
Settings and localization updated for new channels.

**Exit:** §2.2 satisfied; layers demonstrably separable; no clipping; settings UI works.

### W5 — Integration and release hygiene

Typecheck/lint/test/build, perf pass, accessibility (motion/grain/audio-reactivity toggles),
documentation updates, `IMPLEMENTATION_STATUS.md`, final captures, commit series.

---

## 7. Gates

| Gate | Contents | Blocking check |
|---|---|---|
| G0 | W0 harness + baseline | Baseline report with numbers and images |
| G1 | W1 look foundation | §2.1 bands on 4/6 shots; blind PASS; fps |
| G2 | W2 content language | art-director PASS on canyon/rooftop; perf stable |
| G3 | W3 route | §2.3; playable start → finish; tests green |
| G4 | W4 audio | §2.2; listening pass |
| G5 | W5 polish | `npm run validate` green; docs current |

Iteration loop per gate: brief → execute → capture → measure → blind review →
lead verdict → next card. A gate closes only with evidence attached.

---

## 8. Branch and documentation policy

- All work on `feat/art-audio-level`, branched from current `main`; the uncommitted
  WIP is committed first as a single checkpoint commit.
- One logical commit per task card; no mixed art/code commits.
- `docs/reports/` holds baseline, iteration captures index, decisions, and gate sign-offs.
- `IMPLEMENTATION_STATUS.md` is updated at each gate, not at the end.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| No Qwen API access | art director role cannot run | resolve before W1; fallback = lead acts as art director with reference metrics (weaker, explicit downgrade) |
| Metric gaming | numbers pass, image does not | blind review is a gate, not a report; hack removal is an explicit check |
| Route work larger than estimated | G3 slips | land W1/W2 first; route is authored incrementally section by section |
| Physics/geometry mismatch | unreachable jumps, soft-locks | traversal probe in W0; validator + reachability test per section |
| Post-processing cost | frame rate regression | quality tiers + dynamic resolution; perf budget per gate |
| Licensing | cannot ship | reference metrics and MIT content design only; no Saltline engine code |

### 9.1 Harness wiring (verified 2026-11-19)

- Qwen4 Max is installed in this DSH profile as provider `qwen-token-plan`, model `qwen4-max`
  (1M context, text + image input, reasoning efforts `low | medium | xhigh`).
- Cross-provider delegation is gated by a session-level allowlist that the Host records
  **only when a top-level session is created**. Enable *Plugins → Subagent → Model selection*
  (add `qwen-token-plan / qwen4-max`) and start a fresh session in this workspace; the
  current session cannot be upgraded retroactively.
- Qwen4 Max is a text/vision model. It writes art direction, specs and review verdicts, and
  reads our captures. Pixel generation needs either procedural code (preferred: the asset
  bible is procedural-first) or a QwenCloud image key, which is not configured.

---

## 10. Open decisions for the owner

1. Qwen access path: QwenCloud API key (which plan/model id) versus local Qwen CLI session.
2. Fidelity target: reference *language* (palette, composition, beats) versus close copy of
   specific frames.
3. Scope: Prologue only, or Prologue plus Training arenas.
4. ~~Permission to commit the current WIP~~ — Round 1 was committed on `main`; capture
   uses CDP directly with no new dependency.
