/**
 * Pure objective-marker rules: which in-world target is active, marker
 * dimensions and the deterministic animation/fade math.
 *
 * The module is intentionally free of Three.js and of application imports so
 * the rules and the placement math can be unit tested in Node (`docs/13` §1:
 * a small semantic in-world marker, not an architectural surface).
 */

import type { LevelDefinition, LevelTriggerDefinition, LevelVector3 } from "../levels/LevelTypes";
import type { TrainingObjectiveDefinition } from "../training/TrainingTypes";

/** Runner red used by the existing route strips, gates and signage. */
export const OBJECTIVE_MARKER_COLOR = 0xd52e36;
export const OBJECTIVE_MARKER_ROUGHNESS = 0.45;
export const OBJECTIVE_MARKER_METALNESS = 0;
/** Emissive contribution; the AD brief caps it at 0.15 (bloom threshold 1.0). */
export const OBJECTIVE_MARKER_EMISSION = 0.12;
export const OBJECTIVE_MARKER_EMISSION_CAP = 0.15;

/** Square pyramid base edge, metres. */
export const OBJECTIVE_MARKER_BASE_SIZE = 0.35;
/** Pyramid height from base to apex, metres (apex points down). */
export const OBJECTIVE_MARKER_HEIGHT = 0.5;

/** Apex height above the marked surface, metres. */
export const OBJECTIVE_MARKER_APEX_HEIGHT = 1.5;
/** Base height above the marked surface, metres (apex + height). */
export const OBJECTIVE_MARKER_BASE_HEIGHT = 2.0;
/** Vertical bob amplitude, metres (±). */
export const OBJECTIVE_MARKER_BOB_AMPLITUDE = 0.08;
/** Bob period, seconds. */
export const OBJECTIVE_MARKER_BOB_PERIOD_SECONDS = 2.4;
/** Yaw speed, radians per second. */
export const OBJECTIVE_MARKER_YAW_RADIANS_PER_SECOND = 0.6;

/** Ring decal diameter, metres (optional surface anchor). */
export const OBJECTIVE_MARKER_RING_DIAMETER = 0.6;
/** Ring decal height above the marked surface, metres. */
export const OBJECTIVE_MARKER_RING_HEIGHT = 0.02;

/** Distance fade-out band: alpha 1 at/below 50 m, 0 at/above 60 m. */
export const OBJECTIVE_MARKER_FADE_OUT_NEAR_METRES = 50;
export const OBJECTIVE_MARKER_FADE_OUT_FAR_METRES = 60;
/** Near fade-in band: alpha 0 at the camera, 1 at/above 3 m. */
export const OBJECTIVE_MARKER_FADE_IN_METRES = 3;

/**
 * Authored target points stand roughly one capsule half-height above the
 * surface the player stands on: Training `reach_location` objectives use the
 * shared `BODY_Y = 0.93` body centre and Prologue triggers are authored around
 * eye/body height. Subtracting it turns the target point into a plausible
 * surface anchor; the renderer additionally refines it with a downward ray
 * cast when physics is available (see `ObjectiveMarkerSystem`).
 */
export const OBJECTIVE_MARKER_TARGET_CENTRE_HEIGHT = 0.93;

/** Marker target point plus the fallback distance down to its surface. */
export interface ObjectiveMarkerTarget {
  x: number;
  y: number;
  z: number;
  /** Metres from the authored target point down to the marked surface. */
  surfaceOffsetY: number;
}

/** Creates a reusable target container (gameplay code reuses one instance). */
export function createObjectiveMarkerTarget(): ObjectiveMarkerTarget {
  return { x: 0, y: 0, z: 0, surfaceOffsetY: -OBJECTIVE_MARKER_TARGET_CENTRE_HEIGHT };
}

/** Gameplay mode whose active objective the marker follows. */
export type ObjectiveMarkerMode = "training" | "prologue" | "speedrun";

