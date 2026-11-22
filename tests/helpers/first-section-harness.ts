import RAPIER from "@dimforge/rapier3d-compat";

import { FIRST_SECTION_LEVEL } from "../../src/levels/first-section/FirstSectionLevel";
import type {
  LevelDefinition,
  LevelGeometryDefinition,
  LevelSpawnPointDefinition,
  LevelVector3,
} from "../../src/levels/LevelTypes";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";

/**
 * Headless First Section harness shared by the Step 3.7 vault regression suites.
 *
 * The collision layer is the production authored geometry, loaded exactly like
 * `BoxLevelContentLoader`: one fixed body per `geometry` entry, a cuboid of
 * `size / 2` half extents, friction 1, restitution 0. Movement runs through the
 * real `PlayerSystem`, `DEFAULT_MOVEMENT_TUNING` and a fixed 1/60 s step.
 */

export const FIXED_DT = 1 / 60;
export const LEVEL: LevelDefinition = FIRST_SECTION_LEVEL;

export interface GeometryBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface FirstSectionHarness {
  readonly physics: PhysicsWorld;
  readonly player: PlayerSystem;
  readonly world: RAPIER.World;
  /** Authored colliders by geometry id, for engine-authoritative overlap checks. */
  readonly colliders: ReadonlyMap<string, RAPIER.Collider>;
  dispose(): void;
}

export function createInput(overrides: Partial<MovementInputSample> = {}): MovementInputSample {
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

export function findGeometry(id: string): LevelGeometryDefinition {
  const geometry = LEVEL.geometry.find((candidate) => candidate.id === id);

  if (!geometry) {
    throw new Error(`FIRST_SECTION_LEVEL is missing geometry "${id}".`);
  }

  return geometry;
}

export function boundsOf(geometry: LevelGeometryDefinition): GeometryBounds {
  return {
    minX: geometry.position.x - geometry.size.x / 2,
    maxX: geometry.position.x + geometry.size.x / 2,
    minY: geometry.position.y - geometry.size.y / 2,
    maxY: geometry.position.y + geometry.size.y / 2,
    minZ: geometry.position.z - geometry.size.z / 2,
    maxZ: geometry.position.z + geometry.size.z / 2,
  };
}

export function boundsOfId(id: string): GeometryBounds {
  return boundsOf(findGeometry(id));
}

export function findSpawn(id: string): LevelSpawnPointDefinition {
  const spawn = LEVEL.spawnPoints.find((candidate) => candidate.id === id);

  if (!spawn) {
    throw new Error(`FIRST_SECTION_LEVEL is missing spawn point "${id}".`);
  }

  return spawn;
}

export async function createHarness(spawn: LevelVector3): Promise<FirstSectionHarness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: FIXED_DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;
  const colliders = new Map<string, RAPIER.Collider>();

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

  return {
    physics,
    player,
    world,
    colliders,
    dispose: () => {
      player.dispose();
      physics.dispose();
    },
  };
}

export function stepOnce(harness: FirstSectionHarness, sample: MovementInputSample, yaw = 0): void {
  harness.player.fixedUpdate(sample, yaw, FIXED_DT);
  harness.physics.step();
}

export function step(
  harness: FirstSectionHarness,
  sample: MovementInputSample,
  steps: number,
  yaw = 0,
): void {
  for (let index = 0; index < steps; index += 1) {
    stepOnce(harness, sample, yaw);
  }
}

/** Fixed-step settle used before every scenario so the capsule rests on the deck. */
export function settle(harness: FirstSectionHarness, steps = 60): void {
  step(harness, createInput(), steps);
}

export function formatNumber(value: number): string {
  return value.toFixed(3);
}

/** Compact failure context: body position, feet, speed, state and grounding. */
export function context(harness: FirstSectionHarness, label: string): string {
  const position = harness.player.getPosition();
  const feet = harness.player.getFeetPosition();
  const snapshot = harness.player.getMovementSnapshot();

  return [
    label,
    `position=(${formatNumber(position.x)}, ${formatNumber(position.y)}, ${formatNumber(
      position.z,
    )})`,
    `feetY=${formatNumber(feet.y)}`,
    `vy=${formatNumber(snapshot.verticalSpeed)}`,
    `speed=${formatNumber(snapshot.speed)}`,
    `state=${snapshot.state}`,
    `grounded=${String(snapshot.grounded)}`,
    `stance=${snapshot.stance}`,
    `posture=${formatNumber(snapshot.postureHeight)}`,
  ].join(" ");
}
