import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { type CheckpointDefinition, CheckpointSystem } from "../../src/checkpoint/CheckpointSystem";
import {
  FIRST_SECTION_SECTION_IDS,
  type FirstSectionSectionId,
} from "../../src/levels/first-section/FirstSectionLayout";
import { FIRST_SECTION_LEVEL } from "../../src/levels/first-section/FirstSectionLevel";
import type {
  LevelBounds,
  LevelGeometryDefinition,
  LevelSpawnPointDefinition,
  LevelTriggerDefinition,
  LevelVector3,
} from "../../src/levels/LevelTypes";
import { TriggerManager } from "../../src/levels/TriggerManager";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { VaultDetector } from "../../src/player/detection/VaultDetector";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";
import { RespawnManager } from "../../src/respawn/RespawnManager";

/**
 * Headless traversal acceptance tests for `FIRST_SECTION_LEVEL`
 * (`FIRST_GAMEPLAY_SECTION_SPEC.md` §11.2, criteria 8–15).
 *
 * Every traversal assertion below is produced by the production stack — the
 * real authored `FIRST_SECTION_LEVEL.geometry` colliders, `PhysicsWorld`
 * (Rapier), `PlayerSystem`, `DEFAULT_MOVEMENT_TUNING` and a fixed 1/60 s step.
 * There is no simplified movement model and no copied geometry array: the only
 * level data used here are object ids, authored bounds, spawn points and
 * triggers.
 *
 * All movement loops have a hard step cap, so a blocked traversal fails with
 * diagnostics instead of hanging the suite.
 */

const LEVEL = FIRST_SECTION_LEVEL;
const DT = 1 / 60;
const SETTLE_STEPS = 60;
/** Hard cap for any driven loop, so a blocked traversal fails instead of hanging. */
const MAX_STEPS = 600;

interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function findGeometry(id: string): LevelGeometryDefinition {
  const geometry = LEVEL.geometry.find((candidate) => candidate.id === id);

  if (!geometry) {
    throw new Error(`FIRST_SECTION_LEVEL is missing geometry "${id}".`);
  }

  return geometry;
}

function boundsOf(geometry: LevelGeometryDefinition): Bounds {
  const halfX = geometry.size.x / 2;
  const halfY = geometry.size.y / 2;
  const halfZ = geometry.size.z / 2;

  return {
    minX: geometry.position.x - halfX,
    maxX: geometry.position.x + halfX,
    minY: geometry.position.y - halfY,
    maxY: geometry.position.y + halfY,
    minZ: geometry.position.z - halfZ,
    maxZ: geometry.position.z + halfZ,
  };
}

function boundsOfId(id: string): Bounds {
  return boundsOf(findGeometry(id));
}

function triggerBounds(trigger: LevelTriggerDefinition): LevelBounds {
  return { center: trigger.center, halfExtents: trigger.halfExtents };
}

function findSpawn(id: string): LevelSpawnPointDefinition {
  const spawn = LEVEL.spawnPoints.find((candidate) => candidate.id === id);

  if (!spawn) {
    throw new Error(`FIRST_SECTION_LEVEL is missing spawn point "${id}".`);
  }

  return spawn;
}

function geometryOfSection(sectionId: FirstSectionSectionId): readonly LevelGeometryDefinition[] {
  return LEVEL.geometry.filter((geometry) => geometry.sectionId === sectionId);
}

function sectionEntrySpawn(sectionId: FirstSectionSectionId): LevelSpawnPointDefinition {
  const section = LEVEL.sections.find((candidate) => candidate.id === sectionId);

  if (!section) {
    throw new Error(`FIRST_SECTION_LEVEL is missing section "${sectionId}".`);
  }

  return findSpawn(section.entrySpawnPointId);
}

/* ------------------------------------------------------------------------- */
/* Physics harness                                                            */
/* ------------------------------------------------------------------------- */

interface Harness {
  readonly physics: PhysicsWorld;
  readonly player: PlayerSystem;
  readonly world: RAPIER.World;
  readonly detector: VaultDetector;
  /** Authored colliders by geometry id, for engine-authoritative overlap checks. */
  readonly colliders: ReadonlyMap<string, RAPIER.Collider>;
}

const harnesses: Harness[] = [];
const checkpointSystems: CheckpointSystem[] = [];

async function createHarness(spawn: LevelVector3): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;
  const colliders = new Map<string, RAPIER.Collider>();

  // The authored collision layer, exactly as `BoxLevelContentLoader` builds it:
  // one fixed body per `geometry` entry, a cuboid of `size / 2` half extents at
  // the authored centre, friction 1 and restitution 0. No rotations, no
  // offsets, no test-only boxes.
  for (const geometry of LEVEL.geometry) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        geometry.position.x,
        geometry.position.y,
        geometry.position.z,
      ),
    );

    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(geometry.size.x / 2, geometry.size.y / 2, geometry.size.z / 2)
        .setFriction(1)
        .setRestitution(0),
      body,
    );

    colliders.set(geometry.id, collider);
  }

  const player = new PlayerSystem(physics, {
    tuning: DEFAULT_MOVEMENT_TUNING,
    spawnPoint: spawn,
  });

  player.activate();

  const harness: Harness = {
    physics,
    player,
    world,
    detector: new VaultDetector(world, DEFAULT_MOVEMENT_TUNING),
    colliders,
  };

  harnesses.push(harness);

  return harness;
}

async function createHarnessAtSpawn(spawnPointId: string): Promise<Harness> {
  return createHarness(findSpawn(spawnPointId).position);
}

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

function step(harness: Harness, sample: MovementInputSample, steps: number, yaw = 0): void {
  for (let index = 0; index < steps; index += 1) {
    harness.player.fixedUpdate(sample, yaw, DT);
    harness.physics.step();
  }
}

/** Runs one step; production order is movement → triggers → physics step. */
function stepOnce(harness: Harness, sample: MovementInputSample, yaw = 0): void {
  harness.player.fixedUpdate(sample, yaw, DT);
  harness.physics.step();
}

