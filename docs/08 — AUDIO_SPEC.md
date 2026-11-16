# 08_AUDIO_DESIGN_SPEC.md

**Project:** MIRROR'S EDGE — RUNNER PROTOCOL  
**Document:** Audio Design Specification  
**Version:** 1.0  
**Status:** Design Specification

---

# 1. Purpose

This document defines the audio design, procedural sound generation, audio architecture, and integration requirements for the game.

The audio system must support:

- Player movement and parkour feedback.
- Environmental atmosphere.
- Surface-dependent sound variation.
- Spatial audio.
- Dynamic sound behavior based on player state and movement speed.
- UI feedback.
- Radio communication and short voice-like signals.
- Performance-conscious procedural sound generation.

The audio implementation must integrate with the existing game architecture without coupling audio logic directly to rendering or physics internals.

## 1.1 Core Principle

**All game audio assets must be generated procedurally at runtime or generated programmatically during initialization.**

Do not download, import, or depend on external game sound assets.

Allowed technologies:

- Web Audio API.
- OscillatorNode.
- AudioBuffer and AudioBufferSourceNode.
- GainNode.
- BiquadFilterNode.
- WaveShaperNode.
- DelayNode.
- StereoPannerNode.
- PannerNode.
- ConvolverNode with procedurally generated impulse responses.
- AudioWorklet where genuinely necessary.
- Typed arrays for generating audio buffers.

Do not introduce an external audio engine unless explicitly approved.

---

# 2. Audio Design Principles

## 2.1 Functional Feedback

Audio must communicate gameplay information.

Examples:

- Footsteps communicate running rhythm and surface type.
- Landing sounds communicate impact intensity.
- Sliding sounds communicate contact with the ground.
- Wallrun sounds communicate sustained contact with a wall.
- Metal impacts communicate contact with metal structures.
- Zipline sounds communicate movement along a cable.
- UI sounds confirm interactions and state changes.

Sound must reinforce gameplay rather than obscure important information.

## 2.2 Minimalist Presentation

The project follows a minimalist visual identity inspired by Mirror's Edge.

Audio should follow the same direction:

- Clean and restrained.
- Primarily environmental and mechanical.
- No unnecessary musical layers.
- No excessive cinematic effects.
- Short and readable UI feedback.
- Strong contrast between quiet movement and significant actions.

## 2.3 Dynamic Audio

Sound parameters should react to gameplay.

Examples:

- Footstep intensity increases with movement speed.
- Landing intensity depends on impact velocity.
- Wind becomes stronger at higher speeds.
- Slide noise depends on speed and surface.
- Wallrun sound remains active only while wall contact is valid.
- Metal impacts vary according to impact strength.

Avoid playing fixed-volume sounds for every event.

## 2.4 Audio Must Never Control Gameplay

Audio is a presentation system.

It must not:

- Modify player velocity.
- Change physics parameters.
- Determine gameplay state.
- Delay gameplay transitions.
- Block input.
- Control checkpoint or timer logic.

Gameplay events drive audio, never the opposite.

---

# 3. Audio Architecture

## 3.1 Proposed Directory Structure

```text
src/audio/
  AudioManager.ts
  AudioContextManager.ts
  AudioSettings.ts

  core/
    AudioBus.ts
    AudioEvent.ts
    AudioEventDispatcher.ts
    AudioSourcePool.ts
    AudioBufferCache.ts
    AudioEnvelope.ts
    AudioMath.ts

  synthesis/
    NoiseGenerator.ts
    OscillatorSynth.ts
    ImpactSynth.ts
    FootstepSynth.ts
    WindSynth.ts
    UiSynth.ts
    RadioSynth.ts
    ZiplineSynth.ts

  spatial/
    AudioListenerController.ts
    SpatialAudioSource.ts

  environment/
    AmbientAudioController.ts
    WindController.ts
    CityAmbienceController.ts

  gameplay/
    PlayerAudioController.ts
    FootstepController.ts
    MovementAudioController.ts
    ParkourAudioController.ts

  data/
    SoundPresets.ts
    SurfaceAudioPresets.ts
    AudioConstants.ts

  types/
    AudioTypes.ts
```

This is a proposed structure. Implement modules incrementally and avoid creating empty classes without a concrete purpose.

