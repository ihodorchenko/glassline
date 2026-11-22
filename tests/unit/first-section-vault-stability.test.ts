import { afterEach, describe, expect, it } from "vitest";

import { MovementModel } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import {
  boundsOfId,
  context,
  createHarness,
  createInput,
  FIXED_DT,
  type FirstSectionHarness,
  type GeometryBounds,
  settle,
  step,
  stepOnce,
} from "../helpers/first-section-harness";

/**
 * Step 3.7 F-01 — vault obstacle collision stability.
 *
 * Regression for the Step 3.6 finding: sprinting into the authored 0.50 m vault
 * obstacle without pressing E launched the body upward and backwards. The
 * scenarios below charge the real authored obstacle at several lateral offsets
 * and approach speeds and assert the full collision response — not only the
 * final position: peak feet height, vertical speed, per-step displacement,
 * capsule/obstacle overlap, movement states and movement events.
 */

const DECK = boundsOfId("geo_vault_deck");
/** Authored body centre Y when standing on the vault deck (feet = deck + 0.02). */
const DECK_BODY_Y = DECK.maxY + 0.895;
const DECK_FEET_Y = DECK.maxY + 0.02;
/**
 * Peak feet lift accepted while charging a vault obstacle. Rapier may resolve a
 * sub-centimetre contact lift; anything above 2 cm is a launch/bounce.
 */
const MAX_SUPPORT_LIFT_METERS = 0.02;
const FORBIDDEN_STATES = new Set([
  "JUMPING",
  "FALLING",
  "LANDING",
  "VAULTING",
  "WALLRUN",
  "WALLJUMP",
]);

interface ObstacleCase {
  readonly id: "geo_vault_1" | "geo_vault_2" | "geo_vault_3";
  readonly label: string;
  readonly height: number;
  readonly bounds: GeometryBounds;
}

const OBSTACLES: readonly ObstacleCase[] = [
  {
    id: "geo_vault_1",
    label: "0.50 m",
    height: 0.5,
    bounds: boundsOfId("geo_vault_1"),
  },
  {
    id: "geo_vault_2",
    label: "0.70 m",
    height: 0.7,
    bounds: boundsOfId("geo_vault_2"),
  },
  {
    id: "geo_vault_3",
    label: "1.10 m",
    height: 1.1,
    bounds: boundsOfId("geo_vault_3"),
  },
];

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

type ApproachSpeed = "slow" | "run" | "sprint";

function approachInput(speed: ApproachSpeed) {
  if (speed === "sprint") {
    return createInput({ move: { x: 0, y: 1 }, sprintHeld: true });
  }

  if (speed === "run") {
    return createInput({ move: { x: 0, y: 1 } });
  }

  return createInput({ move: { x: 0, y: 0.35 } });
}

interface ChargeResult {
  readonly initialZ: number;
  readonly finalX: number;
  readonly finalY: number;
  readonly finalZ: number;
  readonly maxFeetY: number;
  readonly maxVerticalSpeed: number;
  readonly minVerticalSpeed: number;
  readonly maxZAfterContact: number;
  readonly penetrated: boolean;
  readonly jumpedEvents: number;
  readonly vaultEvents: number;
  readonly observedStates: ReadonlySet<string>;
  readonly grounded: boolean;
  readonly finalSpeed: number;
  readonly trajectory: readonly { readonly z: number; readonly y: number }[];
}

