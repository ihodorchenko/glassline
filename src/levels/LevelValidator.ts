import { PROLOGUE_COMPLETION_LEVEL_ID } from "../progression/LevelCompletionPolicy";
import { validateArchitecturalModuleDefinition } from "./architecture/KitTypes";
import type {
  AuthoredCheckpointDefinition,
  LevelDefinition,
  LevelSectionDefinition,
  LevelSpawnPointDefinition,
  LevelSurfaceDefinition,
  LevelTriggerDefinition,
} from "./LevelTypes";

export interface LevelValidationError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface LevelValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface LevelValidationResult {
  readonly valid: boolean;
  readonly errors: readonly LevelValidationError[];
  readonly warnings: readonly LevelValidationWarning[];
}

function isFiniteVector(vector: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

class ValidationCollector {
  readonly errors: LevelValidationError[] = [];
  readonly warnings: LevelValidationWarning[] = [];

  error(code: string, message: string, path?: string): void {
    this.errors.push({ code, message, ...(path === undefined ? {} : { path }) });
  }

  warn(code: string, message: string, path?: string): void {
    this.warnings.push({ code, message, ...(path === undefined ? {} : { path }) });
  }
}

function validateUniqueIds(
  collector: ValidationCollector,
  label: string,
  items: readonly { readonly id: string }[],
): void {
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id || item.id.trim().length === 0) {
      collector.error("EMPTY_ID", `${label} contains an empty id.`);
      continue;
    }

    if (seen.has(item.id)) {
      collector.error("DUPLICATE_ID", `${label} id "${item.id}" is duplicated.`);
    }

    seen.add(item.id);
  }
}

function validateLevelBasics(collector: ValidationCollector, definition: LevelDefinition): void {
  if (!definition.id || definition.id.trim().length === 0) {
    collector.error("INVALID_LEVEL_ID", "Level id must not be empty.");
  }

  if (!definition.version || definition.version.trim().length === 0) {
    collector.error("INVALID_LEVEL_VERSION", "Level version must not be empty.", "version");
  }

  if (definition.mode !== "training" && definition.mode !== "prologue") {
    collector.error("INVALID_GAME_MODE", `Unsupported game mode "${definition.mode}".`);
  }

  if (definition.sections.length === 0) {
    collector.error("NO_SECTIONS", "A level must define at least one section.");
  }

  validateUniqueIds(collector, "Sections", definition.sections);
  validateUniqueIds(collector, "Spawn points", definition.spawnPoints);
  validateUniqueIds(collector, "Triggers", definition.triggers);
  validateUniqueIds(collector, "Surfaces", definition.surfaces);
  validateUniqueIds(collector, "Geometry", definition.geometry);
  validateUniqueIds(collector, "Checkpoints", definition.checkpoints);
  validateUniqueIds(collector, "Interaction targets", definition.interactionTargets);

  if (definition.decorations) {
    validateUniqueIds(collector, "Decorations", definition.decorations);
  }

  if (definition.architecture) {
    validateUniqueIds(collector, "Architecture", definition.architecture);
  }
}