## 3.2 Main Components

### AudioManager

Central entry point for audio functionality.

Responsibilities:

- Own and coordinate the audio subsystem.
- Initialize the audio context.
- Manage audio buses.
- Receive and dispatch audio events.
- Manage master volume and mute state.
- Coordinate global audio lifecycle.
- Dispose audio resources during shutdown.

AudioManager must not contain individual sound synthesis algorithms.

### AudioContextManager

Responsibilities:

- Create and own the AudioContext.
- Handle browser autoplay restrictions.
- Resume the context after a valid user gesture.
- Suspend the context when appropriate.
- Expose the current context state.
- Handle initialization failures.

Do not create multiple AudioContext instances without a clear architectural reason.

### AudioBus

Represents a logical audio channel.

Required buses:

- Master.
- Environment.
- Player.
- Movement.
- Parkour.
- UI.
- Radio.

The exact hierarchy may be adjusted during implementation.

Example:

```text
AudioContext.destination
  |
  Master Gain
  |
  +-- Environment Gain
  |
  +-- Player Gain
  |     |
  |     +-- Movement Gain
  |     |
  |     +-- Parkour Gain
  |
  +-- UI Gain
  |
  +-- Radio Gain
```

Every bus must support independent volume control.

### PlayerAudioController

Responsible for player-related audio.

Responsibilities:

- Footstep scheduling.
- Landing sounds.
- Movement sounds.
- Slide sounds.
- Vault sounds.
- Wallrun sounds.
- Climbing sounds.
- Balance and zipline sounds.

It consumes player state and typed gameplay events.

It must not inspect Rapier internals directly.

### AmbientAudioController

Responsible for environmental sound.

Responsibilities:

- Wind ambience.
- Distant city ambience.
- Rooftop atmosphere.
- Environmental transitions.
- Ambient audio lifecycle.

Ambient audio must be lightweight and must not require a continuously growing number of audio nodes.

---

# 4. Audio Context Lifecycle

## 4.1 Browser Autoplay Restrictions

Browsers may prevent AudioContext playback before a user interaction.

The application must not assume that audio starts automatically.

Recommended initialization:

1. Create the AudioContext during application initialization or at the first audio initialization request.
2. Build the required audio routing graph.
3. Wait for a user gesture.
4. Call `AudioContext.resume()` from that user gesture.
5. Start gameplay audio only when the context is running.

The first valid interaction may be:

- Start Run.
- Start Training.
- A dedicated enable-audio interaction if necessary.

Do not make a failed initial playback attempt a fatal application error.

## 4.2 Context State

Handle the following states:

- `suspended`
- `running`
- `closed`

Audio must degrade gracefully when the context is unavailable.

When the context is suspended:

- Stop or pause continuous audio controllers.
- Do not create unnecessary audio sources.
- Preserve gameplay behavior.
- Resume audio when the browser permits it.

## 4.3 Pause and Resume

When gameplay is paused:

- Stop gameplay-specific continuous sounds.
- Pause or reduce environmental activity according to the desired presentation.
- Prevent footstep scheduling.
- Stop zipline and wallrun loops.
- Keep UI audio available if the context is running.

When gameplay resumes:

- Restore appropriate continuous sounds.
- Recalculate parameters from the current player state.
- Do not blindly restart sounds that are no longer valid.

## 4.4 Tab Visibility

When the document becomes hidden:

- Avoid unnecessary audio processing.
- Suspend or reduce ambient audio when appropriate.
- Do not allow stale movement loops to continue indefinitely.

On visibility restoration:

- Reconcile audio state with the actual game state.
- Resume the context only when permitted.
- Recreate active loops from current gameplay state rather than restoring stale node references.

---

# 5. Procedural Audio Generation

## 5.1 General Requirements

Procedural synthesis should use reusable generators and sound presets.

Avoid implementing every sound as an isolated block of Web Audio API code.

Common synthesis building blocks:

- White noise.
- Pink noise approximation.
- Brown noise approximation.
- Sine oscillators.
- Triangle oscillators.
- Sawtooth oscillators.
- Low-pass filters.
- High-pass filters.
- Band-pass filters.
- Amplitude envelopes.
- Frequency envelopes.
- Modulation.
- Short delays.
- Procedurally generated impulse responses.

