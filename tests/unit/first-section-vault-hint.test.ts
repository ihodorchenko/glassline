import { afterEach, describe, expect, it } from "vitest";

import { FIRST_SECTION_LEVEL } from "../../src/levels/first-section/FirstSectionLevel";
import { PROLOGUE_TEST_LEVEL } from "../../src/levels/test/PrologueTestLevel";
import { TRAINING_TEST_LEVEL } from "../../src/levels/test/TrainingTestLevel";
import { ENGLISH_RESOURCES } from "../../src/localization/resources/en";
import { RUSSIAN_RESOURCES } from "../../src/localization/resources/ru";
import { shouldShowVaultPrompt } from "../../src/ui/ContextualPrompt";
import {
  boundsOfId,
  context,
  createHarness,
  createInput,
  type FirstSectionHarness,
  settle,
  stepOnce,
} from "../helpers/first-section-harness";

/**
 * Step 3.7 F-04 — contextual `E · VAULT` discoverability.
 *
 * The prompt is driven by the exact vault detection the action uses
 * (`PlayerSystem.isVaultAvailable`) and by an explicit per-level opt-in
 * (`LevelMetadata.vaultAffordance`). These tests cover appearance, hiding,
 * stability (no flicker/duplication), action consistency and isolation from the
 * Prologue and Training tutorial progression.
 */

const DECK = boundsOfId("geo_vault_deck");
const FIRST_OBSTACLE = boundsOfId("geo_vault_1");
const DECK_BODY_Y = DECK.maxY + 0.895;

const harnesses: FirstSectionHarness[] = [];

async function harnessAt(
  x: number,
  z: number,
  options: { readonly vaultAffordance?: boolean } = {},
): Promise<FirstSectionHarness> {
  const harness = await createHarness({ x, y: DECK.maxY + 0.93, z }, options);

  harnesses.push(harness);
  settle(harness);

  return harness;
}

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose();
  }
});