async function chargeObstacle(options: {
  readonly obstacle: ObstacleCase;
  readonly lateral?: number;
  readonly speed?: ApproachSpeed;
  readonly steps?: number;
}): Promise<ChargeResult> {
  const { obstacle } = options;
  const lateral = options.lateral ?? 0;
  const speed = options.speed ?? "sprint";
  const harness = await harnessAt(lateral, obstacle.bounds.maxZ + 4);
  const obstacleCollider = harness.colliders.get(obstacle.id);

  if (!obstacleCollider) {
    throw new Error(`Harness has no authored collider for "${obstacle.id}".`);
  }

  let jumpedEvents = 0;
  let vaultEvents = 0;

  harness.player.onMovementEvent("player:jumped", () => {
    jumpedEvents += 1;
  });
  harness.player.onMovementEvent("player:vault-started", () => {
    vaultEvents += 1;
  });

  const sample = approachInput(speed);
  const initialZ = harness.player.getPosition().z;
  const observedStates = new Set<string>();
  const trajectory: Array<{ z: number; y: number }> = [];
  let maxFeetY = Number.NEGATIVE_INFINITY;
  let maxVerticalSpeed = Number.NEGATIVE_INFINITY;
  let minVerticalSpeed = Number.POSITIVE_INFINITY;
  let maxZAfterContact = Number.NEGATIVE_INFINITY;
  let penetrated = false;
  let contactReached = false;
  const contactThreshold = obstacle.bounds.maxZ + DEFAULT_MOVEMENT_TUNING.capsuleRadius + 0.04;

  for (let index = 0; index < (options.steps ?? 240); index += 1) {
    stepOnce(harness, sample);

    const position = harness.player.getPosition();
    const snapshot = harness.player.getMovementSnapshot();
    const feet = harness.player.getFeetPosition();

    observedStates.add(snapshot.state);
    maxFeetY = Math.max(maxFeetY, feet.y);
    maxVerticalSpeed = Math.max(maxVerticalSpeed, snapshot.verticalSpeed);
    minVerticalSpeed = Math.min(minVerticalSpeed, snapshot.verticalSpeed);

    if (harness.world.intersectionPair(harness.player.collider, obstacleCollider)) {
      penetrated = true;
    }

    if (position.z <= contactThreshold) {
      contactReached = true;
    }

    if (contactReached) {
      maxZAfterContact = Math.max(maxZAfterContact, position.z);
    }

    trajectory.push({ z: position.z, y: position.y });
  }

  const position = harness.player.getPosition();
  const snapshot = harness.player.getMovementSnapshot();

  return {
    initialZ,
    finalX: position.x,
    finalY: position.y,
    finalZ: position.z,
    maxFeetY,
    maxVerticalSpeed,
    minVerticalSpeed,
    maxZAfterContact,
    penetrated,
    jumpedEvents,
    vaultEvents,
    observedStates,
    grounded: snapshot.grounded,
    finalSpeed: snapshot.speed,
    trajectory,
  };
}

function assertStableBlock(result: ChargeResult, obstacle: ObstacleCase, label: string): void {
  const suffix = `${label} ${obstacle.label} z=${result.finalZ.toFixed(3)}`;

  // No involuntary jump/vault and no bounce: the body stays on the deck and the
  // vertical velocity never becomes ballistic.
  expect(result.jumpedEvents, `${suffix}: emitted player:jumped`).toBe(0);
  expect(result.vaultEvents, `${suffix}: emitted player:vault-started`).toBe(0);
  expect(
    result.maxVerticalSpeed,
    `${suffix}: vertical speed became ballistic (launch)`,
  ).toBeLessThanOrEqual(0.05);
  expect(
    result.maxFeetY - DECK_FEET_Y,
    `${suffix}: feet lifted more than the support tolerance`,
  ).toBeLessThanOrEqual(MAX_SUPPORT_LIFT_METERS);
  expect(result.minVerticalSpeed, `${suffix}: unexpected downward impulse`).toBeGreaterThanOrEqual(
    -0.6,
  );

  for (const state of result.observedStates) {
    expect(FORBIDDEN_STATES.has(state), `${suffix}: observed ${state}`).toBe(false);
  }

  // No penetration and no pass-through: the body centre stays in front of the
  // authored front face for the whole charge.
  expect(result.penetrated, `${suffix}: capsule intersected the obstacle`).toBe(false);
  expect(result.finalZ, `${suffix}: body did not reach the obstacle`).toBeLessThan(
    result.initialZ - 2,
  );
  expect(result.finalZ, `${suffix}: body passed the front face`).toBeGreaterThan(
    obstacle.bounds.maxZ + 0.2,
  );
  expect(
    result.maxZAfterContact,
    `${suffix}: body was pushed backwards after contact`,
  ).toBeLessThanOrEqual(result.finalZ + 0.02);

  // Settled, grounded, still: a normal blocked collision, not a bounce cycle.
  expect(result.grounded, `${suffix}: not grounded after the charge`).toBe(true);
  expect(result.finalSpeed, `${suffix}: still moving after the charge`).toBeLessThan(0.05);
  expect(
    Math.abs(result.finalY - DECK_BODY_Y),
    `${suffix}: body height changed`,
  ).toBeLessThanOrEqual(0.03);
}

