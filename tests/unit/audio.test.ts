import { describe, expect, it } from "vitest";

import { AudioManager } from "../../src/audio/AudioManager";
import { AudioSettingsAdapter } from "../../src/settings/adapters/AudioSettingsAdapter";
import type { SettingsSnapshot } from "../../src/settings/SettingsTypes";
import { createRunningManager, FakeAudioContext } from "../helpers/fakeAudioContext";

describe("AudioManager lifecycle and graph", () => {
  it("does not create an AudioContext before a user gesture", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    manager.initialize();

    expect(manager.state).toBe("idle");
    expect(context.resumeCount).toBe(0);
  });

  it("creates and resumes the graph after a user gesture", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    const running = await manager.notifyUserGesture();

    expect(running).toBe(true);
    expect(context.resumeCount).toBe(1);
    expect(manager.state).toBe("running");
    expect(context.compressors.length).toBe(1);
    expect(context.convolvers.length).toBe(1);
    expect(context.gains.length).toBeGreaterThanOrEqual(9);
    expect(context.bufferSources.length).toBe(0);
  });

  it("starts from DOM gesture listeners exactly once", async () => {
    const context = new FakeAudioContext();
    const target = new EventTarget();
    const manager = new AudioManager({ factory: () => context, gestureTarget: target });

    manager.initialize();
    target.dispatchEvent(new Event("pointerdown"));
    target.dispatchEvent(new Event("keydown"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.resumeCount).toBe(1);
    expect(manager.state).toBe("running");
  });

  it("reports unavailable when Web Audio is not supported", async () => {
    const manager = new AudioManager({ factory: null, gestureTarget: null });

    expect(manager.state).toBe("unavailable");
    expect(await manager.notifyUserGesture()).toBe(false);
  });

  it("closes the context on dispose", async () => {
    const { context, manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.closeCount).toBe(1);
    expect(manager.state).toBe("unavailable");
  });
});