Use a combination of noise and oscillators to create more natural results.

## 5.2 Noise Generation

Noise is a fundamental building block for:

- Footsteps.
- Wind.
- Sliding.
- Impacts.
- Mechanical friction.
- Radio interference.

Implement reusable noise generation.

Requirements:

- Generate buffers once and reuse them.
- Support different noise characteristics.
- Avoid regenerating large buffers for every event.
- Use seeded generation where deterministic output is useful.
- Allow filter and envelope parameters to shape the sound.

Possible noise types:

| Type | Typical use |
|---|---|
| White noise | Impacts, friction, static |
| Pink noise approximation | Wind, environmental ambience |
| Brown noise approximation | Low-frequency wind and rumble |
| Filtered noise | Footsteps, sliding, metal friction |

Noise generation should be implemented independently from gameplay event handling.

## 5.3 Oscillator Synthesis

Oscillators provide tonal components.

Use them for:

- Mechanical resonances.
- Metal impacts.
- UI feedback.
- Zipline tension.
- Radio tones.
- Low-frequency impact body.

Use frequency and amplitude envelopes to avoid abrupt starts and stops.

Avoid constant loud tones unless they are intentional.

## 5.4 Envelope Design

Most short sound effects should use an amplitude envelope.

Typical phases:

1. Attack.
2. Decay.
3. Optional sustain.
4. Release.

Short impacts usually need a fast attack and short decay.

Ambient sounds need slower transitions.

Use AudioParam automation methods such as:

- `setValueAtTime`.
- `linearRampToValueAtTime`.
- `exponentialRampToValueAtTime`.
- `setTargetAtTime`.

Avoid abrupt GainNode value changes that produce clicks.

Guard against invalid automation values, including zero or negative values where exponential ramps are used.

---

# 6. Sound Categories

## 6.1 Footsteps

Footsteps are one of the most important audio systems.

They must communicate:

- Movement rhythm.
- Player speed.
- Ground contact.
- Surface material.
- Movement intensity.

Footsteps must be generated procedurally.

### Synthesis Approach

A basic footstep can combine:

- Short filtered noise burst.
- Low-frequency impact component.
- Optional transient tonal component.
- Short amplitude envelope.

Vary parameters slightly between steps.

Variation should be controlled and believable.

Avoid randomizing every parameter so aggressively that footsteps become inconsistent.

### Speed Dependence

Footstep interval should depend on movement speed.

Higher speed means shorter intervals.

Do not schedule footsteps using a fixed interval independent of player velocity.

Use actual grounded movement state.

Do not produce footsteps when:

- Player is airborne.
- Player is sliding.
- Player is wallrunning.
- Player is climbing.
- Player is attached to a zipline.
- Player is in a state where normal ground contact is not occurring.

### Surface Dependence

Footsteps must use surface information provided by the gameplay/physics integration layer.

Required initial surface categories:

- Concrete.
- Metal.
- Rubber.
- Asphalt.
- Glass.
- Generic fallback.

Each surface preset may define:

- Noise frequency range.
- Low-frequency impact level.
- High-frequency content.
- Decay duration.
- Tonal component.
- Variation range.

Do not infer a surface from visual material names.

Use the physics surface classification system.

## 6.2 Jump

Jump sound should be subtle.

It may include:

- Short movement noise.
- Light clothing or equipment movement.
- Optional low transient.

Avoid making every jump sound like a large cinematic action.

Jump sound should be triggered by a confirmed jump event, not simply by pressing Space.

## 6.3 Landing

Landing sound communicates impact intensity.

Use impact velocity or an equivalent gameplay-provided impact measure.

Suggested intensity model:

```text
normalizedImpact =
  clamp(
    impactVelocity / maximumExpectedImpact,
    0,
    1
  )
```

The exact curve must be tuned.

Possible components:

- Low-frequency impact.
- Short noise burst.
- Optional surface-dependent resonance.

Differentiate:

- Soft landing.
- Normal landing.
- Hard landing.

Do not play a normal landing sound for every small collision or grounding correction.

## 6.4 Sliding

Sliding is a continuous sound.

Possible synthesis:

- Filtered noise.
- Low-frequency friction.
- Subtle material-dependent resonance.

Parameters:

- Player speed.
- Surface category.
- Slide duration.
- Contact intensity.

