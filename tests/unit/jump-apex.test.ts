import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample, MovementState } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";

const DT = 1 / 60;
const FLOOR_TOP_Y = 0;
const FLOOR_SIZE_METERS = 40;
const FLOOR_THICKNESS_METERS = 1;
/** Authored spawn convention: capsule centre = top surface + 0.93. */
const SPAWN_CENTER_ABOVE_FLOOR = 0.93;
const WARMUP_STEPS = 90;

/** Current behaviour, fixed by this test (`FIRST_GAMEPLAY_SECTION_SPEC` §12.1). */
const FULL_APEX_METERS = 1.55;
const FULL_APEX_TOLERANCE = 0.01;
const EARLY_APEX_METERS = 0.446;
const EARLY_APEX_TOLERANCE = 0.02;
const AIRTIME_TOLERANCE_SECONDS = 0.02;

interface JumpHarness {
  readonly physics: PhysicsWorld;
  readonly player: PlayerSystem;
}

interface JumpTrace {
  /** Highest feet position above the floor surface (not the capsule centre). */
  readonly apexFeetAboveFloor: number;
  /** Step index of the apex, counted from the jump-press step as 0. */
  readonly apexStep: number;
  /** Step index of the first LANDING state, counted from the jump-press step. */
  readonly landingStep: number;
  readonly airtimeSeconds: number;
  readonly stateSequence: readonly MovementState[];
}

const harnesses: JumpHarness[] = [];

function input(overrides: Partial<MovementInputSample> = {}): MovementInputSample {
  return {
    move: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: false,
    crouchHeld: false,
    interactPressed: false,
    ...overrides,
  };
}

async function createHarness(): Promise<JumpHarness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;
  const floor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, FLOOR_TOP_Y - FLOOR_THICKNESS_METERS / 2, 0),
  );

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      FLOOR_SIZE_METERS / 2,
      FLOOR_THICKNESS_METERS / 2,
      FLOOR_SIZE_METERS / 2,
    ),
    floor,
  );

  const player = new PlayerSystem(physics, {
    tuning: DEFAULT_MOVEMENT_TUNING,
    spawnPoint: { x: 0, y: FLOOR_TOP_Y + SPAWN_CENTER_ABOVE_FLOOR, z: 0 },
  });

  player.activate();

  const harness = { physics, player };

  harnesses.push(harness);

  for (let step = 0; step < WARMUP_STEPS; step += 1) {
    player.fixedUpdate(input(), 0, DT);
    physics.step();
  }

  return harness;
}

function restFeetAboveFloor(player: PlayerSystem): number {
  return player.getFeetPosition().y - FLOOR_TOP_Y;
}

/**
 * Runs one jump. `jumpHeldSteps` counts the take-off step itself, which is
 * already airborne (state JUMPING, `grounded === false`): 1 releases right
 * after the first airborne step, 2 holds through the first airborne step as
 * well.
 */
function measureJump(harness: JumpHarness, jumpHeldSteps: number): JumpTrace {
  const { player, physics } = harness;
  const stateSequence: MovementState[] = [];
  let apexFeetAboveFloor = Number.NEGATIVE_INFINITY;
  let apexStep = -1;
  let landingStep = -1;

  for (let step = 0; step < 240; step += 1) {
    player.fixedUpdate(input({ jumpPressed: step === 0, jumpHeld: step < jumpHeldSteps }), 0, DT);
    physics.step();

    const state = player.getState();

    if (stateSequence.at(-1) !== state) {
      stateSequence.push(state);
    }

    const feetAboveFloor = restFeetAboveFloor(player);

    if (feetAboveFloor > apexFeetAboveFloor) {
      apexFeetAboveFloor = feetAboveFloor;
      apexStep = step;
    }

    if (state === "LANDING") {
      landingStep = step;
      break;
    }
  }

  return {
    apexFeetAboveFloor,
    apexStep,
    landingStep,
    airtimeSeconds: landingStep * DT,
    stateSequence,
  };
}

afterEach(() => {
  for (const harness of harnesses) {
    harness.player.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("Jump apex (real PlayerSystem + Rapier character controller)", () => {
  it("reaches the documented full-hold apex, apex step and airtime", async () => {
    const harness = await createHarness();
    const rest = restFeetAboveFloor(harness.player);

    expect(harness.player.getMovementSnapshot().grounded).toBe(true);
    expect(rest).toBeGreaterThan(0);
    expect(rest).toBeLessThan(0.05);

    const trace = measureJump(harness, 240);

    expect(trace.apexFeetAboveFloor).toBeGreaterThanOrEqual(FULL_APEX_METERS - FULL_APEX_TOLERANCE);
    expect(trace.apexFeetAboveFloor).toBeLessThanOrEqual(FULL_APEX_METERS + FULL_APEX_TOLERANCE);
    expect(trace.apexStep).toBe(21);
    expect(trace.landingStep).toBe(44);
    expect(trace.airtimeSeconds).toBeGreaterThanOrEqual(0.733 - AIRTIME_TOLERANCE_SECONDS);
    expect(trace.airtimeSeconds).toBeLessThanOrEqual(0.733 + AIRTIME_TOLERANCE_SECONDS);
    expect(trace.stateSequence).toEqual(["JUMPING", "FALLING", "LANDING"]);
  });

  it("cuts an early release to the documented lower apex and airtime", async () => {
    const harness = await createHarness();
    const rest = restFeetAboveFloor(harness.player);
    const trace = measureJump(harness, 1);
    const riseAboveRest = trace.apexFeetAboveFloor - rest;

    // The documented 0.446 m figure is the rise from the resting feet, which
    // the controller holds 0.0198 m above the floor; the floor-relative height
    // is therefore ~0.465 m. Both stay inside the documented band.
    expect(trace.apexFeetAboveFloor).toBeGreaterThanOrEqual(
      EARLY_APEX_METERS - EARLY_APEX_TOLERANCE,
    );
    expect(trace.apexFeetAboveFloor).toBeLessThanOrEqual(EARLY_APEX_METERS + EARLY_APEX_TOLERANCE);
    expect(riseAboveRest).toBeGreaterThanOrEqual(EARLY_APEX_METERS - EARLY_APEX_TOLERANCE);
    expect(riseAboveRest).toBeLessThanOrEqual(EARLY_APEX_METERS + EARLY_APEX_TOLERANCE);
    expect(trace.apexStep).toBe(6);
    expect(trace.landingStep).toBe(17);
    expect(trace.airtimeSeconds).toBeGreaterThanOrEqual(0.283 - AIRTIME_TOLERANCE_SECONDS);
    expect(trace.airtimeSeconds).toBeLessThanOrEqual(0.283 + AIRTIME_TOLERANCE_SECONDS);
    expect(trace.stateSequence).toEqual(["JUMPING", "FALLING", "LANDING"]);
  });

  it("keeps the two-airborne-step grace window consistent across releases", async () => {
    const releaseHarness = await createHarness();
    const holdHarness = await createHarness();
    const releasedAfterFirstStep = measureJump(releaseHarness, 1);
    const heldThroughFirstStep = measureJump(holdHarness, 2);

    expect(heldThroughFirstStep.apexFeetAboveFloor).toBe(releasedAfterFirstStep.apexFeetAboveFloor);
    expect(heldThroughFirstStep.apexStep).toBe(releasedAfterFirstStep.apexStep);
    expect(heldThroughFirstStep.landingStep).toBe(releasedAfterFirstStep.landingStep);
    expect(heldThroughFirstStep.stateSequence).toEqual(releasedAfterFirstStep.stateSequence);
  });
});