function validateSections(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
  spawnPointIds: ReadonlySet<string>,
): void {
  const orders = new Set<number>();

  for (const section of definition.sections) {
    if (!Number.isInteger(section.order) || section.order < 0) {
      collector.error(
        "INVALID_SECTION_ORDER",
        `Section "${section.id}" has an invalid order.`,
        section.id,
      );
    }

    if (orders.has(section.order)) {
      collector.error(
        "DUPLICATE_SECTION_ORDER",
        `Section "${section.id}" reuses order ${section.order}.`,
        section.id,
      );
    }

    orders.add(section.order);

    if (!spawnPointIds.has(section.entrySpawnPointId)) {
      collector.error(
        "MISSING_SECTION_ENTRY_SPAWN",
        `Section "${section.id}" references missing entry spawn "${section.entrySpawnPointId}".`,
        section.id,
      );
    }

    if (section.exitSpawnPointId && !spawnPointIds.has(section.exitSpawnPointId)) {
      collector.error(
        "MISSING_SECTION_EXIT_SPAWN",
        `Section "${section.id}" references missing exit spawn "${section.exitSpawnPointId}".`,
        section.id,
      );
    }

    if (section.nextSectionId) {
      if (!sectionIds.has(section.nextSectionId)) {
        collector.error(
          "MISSING_NEXT_SECTION",
          `Section "${section.id}" references missing next section "${section.nextSectionId}".`,
          section.id,
        );
      } else if (section.nextSectionId === section.id) {
        collector.error(
          "SELF_REFERENCING_SECTION",
          `Section "${section.id}" cannot reference itself as next section.`,
          section.id,
        );
      }
    }
  }

  const sortedOrders = [...definition.sections].sort((left, right) => left.order - right.order);

  for (let index = 1; index < sortedOrders.length; index += 1) {
    const previous = sortedOrders[index - 1];
    const current = sortedOrders[index];

    if (previous && current && previous.order === current.order) {
    }
  }

  const initialSection = definition.sections.find(
    (section) => section.id === definition.sections[0]?.id,
  );

  if (initialSection) {
    const initialOwner = definition.spawnPoints.find(
      (spawnPoint) => spawnPoint.id === definition.initialSpawnPointId,
    );

    if (!initialOwner) {
      collector.error(
        "MISSING_INITIAL_SPAWN",
        `Initial spawn point "${definition.initialSpawnPointId}" is not registered.`,
        "initialSpawnPointId",
      );
    } else if (definition.mode === "prologue" && initialOwner.sectionId !== initialSection.id) {
      collector.warn(
        "INITIAL_SPAWN_NOT_IN_FIRST_SECTION",
        `Initial spawn "${initialOwner.id}" does not belong to the first section.`,
        "initialSpawnPointId",
      );
    }
  }
}

function validateSpawnPoints(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
): void {
  for (const spawnPoint of definition.spawnPoints) {
    if (!sectionIds.has(spawnPoint.sectionId)) {
      collector.error(
        "INVALID_SPAWN_SECTION",
        `Spawn point "${spawnPoint.id}" belongs to unknown section "${spawnPoint.sectionId}".`,
        spawnPoint.id,
      );
    }

    if (!isFiniteVector(spawnPoint.position)) {
      collector.error(
        "INVALID_SPAWN_POSITION",
        `Spawn point "${spawnPoint.id}" has a non-finite position.`,
        spawnPoint.id,
      );
    }

    if (!Number.isFinite(spawnPoint.rotationY)) {
      collector.error(
        "INVALID_SPAWN_ROTATION",
        `Spawn point "${spawnPoint.id}" has a non-finite rotation.`,
        spawnPoint.id,
      );
    }
  }
}

function validateSurfacesAndGeometry(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
): void {
  const surfaces = new Map<string, LevelSurfaceDefinition>();

  for (const surface of definition.surfaces) {
    if (!sectionIds.has(surface.sectionId)) {
      collector.error(
        "INVALID_SURFACE_SECTION",
        `Surface "${surface.id}" belongs to unknown section "${surface.sectionId}".`,
        surface.id,
      );
    }

    surfaces.set(surface.id, surface);

    if (
      !surface.walkable &&
      !surface.landingSurface &&
      !surface.wallRunSurface &&
      !surface.wallJumpSurface &&
      !surface.vaultObstacle
    ) {
      collector.warn(
        "SURFACE_WITHOUT_TRAVERSAL_METADATA",
        `Surface "${surface.id}" exposes no traversal metadata.`,
        surface.id,
      );
    }
  }

  for (const geometry of definition.geometry) {
    if (!sectionIds.has(geometry.sectionId)) {
      collector.error(
        "INVALID_GEOMETRY_SECTION",
        `Geometry "${geometry.id}" belongs to unknown section "${geometry.sectionId}".`,
        geometry.id,
      );
    }

    if (!surfaces.has(geometry.surfaceId)) {
      collector.error(
        "MISSING_GEOMETRY_SURFACE",
        `Geometry "${geometry.id}" references unknown surface "${geometry.surfaceId}".`,
        geometry.id,
      );
    }

    if (!isFiniteVector(geometry.position) || !isFiniteVector(geometry.size)) {
      collector.error(
        "INVALID_GEOMETRY_TRANSFORM",
        `Geometry "${geometry.id}" has a non-finite transform.`,
        geometry.id,
      );
      continue;
    }

    if (geometry.size.x <= 0 || geometry.size.y <= 0 || geometry.size.z <= 0) {
      collector.error(
        "INVALID_GEOMETRY_SIZE",
        `Geometry "${geometry.id}" must have positive dimensions.`,
        geometry.id,
      );
    }
  }
}