describe("F-04 — vault affordance availability", () => {
  it("is unavailable far from the obstacle and appears inside the detection range", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 4);
    const availability: boolean[] = [];

    expect(harness.player.isVaultAvailable()).toBe(false);

    let firstAvailableZ: number | null = null;

    for (let index = 0; index < 120; index += 1) {
      stepOnce(harness, createInput({ move: { x: 0, y: 1 } }));

      if (harness.player.isVaultAvailable()) {
        availability.push(true);

        if (firstAvailableZ === null) {
          firstAvailableZ = harness.player.getPosition().z;
        }
      }
    }

    const finalZ = harness.player.getPosition().z;
    const label = context(harness, "affordance approach");

    expect(firstAvailableZ, `${label} never detected the obstacle`).not.toBeNull();
    expect(firstAvailableZ ?? 0, `${label} detection range`).toBeGreaterThan(
      FIRST_OBSTACLE.maxZ + 0.2,
    );
    // Still detected while pressed against the obstacle (the discovery moment).
    expect(finalZ).toBeGreaterThan(FIRST_OBSTACLE.maxZ + 0.2);
    expect(harness.player.isVaultAvailable(), label).toBe(true);
  });

  it("stays stable and never starts an action while the player stands in range", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 0.9);

    expect(harness.player.isVaultAvailable()).toBe(true);

    let vaultEvents = 0;
    let jumpEvents = 0;

    harness.player.onMovementEvent("player:vault-started", () => {
      vaultEvents += 1;
    });
    harness.player.onMovementEvent("player:jumped", () => {
      jumpEvents += 1;
    });

    const states = new Set<string>();
    const availability: boolean[] = [];

    for (let index = 0; index < 120; index += 1) {
      stepOnce(harness, createInput());

      availability.push(harness.player.isVaultAvailable());
      states.add(harness.player.getState());
    }

    const label = context(harness, "standing affordance");

    expect(
      availability.every((value) => value),
      `${label}: availability flickered`,
    ).toBe(true);
    expect(vaultEvents, label).toBe(0);
    expect(jumpEvents, label).toBe(0);
    expect(states.has("VAULTING"), label).toBe(false);
    expect(states.has("IDLE"), label).toBe(true);
  });

  it("hides while airborne and returns after landing in range", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 0.9);

    expect(harness.player.isVaultAvailable()).toBe(true);

    const airborneAvailability: boolean[] = [];
    let landed = false;

    for (let index = 0; index < 120; index += 1) {
      stepOnce(
        harness,
        createInput({
          jumpPressed: index === 0,
          jumpHeld: index < 20,
        }),
      );

      const snapshot = harness.player.getMovementSnapshot();

      if (!snapshot.grounded) {
        airborneAvailability.push(harness.player.isVaultAvailable());
      }

      if (index > 10 && snapshot.grounded) {
        landed = true;
        break;
      }
    }

    const label = context(harness, "airborne affordance");

    expect(airborneAvailability.length, `${label}: never airborne`).toBeGreaterThan(3);
    expect(
      airborneAvailability.every((value) => !value),
      `${label}: affordance visible while airborne`,
    ).toBe(true);
    expect(landed, label).toBe(true);

    // Detection runs at the start of a fixed step; let the landing settle for a
    // couple of steps before asserting the affordance is back.
    settle(harness, 3);

    expect(harness.player.isVaultAvailable(), `${label}: not restored after landing`).toBe(true);
  });

  it("hides during and after a vault, then returns when the player comes back", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 3);
    let sawVaulting = false;
    const availabilityDuringVault: boolean[] = [];
    let vaultEvents = 0;

    harness.player.onMovementEvent("player:vault-started", () => {
      vaultEvents += 1;
    });

    for (let index = 0; index < 240; index += 1) {
      const pressInteract = harness.player.isVaultAvailable() && vaultEvents === 0;

      stepOnce(
        harness,
        createInput({ move: { x: 0, y: 1 }, sprintHeld: true, interactPressed: pressInteract }),
      );

      if (harness.player.getState() === "VAULTING") {
        sawVaulting = true;
        availabilityDuringVault.push(harness.player.isVaultAvailable());
      }

      if (
        sawVaulting &&
        harness.player.getState() !== "VAULTING" &&
        harness.player.getPosition().z < FIRST_OBSTACLE.minZ - 0.4
      ) {
        break;
      }
    }

    const landedLabel = context(harness, "post-vault affordance");

    expect(vaultEvents, landedLabel).toBe(1);
    expect(availabilityDuringVault.length, landedLabel).toBeGreaterThan(3);
    expect(
      availabilityDuringVault.every((value) => !value),
      `${landedLabel}: affordance visible during the vault`,
    ).toBe(true);
    expect(
      harness.player.isVaultAvailable(),
      `${landedLabel}: affordance stuck after the vault`,
    ).toBe(false);

    // Coming back to the same approach restores the affordance consistently.
    harness.player.teleportTo({ x: 0, y: DECK.maxY + 0.93, z: FIRST_OBSTACLE.maxZ + 0.9 });
    settle(harness);

    expect(harness.player.isVaultAvailable(), context(harness, "re-entry affordance")).toBe(true);
    expect(harness.player.getPosition().y).toBeCloseTo(DECK_BODY_Y, 2);
  });

  it("clears immediately on teleport and outside the range", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 0.9);

    expect(harness.player.isVaultAvailable()).toBe(true);

    harness.player.teleportTo({ x: 0, y: DECK.maxY + 0.93, z: FIRST_OBSTACLE.maxZ + 5 });

    expect(harness.player.isVaultAvailable()).toBe(false);

    settle(harness);

    expect(harness.player.isVaultAvailable()).toBe(false);
  });
});