describe("F-01 — sprinting into a vault obstacle without E", () => {
  it("the 0.50 m obstacle blocks without launching, bouncing or self-vaulting", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;
    const result = await chargeObstacle({ obstacle });

    assertStableBlock(result, obstacle, "sprint");
  });

  it("the 0.50 m obstacle blocks identically at five lateral offsets", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;

    for (const lateral of [-1.8, -1.2, 0, 1.2, 1.8]) {
      const result = await chargeObstacle({ obstacle, lateral });

      assertStableBlock(result, obstacle, `sprint x=${lateral}`);
      expect(
        Math.abs(result.finalX - lateral),
        `sprint x=${lateral}: lateral drift ${result.finalX.toFixed(3)}`,
      ).toBeLessThanOrEqual(0.12);
    }
  });

  it("blocks at slow walk, run and sprint approach speeds", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;

    for (const speed of ["slow", "run", "sprint"] as const) {
      const result = await chargeObstacle({ obstacle, speed });

      assertStableBlock(result, obstacle, `speed=${speed}`);
    }
  });

  it("is deterministic across repeated attempts with identical initial conditions", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;
    const first = await chargeObstacle({ obstacle });
    const second = await chargeObstacle({ obstacle });

    expect(first.trajectory).toHaveLength(second.trajectory.length);

    let maxDifference = 0;

    for (const [index, sample] of first.trajectory.entries()) {
      const other = second.trajectory[index];

      if (!other) {
        throw new Error(`Second run is missing sample ${index}.`);
      }

      maxDifference = Math.max(
        maxDifference,
        Math.abs(sample.z - other.z),
        Math.abs(sample.y - other.y),
      );
    }

    expect(maxDifference, `repeat divergence ${maxDifference}`).toBeLessThan(1e-9);
    expect(first.finalZ).toBeCloseTo(second.finalZ, 9);
  });

  it("the 0.70 m control obstacle also blocks cleanly at sprint speed", async () => {
    const obstacle = OBSTACLES[1] as ObstacleCase;
    const result = await chargeObstacle({ obstacle });

    assertStableBlock(result, obstacle, "sprint control");
  });

  it("the 1.10 m vaultable obstacle blocks cleanly without E as well", async () => {
    const obstacle = OBSTACLES[2] as ObstacleCase;
    const result = await chargeObstacle({ obstacle });

    assertStableBlock(result, obstacle, "sprint control");
  });
});

describe("F-01 — the vault action still works with E", () => {
  it("sprints into the 0.50 m obstacle and vaults with E", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;
    const harness = await harnessAt(0, obstacle.bounds.maxZ + 3);
    const obstacleCollider = harness.colliders.get(obstacle.id);

    if (!obstacleCollider) {
      throw new Error(`Harness has no authored collider for "${obstacle.id}".`);
    }

    const events: Array<{ speed: number; vaultType: "standard" | "speed" }> = [];

    harness.player.onMovementEvent("player:vault-started", (payload) => {
      events.push({ ...payload });
    });

    let sawVaulting = false;
    let penetrated = false;
    let interactStep = -1;
    let availableSteps = 0;

    for (let index = 0; index < 240; index += 1) {
      const pressInteract = interactStep < 0 && harness.player.isVaultAvailable();

      if (pressInteract) {
        interactStep = index;
      }

      if (harness.player.isVaultAvailable()) {
        availableSteps += 1;
      }

      stepOnce(
        harness,
        createInput({ move: { x: 0, y: 1 }, sprintHeld: true, interactPressed: pressInteract }),
      );

      if (harness.player.getState() === "VAULTING") {
        sawVaulting = true;
      }

      if (harness.world.intersectionPair(harness.player.collider, obstacleCollider)) {
        penetrated = true;
      }

      if (
        sawVaulting &&
        harness.player.getState() !== "VAULTING" &&
        harness.player.getPosition().z < obstacle.bounds.minZ - 0.4
      ) {
        break;
      }
    }

    step(harness, createInput({ move: { x: 0, y: 1 }, sprintHeld: true }), 60);

    const final = harness.player.getPosition();
    const finalSnapshot = harness.player.getMovementSnapshot();
    const label = context(harness, "sprint vault geo_vault_1");

    expect(events, label).toHaveLength(1);
    expect(availableSteps, label).toBeGreaterThan(0);
    expect(sawVaulting, label).toBe(true);
    expect(events[0]?.vaultType, label).toBe("speed");
    expect(events[0]?.speed ?? 0, label).toBeGreaterThan(8);
    expect(penetrated, label).toBe(false);
    expect(final.z, label).toBeLessThan(obstacle.bounds.minZ - 0.2);
    expect(finalSnapshot.grounded, label).toBe(true);
  });
});