/** Read-only inputs required to resolve the active marker target. */
export interface ObjectiveMarkerTargetRules {
  /** Current gameplay mode; `null` outside a gameplay session. */
  mode: ObjectiveMarkerMode | null;
  /** True only while the gameplay session is running and the flow is in gameplay. */
  gameplayActive: boolean;
  /** True when the deterministic capture boot is active. */
  captureMode: boolean;
  /** True after the Prologue finish trigger has fired. */
  finishTriggered: boolean;
  /** Current Training objective definition (read-only, no snapshot allocation). */
  trainingObjective: TrainingObjectiveDefinition | null;
  /**
   * Next positional objective inside the current Training exercise (look-ahead,
   * never crossing into the next exercise). Used only when the current
   * objective is non-positional.
   */
  trainingNextPositionalObjective: TrainingObjectiveDefinition | null;
  /** Currently loaded level definition. */
  level: LevelDefinition | null;
  /** Active level section id. */
  activeSectionId: string | null;
  /** Checkpoints already activated in the current session. */
  activatedCheckpointIds: ReadonlySet<string>;
}

/**
 * Resolves the single active marker target into `out`.
 *
 * Rules (`docs/reports/UX_CITY_TARGETS.md` §1):
 * - Training: the current `reach_location` objective; while the current
 *   objective is non-positional, look ahead to the next positional objective in
 *   the same exercise (never the next exercise); hidden when none remains.
 * - Prologue / Speedrun: the next unactivated checkpoint of the active section
 *   (future sections included once the active one is done); in the final
 *   section the finish gate, falling back to the section's terminal; hidden
 *   after `trigger_finish`.
 * - Menu, non-gameplay flow and capture mode never resolve a target.
 *
 * Returns `false` (and leaves `out` untouched) when no marker must be shown.
 */
export function resolveObjectiveMarkerTarget(
  out: ObjectiveMarkerTarget,
  rules: ObjectiveMarkerTargetRules,
): boolean {
  if (!rules.gameplayActive || rules.captureMode || rules.mode === null) {
    return false;
  }

  if (rules.mode === "training") {
    return resolveTrainingTarget(
      out,
      rules.trainingObjective,
      rules.trainingNextPositionalObjective,
    );
  }

  return resolvePrologueTarget(out, rules);
}

function resolveTrainingTarget(
  out: ObjectiveMarkerTarget,
  currentObjective: TrainingObjectiveDefinition | null,
  nextPositionalObjective: TrainingObjectiveDefinition | null,
): boolean {
  // The current positional objective always wins; the look-ahead only keeps the
  // marker visible while the current step has no world position.
  if (setTargetFromObjective(out, currentObjective)) {
    return true;
  }

  return setTargetFromObjective(out, nextPositionalObjective);
}

function setTargetFromObjective(
  out: ObjectiveMarkerTarget,
  objective: TrainingObjectiveDefinition | null,
): boolean {
  if (objective?.type !== "reach_location") {
    return false;
  }

  const position = objective.position;

  if (position === undefined) {
    return false;
  }

  setTarget(out, position);

  return true;
}

function resolvePrologueTarget(
  out: ObjectiveMarkerTarget,
  rules: ObjectiveMarkerTargetRules,
): boolean {
  const level = rules.level;

  if (level?.mode !== "prologue") {
    return false;
  }

  if (rules.finishTriggered || rules.activeSectionId === null) {
    return false;
  }

  // Explicit loops (no array/sort/callback allocations): this runs every
  // rendered frame, so the per-frame path must stay allocation-free.
  const activeSectionId = rules.activeSectionId;
  const activeSection = findSection(level, activeSectionId);

  if (!activeSection) {
    return false;
  }

  if (!hasSectionAfter(level, activeSection.order)) {
    return resolveFinishTarget(out, rules, activeSection.id);
  }

  return resolveNextCheckpointTarget(out, rules, activeSection.order);
}

function findSection(
  level: LevelDefinition,
  sectionId: string,
): { readonly id: string; readonly order: number } | null {
  for (const section of level.sections) {
    if (section.id === sectionId) {
      return section;
    }
  }

  return null;
}

function hasSectionAfter(level: LevelDefinition, order: number): boolean {
  for (const section of level.sections) {
    if (section.order > order) {
      return true;
    }
  }

  return false;
}

function resolveFinishTarget(
  out: ObjectiveMarkerTarget,
  rules: ObjectiveMarkerTargetRules,
  activeSectionId: string,
): boolean {
  const level = rules.level;

  if (!level) {
    return false;
  }

  let fallbackFinishTrigger: LevelTriggerDefinition | null = null;

  for (const trigger of level.triggers) {
    if (trigger.metadata?.kind !== "finish") {
      continue;
    }

    if (trigger.sectionId === activeSectionId) {
      setTarget(out, trigger.center);

      return true;
    }

    fallbackFinishTrigger ??= trigger;
  }

  if (fallbackFinishTrigger) {
    setTarget(out, fallbackFinishTrigger.center);

    return true;
  }

  for (const terminal of level.interactionTargets) {
    if (terminal.sectionId === activeSectionId) {
      setTarget(out, terminal.position);

      return true;
    }
  }

  return false;
}