function validateTriggers(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
  checkpointIds: ReadonlySet<string>,
): void {
  for (const trigger of definition.triggers) {
    if (!sectionIds.has(trigger.sectionId)) {
      collector.error(
        "INVALID_TRIGGER_SECTION",
        `Trigger "${trigger.id}" belongs to unknown section "${trigger.sectionId}".`,
        trigger.id,
      );
    }

    if (!isFiniteVector(trigger.center) || !isFiniteVector(trigger.halfExtents)) {
      collector.error(
        "INVALID_TRIGGER_VOLUME",
        `Trigger "${trigger.id}" has a non-finite volume.`,
        trigger.id,
      );
      continue;
    }

    if (trigger.halfExtents.x <= 0 || trigger.halfExtents.y <= 0 || trigger.halfExtents.z <= 0) {
      collector.error(
        "INVALID_TRIGGER_EXTENTS",
        `Trigger "${trigger.id}" must have positive extents.`,
        trigger.id,
      );
    }

    if (trigger.type === "section-entry" || trigger.type === "section-exit") {
      const target = trigger.metadata?.targetSectionId;

      if (!target || !sectionIds.has(target)) {
        collector.error(
          "MISSING_TRIGGER_TARGET_SECTION",
          `Trigger "${trigger.id}" must reference a valid target section.`,
          trigger.id,
        );
      }
    }

    if (trigger.type === "checkpoint") {
      const checkpointId = trigger.metadata?.checkpointId;

      if (!checkpointId || !checkpointIds.has(checkpointId)) {
        collector.error(
          "MISSING_TRIGGER_CHECKPOINT",
          `Checkpoint trigger "${trigger.id}" must reference a valid checkpoint.`,
          trigger.id,
        );
      }
    }
  }
}

function validateCheckpoints(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
  spawnPointIds: ReadonlySet<string>,
  triggerIds: ReadonlySet<string>,
): void {
  for (const checkpoint of definition.checkpoints) {
    if (!sectionIds.has(checkpoint.sectionId)) {
      collector.error(
        "INVALID_CHECKPOINT_SECTION",
        `Checkpoint "${checkpoint.id}" belongs to unknown section "${checkpoint.sectionId}".`,
        checkpoint.id,
      );
    }

    if (!spawnPointIds.has(checkpoint.spawnPointId)) {
      collector.error(
        "MISSING_CHECKPOINT_SPAWN",
        `Checkpoint "${checkpoint.id}" references missing spawn "${checkpoint.spawnPointId}".`,
        checkpoint.id,
      );
    }

    if (!triggerIds.has(checkpoint.triggerId)) {
      collector.error(
        "MISSING_CHECKPOINT_TRIGGER",
        `Checkpoint "${checkpoint.id}" references missing trigger "${checkpoint.triggerId}".`,
        checkpoint.id,
      );
    } else {
      const trigger = definition.triggers.find(
        (candidate) => candidate.id === checkpoint.triggerId,
      );

      if (trigger?.type !== "checkpoint") {
        collector.warn(
          "CHECKPOINT_TRIGGER_TYPE",
          `Checkpoint "${checkpoint.id}" references a trigger that is not typed "checkpoint".`,
          checkpoint.id,
        );
      }

      if (trigger?.metadata?.checkpointId !== checkpoint.id) {
        collector.warn(
          "CHECKPOINT_TRIGGER_MISMATCH",
          `Checkpoint "${checkpoint.id}" and its trigger do not share the same checkpoint id.`,
          checkpoint.id,
        );
      }
    }
  }
}