The sound must fade in and out smoothly.

When sliding ends, the loop must stop even if the player transitions to another state immediately.

Do not create a new looping audio graph every frame.

## 6.5 Vaulting

Vault sound should be short and contextual.

Possible components:

- Brief movement noise.
- Contact transient.
- Landing or hand contact accent.

Differentiate standard vaulting and speed vaulting through intensity and timing rather than creating unnecessarily complex sound sets.

## 6.6 Wallrun

Wallrun requires a continuous contact sound.

Possible synthesis:

- Filtered friction noise.
- Light rhythmic contact variation.
- Subtle low-frequency movement component.

Parameters:

- Speed.
- Wall material.
- Wallrun duration.
- Player movement direction.

The loop must stop immediately when wallrun becomes invalid or ends.

Do not keep the sound alive while the player is falling or walljumping.

## 6.7 Walljump

Walljump can reuse the jump sound system with additional emphasis.

Possible components:

- Short contact release.
- Brief movement transient.
- Stronger low-frequency component than a normal jump.

## 6.8 Ledge Grab and Climbing

Use restrained contact sounds.

Possible components:

- Hand contact transient.
- Metal or concrete friction.
- Pull-up movement noise.
- Landing or foot contact when returning to a platform.

Use the detected surface category when available.

Avoid adding detailed hand sounds for every animation frame.

## 6.9 Balancing

Balancing audio should remain subtle.

Possible elements:

- Light foot adjustments.
- Occasional contact noise.
- Wind ambience.

Do not generate continuous loud friction noise while the player stands on a narrow beam.

## 6.10 Zipline

Zipline is a distinctive continuous sound.

Possible synthesis:

- Filtered noise for cable friction.
- A narrow tonal component for cable resonance.
- Subtle modulation based on speed.
- Short metallic contact sounds when attaching or detaching.

Parameters:

- Movement speed.
- Cable tension approximation.
- Distance travelled.
- Attachment and release events.

Do not attempt full physical cable simulation for audio.

## 6.11 Metal Impacts

Metal impacts should support environmental interactions.

Possible synthesis:

- Short noise transient.
- One or more decaying oscillators.
- Frequency-dependent resonance.
- Optional short delay.

Vary the resonance according to impact intensity and object type.

Avoid using a single identical metallic sound for every contact.

## 6.12 Wind

Wind is a continuous environmental layer.

Generate using:

- Brown or pink noise approximation.
- Low-pass filtering.
- Slow amplitude modulation.
- Subtle frequency modulation.

Wind intensity may depend on:

- Player speed.
- Exposure.
- Location.
- Height or environmental context, if supported by level metadata.

Do not make wind volume depend exclusively on player speed.

The environment must still feel alive when the player is standing still.

## 6.13 Distant City Ambience

The city background should be subtle.

Possible components:

- Low-level broadband noise.
- Distant mechanical hum.
- Slowly changing tonal layers.
- Sparse, quiet environmental events.

Do not simulate a detailed city soundscape with hundreds of independent audio sources.

Use a small number of carefully controlled ambient layers.

## 6.14 Radio

Radio communication is optional but useful for the Prologue introduction.

The first version may use:

- Procedural radio static.
- Short synthetic signal tones.
- Filtered noise.
- Short pre-authored text displayed on screen.

If speech synthesis is used, it must not depend on downloaded voice assets.

Browser speech synthesis may be used only as an optional enhancement because available voices and behavior vary between platforms.

The game must remain fully playable without speech synthesis.

Radio should use its own bus and support ducking of environmental audio while active.

## 6.15 UI Sounds

UI audio should be minimal.

Required events:

- Menu selection.
- Button confirmation.
- Back or cancel.
- Checkpoint reached.
- Exercise completed.
- Run started.
- Run finished.
- Invalid run notification.
- New personal best.

Use short synthesized signals.

Avoid loud or overly decorative UI sounds.

Important gameplay information must also be visible.

---

# 7. Surface Audio System

## 7.1 Surface Registry Integration

The audio system must integrate with the existing SurfaceRegistry.

Physics or gameplay code should provide a stable surface identifier.

Example:

```ts
type SurfaceType =
  | "concrete"
  | "metal"
  | "rubber"
  | "asphalt"
  | "glass"
  | "default";
```