function resolveNextCheckpointTarget(
  out: ObjectiveMarkerTarget,
  rules: ObjectiveMarkerTargetRules,
  activeSectionOrder: number,
): boolean {
  const level = rules.level;

  if (!level) {
    return false;
  }

  let nextCheckpointId: string | null = null;
  let nextCheckpointOrder = Number.POSITIVE_INFINITY;
  let nextCheckpointTriggerId: string | null = null;

  for (const checkpoint of level.checkpoints) {
    if (rules.activatedCheckpointIds.has(checkpoint.id)) {
      continue;
    }

    const sectionOrder = checkpoint.order ?? sectionOrderFor(level, checkpoint.sectionId);

    if (sectionOrder < activeSectionOrder || sectionOrder >= nextCheckpointOrder) {
      continue;
    }

    nextCheckpointId = checkpoint.id;
    nextCheckpointOrder = sectionOrder;
    nextCheckpointTriggerId = checkpoint.triggerId;
  }

  if (nextCheckpointId === null || nextCheckpointTriggerId === null) {
    return false;
  }

  for (const trigger of level.triggers) {
    if (trigger.id === nextCheckpointTriggerId) {
      setTarget(out, trigger.center);

      return true;
    }
  }

  return false;
}

function sectionOrderFor(level: LevelDefinition, sectionId: string): number {
  for (const section of level.sections) {
    if (section.id === sectionId) {
      return section.order;
    }
  }

  return Number.NaN;
}

function setTarget(out: ObjectiveMarkerTarget, point: LevelVector3): void {
  out.x = point.x;
  out.y = point.y;
  out.z = point.z;
  out.surfaceOffsetY = -OBJECTIVE_MARKER_TARGET_CENTRE_HEIGHT;
}

/** Marker pose for one elapsed-time sample. */
export interface ObjectiveMarkerPose {
  /** World Y of the downward apex. */
  apexY: number;
  /** Pyramid yaw in radians. */
  yaw: number;
}

/**
 * Computes the deterministic bob/yaw pose into `out`.
 *
 * The animation is driven by elapsed seconds from the application clock, so it
 * is frame-rate independent; under reduced motion the marker is fully static
 * (no bob, no yaw) and rests on the nominal apex height.
 */
export function computeObjectiveMarkerPose(
  out: ObjectiveMarkerPose,
  elapsedSeconds: number,
  surfaceY: number,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    out.apexY = surfaceY + OBJECTIVE_MARKER_APEX_HEIGHT;
    out.yaw = 0;

    return;
  }

  const phase = (Math.max(0, elapsedSeconds) / OBJECTIVE_MARKER_BOB_PERIOD_SECONDS) * Math.PI * 2;

  out.apexY =
    surfaceY + OBJECTIVE_MARKER_APEX_HEIGHT + Math.sin(phase) * OBJECTIVE_MARKER_BOB_AMPLITUDE;
  out.yaw = Math.max(0, elapsedSeconds) * OBJECTIVE_MARKER_YAW_RADIANS_PER_SECOND;
}

/**
 * Distance alpha for the marker.
 *
 * 1 between 3 m and 50 m; linear near fade-in 0→1 over the first 3 m (the
 * marker never clips the camera); linear fade-out 1→0 from 50 m to 60 m.
 */
export function computeObjectiveMarkerFadeAlpha(distanceMetres: number): number {
  if (!Number.isFinite(distanceMetres) || distanceMetres <= 0) {
    return 0;
  }

  const near = Math.min(1, distanceMetres / OBJECTIVE_MARKER_FADE_IN_METRES);
  const far = Math.min(
    1,
    Math.max(
      0,
      (OBJECTIVE_MARKER_FADE_OUT_FAR_METRES - distanceMetres) /
        (OBJECTIVE_MARKER_FADE_OUT_FAR_METRES - OBJECTIVE_MARKER_FADE_OUT_NEAR_METRES),
    ),
  );

  return Math.min(near, far);
}