function validateDecorations(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
): void {
  for (const decoration of definition.decorations ?? []) {
    if (!sectionIds.has(decoration.sectionId)) {
      collector.error(
        "INVALID_DECORATION_SECTION",
        `Decoration "${decoration.id}" belongs to unknown section "${decoration.sectionId}".`,
        decoration.id,
      );
    }

    if (!isFiniteVector(decoration.position) || !isFiniteVector(decoration.size)) {
      collector.error(
        "INVALID_DECORATION_TRANSFORM",
        `Decoration "${decoration.id}" has a non-finite transform.`,
        decoration.id,
      );
      continue;
    }

    if (decoration.size.x <= 0 || decoration.size.y <= 0 || decoration.size.z <= 0) {
      collector.error(
        "INVALID_DECORATION_SIZE",
        `Decoration "${decoration.id}" must have positive dimensions.`,
        decoration.id,
      );
    }

    if (decoration.opacity !== undefined && (decoration.opacity < 0 || decoration.opacity > 1)) {
      collector.error(
        "INVALID_DECORATION_OPACITY",
        `Decoration "${decoration.id}" opacity must be in [0, 1].`,
        decoration.id,
      );
    }
  }

  if (definition.environment) {
    const environment = definition.environment;

    if (!(environment.fogNear >= 0) || !(environment.fogFar > environment.fogNear)) {
      collector.error(
        "INVALID_FOG_RANGE",
        "Environment fog range must satisfy 0 <= fogNear < fogFar.",
        "environment",
      );
    }

    if (environment.sunIntensity < 0 || environment.hemisphereIntensity < 0) {
      collector.error(
        "INVALID_LIGHT_INTENSITY",
        "Environment light intensities must be non-negative.",
        "environment",
      );
    }
  }
}

function validateArchitecture(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
): void {
  for (const placement of definition.architecture ?? []) {
    if (!sectionIds.has(placement.sectionId)) {
      collector.error(
        "INVALID_ARCHITECTURE_SECTION",
        `Architecture placement "${placement.id}" belongs to unknown section "${placement.sectionId}".`,
        placement.id,
      );
    }

    if (!isFiniteVector(placement.position)) {
      collector.error(
        "INVALID_ARCHITECTURE_POSITION",
        `Architecture placement "${placement.id}" has a non-finite position.`,
        placement.id,
      );
    }

    for (const [axis, rotation] of [
      ["rotationX", placement.rotationX],
      ["rotationY", placement.rotationY],
      ["rotationZ", placement.rotationZ],
    ] as const) {
      if (rotation !== undefined && !Number.isFinite(rotation)) {
        collector.error(
          "INVALID_ARCHITECTURE_ROTATION",
          `Architecture placement "${placement.id}" has a non-finite ${axis}.`,
          placement.id,
        );
      }
    }

    for (const issue of validateArchitecturalModuleDefinition(placement.module)) {
      collector.error("INVALID_ARCHITECTURE_MODULE", `"${placement.id}": ${issue}`, placement.id);
    }
  }
}

function validateInteractionTargets(
  collector: ValidationCollector,
  definition: LevelDefinition,
  sectionIds: ReadonlySet<string>,
): void {
  for (const target of definition.interactionTargets) {
    if (!sectionIds.has(target.sectionId)) {
      collector.error(
        "INVALID_INTERACTION_SECTION",
        `Interaction target "${target.id}" belongs to unknown section "${target.sectionId}".`,
        target.id,
      );
    }

    if (!isFiniteVector(target.position)) {
      collector.error(
        "INVALID_INTERACTION_POSITION",
        `Interaction target "${target.id}" has a non-finite position.`,
        target.id,
      );
    }

    if (!(target.radius > 0)) {
      collector.error(
        "INVALID_INTERACTION_RADIUS",
        `Interaction target "${target.id}" must have a positive radius.`,
        target.id,
      );
    }
  }
}

/**
 * Levels that must satisfy the campaign Prologue's five-section taxonomy.
 *
 * `mode: "prologue"` is a gameplay mode, not an identifier: until a dedicated
 * single-section mode exists, standalone levels such as `first_section` reuse
 * it (§10 Q1 of `FIRST_GAMEPLAY_SECTION_SPEC`). The authored campaign Prologue
 * is therefore identified by the same explicit level id that gates progression
 * in `LevelCompletionPolicy` — never by its `displayName` or section count.
 *
 * The check stays mandatory for the authored Prologue: a prologue-mode level
 * cannot opt out because the set is keyed by the level id, and
 * `tests/unit/first-section-level.test.ts` pins that the canonical Prologue is
 * still rejected when its five-section structure is broken.
 */