The audio system maps this identifier to a sound preset.

Do not create a separate surface classification system inside the audio module.

## 7.2 Surface Presets

Example conceptual structure:

```ts
interface SurfaceAudioPreset {
  readonly type: SurfaceType;
  readonly noiseFilterFrequency: number;
  readonly impactGain: number;
  readonly noiseGain: number;
  readonly decayTime: number;
  readonly tonalFrequency?: number;
  readonly tonalGain?: number;
}
```

Values must be calibrated by listening tests.

The example defines a contract, not final tuning values.

## 7.3 Surface Transition

When the player moves between surfaces:

- Update the surface used by subsequent footsteps.
- Do not abruptly change an active continuous sound.
- Smoothly interpolate parameters when appropriate.
- Avoid unnecessary recreation of audio nodes.

---

# 8. Spatial Audio

## 8.1 General Requirements

Spatial audio should be used where it adds meaningful information.

Use PannerNode for world-space sound sources.

Potential sources:

- Environmental machinery.
- Distant mechanical events.
- Static ambience emitters.
- Radio emitters in the world.
- Optional zipline attachment points.

Player-local sounds may remain non-spatial.

## 8.2 Listener

The AudioListener must follow the active gameplay camera or player audio origin.

Update:

- Position.
- Forward direction.
- Up direction.

Do not couple AudioListener updates directly to rendering internals.

Use a small integration component that receives the appropriate camera/player transform.

## 8.3 Attenuation

Use appropriate distance attenuation.

Avoid sounds that remain equally loud regardless of distance.

Use a consistent distance model and tune reference and maximum distances.

Do not create arbitrary distance attenuation logic separately for every sound source.

## 8.4 Spatial Performance

- Keep the number of active spatial sources limited.
- Reuse source nodes where possible.
- Remove inactive emitters.
- Avoid per-frame allocations.
- Do not create spatial sources for every decorative object.

---

# 9. Audio Events and Gameplay Integration

## 9.1 Event-Driven Design

Gameplay systems should publish typed events.

Audio systems subscribe to relevant events.

Example event contracts:

```ts
interface PlayerJumpedEvent {
  readonly playerId: string;
  readonly speed: number;
}

interface PlayerLandedEvent {
  readonly playerId: string;
  readonly impactVelocity: number;
  readonly surface: SurfaceType;
}

interface PlayerFootstepEvent {
  readonly playerId: string;
  readonly speed: number;
  readonly surface: SurfaceType;
}

interface PlayerParkourEvent {
  readonly playerId: string;
  readonly action:
    | "slide-start"
    | "slide-end"
    | "vault"
    | "wallrun-start"
    | "wallrun-end"
    | "walljump"
    | "ledge-grab"
    | "climb"
    | "balance-start"
    | "balance-end"
    | "zipline-start"
    | "zipline-end";
  readonly speed?: number;
  readonly surface?: SurfaceType;
}
```

These are illustrative contracts. Reuse or extend the project's existing typed event system rather than introducing duplicate event infrastructure.

## 9.2 Event Rules

- Emit events only when a real gameplay transition occurs.
- Do not emit state-start events every frame.
- Include the data needed by audio.
- Avoid passing rendering objects or physics engine objects into audio events.
- Use stable identifiers and simple data types.
- Audio listeners must unsubscribe during disposal.

## 9.3 Continuous State Synchronization

Some sounds are better represented by continuous state updates than repeated events.

Examples:

- Wind intensity.
- Slide loop intensity.
- Wallrun loop intensity.
- Zipline loop intensity.

Use a controlled update interface.

Do not publish high-frequency events for every audio parameter change.

Prefer updating a small set of AudioParams on active nodes.

---

# 10. Audio Mixing

## 10.1 Bus Structure

Recommended initial buses:

| Bus | Content |
|---|---|
| Master | Overall output |
| Environment | Wind and city ambience |
| Player | Player-related audio |
| Movement | Footsteps and movement loops |
| Parkour | Jump, landing, vault, wallrun, climbing |
| UI | Interface sounds |
| Radio | Radio communication |

The final bus hierarchy may be simplified if separate buses do not provide useful control.

## 10.2 Volume Settings

Provide settings for:

- Master volume.
- Environment volume.
- Player/SFX volume.
- UI volume.
- Radio volume.

A separate music volume is unnecessary until a music system is actually introduced.

Volume values should be normalized between 0 and 1.

Validate persisted values before applying them.

## 10.3 Ducking

Radio may temporarily reduce environmental ambience.

Ducking requirements:

- Smooth attack.
- Smooth release.
- Restore the original level after playback.
- Do not permanently overwrite the user's volume settings.
- Do not allow overlapping ducking operations to produce inconsistent gain values.

Implement ducking through dedicated gain control rather than mutating stored settings.

---

# 11. Source Management and Performance

## 11.1 Reuse

Audio nodes and buffers should be reused where appropriate.

Avoid:

- Creating AudioContext instances per sound.
- Regenerating noise buffers for every footstep.
- Creating new ambient graphs every frame.
- Leaving completed AudioBufferSourceNodes connected indefinitely.
- Accumulating event listeners after level reloads.

AudioBufferSourceNode instances are single-use. Reuse buffers, not started source nodes.

Create a new source node for each playback while reusing the underlying AudioBuffer.

## 11.2 Source Cleanup

Every one-shot source must have a cleanup strategy.

When playback ends:

- Disconnect temporary nodes.
- Remove references to completed sources.
- Return reusable resources to a pool when applicable.
- Avoid retaining closures that keep large object graphs alive.

Continuous sounds must expose explicit start, update, and stop behavior.

## 11.3 Voice Limits

Set a reasonable limit on simultaneous sound sources.

Prioritize:

1. Important gameplay feedback.
2. Player movement.
3. Nearby environmental sounds.
4. Distant ambience.

Low-priority sounds may be skipped when the limit is reached.

Never allow excessive decorative audio to degrade gameplay performance.

## 11.4 No Per-Frame Graph Creation

Audio graphs must be constructed during initialization or when a sound instance is created.

During normal updates, modify existing AudioParams.

Do not create new filters, oscillators, or gain nodes on every frame.

## 11.5 AudioWorklet

AudioWorklet is not required for the initial implementation.

Use it only if profiling demonstrates that the standard Web Audio API nodes cannot meet the required behavior or performance.

Do not introduce complexity without a measurable benefit.

---

# 12. Accessibility and User Experience

Provide:

- Master mute.
- Independent volume controls.
- Sensible default volume levels.
- No excessively loud sudden transients.
- Consistent audio feedback.
- Visual alternatives for important audio cues.

The following must never be communicated exclusively through sound:

- Checkpoint completion.
- Exercise completion.
- Invalid run state.
- Personal best.
- Critical gameplay instructions.

The game must remain playable with audio disabled.

Avoid continuous high-frequency sounds and excessive low-frequency rumble.

---

# 13. Testing

## 13.1 Unit Tests

Test:

- Volume validation.
- Surface preset lookup.
- Noise generator output constraints.
- Envelope parameter validation.
- Audio event mapping.
- Intensity normalization.
- Audio source lifecycle state.
- Voice limit behavior.

Tests should not depend on actual sound output.

Where necessary, use mocked AudioContext interfaces.

## 13.2 Integration Tests

Test:

- AudioManager initialization.
- AudioContext resume after user interaction.
- Bus routing.
- Event subscription and unsubscription.
- Player state to audio mapping.
- SurfaceRegistry integration.
- Pause and resume.
- Level transitions.
- Application shutdown.

## 13.3 Manual Listening Tests

Verify:

- Footsteps are distinguishable across surfaces.
- Footstep frequency matches movement speed.
- Jump and landing sounds are not confused.
- Landing intensity reflects impact.
- Sliding and wallrun loops stop correctly.
- No clicks occur at loop transitions.
- Ambient sound does not overpower gameplay.
- Radio ducking restores the correct volume.
- UI sounds remain subtle.
- Muting works immediately.

Test using headphones and ordinary desktop speakers.

---

# 14. Implementation Order

Do not implement the entire audio system at once.

Follow this order:

## Phase 1 — Audio Foundation

- AudioContextManager.
- AudioManager.
- Master bus.
- Basic volume controls.
- Browser autoplay handling.
- Resource cleanup.

Acceptance criteria:

- Audio initializes safely.
- Audio resumes after a user gesture.
- Master mute and volume work.
- No critical errors when audio is unavailable.