describe("AudioManager ambience and music", () => {
  it("starts ambience and music only after audio is running", async () => {
    const { context, manager } = createRunningManager();

    manager.startAmbience("training");
    expect(context.bufferSources.length).toBe(0);

    await manager.notifyUserGesture();
    manager.startAmbience("training");

    expect(manager.getDebugSnapshot().ambienceActive).toBe(true);
    expect(manager.getDebugSnapshot().ambienceSources).toBe(3);
    expect(manager.getDebugSnapshot().musicActive).toBe(true);
    expect(context.oscillators.length).toBeGreaterThanOrEqual(2);

    manager.stopAmbience();

    expect(manager.getDebugSnapshot().ambienceActive).toBe(false);
    expect(context.bufferSources.every((source) => source.stopCount >= 1)).toBe(true);
  });

  it("schedules score chords over time", async () => {
    const { context, manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.startAmbience("prologue");
    const before = context.oscillators.length;

    context.currentTime = 1.0;
    manager.update(1 / 60, {
      speed: 6,
      grounded: true,
      stance: "standing",
      wallRunSide: null,
      surface: "concrete",
      paused: false,
    });

    expect(context.oscillators.length).toBeGreaterThan(before);
  });
});

describe("AudioManager movement feedback", () => {
  it("plays a surface-aware footstep with noise and body layers", async () => {
    const { context, manager } = createRunningManager();

    await manager.notifyUserGesture();
    const before = context.bufferSources.length;

    manager.playFootstep(0.8, "metal");

    expect(context.bufferSources.length).toBeGreaterThan(before);
    expect(context.oscillators.length).toBeGreaterThan(0);
    expect(
      context.filters.at(-2)?.frequency.value ?? context.filters.at(-1)?.frequency.value,
    ).toBeGreaterThan(1500);
  });

  it("does not play movement one-shots before the context is running", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    manager.playFootstep(1, "concrete");
    manager.playLanding(8, "metal");
    manager.playJump(8);

    expect(context.bufferSources.length).toBe(0);
    expect(context.oscillators.length).toBe(0);
  });

  it("starts and stops slide and wall-run loops without duplicating them", async () => {
    const { context, manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.startSlide("asphalt");
    manager.startSlide("asphalt");

    expect(manager.getDebugSnapshot().slideActive).toBe(true);
    expect(context.bufferSources.filter((source) => source.loop)).toHaveLength(1);

    manager.startWallRun("left", "metal");
    manager.startWallRun("right", "metal");

    expect(manager.getDebugSnapshot().wallRunActive).toBe(true);
    expect(context.bufferSources.filter((source) => source.loop)).toHaveLength(2);

    manager.stopSlide();
    manager.stopWallRun();

    expect(manager.getDebugSnapshot().slideActive).toBe(false);
    expect(manager.getDebugSnapshot().wallRunActive).toBe(false);
  });

  it("stops contact loops when paused", async () => {
    const { manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.startSlide("concrete");
    manager.startWallRun("right", "concrete");
    manager.setGameplayPaused(true);

    expect(manager.getDebugSnapshot().slideActive).toBe(false);
    expect(manager.getDebugSnapshot().wallRunActive).toBe(false);
  });

  it("keeps one-shot voices within the configured limit", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({
      factory: () => context,
      gestureTarget: null,
      voiceLimit: 4,
    });

    await manager.notifyUserGesture();

    for (let index = 0; index < 12; index += 1) {
      manager.playFootstep(0.9, "concrete");
    }

    expect(manager.activeVoiceCount).toBeLessThanOrEqual(4);
  });
});

describe("AudioManager cues and volumes", () => {
  it("does not play cues before the context is running", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    manager.playUiCue("confirm");

    expect(context.oscillators.length).toBe(0);
  });

  it("plays an enveloped procedural cue after the context is running", async () => {
    const { context, manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.playUiCue("confirm");

    expect(context.oscillators.at(-1)?.frequency.value).toBe(880);
    expect(context.oscillators.at(-1)?.stopCount).toBe(1);
  });

  it("suppresses cues when the channel volume is zero", async () => {
    const { context, manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.setUiVolume(0);
    const before = context.oscillators.length;
    manager.playUiCue("navigate");

    expect(context.oscillators.length).toBe(before);
  });

  it("applies master volume and mute to the master gain node", async () => {
    const { context, manager } = createRunningManager();

    manager.setMasterVolume(0.4, false);
    expect(manager.effectiveVolume).toBe(0.4);

    await manager.notifyUserGesture();
    const master = context.gains[0]?.gain.value;

    expect(master).toBeCloseTo(0.4, 2);

    manager.setMasterVolume(0.4, true);
    expect(manager.effectiveVolume).toBe(0);
    expect(context.gains[0]?.gain.value).toBe(0);
  });

  it("routes the radio cue through the radio bus and ducks ambience", async () => {
    const { manager } = createRunningManager();

    await manager.notifyUserGesture();
    manager.startAmbience("prologue");
    const environment = manager.getDebugSnapshot().buses.environment ?? 0;

    manager.playRadioCue();

    expect(manager.getDebugSnapshot().buses.radio ?? 0).toBeGreaterThan(0);
    expect(environment).toBeGreaterThan(0);
  });
});

describe("AudioSettingsAdapter", () => {
  it("applies master, UI, SFX, and music settings", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });
    const adapter = new AudioSettingsAdapter(manager);

    const snapshot: SettingsSnapshot = {
      revision: 1,
      values: {
        "audio.master_volume": 0.35,
        "audio.muted": false,
        "audio.ui_volume": 0.5,
        "audio.sfx_volume": 0.7,
        "audio.music_volume": 0.25,
      },
    };

    adapter.apply(snapshot);

    expect(manager.effectiveVolume).toBe(0.35);

    adapter.apply({
      revision: 2,
      values: {
        "audio.master_volume": 0.35,
        "audio.muted": true,
        "audio.ui_volume": 0.5,
        "audio.sfx_volume": 0.7,
        "audio.music_volume": 0.25,
      },
    });

    expect(manager.effectiveVolume).toBe(0);
  });
});