describe("F-01 — ordinary jumping next to the obstacle", () => {
  it("keeps a normal standing-jump apex and landing in front of the obstacle", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;
    const harness = await harnessAt(0, obstacle.bounds.maxZ + 2.5);
    const obstacleCollider = harness.colliders.get(obstacle.id);

    if (!obstacleCollider) {
      throw new Error(`Harness has no authored collider for "${obstacle.id}".`);
    }

    const startFeet = harness.player.getFeetPosition().y;
    let maxFeetY = startFeet;
    let sawJumping = false;
    let sawLanding = false;
    let penetrated = false;

    for (let index = 0; index < 120; index += 1) {
      stepOnce(
        harness,
        createInput({
          jumpPressed: index === 0,
          jumpHeld: index < 20,
        }),
      );

      const snapshot = harness.player.getMovementSnapshot();

      maxFeetY = Math.max(maxFeetY, harness.player.getFeetPosition().y);
      sawJumping ||= snapshot.state === "JUMPING";
      sawLanding ||= snapshot.state === "LANDING";

      if (harness.world.intersectionPair(harness.player.collider, obstacleCollider)) {
        penetrated = true;
      }
    }

    const finalSnapshot = harness.player.getMovementSnapshot();
    const rise = maxFeetY - startFeet;
    const label = context(harness, "standing jump at geo_vault_1");

    expect(sawJumping, label).toBe(true);
    expect(sawLanding, label).toBe(true);
    expect(rise, `${label} apex rise`).toBeGreaterThan(1.1);
    expect(rise, `${label} apex rise`).toBeLessThan(1.8);
    expect(penetrated, label).toBe(false);
    expect(finalSnapshot.grounded, label).toBe(true);
    expect(finalSnapshot.state, label).not.toBe("JUMPING");
  });

  it("still clears the 0.50 m obstacle with an ordinary running jump", async () => {
    const obstacle = OBSTACLES[0] as ObstacleCase;
    const harness = await harnessAt(0, obstacle.bounds.maxZ + 4);
    const obstacleCollider = harness.colliders.get(obstacle.id);

    if (!obstacleCollider) {
      throw new Error(`Harness has no authored collider for "${obstacle.id}".`);
    }

    let jumped = false;
    let penetrated = false;

    for (let index = 0; index < 240; index += 1) {
      const position = harness.player.getPosition();
      const jumpPressed = !jumped && position.z <= obstacle.bounds.maxZ + 1.6;

      if (jumpPressed) {
        jumped = true;
      }

      stepOnce(
        harness,
        createInput({
          move: { x: 0, y: 1 },
          sprintHeld: true,
          jumpPressed,
          jumpHeld: position.z > obstacle.bounds.minZ - 1,
        }),
      );

      if (harness.world.intersectionPair(harness.player.collider, obstacleCollider)) {
        penetrated = true;
      }

      if (
        jumped &&
        harness.player.getMovementSnapshot().grounded &&
        harness.player.getPosition().z < obstacle.bounds.minZ - 0.5
      ) {
        break;
      }
    }

    step(harness, createInput(), 30);

    const final = harness.player.getPosition();
    const label = context(harness, "running jump over geo_vault_1");

    expect(jumped, label).toBe(true);
    expect(penetrated, label).toBe(false);
    expect(final.z, label).toBeLessThan(obstacle.bounds.minZ - 0.3);
    expect(harness.player.getMovementSnapshot().grounded, label).toBe(true);
  });
});

describe("F-01 — collision response never converts support motion into a launch", () => {
  it("ignores an unrequested upward controller correction while grounded", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    model.step(
      createInput(),
      { x: 0, y: 0, z: -1 },
      { grounded: true, wallRun: null, vault: null },
      FIXED_DT,
    );
    model.applyCollisionResult({ x: 0, y: 0.09, z: 0 }, FIXED_DT, false);

    expect(model.getSnapshot().verticalSpeed).toBe(0);
    expect(model.getSnapshot().state).not.toBe("JUMPING");
  });

  it("preserves a requested jump's upward velocity", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    model.step(
      createInput({ jumpPressed: true, jumpHeld: true }),
      { x: 0, y: 0, z: -1 },
      { grounded: true, wallRun: null, vault: null },
      FIXED_DT,
    );

    const jumpVelocity = model.getSnapshot().verticalSpeed;

    expect(jumpVelocity).toBeGreaterThan(5);

    const desired = model.getDesiredTranslation(FIXED_DT);

    model.applyCollisionResult(desired, FIXED_DT, false);

    expect(model.getSnapshot().verticalSpeed).toBeCloseTo(jumpVelocity, 6);
    expect(model.getSnapshot().state).toBe("JUMPING");
  });
});