## Phase 2 — Basic Procedural Synthesis

- NoiseGenerator.
- OscillatorSynth.
- AudioEnvelope.
- Basic one-shot playback.
- Buffer caching.

Acceptance criteria:

- Sounds are generated without external assets.
- Repeated playback does not regenerate expensive resources unnecessarily.
- One-shot sources clean themselves up.

## Phase 3 — Player Movement Audio

- Footsteps.
- Jump.
- Landing.
- Surface presets.
- Speed-dependent parameters.

Acceptance criteria:

- Footsteps occur only during valid ground movement.
- Different surfaces are distinguishable.
- Landing intensity responds to impact.
- No footsteps occur during incompatible player states.

## Phase 4 — Parkour Audio

- Sliding.
- Vaulting.
- Wallrun.
- Walljump.
- Ledge grab.
- Climbing.
- Balancing.
- Zipline.

Acceptance criteria:

- Every implemented mechanic has appropriate audio feedback.
- Continuous sounds stop on state transitions.
- No overlapping incompatible movement loops remain active.

## Phase 5 — Environment

- Wind.
- City ambience.
- Environmental emitters.
- Spatial audio.

Acceptance criteria:

- Ambient sound works in Training and Prologue.
- Spatial sources respond to listener movement.
- Source count remains controlled.

## Phase 6 — UI and Radio

- UI feedback.
- Checkpoint and completion sounds.
- Radio static and signal.
- Optional synthetic speech.
- Radio ducking.

Acceptance criteria:

- Important UI events have clear feedback.
- Radio does not permanently alter other bus volumes.
- The game remains functional without speech synthesis.

## Phase 7 — Polish

- Fine-tune presets.
- Improve variation.
- Reduce repetitive patterns.
- Profile audio processing.
- Verify lifecycle and cleanup.

---

# 15. Definition of Done

The audio system is considered complete when:

- All game sounds are generated procedurally.
- No downloaded game sound assets are required.
- AudioContext lifecycle is handled safely.
- Browser autoplay restrictions are respected.
- Master and category volume settings work.
- Footsteps respond to movement speed and surface type.
- Jump and landing sounds respond to gameplay events.
- Parkour mechanics have appropriate audio feedback.
- Continuous sounds stop correctly.
- Environmental ambience works without excessive resource usage.
- Spatial audio works for supported world emitters.
- Radio and UI sounds work independently.
- Audio can be muted without affecting gameplay.
- Important audio information also has visual feedback.
- Event listeners and audio nodes are cleaned up correctly.
- Level restarts do not accumulate audio sources.
- Application shutdown does not leave active audio resources.
- No critical runtime errors occur during normal audio operation.

---

# 16. Rules for AI Coding Agents

When implementing this specification:

1. Read `00_PROJECT_BRIEF.md`.
2. Read `01_AGENT_RULES.md`.
3. Read `02_TECHNICAL_ARCHITECTURE.md`.
4. Read `03_GAMEPLAY_SPEC.md`.
5. Read `04_ASSET_BIBLE.md`.
6. Read `05_PROCEDURAL_GENERATION_SPEC.md`.
7. Read `06_LEVEL_DESIGN_SPEC.md`.
8. Read `07_UI_UX_SPEC.md`.
9. Follow the existing project architecture.
10. Reuse the existing event system and SurfaceRegistry.
11. Do not introduce external sound assets.
12. Do not add an external audio engine without approval.
13. Do not implement all sound categories in one step.
14. Start with a small working audio vertical slice.
15. Keep audio independent from physics and rendering internals.
16. Ensure all continuous audio has explicit lifecycle management.
17. Test cleanup after pause, restart, level transition, and shutdown.
18. Update implementation status and technical decisions.

If a required gameplay event or surface classification does not exist yet, do not invent a parallel system inside the audio module. Document the missing contract and implement only the parts that can be integrated safely.

---

# 17. Final Design Principle

Audio should make movement feel physical, readable, and responsive.

The player should hear the difference between running on concrete, landing on metal, sliding across a surface, and moving along a cable.

However, sound must remain restrained.

The purpose of the audio system is not to make every action louder. It is to make the world feel coherent and to give the player useful feedback without distracting from movement and route execution.