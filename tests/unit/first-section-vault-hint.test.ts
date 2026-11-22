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

async function harnessAt(x: number, z: number): Promise<FirstSectionHarness> {
  const harness = await createHarness({ x, y: DECK.maxY + 0.93, z });

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

describe("F-04 — prompt priority, localization and isolation", () => {
  const base = {
    levelSupportsVaultAffordance: true,
    vaultAvailable: true,
    interactionPrompt: null,
    tutorialHintVisible: false,
  } as const;

  it("shows only when the level opts in, an obstacle is available and nothing else owns the line", () => {
    expect(shouldShowVaultPrompt(base)).toBe(true);
    expect(shouldShowVaultPrompt({ ...base, levelSupportsVaultAffordance: false })).toBe(false);
    expect(shouldShowVaultPrompt({ ...base, vaultAvailable: false })).toBe(false);
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
