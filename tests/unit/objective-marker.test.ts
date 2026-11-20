import { describe, expect, it, vi } from "vitest";

import type { LevelDefinition } from "../../src/levels/LevelTypes";
import {
  computeObjectiveMarkerFadeAlpha,
  computeObjectiveMarkerPose,
  createObjectiveMarkerTarget,
  OBJECTIVE_MARKER_APEX_HEIGHT,
  OBJECTIVE_MARKER_BASE_HEIGHT,
  OBJECTIVE_MARKER_BASE_SIZE,
  OBJECTIVE_MARKER_BOB_AMPLITUDE,
  OBJECTIVE_MARKER_BOB_PERIOD_SECONDS,
  OBJECTIVE_MARKER_COLOR,
  OBJECTIVE_MARKER_EMISSION,
  OBJECTIVE_MARKER_EMISSION_CAP,
  OBJECTIVE_MARKER_HEIGHT,
  OBJECTIVE_MARKER_METALNESS,
  OBJECTIVE_MARKER_RING_DIAMETER,
  OBJECTIVE_MARKER_RING_HEIGHT,
  OBJECTIVE_MARKER_ROUGHNESS,
  OBJECTIVE_MARKER_TARGET_CENTRE_HEIGHT,
  OBJECTIVE_MARKER_YAW_RADIANS_PER_SECOND,
  type ObjectiveMarkerPose,
  type ObjectiveMarkerTargetRules,
  resolveObjectiveMarkerTarget,
} from "../../src/markers/ObjectiveMarkerRules";
import {
  createObjectiveMarkerMaterial,
  createObjectiveMarkerRingMaterial,
  ObjectiveMarkerSystem,
} from "../../src/markers/ObjectiveMarkerSystem";
import { TRAINING_EXERCISES } from "../../src/training/TrainingExercises";
import { TrainingSystem } from "../../src/training/TrainingSystem";
import type { TrainingObjectiveDefinition } from "../../src/training/TrainingTypes";

function createPrologueLevel(): LevelDefinition {
  return {
    id: "test_prologue",
    version: "1.0.0",
    mode: "prologue",
    displayName: "Test Prologue",
    initialSpawnPointId: "sp_initial",
    metadata: { supportsSpeedrun: true, supportsRespawn: true },
    sections: [
      {
        id: "sec_start",
        order: 0,
        displayName: "Start",
        entrySpawnPointId: "sp_initial",
        activationPolicy: "automatic",
        nextSectionId: "sec_mid",
      },
      {
        id: "sec_mid",
        order: 1,
        displayName: "Mid",
        entrySpawnPointId: "sp_initial",
        activationPolicy: "automatic",
        nextSectionId: "sec_finish",
      },
      {
        id: "sec_finish",
        order: 2,
        displayName: "Finish",
        entrySpawnPointId: "sp_initial",
        activationPolicy: "automatic",
      },
    ],
    spawnPoints: [
      {
        id: "sp_initial",
        sectionId: "sec_start",
        position: { x: 0, y: 0.93, z: 6 },
        rotationY: 0,
        type: "initial",
      },
    ],
    triggers: [
      {
        id: "trigger_cp_start",
        sectionId: "sec_start",
        type: "checkpoint",
        center: { x: 0, y: 1, z: 3 },
        halfExtents: { x: 3, y: 1.5, z: 2 },
        metadata: { checkpointId: "cp_start" },
      },
      {
        id: "trigger_cp_mid",
        sectionId: "sec_mid",
        type: "checkpoint",
        center: { x: 0, y: 1, z: -2 },
        halfExtents: { x: 3, y: 1.5, z: 2 },
        metadata: { checkpointId: "cp_mid" },
      },
      {
        id: "trigger_cp_finish",
        sectionId: "sec_finish",
        type: "checkpoint",
        center: { x: 0, y: -2, z: -66 },
        halfExtents: { x: 3, y: 2, z: 2 },
        metadata: { checkpointId: "cp_finish" },
      },
      {
        id: "trigger_finish",
        sectionId: "sec_finish",
        type: "level-transition",
        center: { x: 0, y: 5.9, z: -133 },
        halfExtents: { x: 4, y: 3, z: 0.7 },
        metadata: { kind: "finish" },
      },
    ],
    checkpoints: [
      {
        id: "cp_start",
        sectionId: "sec_start",
        triggerId: "trigger_cp_start",
        spawnPointId: "sp_initial",
        displayName: "Start",
        order: 0,
      },
      {
        id: "cp_mid",
        sectionId: "sec_mid",
        triggerId: "trigger_cp_mid",
        spawnPointId: "sp_initial",
        displayName: "Mid",
        order: 1,
      },
      {
        id: "cp_finish",
        sectionId: "sec_finish",
        triggerId: "trigger_cp_finish",
        spawnPointId: "sp_initial",
        displayName: "Finish",
        order: 2,
      },
    ],
    interactionTargets: [
      {
        id: "terminal",
        sectionId: "sec_finish",
        position: { x: 2.5, y: 6.1, z: -131.5 },
        radius: 2.5,
        prompt: "Use terminal",
      },
    ],
    geometry: [],
    surfaces: [],
  };
}