describe("F-04 (Step 3.8) — affordance display range vs execution range", () => {
  it("shows the affordance well before the action becomes available", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 2.6);
    const label = context(harness, "2.6 m before the obstacle");

    expect(harness.player.isVaultAvailable(), `${label}: action range must be unchanged`).toBe(
      false,
    );
    expect(harness.player.isVaultAffordanceAvailable(), label).toBe(true);
  });

  it("keeps the action range at the original 1.1 m while the affordance reaches 4 m", async () => {
    // 4.5 m out: outside the 4.0 m affordance reach and clear of the duct
    // ceiling slab that ends at z = -54.
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 4.5);
    let affordanceZ: number | null = null;
    let actionZ: number | null = null;

    expect(harness.player.isVaultAffordanceAvailable()).toBe(false);
    expect(harness.player.isVaultAvailable()).toBe(false);

    for (let index = 0; index < 240; index += 1) {
      stepOnce(harness, createInput({ move: { x: 0, y: 1 } }));

      if (affordanceZ === null && harness.player.isVaultAffordanceAvailable()) {
        affordanceZ = harness.player.getPosition().z;
      }

      if (actionZ === null && harness.player.isVaultAvailable()) {
        actionZ = harness.player.getPosition().z;
      }

      if (actionZ !== null) {
        break;
      }
    }

    const affordanceDistance = (affordanceZ ?? 0) - FIRST_OBSTACLE.maxZ;
    const actionDistance = (actionZ ?? 0) - FIRST_OBSTACLE.maxZ;
    const lead = affordanceDistance - actionDistance;

    // The affordance reach is 4.0 m and the action reach 1.1 m, so the prompt
    // is visible for at least 2.5 m of travel before `E` would work.
    expect(affordanceDistance, "affordance must start ~4 m out").toBeGreaterThan(3.5);
    expect(affordanceDistance).toBeLessThan(4.3);
    expect(actionDistance, "action must still start ~1.1 m out").toBeLessThan(1.2);
    expect(actionDistance).toBeGreaterThan(0.9);
    expect(lead, "readable approach before the action range").toBeGreaterThan(2.5);
  });

  it("never advertises an obstacle the vault action would reject", async () => {
    // Facing the 2.0 m vault-channel east wall from 2.2 m away: inside the
    // 4 m affordance reach but above `vaultMaxHeight`.
    const harness = await harnessAt(0, -61);
    const state = harness.player;

    for (let index = 0; index < 30; index += 1) {
      stepOnce(harness, createInput(), -Math.PI / 2);
    }

    expect(state.isVaultAffordanceAvailable()).toBe(false);
    expect(state.isVaultAvailable()).toBe(false);
  });

  it("starts no action and fires no events for the wider probe", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 2.6);
    let vaultEvents = 0;
    let jumpEvents = 0;

    harness.player.onMovementEvent("player:vault-started", () => {
      vaultEvents += 1;
    });
    harness.player.onMovementEvent("player:jumped", () => {
      jumpEvents += 1;
    });

    const states = new Set<string>();

    for (let index = 0; index < 120; index += 1) {
      stepOnce(harness, createInput());
      states.add(harness.player.getState());
    }

    expect(vaultEvents).toBe(0);
    expect(jumpEvents).toBe(0);
    expect(states.has("VAULTING")).toBe(false);
    expect(harness.player.isVaultAffordanceAvailable()).toBe(true);
  });

  it("is fully disabled for a level that does not opt in", async () => {
    const harness = await harnessAt(0, FIRST_OBSTACLE.maxZ + 2.6, {
      vaultAffordance: false,
    });

    expect(harness.player.isVaultAffordanceAvailable()).toBe(false);
    expect(harness.player.isVaultAvailable()).toBe(false);

    // Inside the action range the action is available, but the affordance is
    // still off because the level does not advertise it.
    harness.player.teleportTo({ x: 0, y: DECK.maxY + 0.93, z: FIRST_OBSTACLE.maxZ + 0.9 });
    settle(harness);

    expect(harness.player.isVaultAvailable()).toBe(true);
    expect(harness.player.isVaultAffordanceAvailable()).toBe(false);
  });
});

describe("F-04 — prompt priority, localization and isolation", () => {
  const base = {
    levelSupportsVaultAffordance: true,
    vaultAffordanceVisible: true,
    interactionPrompt: null,
    tutorialHintVisible: false,
  } as const;

  it("shows only when the level opts in, an obstacle is available and nothing else owns the line", () => {
    expect(shouldShowVaultPrompt(base)).toBe(true);
    expect(shouldShowVaultPrompt({ ...base, levelSupportsVaultAffordance: false })).toBe(false);
    expect(shouldShowVaultPrompt({ ...base, vaultAffordanceVisible: false })).toBe(false);
    expect(shouldShowVaultPrompt({ ...base, interactionPrompt: "Press E to interact" })).toBe(
      false,
    );
    expect(shouldShowVaultPrompt({ ...base, tutorialHintVisible: true })).toBe(false);
  });

  it("does not duplicate or toggle the prompt across repeated evaluations", () => {
    const values = Array.from({ length: 20 }, () => shouldShowVaultPrompt(base));

    expect(new Set(values)).toEqual(new Set([true]));
  });

  it("keeps the Prologue and Training out of the vault affordance", () => {
    expect(FIRST_SECTION_LEVEL.metadata.vaultAffordance).toBe(true);
    expect(PROLOGUE_TEST_LEVEL.metadata.vaultAffordance).not.toBe(true);
    expect(TRAINING_TEST_LEVEL.metadata.vaultAffordance).not.toBe(true);

    for (const level of [PROLOGUE_TEST_LEVEL, TRAINING_TEST_LEVEL]) {
      expect(
        shouldShowVaultPrompt({
          ...base,
          levelSupportsVaultAffordance: level.metadata.vaultAffordance === true,
        }),
        `${level.id} must not publish the First Section vault affordance`,
      ).toBe(false);
    }
  });

  it("ships a localized E · VAULT prompt in both supported languages", () => {
    const english = ENGLISH_RESOURCES["hud.vaultPrompt"];
    const russian = RUSSIAN_RESOURCES["hud.vaultPrompt"];

    expect(english).toBeTypeOf("string");
    expect(russian).toBeTypeOf("string");
    expect(english).toContain("E");
    expect(english).toContain("VAULT");
    expect(russian).toContain("E");
    expect(russian).toContain("ОПОРНЫЙ ПРЫЖОК");
    expect(russian).not.toBe(english);
  });
});