const PROLOGUE_SECTION_TAXONOMY_LEVEL_IDS: ReadonlySet<string> = new Set([
  PROLOGUE_COMPLETION_LEVEL_ID,
]);

function validatePrologueSections(
  collector: ValidationCollector,
  definition: LevelDefinition,
): void {
  if (!PROLOGUE_SECTION_TAXONOMY_LEVEL_IDS.has(definition.id)) {
    return;
  }

  const required = ["Rooftop", "Industrial", "Construction", "Skybridge", "Finish"];
  const sorted = [...definition.sections].sort((left, right) => left.order - right.order);
  const names = sorted.map((section) => section.displayName);

  if (names.length !== required.length) {
    collector.error(
      "PROLOGUE_SECTION_COUNT",
      `Prologue must define exactly ${required.length} sections; received ${names.length}.`,
    );
  }

  for (let index = 0; index < required.length; index += 1) {
    if (names[index] !== required[index]) {
      collector.error(
        "PROLOGUE_SECTION_ORDER",
        `Prologue section ${index + 1} must be "${required[index]}"; received "${names[index] ?? "missing"}".`,
      );
    }
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];

    if (current && next && current.nextSectionId !== next.id) {
      collector.error(
        "PROLOGUE_SECTION_CHAIN",
        `Prologue section "${current.id}" must point to "${next.id}" as its next section.`,
        current.id,
      );
    }
  }
}

/** Validates a level definition before Level Runtime initializes it (`docs/15` §14). */
export function validateLevelDefinition(definition: LevelDefinition): LevelValidationResult {
  const collector = new ValidationCollector();

  validateLevelBasics(collector, definition);

  const sectionIds = new Set(definition.sections.map((section) => section.id));
  const spawnPointIds = new Set(definition.spawnPoints.map((spawnPoint) => spawnPoint.id));
  const triggerIds = new Set(definition.triggers.map((trigger) => trigger.id));
  const checkpointIds = new Set(definition.checkpoints.map((checkpoint) => checkpoint.id));

  validateSections(collector, definition, sectionIds, spawnPointIds);
  validateSpawnPoints(collector, definition, sectionIds);
  validateSurfacesAndGeometry(collector, definition, sectionIds);
  validateTriggers(collector, definition, sectionIds, checkpointIds);
  validateCheckpoints(collector, definition, sectionIds, spawnPointIds, triggerIds);
  validateInteractionTargets(collector, definition, sectionIds);
  validateArchitecture(collector, definition, sectionIds);
  validateDecorations(collector, definition, sectionIds);
  validatePrologueSections(collector, definition);

  return {
    valid: collector.errors.length === 0,
    errors: collector.errors,
    warnings: collector.warnings,
  };
}

/** Convenience validation for a single authored checkpoint. */
export function validateCheckpointReferences(
  definition: LevelDefinition,
  checkpoint: AuthoredCheckpointDefinition,
): LevelValidationError[] {
  const errors: LevelValidationError[] = [];
  const section: LevelSectionDefinition | undefined = definition.sections.find(
    (candidate) => candidate.id === checkpoint.sectionId,
  );
  const spawn: LevelSpawnPointDefinition | undefined = definition.spawnPoints.find(
    (candidate) => candidate.id === checkpoint.spawnPointId,
  );
  const trigger: LevelTriggerDefinition | undefined = definition.triggers.find(
    (candidate) => candidate.id === checkpoint.triggerId,
  );

  if (!section) {
    errors.push({
      code: "INVALID_CHECKPOINT_SECTION",
      message: `Unknown checkpoint section "${checkpoint.sectionId}".`,
    });
  }

  if (!spawn) {
    errors.push({
      code: "MISSING_CHECKPOINT_SPAWN",
      message: `Unknown checkpoint spawn "${checkpoint.spawnPointId}".`,
    });
  }

  if (!trigger) {
    errors.push({
      code: "MISSING_CHECKPOINT_TRIGGER",
      message: `Unknown checkpoint trigger "${checkpoint.triggerId}".`,
    });
  }

  return errors;
}