function createRules(
  overrides: Partial<ObjectiveMarkerTargetRules> = {},
): ObjectiveMarkerTargetRules {
  return {
    mode: "prologue",
    gameplayActive: true,
    captureMode: false,
    finishTriggered: false,
    trainingObjective: null,
    trainingNextPositionalObjective: null,
    level: createPrologueLevel(),
    activeSectionId: "sec_start",
    activatedCheckpointIds: new Set<string>(),
    ...overrides,
  };
}

function resolveInto(rules: ObjectiveMarkerTargetRules) {
  const out = createObjectiveMarkerTarget();
  const resolved = resolveObjectiveMarkerTarget(out, rules);

  return { out, resolved };
}

/* -------------------------------------------------------------------------- */
/* Target resolution                                                          */
/* -------------------------------------------------------------------------- */

describe("objective marker target resolution", () => {
  it("targets the current Training reach_location objective position", () => {
    const objective = TRAINING_EXERCISES[0]?.objectives[1];

    expect(objective?.type).toBe("reach_location");

    const { out, resolved } = resolveInto(
      createRules({
        mode: "training",
        level: null,
        activeSectionId: null,
        trainingObjective: objective ?? null,
      }),
    );

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 0.93, z: 3 });
    expect(out.surfaceOffsetY).toBe(-OBJECTIVE_MARKER_TARGET_CENTRE_HEIGHT);
  });

  it("gives the current positional objective priority over the look-ahead", () => {
    const current = TRAINING_EXERCISES[0]?.objectives[1];
    const lookahead: TrainingObjectiveDefinition = {
      id: "lookahead",
      description: "",
      type: "reach_location",
      required: true,
      position: { x: 9, y: 0.93, z: -9 },
    };

    expect(current?.type).toBe("reach_location");

    const { out, resolved } = resolveInto(
      createRules({
        mode: "training",
        level: null,
        trainingObjective: current ?? null,
        trainingNextPositionalObjective: lookahead,
      }),
    );

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 0.93, z: 3 });
  });

  it("looks ahead to the next positional objective while the current one is non-positional", () => {
    const maintainSpeed = TRAINING_EXERCISES[0]?.objectives[0];
    const reachRooftop = TRAINING_EXERCISES[0]?.objectives[1];

    expect(maintainSpeed?.type).toBe("maintain_speed");
    expect(reachRooftop?.type).toBe("reach_location");

    const { out, resolved } = resolveInto(
      createRules({
        mode: "training",
        level: null,
        trainingObjective: maintainSpeed ?? null,
        trainingNextPositionalObjective: reachRooftop ?? null,
      }),
    );

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 0.93, z: 3 });
  });

  it("hides the marker when the current objective is non-positional and no positional one remains", () => {
    const maintainSpeed = TRAINING_EXERCISES[0]?.objectives[0];

    expect(
      resolveInto(
        createRules({
          mode: "training",
          level: null,
          trainingObjective: maintainSpeed ?? null,
        }),
      ).resolved,
    ).toBe(false);
  });

  it("hides the marker for a reach_location objective without a position", () => {
    const { resolved } = resolveInto(
      createRules({
        mode: "training",
        level: null,
        trainingObjective: {
          id: "no_position",
          description: "",
          type: "reach_location",
          required: true,
        },
      }),
    );

    expect(resolved).toBe(false);
  });

  it("targets the next Prologue checkpoint trigger centre", () => {
    const { out, resolved } = resolveInto(createRules({ activeSectionId: "sec_start" }));

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 1, z: 3 });
  });

  it("advances to the next section checkpoint once the active one is activated", () => {
    const { out, resolved } = resolveInto(
      createRules({
        activeSectionId: "sec_start",
        activatedCheckpointIds: new Set(["cp_start"]),
      }),
    );

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 1, z: -2 });
  });

  it("ignores pending checkpoints of sections before the active one", () => {
    const { out, resolved } = resolveInto(
      createRules({ activeSectionId: "sec_mid", activatedCheckpointIds: new Set(["cp_start"]) }),
    );

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 1, z: -2 });
  });

  it("targets the finish trigger in the final section (not the checkpoint)", () => {
    const { out, resolved } = resolveInto(createRules({ activeSectionId: "sec_finish" }));

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 0, y: 5.9, z: -133 });
  });

  it("falls back to the final section interaction terminal when no finish trigger exists", () => {
    const base = createPrologueLevel();
    const level: LevelDefinition = {
      ...base,
      triggers: base.triggers.filter((trigger) => trigger.metadata?.kind !== "finish"),
    };
    const { out, resolved } = resolveInto(createRules({ level, activeSectionId: "sec_finish" }));

    expect(resolved).toBe(true);
    expect(out).toMatchObject({ x: 2.5, y: 6.1, z: -131.5 });
  });

  it("hides the marker after the finish trigger", () => {
    expect(
      resolveInto(createRules({ activeSectionId: "sec_finish", finishTriggered: true })).resolved,
    ).toBe(false);
  });

  it("hides the marker in the menu / outside gameplay", () => {
    expect(resolveInto(createRules({ gameplayActive: false })).resolved).toBe(false);
  });

  it("hides the marker when no gameplay mode is active", () => {
    expect(resolveInto(createRules({ mode: null })).resolved).toBe(false);
  });

  it("hides the marker in capture mode", () => {
    expect(
      resolveInto(
        createRules({
          mode: "training",
          trainingObjective: TRAINING_EXERCISES[0]?.objectives[1] ?? null,
          captureMode: true,
        }),
      ).resolved,
    ).toBe(false);
  });

  it("hides the marker when the level is not a Prologue level", () => {
    const level: LevelDefinition = { ...createPrologueLevel(), mode: "training" };

    expect(resolveInto(createRules({ level })).resolved).toBe(false);
  });

  it("hides the marker when the active section is unknown", () => {
    expect(resolveInto(createRules({ activeSectionId: "sec_unknown" })).resolved).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Training integration                                                       */
/* -------------------------------------------------------------------------- */

describe("objective marker Training integration", () => {
  function resolveTrainingTarget(training: TrainingSystem) {
    return resolveInto(
      createRules({
        mode: "training",
        level: null,
        trainingObjective: training.getCurrentObjectiveDefinition(),
        trainingNextPositionalObjective: training.getNextPositionalObjectiveDefinition(),
      }),
    );
  }

  it("shows the first reach_location marker at spawn via the in-exercise look-ahead", () => {
    const training = new TrainingSystem(TRAINING_EXERCISES, { clock: () => 1000 });

    training.startSession("marker-session");

    expect(training.getCurrentObjectiveDefinition()?.id).toBe("move");
    expect(training.getNextPositionalObjectiveDefinition()?.id).toBe("reach_rooftop");

    const spawn = resolveTrainingTarget(training);

    expect(spawn.resolved).toBe(true);
    expect(spawn.out).toMatchObject({ x: 0, y: 0.93, z: 3 });

    // After the non-positional step completes, the current objective itself is
    // positional; the look-ahead no longer applies within this exercise.
    training.update({ position: { x: 0, y: 0.93, z: 5 }, speed: 2 }, 1000);
    training.update({ position: { x: 0, y: 0.93, z: 5 }, speed: 2 }, 1600);

    expect(training.getCurrentObjectiveDefinition()?.id).toBe("reach_rooftop");
    expect(training.getNextPositionalObjectiveDefinition()).toBeNull();

    const current = resolveTrainingTarget(training);

    expect(current.resolved).toBe(true);
    expect(current.out).toMatchObject({ x: 0, y: 0.93, z: 3 });
  });

  it("does not look ahead into the next exercise's positional objective", () => {
    const training = new TrainingSystem(
      [
        {
          id: "no_positional",
          title: "No positional",
          description: "",
          mechanic: "movement" as const,
          objectives: [
            {
              id: "speed",
              description: "",
              type: "maintain_speed" as const,
              required: true,
              targetSpeed: 1,
              targetDurationSeconds: 0.1,
            },
            {
              id: "jump",
              description: "",
              type: "perform_action" as const,
              required: true,
              action: "jump" as const,
            },
          ],
        },
        {
          id: "next_exercise_positional",
          title: "Next exercise",
          description: "",
          mechanic: "movement" as const,
          objectives: [
            {
              id: "next_reach",
              description: "",
              type: "reach_location" as const,
              required: true,
              position: { x: 9, y: 0.93, z: -9 },
            },
          ],
        },
      ],
      { clock: () => 1000 },
    );

    training.startSession("no-positional-session");

    expect(training.getCurrentObjectiveDefinition()?.id).toBe("speed");
    expect(training.getNextPositionalObjectiveDefinition()).toBeNull();
    expect(resolveTrainingTarget(training).resolved).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Marker math and material contract                                          */
/* -------------------------------------------------------------------------- */

describe("objective marker math", () => {
  it("matches the AD dimensions", () => {
    expect(OBJECTIVE_MARKER_BASE_SIZE).toBeCloseTo(0.35);
    expect(OBJECTIVE_MARKER_HEIGHT).toBeCloseTo(0.5);
    expect(OBJECTIVE_MARKER_APEX_HEIGHT).toBeCloseTo(1.5);
    expect(OBJECTIVE_MARKER_BASE_HEIGHT).toBeCloseTo(2.0);
    expect(OBJECTIVE_MARKER_BASE_HEIGHT - OBJECTIVE_MARKER_HEIGHT).toBeCloseTo(
      OBJECTIVE_MARKER_APEX_HEIGHT,
    );
    expect(OBJECTIVE_MARKER_BOB_AMPLITUDE).toBeCloseTo(0.08);
    expect(OBJECTIVE_MARKER_BOB_PERIOD_SECONDS).toBeCloseTo(2.4);
    expect(OBJECTIVE_MARKER_YAW_RADIANS_PER_SECOND).toBeCloseTo(0.6);
    expect(OBJECTIVE_MARKER_RING_DIAMETER).toBeCloseTo(0.6);
    expect(OBJECTIVE_MARKER_RING_HEIGHT).toBeCloseTo(0.02);
  });

  it("computes a deterministic bob/yaw pose from elapsed seconds", () => {
    const pose: ObjectiveMarkerPose = { apexY: 0, yaw: 0 };

    computeObjectiveMarkerPose(pose, 0, 0, false);
    expect(pose.apexY).toBeCloseTo(1.5);
    expect(pose.yaw).toBeCloseTo(0);

    computeObjectiveMarkerPose(pose, 0.6, 0, false);
    expect(pose.apexY).toBeCloseTo(1.5 + 0.08);
    expect(pose.yaw).toBeCloseTo(0.36);

    computeObjectiveMarkerPose(pose, 1.2, 0, false);
    expect(pose.apexY).toBeCloseTo(1.5);
    expect(pose.yaw).toBeCloseTo(0.72);

    // Same elapsed time → same pose regardless of how the frames were stepped.
    const stepped: ObjectiveMarkerPose = { apexY: 0, yaw: 0 };
    let elapsed = 0;

    for (let frame = 0; frame < 120; frame += 1) {
      elapsed += 0.005;
    }

    computeObjectiveMarkerPose(stepped, elapsed, 0, false);
    computeObjectiveMarkerPose(pose, 0.6, 0, false);
    expect(stepped.apexY).toBeCloseTo(pose.apexY);
    expect(stepped.yaw).toBeCloseTo(pose.yaw);
  });

  it("is static under reduced motion", () => {
    const pose: ObjectiveMarkerPose = { apexY: 0, yaw: 0 };

    for (const elapsed of [0, 0.6, 1.2, 9.5]) {
      computeObjectiveMarkerPose(pose, elapsed, 2.5, true);
      expect(pose.apexY).toBeCloseTo(2.5 + 1.5);
      expect(pose.yaw).toBe(0);
    }
  });

  it("applies the near fade-in and the 50–60 m fade-out", () => {
    expect(computeObjectiveMarkerFadeAlpha(0)).toBe(0);
    expect(computeObjectiveMarkerFadeAlpha(1.5)).toBeCloseTo(0.5);
    expect(computeObjectiveMarkerFadeAlpha(3)).toBe(1);
    expect(computeObjectiveMarkerFadeAlpha(25)).toBe(1);
    expect(computeObjectiveMarkerFadeAlpha(50)).toBe(1);
    expect(computeObjectiveMarkerFadeAlpha(55)).toBeCloseTo(0.5);
    expect(computeObjectiveMarkerFadeAlpha(60)).toBe(0);
    expect(computeObjectiveMarkerFadeAlpha(75)).toBe(0);
    expect(computeObjectiveMarkerFadeAlpha(Number.NaN)).toBe(0);

    let previous = 0;

    for (let distance = 0; distance <= 70; distance += 1) {
      const alpha = computeObjectiveMarkerFadeAlpha(distance);

      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);

      if (distance <= 3) {
        expect(alpha).toBeGreaterThanOrEqual(previous - 1e-9);
      }

      if (distance >= 50 && distance <= 60) {
        expect(alpha).toBeLessThanOrEqual(previous + 1e-9);
      }

      previous = alpha;
    }
  });

  it("keeps the material inside the AD caps (no x-ray, no glow, emission ≤ 0.15)", () => {
    const material = createObjectiveMarkerMaterial();

    expect(material.color.getHex()).toBe(OBJECTIVE_MARKER_COLOR);
    expect(material.roughness).toBeCloseTo(OBJECTIVE_MARKER_ROUGHNESS);
    expect(material.metalness).toBe(OBJECTIVE_MARKER_METALNESS);
    expect(material.emissive.getHex()).toBe(OBJECTIVE_MARKER_COLOR);
    expect(material.emissiveIntensity).toBeCloseTo(OBJECTIVE_MARKER_EMISSION);
    expect(material.emissiveIntensity).toBeLessThanOrEqual(OBJECTIVE_MARKER_EMISSION_CAP);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(1);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.type).toBe("MeshStandardMaterial");

    const ring = createObjectiveMarkerRingMaterial();

    expect(ring.emissiveIntensity).toBeLessThanOrEqual(OBJECTIVE_MARKER_EMISSION_CAP);
    expect(ring.depthTest).toBe(true);
    expect(ring.transparent).toBe(true);
    expect(ring.polygonOffset).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* System behavior                                                            */
/* -------------------------------------------------------------------------- */

interface MarkerHarness {
  readonly system: ObjectiveMarkerSystem;
  readonly addObject: ReturnType<typeof vi.fn>;
  readonly removeObject: ReturnType<typeof vi.fn>;
  readonly resolveSurfaceY: ReturnType<typeof vi.fn>;
}

function createHarness(
  options: { captureMode?: boolean; target?: { x: number; y: number; z: number } | null } = {},
): MarkerHarness {
  const addObject = vi.fn();
  const removeObject = vi.fn();
  const resolveSurfaceY = vi.fn((_x: number, y: number) => y - 0.93);
  const target = options.target === undefined ? { x: 0, y: 0.93, z: 3 } : options.target;

  return {
    system: new ObjectiveMarkerSystem({
      addObject,
      removeObject,
      resolveTarget: (out) => {
        if (!target) {
          return false;
        }

        out.x = target.x;
        out.y = target.y;
        out.z = target.z;
        out.surfaceOffsetY = -0.93;

        return true;
      },
      resolveSurfaceY,
      getReducedMotion: () => false,
      captureMode: options.captureMode ?? false,
    }),
    addObject,
    removeObject,
    resolveSurfaceY,
  };
}

describe("ObjectiveMarkerSystem", () => {
  it("spawns nothing in capture mode", () => {
    const harness = createHarness({ captureMode: true });

    harness.system.update({ x: 0, y: 1.5, z: 10 }, 0);

    expect(harness.addObject).not.toHaveBeenCalled();
    expect(harness.system.isVisible).toBe(false);
    expect(harness.system.isAttached).toBe(false);
    expect(harness.system.getSnapshot()).toMatchObject({ visible: false, attached: false });
  });

  it("attaches one pyramid and one ring, positioned at the apex and surface", () => {
    const harness = createHarness();

    harness.system.update({ x: 0, y: 1.5, z: 10 }, 0);

    expect(harness.addObject).toHaveBeenCalledTimes(2);
    expect(harness.removeObject).not.toHaveBeenCalled();

    const snapshot = harness.system.getSnapshot();

    expect(snapshot.visible).toBe(true);
    expect(snapshot.attached).toBe(true);
    expect(snapshot.position).toMatchObject({ x: 0, y: 1.5, z: 3 });
    expect(snapshot.surfaceY).toBeCloseTo(0);
    expect(snapshot.alpha).toBe(1);
  });

  it("resolves the surface once per target change, not every frame", () => {
    const harness = createHarness();

    harness.system.update({ x: 0, y: 1.5, z: 10 }, 0);
    harness.system.update({ x: 0, y: 1.5, z: 10 }, 0.016);
    harness.system.update({ x: 0, y: 1.5, z: 10 }, 0.032);

    expect(harness.resolveSurfaceY).toHaveBeenCalledTimes(1);
  });

  it("is static under reduced motion and animated otherwise", () => {
    const addObject = vi.fn();
    let reducedMotion = false;
    let targetX = 0;

    const system = new ObjectiveMarkerSystem({
      addObject,
      removeObject: vi.fn(),
      resolveTarget: (out) => {
        out.x = targetX;
        out.y = 0.93;
        out.z = 3;
        out.surfaceOffsetY = -0.93;

        return true;
      },
      resolveSurfaceY: () => 0,
      getReducedMotion: () => reducedMotion,
      captureMode: false,
    });

    system.update({ x: 0, y: 1.5, z: 10 }, 0);

    const start = system.getSnapshot();

    expect(start.position.y).toBeCloseTo(1.5);
    expect(start.yaw).toBeCloseTo(0);

    system.update({ x: 0, y: 1.5, z: 10 }, 0.6);

    const animated = system.getSnapshot();

    expect(animated.position.y).toBeCloseTo(1.58);
    expect(animated.yaw).toBeCloseTo(0.36);

    reducedMotion = true;
    system.update({ x: 0, y: 1.5, z: 10 }, 0.9);

    const staticPose = system.getSnapshot();

    expect(staticPose.position.y).toBeCloseTo(1.5);
    expect(staticPose.yaw).toBeCloseTo(0);

    targetX = 5;
    system.update({ x: 5, y: 1.5, z: 10 }, 9);

    expect(system.getSnapshot().position.y).toBeCloseTo(1.5);
  });

  it("fades out with distance and hides when fully faded", () => {
    const harness = createHarness();

    harness.system.update({ x: 0, y: 1.5, z: 58 }, 0);
    expect(harness.system.getSnapshot().alpha).toBeCloseTo(0.5);

    harness.system.update({ x: 0, y: 1.5, z: 65 }, 0);
    expect(harness.system.isVisible).toBe(false);
    expect(harness.system.getSnapshot().alpha).toBe(0);
  });

  it("hides when the target disappears and shows again without re-attaching", () => {
    const addObject = vi.fn();
    let visibleTarget = true;

    const system = new ObjectiveMarkerSystem({
      addObject,
      removeObject: vi.fn(),
      resolveTarget: (out) => {
        if (!visibleTarget) {
          return false;
        }

        out.x = 0;
        out.y = 0.93;
        out.z = 3;
        out.surfaceOffsetY = -0.93;

        return true;
      },
      resolveSurfaceY: () => 0,
      getReducedMotion: () => false,
      captureMode: false,
    });

    system.update({ x: 0, y: 1.5, z: 10 }, 0);
    visibleTarget = false;
    system.update({ x: 0, y: 1.5, z: 10 }, 0.1);

    expect(system.isVisible).toBe(false);
    expect(system.isAttached).toBe(true);

    visibleTarget = true;
    system.update({ x: 0, y: 1.5, z: 10 }, 0.2);

    expect(system.isVisible).toBe(true);
    expect(addObject).toHaveBeenCalledTimes(2);
  });

  it("removes its objects and disposes on dispose", () => {
    const harness = createHarness();

    harness.system.update({ x: 0, y: 1.5, z: 10 }, 0);
    harness.system.dispose();

    expect(harness.removeObject).toHaveBeenCalledTimes(2);
    expect(harness.system.isAttached).toBe(false);
    expect(() => harness.system.update({ x: 0, y: 1.5, z: 10 }, 1)).not.toThrow();
  });
});