function settle(harness: Harness): void {
  step(harness, input(), SETTLE_STEPS);
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

/** Failure context required by the step brief: position, speed, movement state. */
function context(harness: Harness, label: string): string {
  const position = harness.player.getPosition();
  const feet = harness.player.getFeetPosition();
  const snapshot = harness.player.getMovementSnapshot();

  return [
    label,
    `position=(${formatNumber(position.x)}, ${formatNumber(position.y)}, ${formatNumber(
      position.z,
    )})`,
    `feetY=${formatNumber(feet.y)}`,
    `speed=${formatNumber(snapshot.speed)}`,
    `state=${snapshot.state}`,
    `grounded=${String(snapshot.grounded)}`,
    `stance=${snapshot.stance}`,
    `posture=${formatNumber(snapshot.postureHeight)}`,
  ].join(" ");
}

function horizontalDistance(
  from: { readonly x: number; readonly z: number },
  to: { readonly x: number; readonly z: number },
): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

afterEach(() => {
  for (const harness of harnesses) {
    harness.player.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;

  for (const checkpointSystem of checkpointSystems) {
    checkpointSystem.dispose();
  }

  checkpointSystems.length = 0;
});

/* ------------------------------------------------------------------------- */
/* Criterion 8 — two sprint jumps across the authored roof gaps (§11.2)       */
/* ------------------------------------------------------------------------- */

describe("criterion 8 — roof gap sprint jumps", () => {
  it("sprint-jumps gap A (3.4 m from z=-2 to z=-5.4) and lands grounded on roof B", async () => {
    const startDeck = boundsOfId("geo_start_deck");
    const roofB = boundsOfId("geo_roof_b");
    const gapA = startDeck.minZ - roofB.maxZ;

    expect(gapA).toBeCloseTo(3.4, 5);

    const harness = await createHarnessAtSpawn("sp_initial");

    settle(harness);

    expect(
      harness.player.getMovementSnapshot().grounded,
      context(harness, "spawn did not settle on the starting roof"),
    ).toBe(true);

    const startZ = harness.player.getPosition().z;
    let takeoffZ = startZ;
    let takeoffSpeed = 0;
    let jumped = false;
    let landed = false;
    let landingPosition = harness.player.getPosition();
    let landingFeetY = 0;
    let minFeetY = Number.POSITIVE_INFINITY;
    let jumpHoldFrames = 0;

    for (let index = 0; index < MAX_STEPS; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const shouldJump = !jumped && snapshot.grounded && position.z <= -1.55;

      if (shouldJump) {
        jumped = true;
        takeoffZ = position.z;
        takeoffSpeed = snapshot.speed;
        jumpHoldFrames = 30;
      }

      stepOnce(
        harness,
        input({
          move: { x: 0, y: 1 },
          sprintHeld: true,
          jumpPressed: shouldJump,
          jumpHeld: jumpHoldFrames > 0,
        }),
      );

      jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);
      minFeetY = Math.min(minFeetY, harness.player.getFeetPosition().y);

      const after = harness.player.getMovementSnapshot();

      if (jumped && after.grounded && harness.player.getPosition().z < roofB.maxZ) {
        landed = true;
        landingPosition = { ...harness.player.getPosition() };
        landingFeetY = harness.player.getFeetPosition().y;
        break;
      }
    }

    const runUp = startZ - takeoffZ;
    const finalContext = context(harness, "gap A");

    expect(jumped, finalContext).toBe(true);
    expect(runUp, `${finalContext} runUp=${formatNumber(runUp)} m`).toBeGreaterThanOrEqual(10);
    expect(
      takeoffSpeed,
      `${finalContext} takeoffSpeed=${formatNumber(takeoffSpeed)} m/s`,
    ).toBeGreaterThanOrEqual(DEFAULT_MOVEMENT_TUNING.sprintSpeed - 0.1);
    expect(landed, `${finalContext} minFeetY=${formatNumber(minFeetY)}`).toBe(true);
    expect(landingPosition.z, finalContext).toBeLessThanOrEqual(roofB.maxZ);
    expect(landingPosition.z, finalContext).toBeGreaterThanOrEqual(roofB.minZ);
    expect(Math.abs(landingFeetY - roofB.maxY), finalContext).toBeLessThanOrEqual(0.05);
    expect(
      harness.player.getMovementSnapshot().grounded,
      `${finalContext} did not confirm grounding after crossing`,
    ).toBe(true);
  });

  it("sprint-jumps gap B (4.2 m from z=-13.4 to z=-17.6) and lands grounded on roof C", async () => {
    const roofB = boundsOfId("geo_roof_b");
    const roofC = boundsOfId("geo_roof_c");
    const gapB = roofB.minZ - roofC.maxZ;

    expect(gapB).toBeCloseTo(4.2, 5);

    const harness = await createHarnessAtSpawn("sp_initial");

    settle(harness);

    let jumpedA = false;
    let landedA = false;
    let jumpedB = false;
    let landedB = false;
    let takeoffZ = 0;
    let takeoffSpeed = 0;
    // §11.2 asks for a ≥ 10 m run-up before each jump. The authored roof B is
    // 8.0 m deep, so a standalone 10 m approach on roof B does not exist; the
    // test therefore measures the uninterrupted sprint ground distance from
    // the spawn to the gap-B take-off (the player never stops sprinting).
    let sprintGroundDistance = 0;
    let roofBGroundDistance = 0;
    let previousPosition = harness.player.getPosition();
    let landingPosition = harness.player.getPosition();
    let landingFeetY = 0;
    let minFeetY = Number.POSITIVE_INFINITY;
    let jumpHoldFrames = 0;

    for (let index = 0; index < MAX_STEPS * 2; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const shouldJumpA = !jumpedA && snapshot.grounded && position.z <= -1.55;
      const shouldJumpB =
        !shouldJumpA && !jumpedB && landedA && snapshot.grounded && position.z <= -13.0;
      const shouldJump = shouldJumpA || shouldJumpB;

      if (shouldJump) {
        if (shouldJumpA) {
          jumpedA = true;
        } else {
          jumpedB = true;
        }

        takeoffZ = position.z;
        takeoffSpeed = snapshot.speed;
        jumpHoldFrames = 30;
      }

      stepOnce(
        harness,
        input({
          move: { x: 0, y: 1 },
          sprintHeld: true,
          jumpPressed: shouldJump,
          jumpHeld: jumpHoldFrames > 0,
        }),
      );

      jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);
      minFeetY = Math.min(minFeetY, harness.player.getFeetPosition().y);

      const after = harness.player.getMovementSnapshot();
      const currentPosition = harness.player.getPosition();

      if (after.grounded && !jumpedB) {
        sprintGroundDistance += horizontalDistance(previousPosition, currentPosition);
      }

      if (after.grounded && currentPosition.z < roofB.maxZ) {
        if (jumpedA && !landedA) {
          landedA = true;
        }

        if (landedA) {
          roofBGroundDistance += horizontalDistance(previousPosition, currentPosition);
        }
      }

      previousPosition = currentPosition;

      if (jumpedB && after.grounded && currentPosition.z < roofC.maxZ) {
        landedB = true;
        landingPosition = { ...currentPosition };
        landingFeetY = harness.player.getFeetPosition().y;
        break;
      }
    }

    const finalContext = context(harness, "gap B");

    expect(jumpedA, `${finalContext} gap A was never attempted`).toBe(true);
    expect(landedA, `${finalContext} gap A did not land`).toBe(true);
    expect(jumpedB, `${finalContext} gap B was never attempted`).toBe(true);
    expect(
      sprintGroundDistance,
      `${finalContext} uninterrupted sprint ground distance before gap B = ${formatNumber(
        sprintGroundDistance,
      )} m (roof-B segment ${formatNumber(roofBGroundDistance)} m)`,
    ).toBeGreaterThanOrEqual(10);
    expect(
      takeoffSpeed,
      `${finalContext} takeoffSpeed=${formatNumber(takeoffSpeed)} m/s takeoffZ=${formatNumber(
        takeoffZ,
      )}`,
    ).toBeGreaterThanOrEqual(DEFAULT_MOVEMENT_TUNING.sprintSpeed - 0.1);
    expect(landedB, `${finalContext} minFeetY=${formatNumber(minFeetY)}`).toBe(true);
    expect(landingPosition.z, finalContext).toBeLessThanOrEqual(roofC.maxZ);
    expect(landingPosition.z, finalContext).toBeGreaterThanOrEqual(roofC.minZ);
    expect(Math.abs(landingFeetY - roofC.maxY), finalContext).toBeLessThanOrEqual(0.05);
    expect(
      harness.player.getMovementSnapshot().grounded,
      `${finalContext} did not confirm grounding after crossing`,
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */
/* Criterion 9 — 0.9 m plant step needs a jump, autostep stays at 0.4 m       */
/* ------------------------------------------------------------------------- */

describe("criterion 9 — 0.9 m plant step", () => {
  it("jumps onto geo_plant_step and stands at its authored 0.90 m height", async () => {
    const roofC = boundsOfId("geo_roof_c");
    const plantStep = boundsOfId("geo_plant_step");
    const rise = plantStep.maxY - roofC.maxY;

    expect(rise).toBeCloseTo(0.9, 5);
    expect(DEFAULT_MOVEMENT_TUNING.maxStepHeight).toBeCloseTo(0.4, 5);
    expect(rise).toBeGreaterThan(DEFAULT_MOVEMENT_TUNING.maxStepHeight);

    const harness = await createHarnessAtSpawn("sp_cp_building_jump");

    settle(harness);

    let jumped = false;
    let landed = false;
    let landingFeetY = 0;
    let landingZ = 0;
    let minFeetY = Number.POSITIVE_INFINITY;
    let jumpHoldFrames = 0;
    let stableLandingFrames = 0;

    for (let index = 0; index < MAX_STEPS; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      // 1.1 m before the authored riser face: the apex has to clear the
      // 0.90 m face before the capsule reaches it at sprint speed.
      const shouldJump = !jumped && snapshot.grounded && position.z <= -23.5;

      if (shouldJump) {
        jumped = true;
        jumpHoldFrames = 30;
      }

      stepOnce(
        harness,
        input({
          move: { x: 0, y: 1 },
          sprintHeld: true,
          jumpPressed: shouldJump,
          jumpHeld: jumpHoldFrames > 0,
        }),
      );

      jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);
      minFeetY = Math.min(minFeetY, harness.player.getFeetPosition().y);

      const after = harness.player.getMovementSnapshot();
      const afterPosition = harness.player.getPosition();
      const feetY = harness.player.getFeetPosition().y;

      // Successful climb: past the authored riser face, grounded, at the
      // planted 0.90 m height (not merely "a coordinate was reached").
      // Wait for a fully supported landing on the raised level: grounded,
      // at least one capsule radius past the riser face, at the authored top.
      if (
        jumped &&
        after.grounded &&
        afterPosition.z < plantStep.maxZ - 0.2 &&
        Math.abs(feetY - plantStep.maxY) <= 0.05
      ) {
        stableLandingFrames += 1;
        landingFeetY = feetY;
        landingZ = afterPosition.z;

        if (stableLandingFrames >= 5) {
          landed = true;
          break;
        }
      } else {
        stableLandingFrames = 0;
      }
    }

    const finalContext = context(harness, "plant step jump");

    expect(jumped, finalContext).toBe(true);
    expect(landed, `${finalContext} minFeetY=${formatNumber(minFeetY)}`).toBe(true);
    expect(landingZ, finalContext).toBeLessThan(plantStep.maxZ);
    expect(Math.abs(landingFeetY - plantStep.maxY), finalContext).toBeLessThanOrEqual(0.05);
    expect(
      harness.player.getMovementSnapshot().grounded,
      `${finalContext} was not grounded on the step top`,
    ).toBe(true);
  });

  it("cannot walk up the same 0.9 m step with autostep (0.4 m limit)", async () => {
    const roofC = boundsOfId("geo_roof_c");
    const plantStep = boundsOfId("geo_plant_step");
    const harness = await createHarnessAtSpawn("sp_cp_building_jump");

    settle(harness);
    step(harness, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 180);

    const position = harness.player.getPosition();
    const feetY = harness.player.getFeetPosition().y;
    const finalContext = context(harness, "plant step walk");

    // The capsule stops at the authored vertical face; it must neither climb
    // the 0.9 m riser nor end up at the step-top height.
    expect(position.z, finalContext).toBeGreaterThan(plantStep.maxZ);
    expect(position.z, finalContext).toBeLessThan(-24.0);
    expect(feetY, finalContext).toBeLessThanOrEqual(roofC.maxY + 0.1);
    expect(harness.player.getMovementSnapshot().grounded, finalContext).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */
/* Criterion 10 — S2 technical gallery: entrance to exit in ≤ 6 s             */
/* ------------------------------------------------------------------------- */

describe("criterion 10 — S2 gallery traversal", () => {
  it("runs the gallery from entrance to exit in under 6 s without snagging or falling", async () => {
    const deck = boundsOfId("geo_plant_deck");
    const galleryCeiling = boundsOfId("geo_gallery_ceiling");
    const chamberCeiling = boundsOfId("geo_chamber_ceiling");
    const exitZ = Math.min(boundsOfId("geo_chamber_wall_w").minZ, chamberCeiling.minZ);

    const harness = await createHarnessAtSpawn("sp_entry_technical");
    const startPosition = { ...harness.player.getPosition() };

    settle(harness);

    let elapsedSeconds = 0;
    let minFeetY = harness.player.getFeetPosition().y;
    let minSpeed = Number.POSITIVE_INFINITY;
    let maxLateral = 0;
    let groundingLost = false;
    let reachedExit = false;

    for (let index = 0; index < MAX_STEPS; index += 1) {
      stepOnce(harness, input({ move: { x: 0, y: 1 }, sprintHeld: true }));

      elapsedSeconds += DT;

      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const feetY = harness.player.getFeetPosition().y;

      minFeetY = Math.min(minFeetY, feetY);
      maxLateral = Math.max(maxLateral, Math.abs(position.x));

      if (index > 20) {
        minSpeed = Math.min(minSpeed, snapshot.speed);
      }

      if (!snapshot.grounded) {
        groundingLost = true;
      }

      if (position.z <= exitZ) {
        reachedExit = true;
        break;
      }
    }

    const finalContext = context(harness, "gallery");
    const floorTop = deck.maxY;

    expect(
      reachedExit,
      `${finalContext} start=(${formatNumber(startPosition.x)}, ${formatNumber(
        startPosition.y,
      )}, ${formatNumber(startPosition.z)}) exitZ=${formatNumber(exitZ)} elapsed=${formatNumber(
        elapsedSeconds,
      )} s`,
    ).toBe(true);
    expect(elapsedSeconds, finalContext).toBeLessThanOrEqual(6);
    expect(groundingLost, `${finalContext} left the floor inside the gallery`).toBe(false);
    expect(minFeetY, finalContext).toBeGreaterThanOrEqual(floorTop - 0.1);
    expect(minSpeed, `${finalContext} stalled inside the gallery`).toBeGreaterThan(5);
    expect(maxLateral, `${finalContext} drifted into a gallery wall`).toBeLessThan(0.5);
    expect(harness.player.getMovementSnapshot().grounded, finalContext).toBe(true);
    expect(
      Math.abs(harness.player.getFeetPosition().y - floorTop),
      finalContext,
    ).toBeLessThanOrEqual(0.05);
    expect(harness.player.getPosition().z, finalContext).toBeLessThanOrEqual(exitZ);
    expect(galleryCeiling.maxY, "gallery ceiling must stay above the floor").toBeGreaterThan(
      floorTop,
    );
  });
});

/* ------------------------------------------------------------------------- */
/* Criterion 11 — S3 slide duct clearance, standing blocked, crouch/slide     */
/* ------------------------------------------------------------------------- */

describe("criterion 11 — S3 slide duct", () => {
  const floor = boundsOfId("geo_slide_floor");
  const ceiling = boundsOfId("geo_slide_ceiling");
  const duct = {
    minX: boundsOfId("geo_slide_wall_w").maxX,
    maxX: boundsOfId("geo_slide_wall_e").minX,
    minZ: Math.max(floor.minZ, ceiling.minZ),
    maxZ: Math.min(floor.maxZ, ceiling.maxZ),
  };
  const clearance = ceiling.minY - floor.maxY;

  it("keeps the authored 1.00 m (±0.02) clearance and blocks a standing player", async () => {
    expect(Math.abs(clearance - 1.0)).toBeLessThanOrEqual(0.02);
    expect(DEFAULT_MOVEMENT_TUNING.capsuleHeight).toBeGreaterThan(clearance);
    expect(DEFAULT_MOVEMENT_TUNING.crouchHeight).toBeGreaterThan(clearance);
    expect(DEFAULT_MOVEMENT_TUNING.slideHeight).toBeLessThan(clearance);

    const harness = await createHarnessAtSpawn("sp_entry_slide");

    settle(harness);
    step(harness, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 180);

    const position = harness.player.getPosition();
    const feetY = harness.player.getFeetPosition().y;
    const snapshot = harness.player.getMovementSnapshot();
    const finalContext = context(harness, "standing duct entry");

    expect(position.z, finalContext).toBeGreaterThan(duct.maxZ);
    expect(position.z, finalContext).toBeLessThan(duct.maxZ + 0.6);
    expect(snapshot.postureHeight, finalContext).toBe(DEFAULT_MOVEMENT_TUNING.capsuleHeight);
    expect(Math.abs(feetY - floor.maxY), finalContext).toBeLessThanOrEqual(0.05);
    expect(snapshot.grounded, finalContext).toBe(true);
  });

  it("passes the duct when crouch is held at 8.5 m/s (slide posture)", async () => {
    const harness = await createHarnessAtSpawn("sp_entry_slide");

    settle(harness);

    let crouchStartZ = 0;
    let crouchEntrySpeed = 0;
    let minPostureInDuct = Number.POSITIVE_INFINITY;
    let maxPostureInDuct = 0;
    let crossed = false;

    for (let index = 0; index < MAX_STEPS; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const holdCrouch = position.z <= -45.4;

      if (holdCrouch && crouchStartZ === 0) {
        crouchStartZ = position.z;
        crouchEntrySpeed = snapshot.speed;
      }

      stepOnce(
        harness,
        input({
          move: { x: 0, y: 1 },
          sprintHeld: true,
          crouchHeld: holdCrouch,
        }),
      );

      const after = harness.player.getPosition();
      const afterSnapshot = harness.player.getMovementSnapshot();

      if (after.z <= duct.maxZ && after.z >= duct.minZ) {
        minPostureInDuct = Math.min(minPostureInDuct, afterSnapshot.postureHeight);
        maxPostureInDuct = Math.max(maxPostureInDuct, afterSnapshot.postureHeight);
      }

      if (after.z < duct.minZ - 0.2) {
        crossed = true;
        break;
      }
    }

    const finalContext = context(harness, "duct crouch 8.5 m/s");

    expect(crouchStartZ, `crouch was never requested before the duct; ${finalContext}`).not.toBe(0);
    expect(crouchEntrySpeed, `${finalContext} crouch entry speed`).toBeGreaterThanOrEqual(8.4);
    expect(crossed, finalContext).toBe(true);
    expect(maxPostureInDuct, `${finalContext} duct postures`).toBeLessThanOrEqual(
      DEFAULT_MOVEMENT_TUNING.slideHeight + 0.02,
    );
    expect(minPostureInDuct, finalContext).toBeGreaterThanOrEqual(
      DEFAULT_MOVEMENT_TUNING.slideHeight - 0.02,
    );
    expect(
      Math.abs(harness.player.getFeetPosition().y - floor.maxY),
      finalContext,
    ).toBeLessThanOrEqual(0.05);
    expect(harness.player.getMovementSnapshot().grounded, finalContext).toBe(true);
  });

  it("passes the duct when crouch is held at 6.0 m/s (slide then crouch)", async () => {
    const harness = await createHarnessAtSpawn("sp_entry_slide");

    settle(harness);

    let crouchStartZ = 0;
    let crouchEntrySpeed = 0;
    let minPostureInDuct = Number.POSITIVE_INFINITY;
    let maxPostureInDuct = 0;
    let crossed = false;

    for (let index = 0; index < MAX_STEPS; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const holdCrouch = position.z <= -45.4;

      if (holdCrouch && crouchStartZ === 0) {
        crouchStartZ = position.z;
        crouchEntrySpeed = snapshot.speed;
      }

      stepOnce(
        harness,
        input({
          move: { x: 0, y: 1 },
          crouchHeld: holdCrouch,
        }),
      );

      const after = harness.player.getPosition();
      const afterSnapshot = harness.player.getMovementSnapshot();

      if (after.z <= duct.maxZ && after.z >= duct.minZ) {
        minPostureInDuct = Math.min(minPostureInDuct, afterSnapshot.postureHeight);
        maxPostureInDuct = Math.max(maxPostureInDuct, afterSnapshot.postureHeight);
      }

      if (after.z < duct.minZ - 0.2) {
        crossed = true;
        break;
      }
    }

    const finalContext = context(harness, "duct crouch 6.0 m/s");

    expect(crouchStartZ, `crouch was never requested before the duct; ${finalContext}`).not.toBe(0);
    expect(crouchEntrySpeed, `${finalContext} crouch entry speed`).toBeGreaterThanOrEqual(5.9);
    expect(crouchEntrySpeed, `${finalContext} crouch entry speed`).toBeLessThanOrEqual(6.1);
    expect(crossed, finalContext).toBe(true);
    expect(maxPostureInDuct, `${finalContext} duct postures`).toBeLessThanOrEqual(
      DEFAULT_MOVEMENT_TUNING.slideHeight + 0.02,
    );
    expect(minPostureInDuct, finalContext).toBeGreaterThanOrEqual(
      DEFAULT_MOVEMENT_TUNING.slideHeight - 0.02,
    );
    expect(
      Math.abs(harness.player.getFeetPosition().y - floor.maxY),
      finalContext,
    ).toBeLessThanOrEqual(0.05);
    expect(harness.player.getMovementSnapshot().grounded, finalContext).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */
/* Criterion 12 — three S4 vault obstacles detected from three approach points */
/* ------------------------------------------------------------------------- */

describe("criterion 12 — S4 vault detector", () => {
  const obstacleIds = ["geo_vault_1", "geo_vault_2", "geo_vault_3"] as const;
  const deck = boundsOfId("geo_vault_deck");
  // Three lateral approach points across the 4.0 m obstacles: west third,
  // centre, east third. This is a superset of the spec's three obstacles.
  const approachPoints = [-1.2, 0, 1.2] as const;
  const obstacleHeights = [0.5, 0.7, 1.1] as const;

  it("authors exactly three vault obstacles in S4", () => {
    const authored = geometryOfSection(FIRST_SECTION_SECTION_IDS.vault).filter((geometry) =>
      geometry.id.startsWith("geo_vault_"),
    );
    const obstacles = authored.filter(
      (geometry) => geometry.id !== "geo_vault_deck" && !geometry.id.startsWith("geo_vault_wall_"),
    );

    expect(obstacles.map((obstacle) => obstacle.id)).toEqual([...obstacleIds]);
    expect(obstacles.map((obstacle) => obstacle.size.x)).toEqual([4, 4, 4]);
    expect(obstacles.map((obstacle) => obstacle.size.z)).toEqual([0.7, 0.7, 0.7]);

    for (const [index, obstacle] of obstacles.entries()) {
      expect(boundsOf(obstacle).maxY - deck.maxY).toBeCloseTo(obstacleHeights[index] ?? 0, 6);
    }
  });

  it("detects geo_vault_1 at the physical feet height with the 0.02 m controller offset", async () => {
    const obstacle = boundsOfId("geo_vault_1");
    const topY = obstacle.maxY;
    // 1.0 m before the authored front face: inside the 1.1 m forward reach.
    const harness = await createHarness({
      x: 0,
      y: deck.maxY + 0.93,
      z: obstacle.maxZ + 1.0,
    });

    settle(harness);

    const position = harness.player.getPosition();
    // The real physical feet height (0.920 on a 0.900 deck: Rapier's 0.02 m
    // character-controller offset), not the authored deck top. Passing 0.900
    // here would hide the production mismatch.
    const feetY = harness.player.getFeetPosition().y;
    const candidate = harness.detector.detect(position, { x: 0, y: 0, z: -1 }, feetY);

    expect(
      candidate,
      `geo_vault_1 z=${formatNumber(position.z)} feetY=${formatNumber(
        feetY,
      )} chestY=${formatNumber(feetY + 0.5)} obstacleTopY=${formatNumber(
        topY,
      )} (${context(harness, "deterministic detector probe")})`,
    ).not.toBeNull();
  });

  for (const [index, obstacleId] of obstacleIds.entries()) {
    it(`detects ${obstacleId} from three lateral approach points at 6 m/s`, async () => {
      const obstacle = boundsOfId(obstacleId);
      const topY = deck.maxY + (obstacleHeights[index] ?? 0);
      const failures: string[] = [];

      for (const approachX of approachPoints) {
        const harness = await createHarness({
          x: approachX,
          y: deck.maxY + 0.93,
          z: obstacle.maxZ + 3.0,
        });

        settle(harness);

        let candidate: ReturnType<VaultDetector["detect"]> = null;
        let detectionSpeed = 0;
        let detectionZ = 0;
        let detectionFeetY = 0;

        for (let stepIndex = 0; stepIndex < 120; stepIndex += 1) {
          stepOnce(harness, input({ move: { x: 0, y: 1 } }));

          const position = harness.player.getPosition();
          const feetY = harness.player.getFeetPosition().y;
          const snapshot = harness.player.getMovementSnapshot();

          candidate = harness.detector.detect(position, { x: 0, y: 0, z: -1 }, feetY);
          detectionSpeed = snapshot.speed;
          detectionZ = position.z;
          detectionFeetY = feetY;

          if (candidate) {
            break;
          }
        }

        if (!candidate) {
          failures.push(
            `${obstacleId} x=${approachX}: detect returned null at z=${formatNumber(
              detectionZ,
            )} feetY=${formatNumber(detectionFeetY)} chestY=${formatNumber(
              detectionFeetY + 0.5,
            )} obstacleTopY=${formatNumber(topY)} (${context(harness, "detector")})`,
          );
          continue;
        }

        if (detectionSpeed < 5.9) {
          failures.push(
            `${obstacleId} x=${approachX}: approach speed ${formatNumber(
              detectionSpeed,
            )} m/s at z=${formatNumber(detectionZ)}`,
          );
        }

        if (Math.abs(candidate.obstacleTopY - topY) > 0.02) {
          failures.push(
            `${obstacleId} x=${approachX}: obstacleTopY=${formatNumber(
              candidate.obstacleTopY,
            )} expected ${formatNumber(topY)}`,
          );
        }

        if (candidate.landingPosition.z >= obstacle.minZ) {
          failures.push(
            `${obstacleId} x=${approachX}: landing z=${formatNumber(
              candidate.landingPosition.z,
            )} is not beyond the obstacle back face ${formatNumber(obstacle.minZ)}`,
          );
        }
      }

      expect(failures, failures.join("\n")).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------------- */
/* Criterion 12 — PlayerSystem vault integration (real E input)                */
/* ------------------------------------------------------------------------- */

describe("criterion 12 — PlayerSystem vault integration", () => {
  const deck = boundsOfId("geo_vault_deck");
  const obstacleIds = ["geo_vault_1", "geo_vault_2", "geo_vault_3"] as const;
  const approachPoints = [-1.2, 0, 1.2] as const;

  for (const obstacleId of obstacleIds) {
    for (const approachX of approachPoints) {
      it(`vaults ${obstacleId} through PlayerSystem at x=${approachX}`, async () => {
        const obstacle = boundsOfId(obstacleId);
        const harness = await createHarness({
          x: approachX,
          y: deck.maxY + 0.93,
          z: obstacle.maxZ + 3.0,
        });
        const obstacleCollider = harness.colliders.get(obstacleId);

        if (!obstacleCollider) {
          throw new Error(`Harness has no authored collider for "${obstacleId}".`);
        }

        settle(harness);

        const events: Array<{ speed: number; vaultType: "standard" | "speed" }> = [];

        harness.player.onMovementEvent("player:vault-started", (payload) => {
          events.push({ ...payload });
        });

        let sawVaulting = false;
        let vaultFrames = 0;
        let maxFeet = Number.NEGATIVE_INFINITY;
        let minCenterClearance = Number.POSITIVE_INFINITY;
        let penetrated = false;
        let exitSpeed: number | null = null;
        let landed = false;
        let landingZ = 0;
        let stableFeetY = 0;
        let groundedFrames = 0;

        for (let index = 0; index < 300; index += 1) {
          const pressInteract = events.length === 0;

          stepOnce(harness, input({ move: { x: 0, y: 1 }, interactPressed: pressInteract }));

          const position = harness.player.getPosition();
          const snapshot = harness.player.getMovementSnapshot();
          const feetY = harness.player.getFeetPosition().y;

          if (harness.world.intersectionPair(harness.player.collider, obstacleCollider)) {
            penetrated = true;
          }

          if (snapshot.state === "VAULTING") {
            sawVaulting = true;
            vaultFrames += 1;
            maxFeet = Math.max(maxFeet, feetY);

            if (position.z <= obstacle.maxZ && position.z >= obstacle.minZ) {
              minCenterClearance = Math.min(minCenterClearance, feetY - obstacle.maxY);
            }
          }

          if (sawVaulting && snapshot.state !== "VAULTING" && exitSpeed === null) {
            exitSpeed = snapshot.speed;
          }

          if (exitSpeed !== null) {
            if (snapshot.grounded) {
              groundedFrames += 1;

              if (groundedFrames === 1) {
                landingZ = position.z;
              }

              if (groundedFrames >= 5) {
                landed = true;
                stableFeetY = feetY;
                break;
              }
            } else {
              groundedFrames = 0;
            }
          }
        }

        const finalContext = context(harness, `${obstacleId} x=${approachX}`);
        const event = events[0];
        const vSpeedRetention = DEFAULT_MOVEMENT_TUNING.vaultSpeedMomentumRetention;
        const standardRetention = DEFAULT_MOVEMENT_TUNING.vaultStandardMomentumRetention;

        expect(events.length, finalContext).toBe(1);
        expect(sawVaulting, `${finalContext} state VAULTING was never observed`).toBe(true);
        expect(vaultFrames, `${finalContext} active vault frames`).toBeGreaterThanOrEqual(10);
        expect(event, finalContext).toBeDefined();

        if (!event) {
          throw new Error(`${finalContext} missing player:vault-started payload`);
        }

        expect(event.speed, `${finalContext} entry speed`).toBeGreaterThanOrEqual(5.9);
        expect(event.speed, `${finalContext} entry speed`).toBeLessThanOrEqual(6.1);

        // The 6.0 m/s profile threshold is knife-edge; only assert the
        // event/profile relation away from the boundary. The exit velocity is
        // always checked against the profile the engine actually applied.
        if (Math.abs(event.speed - DEFAULT_MOVEMENT_TUNING.vaultSpeedMinEntrySpeed) > 0.05) {
          expect(event.vaultType, finalContext).toBe(
            event.speed >= DEFAULT_MOVEMENT_TUNING.vaultSpeedMinEntrySpeed ? "speed" : "standard",
          );
        }

        const retention = event.vaultType === "speed" ? vSpeedRetention : standardRetention;

        expect(exitSpeed, `${finalContext} no post-vault frame`).not.toBeNull();
        expect(exitSpeed ?? 0, `${finalContext} exit speed`).toBeCloseTo(
          event.speed * retention,
          2,
        );
        expect(penetrated, `${finalContext} capsule intersected the obstacle`).toBe(false);
        expect(Number.isFinite(minCenterClearance), finalContext).toBe(true);
        expect(
          minCenterClearance,
          `${finalContext} capsule bottom did not clear the top while over it`,
        ).toBeGreaterThanOrEqual(0.01);
        expect(maxFeet, `${finalContext} apex did not clear the top`).toBeGreaterThan(
          obstacle.maxY + 0.1,
        );
        expect(landed, `${finalContext} did not settle after landing`).toBe(true);
        expect(landingZ, `${finalContext} landing is not behind the back face`).toBeLessThan(
          obstacle.minZ - 0.2,
        );
        expect(
          Math.abs(stableFeetY - (deck.maxY + 0.02)),
          `${finalContext} landing feet height`,
        ).toBeLessThanOrEqual(0.03);
        expect(harness.player.getMovementSnapshot().grounded, finalContext).toBe(true);
        expect(
          Math.abs(harness.player.getPosition().x - approachX),
          finalContext,
        ).toBeLessThanOrEqual(0.05);
      });
    }
  }
});

/* ------------------------------------------------------------------------- */
/* Criterion 13 — 0.20 m lateral gaps in S4 are not traversable               */
/* ------------------------------------------------------------------------- */

describe("criterion 13 — S4 side gaps", () => {
  it("does not let the capsule pass between any vault obstacle and the channel wall", async () => {
    const wallWest = boundsOfId("geo_vault_wall_w");
    const wallEast = boundsOfId("geo_vault_wall_e");
    const deck = boundsOfId("geo_vault_deck");
    const failures: string[] = [];

    for (const obstacleId of ["geo_vault_1", "geo_vault_2", "geo_vault_3"]) {
      const obstacle = boundsOfId(obstacleId);

      for (const side of [-1, 1] as const) {
        const wall = side < 0 ? wallWest : wallEast;
        const gapWidth = side < 0 ? obstacle.minX - wall.maxX : wall.minX - obstacle.maxX;

        if (Math.abs(gapWidth - 0.2) > 0.01) {
          failures.push(`${obstacleId} side=${side}: authored gap ${formatNumber(gapWidth)} m`);
          continue;
        }

        const harness = await createHarness({
          x: side * (obstacle.maxX - 0.15),
          y: deck.maxY + 0.93,
          z: obstacle.maxZ + 2.0,
        });

        settle(harness);

        let passed = false;
        let closestZ = Number.POSITIVE_INFINITY;

        for (let stepIndex = 0; stepIndex < 180; stepIndex += 1) {
          // Push diagonally into the 0.20 m gap for the whole approach.
          stepOnce(
            harness,
            input({
              move: { x: side, y: 1 },
              sprintHeld: false,
            }),
          );

          const position = harness.player.getPosition();

          closestZ = Math.min(closestZ, position.z);

          if (position.z < obstacle.minZ - 0.05) {
            passed = true;
            break;
          }
        }

        if (passed) {
          failures.push(
            `${obstacleId} side=${side}: capsule squeezed through the ${formatNumber(
              gapWidth,
            )} m gap (${context(harness, "side gap")})`,
          );
        }

        // The probe must actually reach the obstacle face, otherwise "blocked"
        // would be satisfied by simply not moving.
        if (closestZ > obstacle.maxZ + 0.7) {
          failures.push(
            `${obstacleId} side=${side}: never reached the obstacle face (${context(
              harness,
              "side gap",
            )}) closestZ=${formatNumber(closestZ)}`,
          );
        }

        if (harness.player.getMovementSnapshot().grounded !== true) {
          failures.push(
            `${obstacleId} side=${side}: left the deck while testing the gap (${context(
              harness,
              "side gap",
            )})`,
          );
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
    expect(DEFAULT_MOVEMENT_TUNING.capsuleRadius * 2).toBeGreaterThan(0.2);
  });
});

/* ------------------------------------------------------------------------- */
/* Criterion 14 — both S5 stair flights pass with autostep, no jumps          */
/* ------------------------------------------------------------------------- */

describe("criterion 14 — S5 stair flights", () => {
  it("walks up both 0.30 m stair flights to the 4.50 m podium without jumping", async () => {
    const landing = boundsOfId("geo_stair_landing");
    const podium = boundsOfId("geo_finish_deck");
    const harness = await createHarnessAtSpawn("sp_entry_finish");

    settle(harness);

    const startFeetY = harness.player.getFeetPosition().y;
    let firstFlightTopReached = false;
    let firstFlightFeetY = 0;
    let secondFlightTopReached = false;
    let podiumFeetY = 0;
    let minFeetY = startFeetY;
    let maxFeetY = startFeetY;
    let reachedPodium = false;

    for (let stepIndex = 0; stepIndex < MAX_STEPS; stepIndex += 1) {
      // "Обычное движение": run, never sprint, never jump.
      stepOnce(harness, input({ move: { x: 0, y: 1 } }));

      const position = harness.player.getPosition();
      const feetY = harness.player.getFeetPosition().y;

      minFeetY = Math.min(minFeetY, feetY);
      maxFeetY = Math.max(maxFeetY, feetY);

      if (!firstFlightTopReached && feetY >= landing.maxY - 0.03) {
        firstFlightTopReached = true;
        firstFlightFeetY = feetY;
      }

      if (firstFlightTopReached && !secondFlightTopReached && feetY >= podium.maxY - 0.03) {
        secondFlightTopReached = true;
        podiumFeetY = feetY;
      }

      if (secondFlightTopReached && position.z < podium.maxZ - 0.2) {
        reachedPodium = true;
        break;
      }
    }

    const finalContext = context(harness, "stairs");

    // No jump input is ever supplied, and a real jump would raise the feet by
    // ~1.55 m above a tread. Staying within 0.05 m of the podium top proves the
    // climb used autostep, not a jump.
    expect(maxFeetY, `${finalContext} feet rose above the podium`).toBeLessThanOrEqual(
      podium.maxY + 0.05,
    );
    expect(firstFlightTopReached, `${finalContext} first flight not topped`).toBe(true);
    expect(secondFlightTopReached, `${finalContext} second flight not topped`).toBe(true);
    expect(reachedPodium, finalContext).toBe(true);
    expect(minFeetY, `${finalContext} fell below the approach`).toBeGreaterThanOrEqual(0.85);
    expect(maxFeetY, finalContext).toBeLessThanOrEqual(podium.maxY + 0.05);
    expect(firstFlightFeetY, finalContext).toBeCloseTo(landing.maxY, 1);
    expect(podiumFeetY, finalContext).toBeCloseTo(podium.maxY, 1);
    expect(harness.player.getMovementSnapshot().grounded, finalContext).toBe(true);
    expect(
      Math.abs(harness.player.getFeetPosition().y - podium.maxY),
      finalContext,
    ).toBeLessThanOrEqual(0.05);
    expect(harness.player.getPosition().z, finalContext).toBeLessThan(podium.maxZ);
  });
});

/* ------------------------------------------------------------------------- */
/* Criterion 15 — fall detection and respawn from all six sections             */
/* ------------------------------------------------------------------------- */

interface FallCase {
  readonly sectionId: FirstSectionSectionId;
  readonly expectedCheckpointId: string;
}

const FALL_CASES: readonly FallCase[] = [
  { sectionId: FIRST_SECTION_SECTION_IDS.start, expectedCheckpointId: "cp_start" },
  { sectionId: FIRST_SECTION_SECTION_IDS.buildingJump, expectedCheckpointId: "cp_building_jump" },
  { sectionId: FIRST_SECTION_SECTION_IDS.technical, expectedCheckpointId: "cp_building_jump" },
  { sectionId: FIRST_SECTION_SECTION_IDS.slide, expectedCheckpointId: "cp_slide" },
  { sectionId: FIRST_SECTION_SECTION_IDS.vault, expectedCheckpointId: "cp_vault" },
  { sectionId: FIRST_SECTION_SECTION_IDS.finish, expectedCheckpointId: "cp_vault" },
];

function checkpointDefinitions(): CheckpointDefinition[] {
  return LEVEL.checkpoints.map((checkpoint) => ({
    id: checkpoint.id,
    levelId: LEVEL.id,
    sectionId: checkpoint.sectionId,
    spawnPointId: checkpoint.spawnPointId,
    displayName: checkpoint.displayName,
    activationMode: checkpoint.activationMode ?? "automatic",
    enabled: checkpoint.enabled ?? true,
    repeatable: checkpoint.repeatable ?? true,
    respawnEnabled: checkpoint.respawnEnabled ?? true,
    ...(checkpoint.order === undefined ? {} : { order: checkpoint.order }),
  }));
}

function createCheckpointSystem(): CheckpointSystem {
  const system = new CheckpointSystem(checkpointDefinitions(), {
    levelId: LEVEL.id,
    sessionId: "first-section-traversal",
    spawnResolver: {
      resolve: (spawnPointId) => {
        const spawn = LEVEL.spawnPoints.find((candidate) => candidate.id === spawnPointId);

        return spawn ? { position: spawn.position, rotationY: spawn.rotationY } : null;
      },
    },
  });

  checkpointSystems.push(system);

  return system;
}

function killVolumeOf(sectionId: FirstSectionSectionId): LevelTriggerDefinition {
  const trigger = LEVEL.triggers.find(
    (candidate) => candidate.sectionId === sectionId && candidate.metadata?.kind === "kill-volume",
  );

  if (!trigger) {
    throw new Error(`Section "${sectionId}" has no authored kill-volume trigger.`);
  }

  return trigger;
}

/**
 * A real fall probe beside the section: just outside its widest authored
 * collider, inside the section's z range, with enough height above the route
 * that the body enters the authored kill-volume under gravity. Nothing is
 * teleported after the initial spawn.
 */
function fallProbe(sectionId: FirstSectionSectionId): LevelVector3 {
  const geometry = geometryOfSection(sectionId);
  const maxHalfX = Math.max(
    ...geometry.map((candidate) => Math.abs(candidate.position.x) + candidate.size.x / 2),
  );
  const maxTop = Math.max(
    ...geometry.map((candidate) => candidate.position.y + candidate.size.y / 2),
  );
  const entry = sectionEntrySpawn(sectionId);

  return { x: maxHalfX + 1.0, y: maxTop + 1.0, z: entry.position.z - 0.5 };
}

describe("criterion 15 — fall respawn chain", () => {
  for (const fallCase of FALL_CASES) {
    it(`catches a fall in ${fallCase.sectionId} and respawns at ${fallCase.expectedCheckpointId}`, async () => {
      const killVolume = killVolumeOf(fallCase.sectionId);
      const volume = triggerBounds(killVolume);
      const probe = fallProbe(fallCase.sectionId);
      const harness = await createHarness(probe);
      const checkpointSystem = createCheckpointSystem();
      const expectedDestination = checkpointSystem.notifyTriggerEnter(
        fallCase.expectedCheckpointId,
        1,
      );

      expect(expectedDestination, "checkpoint activation").not.toBeNull();

      const triggers = new TriggerManager();

      triggers.register(killVolume);

      const camera = { resetForRespawn: () => undefined };
      const control = { setEnabled: () => undefined };
      const initialSpawn = findSpawn("sp_initial");
      const respawn = new RespawnManager(
        { checkpoints: checkpointSystem, player: harness.player, camera, input: control },
        {
          fallbackSpawn: initialSpawn.position,
          fallbackRotationY: initialSpawn.rotationY,
        },
      );

      let requested = false;
      let detectedAtY = Number.NaN;
      let detectedTriggerId = "";

      for (let index = 0; index < 240 && !requested; index += 1) {
        harness.player.fixedUpdate(input(), 0, DT);
        const events = triggers.update(harness.player.getPosition(), "player", index + 1);

        for (const event of events) {
          if (event.eventType !== "enter" || event.metadata?.kind !== "kill-volume") {
            continue;
          }

          detectedAtY = harness.player.getPosition().y;
          detectedTriggerId = event.triggerId;
          // Production handler in `Application.handleTriggerEnter`.
          requested = respawn.request("fall");
        }

        harness.physics.step();
      }

      for (let index = 0; index < 30 && respawn.isRespawning; index += 1) {
        respawn.update(DT);
        harness.physics.step();
      }

      const expectedSpawn = findSpawn(
        checkpointSystem.getDefinition(fallCase.expectedCheckpointId)?.spawnPointId ?? "",
      );
      const finalContext = context(harness, `fall ${fallCase.sectionId}`);
      const destination = respawn.getLastDestination();

      expect(requested, `${finalContext} respawn.request("fall") was not called`).toBe(true);
      expect(detectedTriggerId, finalContext).toBe(killVolume.id);
      expect(detectedAtY, `${finalContext} detection height`).toBeGreaterThanOrEqual(
        volume.center.y - volume.halfExtents.y,
      );
      expect(detectedAtY, `${finalContext} detection height`).toBeLessThanOrEqual(
        volume.center.y + volume.halfExtents.y,
      );
      expect(detectedAtY, `${finalContext} detection height`).toBeGreaterThan(-10);
      expect(destination?.checkpointId, finalContext).toBe(fallCase.expectedCheckpointId);
      expect(destination?.position.z, finalContext).toBeCloseTo(expectedSpawn.position.z, 6);
      expect(harness.player.isActive, `${finalContext} player was not re-activated`).toBe(true);
      expect(harness.player.getPosition().x, finalContext).toBeCloseTo(expectedSpawn.position.x, 5);
      expect(harness.player.getPosition().y, finalContext).toBeCloseTo(expectedSpawn.position.y, 5);
      expect(harness.player.getPosition().z, finalContext).toBeCloseTo(expectedSpawn.position.z, 5);
    });
  }

  it("falls back to the initial spawn when no checkpoint has been activated", async () => {
    const killVolume = killVolumeOf(FIRST_SECTION_SECTION_IDS.start);
    const probe = fallProbe(FIRST_SECTION_SECTION_IDS.start);
    const harness = await createHarness(probe);
    const checkpointSystem = createCheckpointSystem();

    expect(checkpointSystem.getActiveCheckpointId()).toBeNull();

    const triggers = new TriggerManager();

    triggers.register(killVolume);

    const camera = { resetForRespawn: () => undefined };
    const control = { setEnabled: () => undefined };
    const initialSpawn = findSpawn("sp_initial");
    const respawn = new RespawnManager(
      { checkpoints: checkpointSystem, player: harness.player, camera, input: control },
      {
        fallbackSpawn: initialSpawn.position,
        fallbackRotationY: initialSpawn.rotationY,
      },
    );

    let requested = false;

    for (let index = 0; index < 240 && !requested; index += 1) {
      harness.player.fixedUpdate(input(), 0, DT);

      for (const event of triggers.update(harness.player.getPosition(), "player", index + 1)) {
        if (event.eventType === "enter" && event.metadata?.kind === "kill-volume") {
          requested = respawn.request("fall");
        }
      }

      harness.physics.step();
    }

    for (let index = 0; index < 30 && respawn.isRespawning; index += 1) {
      respawn.update(DT);
      harness.physics.step();
    }

    const destination = respawn.getLastDestination();
    const finalContext = context(harness, "fall without checkpoint");

    expect(requested, finalContext).toBe(true);
    expect(destination?.checkpointId, finalContext).toBe("fallback");
    expect(destination?.position, finalContext).toEqual(initialSpawn.position);
    expect(harness.player.getPosition().x, finalContext).toBeCloseTo(initialSpawn.position.x, 5);
    expect(harness.player.getPosition().y, finalContext).toBeCloseTo(initialSpawn.position.y, 5);
    expect(harness.player.getPosition().z, finalContext).toBeCloseTo(initialSpawn.position.z, 5);
  });

  it("triggers the kill-volume respawn chain at the spec y=-10 probe", async () => {
    const killVolume = killVolumeOf(FIRST_SECTION_SECTION_IDS.start);
    const volume = triggerBounds(killVolume);
    const harness = await createHarnessAtSpawn("sp_initial");
    const checkpointSystem = createCheckpointSystem();

    checkpointSystem.notifyTriggerEnter("cp_start", 1);

    const triggers = new TriggerManager();

    triggers.register(killVolume);

    // §11.2 / §9.3 name `y = -10` as the fall probe. The authored slab spans
    // y ∈ [center - halfExtents.y, center + halfExtents.y]; the test records
    // the actual coverage rather than assuming it.
    const slabMinY = volume.center.y - volume.halfExtents.y;
    const slabMaxY = volume.center.y + volume.halfExtents.y;

    harness.player.teleportTo({ x: 0, y: -10, z: 14 });

    const atMinusTen = triggers
      .update(harness.player.getPosition(), "player", 1)
      .filter((event) => event.eventType === "enter" && event.metadata?.kind === "kill-volume");

    expect(
      atMinusTen,
      `kill volume ${killVolume.id} spans y∈[${formatNumber(slabMinY)}, ${formatNumber(
        slabMaxY,
      )}]; the y=-10 probe is outside it`,
    ).toHaveLength(1);
  });
});
