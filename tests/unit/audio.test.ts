import { describe, expect, it } from "vitest";

import {
  type AudioContextLike,
  AudioManager,
  type GainNodeLike,
  type OscillatorNodeLike,
} from "../../src/audio/AudioManager";
import { AudioSettingsAdapter } from "../../src/settings/adapters/AudioSettingsAdapter";
import type { SettingsSnapshot } from "../../src/settings/SettingsTypes";

class FakeAudioContext implements AudioContextLike {
  state: "suspended" | "running" | "closed" | "interrupted" = "suspended";
  readonly destination: unknown = {};
  readonly currentTime = 0;
  readonly gainNode: GainNodeLike;
  readonly oscillators: {
    type: string;
    frequency: number;
    startCount: number;
    stopCount: number;
  }[] = [];
  resumeCount = 0;
  closeCount = 0;

  constructor() {
    this.gainNode = {
      gain: { value: 0 },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }

  createGain(): GainNodeLike {
    return this.gainNode;
  }

  createOscillator(): OscillatorNodeLike {
    const record = { type: "sine", frequency: 0, startCount: 0, stopCount: 0 };

    this.oscillators.push(record);

    return {
      get type() {
        return record.type;
      },
      set type(value: string) {
        record.type = value;
      },
      frequency: {
        get value() {
          return record.frequency;
        },
        set value(next: number) {
          record.frequency = next;
        },
      },
      connect: () => undefined,
      start: () => {
        record.startCount += 1;
      },
      stop: () => {
        record.stopCount += 1;
      },
    };
  }

  get oscillatorCount(): number {
    return this.oscillators.length;
  }

  async resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closeCount += 1;
    this.state = "closed";
  }
}

describe("AudioManager", () => {
  it("does not create an AudioContext before a user gesture", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    manager.initialize();

    expect(manager.state).toBe("idle");
    expect(context.resumeCount).toBe(0);
  });

  it("creates and resumes the context after a user gesture", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    const running = await manager.notifyUserGesture();

    expect(running).toBe(true);
    expect(context.resumeCount).toBe(1);
    expect(manager.state).toBe("running");
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

  it("applies master volume and mute to the master gain node", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    manager.setMasterVolume(0.4, false);

    expect(manager.effectiveVolume).toBe(0.4);

    await manager.notifyUserGesture();

    expect(context.gainNode.gain.value).toBe(0.4);

    manager.setMasterVolume(0.4, true);

    expect(manager.effectiveVolume).toBe(0);
    expect(context.gainNode.gain.value).toBe(0);
  });

  it("reports unavailable when Web Audio is not supported", async () => {
    const manager = new AudioManager({ factory: null, gestureTarget: null });

    expect(manager.state).toBe("unavailable");
    expect(await manager.notifyUserGesture()).toBe(false);
  });

  it("closes the context on dispose", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    await manager.notifyUserGesture();
    manager.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.closeCount).toBe(1);
    expect(manager.state).toBe("unavailable");
  });
});

describe("AudioManager feedback cues", () => {
  it("does not play cues before the context is running", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    manager.playUiCue("confirm");

    expect(context.oscillatorCount).toBe(0);
  });

  it("plays a procedural cue after the context is running", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    await manager.notifyUserGesture();
    manager.playUiCue("confirm");

    expect(context.oscillatorCount).toBe(1);
    expect(context.oscillators[0]?.frequency).toBe(880);
    expect(context.oscillators[0]?.startCount).toBe(1);
    expect(context.oscillators[0]?.stopCount).toBe(1);
  });

  it("suppresses cues when the channel volume is zero", async () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });

    await manager.notifyUserGesture();
    manager.setUiVolume(0);
    manager.playUiCue("navigate");

    expect(context.oscillatorCount).toBe(0);
  });
});

describe("AudioSettingsAdapter", () => {
  it("applies audio settings to the Audio System", () => {
    const context = new FakeAudioContext();
    const manager = new AudioManager({ factory: () => context, gestureTarget: null });
    const adapter = new AudioSettingsAdapter(manager);

    const snapshot: SettingsSnapshot = {
      revision: 1,
      values: { "audio.master_volume": 0.35, "audio.muted": false },
    };

    adapter.apply(snapshot);

    expect(manager.effectiveVolume).toBe(0.35);

    adapter.apply({ revision: 2, values: { "audio.master_volume": 0.35, "audio.muted": true } });

    expect(manager.effectiveVolume).toBe(0);
  });
});
