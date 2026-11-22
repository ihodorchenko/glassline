import { describe, expect, it } from "vitest";

import {
  FIRST_SECTION_LAYOUT,
  FIRST_SECTION_LAYOUT_ID,
  FIRST_SECTION_SECTION_IDS,
} from "../../src/levels/first-section/FirstSectionLayout";
import type {
  LevelGeometryDefinition,
  LevelSurfaceDefinition,
  LevelTriggerDefinition,
} from "../../src/levels/LevelTypes";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";

/**
 * Geometry and route assertions for the first gameplay section collision layer
 * (`FIRST_GAMEPLAY_SECTION_SPEC` §4, §5, §7.1, §9.8, §11.1).
 *
 * Values are intentionally derived from the authored boxes (edges, gaps,
 * clearances, joins) instead of restating the implementation numbers, except
 * where the specification itself fixes a dimension (gap widths, duct width,
 * obstacle heights, stair rise/tread).
 */

const LAYOUT = FIRST_SECTION_LAYOUT;
const EPSILON = 1e-6;

/** Spawn convention: capsule centre = floor top + 0.93. */
const SPAWN_CENTER_ABOVE_FLOOR = 0.93;
/** Trigger convention: body centre during a standing pose = floor top + 0.875. */
const BODY_CENTER_ABOVE_FLOOR = 0.875;
/** §2.7 / §5.7: measured jump apex above the take-off surface. */
const MEASURED_JUMP_APEX_METERS = 1.55;
/** §5.4 / §7.1: required slide clearance and its tolerance. */
const SLIDE_CLEARANCE_METERS = 1.0;
const CLEARANCE_TOLERANCE_METERS = 0.02;
/** §7.1 C4: minimum seam overlap, and the allowance actually authored. */
const MIN_SEAM_OVERLAP_METERS = 0.02;
const MAX_SEAM_OVERLAP_METERS = 0.05;
/** §4.2: route envelope. */
const ROUTE_Z_START = 18;
const ROUTE_Z_END = -87.5;
const ROUTE_LENGTH_METERS = 105.5;

const SECTIONS_IN_ORDER = [
  FIRST_SECTION_SECTION_IDS.start,
  FIRST_SECTION_SECTION_IDS.buildingJump,
  FIRST_SECTION_SECTION_IDS.technical,
  FIRST_SECTION_SECTION_IDS.slide,
  FIRST_SECTION_SECTION_IDS.vault,
  FIRST_SECTION_SECTION_IDS.finish,
] as const;

interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
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

function triggerBounds(trigger: LevelTriggerDefinition): Bounds {
  return {
    minX: trigger.center.x - trigger.halfExtents.x,
    maxX: trigger.center.x + trigger.halfExtents.x,
    minY: trigger.center.y - trigger.halfExtents.y,
    maxY: trigger.center.y + trigger.halfExtents.y,
    minZ: trigger.center.z - trigger.halfExtents.z,
    maxZ: trigger.center.z + trigger.halfExtents.z,
  };
}

function overlapLength(firstMin: number, firstMax: number, secondMin: number, secondMax: number) {
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
}

function zOverlap(first: Bounds, second: Bounds): number {
  return overlapLength(first.minZ, first.maxZ, second.minZ, second.maxZ);
}

function xOverlap(first: Bounds, second: Bounds): number {
  return overlapLength(first.minX, first.maxX, second.minX, second.maxX);
}

function yOverlap(first: Bounds, second: Bounds): number {
  return overlapLength(first.minY, first.maxY, second.minY, second.maxY);
}

function intersectsInterior(geometry: LevelGeometryDefinition, zone: Bounds): boolean {
  const bounds = boundsOf(geometry);

  return (
    bounds.maxX > zone.minX + EPSILON &&
    bounds.minX < zone.maxX - EPSILON &&
    bounds.maxY > zone.minY + EPSILON &&
    bounds.minY < zone.maxY - EPSILON &&
    bounds.maxZ > zone.minZ + EPSILON &&
    bounds.minZ < zone.maxZ - EPSILON
  );
}

/** Asserts a hidden §7.1 C4 overlap on a continuous route seam. */
function expectContinuousSeam(firstId: string, secondId: string): void {
  const first = boundsOf(findGeometry(firstId));
  const second = boundsOf(findGeometry(secondId));
  const label = `${firstId} / ${secondId}`;

  expect(zOverlap(first, second), label).toBeGreaterThanOrEqual(MIN_SEAM_OVERLAP_METERS - EPSILON);
  expect(zOverlap(first, second), label).toBeLessThanOrEqual(MAX_SEAM_OVERLAP_METERS + EPSILON);
  expect(xOverlap(first, second), label).toBeGreaterThan(EPSILON);
  expect(yOverlap(first, second), label).toBeGreaterThan(EPSILON);
}

function findGeometry(id: string): LevelGeometryDefinition {
  const geometry = LAYOUT.geometry.find((candidate) => candidate.id === id);

  if (!geometry) {
    throw new Error(`Layout is missing geometry "${id}".`);
  }

  return geometry;
}

function findTrigger(id: string): LevelTriggerDefinition {
  const trigger = LAYOUT.triggers.find((candidate) => candidate.id === id);

  if (!trigger) {
    throw new Error(`Layout is missing trigger "${id}".`);
  }

  return trigger;
}

function findSurface(id: string): LevelSurfaceDefinition {
  const surface = LAYOUT.surfaces.find((candidate) => candidate.id === id);

  if (!surface) {
    throw new Error(`Layout is missing surface "${id}".`);
  }

  return surface;
}

function geometryOfSection(sectionId: string): LevelGeometryDefinition[] {
  return LAYOUT.geometry.filter((geometry) => geometry.sectionId === sectionId);
}

function supportingTopAt(x: number, z: number, belowY: number): number {
  let top = Number.NEGATIVE_INFINITY;

  for (const geometry of LAYOUT.geometry) {
    const bounds = boundsOf(geometry);
    const containsPoint =
      x >= bounds.minX - EPSILON &&
      x <= bounds.maxX + EPSILON &&
      z >= bounds.minZ - EPSILON &&
      z <= bounds.maxZ + EPSILON;

    if (containsPoint && bounds.maxY <= belowY + EPSILON && bounds.maxY > top) {
      top = bounds.maxY;
    }
  }

  return top;
}

function requireItem<T>(item: T | undefined, label: string): T {
  if (item === undefined) {
    throw new Error(`Layout is missing ${label}.`);
  }

  return item;
}

function pairsOf<T>(items: readonly T[]): ReadonlyArray<readonly [T, T]> {
  const pairs: Array<readonly [T, T]> = [];

  for (let index = 0; index + 1 < items.length; index += 1) {
    const first = items[index];
    const second = items[index + 1];

    if (first !== undefined && second !== undefined) {
      pairs.push([first, second]);
    }
  }

  return pairs;
}

function stairFlight(prefix: "geo_stair1" | "geo_stair2"): LevelGeometryDefinition[] {
  return Array.from({ length: 6 }, (_, index) => findGeometry(`${prefix}_${index + 1}`));
}

describe("First gameplay section collision layout", () => {
  it("validates without errors or warnings", () => {
    const result = validateLevelDefinition(LAYOUT);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
    expect(LAYOUT.id).toBe(FIRST_SECTION_LAYOUT_ID);
  });

  it("declares exactly six ordered sections matching the authored chain", () => {
    const ordered = [...LAYOUT.sections].sort((left, right) => left.order - right.order);

    expect(ordered).toHaveLength(6);
    expect(ordered.map((section) => section.id)).toEqual([...SECTIONS_IN_ORDER]);
    expect(ordered.map((section) => section.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ordered.map((section) => section.displayName)).toEqual([
      "Starting Roof",
      "Building Jump",
      "Technical Passage",
      "Slide Section",
      "Vault Section",
      "Finish Point",
    ]);
    expect(new Set(LAYOUT.sections.map((section) => section.id)).size).toBe(6);

    for (const section of ordered) {
      const entrySpawn = LAYOUT.spawnPoints.find(
        (spawnPoint) => spawnPoint.id === section.entrySpawnPointId,
      );

      expect(entrySpawn, section.id).toBeDefined();
      expect(entrySpawn?.sectionId, section.id).toBe(section.id);
    }
  });

  it("wires nextSectionId as a full chain and leaves the last section open", () => {
    const ordered = [...LAYOUT.sections].sort((left, right) => left.order - right.order);
    const chain = pairsOf(ordered);

    expect(chain).toHaveLength(5);

    for (const [current, next] of chain) {
      expect(current.nextSectionId, current.id).toBe(next.id);
    }

    const last = ordered[ordered.length - 1];

    expect(last).toBeDefined();
    expect(last?.nextSectionId).toBeUndefined();
  });

  it("places one outgoing transition trigger in every non-final section", () => {
    const ordered = [...LAYOUT.sections].sort((left, right) => left.order - right.order);
    const transitions = LAYOUT.triggers.filter((trigger) => trigger.type === "section-entry");
    const exitGeometryIds: Record<string, string> = {
      [FIRST_SECTION_SECTION_IDS.start]: "geo_start_deck",
      [FIRST_SECTION_SECTION_IDS.buildingJump]: "geo_plant_step",
      [FIRST_SECTION_SECTION_IDS.technical]: "geo_plant_deck",
      [FIRST_SECTION_SECTION_IDS.slide]: "geo_slide_exit",
      [FIRST_SECTION_SECTION_IDS.vault]: "geo_vault_deck",
    };

    expect(transitions).toHaveLength(5);

    for (const [current, next] of pairsOf(ordered)) {
      const outgoing = transitions.filter((trigger) => trigger.sectionId === current.id);

      expect(outgoing, current.id).toHaveLength(1);

      const trigger = outgoing[0];
      const exitId = exitGeometryIds[current.id];

      if (!trigger || !exitId) {
        throw new Error(`Missing transition data for "${current.id}".`);
      }

      expect(trigger.metadata?.targetSectionId).toBe(next.id);

      const exitBounds = boundsOf(findGeometry(exitId));

      expect(trigger.center.z).toBeGreaterThanOrEqual(exitBounds.minZ - 0.75);
      expect(trigger.center.z).toBeLessThanOrEqual(exitBounds.maxZ + 0.75);

      // The volume must catch the body centre standing on the exit floor.
      const bodyCenterY = exitBounds.maxY + BODY_CENTER_ABOVE_FLOOR;
      const volume = triggerBounds(trigger);

      expect(bodyCenterY).toBeGreaterThanOrEqual(volume.minY);
      expect(bodyCenterY).toBeLessThanOrEqual(volume.maxY);
    }

    expect(LAYOUT.triggers.filter((trigger) => trigger.type === "section-exit")).toHaveLength(0);
  });

  it("registers four checkpoints in section order with matching trigger and spawn", () => {
    const ordered = [...LAYOUT.sections].sort((left, right) => left.order - right.order);
    const orderedCheckpoints = [...LAYOUT.checkpoints].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );

    expect(orderedCheckpoints).toHaveLength(4);
    expect(orderedCheckpoints.map((checkpoint) => checkpoint.sectionId)).toEqual([
      FIRST_SECTION_SECTION_IDS.start,
      FIRST_SECTION_SECTION_IDS.buildingJump,
      FIRST_SECTION_SECTION_IDS.slide,
      FIRST_SECTION_SECTION_IDS.vault,
    ]);
    expect(orderedCheckpoints.map((checkpoint) => checkpoint.order)).toEqual([0, 1, 2, 3]);

    for (const checkpoint of orderedCheckpoints) {
      const section = ordered.find((candidate) => candidate.id === checkpoint.sectionId);
      const trigger = LAYOUT.triggers.find((candidate) => candidate.id === checkpoint.triggerId);
      const spawn = LAYOUT.spawnPoints.find(
        (candidate) => candidate.id === checkpoint.spawnPointId,
      );

      expect(section, checkpoint.id).toBeDefined();
      expect(trigger, checkpoint.id).toBeDefined();
      expect(spawn, checkpoint.id).toBeDefined();
      expect(trigger?.type).toBe("checkpoint");
      expect(trigger?.sectionId).toBe(checkpoint.sectionId);
      expect(trigger?.metadata?.checkpointId).toBe(checkpoint.id);
      expect(spawn?.sectionId).toBe(checkpoint.sectionId);
      expect(spawn?.type).toBe("checkpoint");
      expect(checkpoint.activationMode).toBe("automatic");
      expect(checkpoint.respawnEnabled).toBe(true);

      if (!trigger || !spawn) {
        throw new Error(`Checkpoint "${checkpoint.id}" is missing its runtime anchors.`);
      }

      expect(Math.abs(trigger.center.x - spawn.position.x)).toBeLessThanOrEqual(
        trigger.halfExtents.x,
      );
      expect(Math.abs(trigger.center.z - spawn.position.z)).toBeLessThanOrEqual(
        trigger.halfExtents.z,
      );

      const supportTop = supportingTopAt(spawn.position.x, spawn.position.z, spawn.position.y);

      expect(supportTop).toBeGreaterThan(Number.NEGATIVE_INFINITY);
      expect(spawn.position.y - supportTop).toBeCloseTo(SPAWN_CENTER_ABOVE_FLOOR, 2);

      const bodyCenterY = supportTop + BODY_CENTER_ABOVE_FLOOR;
      const volume = triggerBounds(trigger);

      expect(bodyCenterY).toBeGreaterThanOrEqual(volume.minY);
      expect(bodyCenterY).toBeLessThanOrEqual(volume.maxY);
    }

    for (const spawn of LAYOUT.spawnPoints) {
      const supportTop = supportingTopAt(spawn.position.x, spawn.position.z, spawn.position.y);

      expect(spawn.rotationY).toBe(0);
      expect(spawn.position.y - supportTop).toBeCloseTo(SPAWN_CENTER_ABOVE_FLOOR, 2);
    }
  });

  it("owns exactly one fall-catcher kill volume per section", () => {
    const killVolumes = LAYOUT.triggers.filter(
      (trigger) => trigger.metadata?.kind === "kill-volume",
    );
    const routeBounds = LAYOUT.geometry.map(boundsOf);
    const routeMinX = Math.min(...routeBounds.map((bounds) => bounds.minX));
    const routeMaxX = Math.max(...routeBounds.map((bounds) => bounds.maxX));
    const routeMinZ = Math.min(...routeBounds.map((bounds) => bounds.minZ));
    const routeMaxZ = Math.max(...routeBounds.map((bounds) => bounds.maxZ));
    const lowestFloorTop = Math.min(...routeBounds.map((bounds) => bounds.maxY));
    expect(killVolumes).toHaveLength(6);

    const reference = requireItem(killVolumes[0], "kill volume");

    for (const section of LAYOUT.sections) {
      expect(
        killVolumes.filter((trigger) => trigger.sectionId === section.id),
        section.id,
      ).toHaveLength(1);
    }

    for (const killVolume of killVolumes) {
      expect(killVolume.center).toEqual(reference.center);
      expect(killVolume.halfExtents).toEqual(reference.halfExtents);

      const volume = triggerBounds(killVolume);

      // The slab must sit below every traversable surface and span the route.
      expect(volume.maxY).toBeLessThan(lowestFloorTop);
      expect(volume.minX).toBeLessThanOrEqual(routeMinX);
      expect(volume.maxX).toBeGreaterThanOrEqual(routeMaxX);
      expect(volume.minZ).toBeLessThanOrEqual(routeMinZ);
      expect(volume.maxZ).toBeGreaterThanOrEqual(routeMaxZ);
    }
  });

  it("defines exactly one finish trigger on the podium", () => {
    const finishTriggers = LAYOUT.triggers.filter((trigger) => trigger.metadata?.kind === "finish");
    const ordered = [...LAYOUT.sections].sort((left, right) => left.order - right.order);
    const lastSection = ordered[ordered.length - 1];

    expect(finishTriggers).toHaveLength(1);

    const finish = finishTriggers[0];

    if (!finish) {
      throw new Error("Finish trigger is missing.");
    }

    expect(finish.id).toBe("trigger_finish");
    expect(finish.type).toBe("level-transition");
    expect(finish.repeatable).toBe(false);
    expect(finish.sectionId).toBe(requireItem(lastSection, "last section").id);

    const podium = findGeometry("geo_finish_deck");
    const podiumBounds = boundsOf(podium);
    const volume = triggerBounds(finish);

    // The finish volume must sit on the podium, not hang over its edges.
    expect(volume.minX).toBeGreaterThanOrEqual(podiumBounds.minX);
    expect(volume.maxX).toBeLessThanOrEqual(podiumBounds.maxX);
    expect(volume.minZ).toBeGreaterThanOrEqual(podiumBounds.minZ);
    expect(volume.maxZ).toBeLessThanOrEqual(podiumBounds.maxZ);

    const bodyCenterY = podiumBounds.maxY + BODY_CENTER_ABOVE_FLOOR;

    expect(bodyCenterY).toBeGreaterThanOrEqual(volume.minY);
    expect(bodyCenterY).toBeLessThanOrEqual(volume.maxY);

    expect(findTrigger("trigger_finish")).toBe(finish);
  });

  it("keeps interaction targets empty", () => {
    expect(LAYOUT.interactionTargets).toEqual([]);
  });

  it("resolves every surface reference and keeps wall run disabled", () => {
    const surfaceIds = new Set(LAYOUT.surfaces.map((surface) => surface.id));
    const sectionIds = new Set(LAYOUT.sections.map((section) => section.id));

    expect(LAYOUT.surfaces.length).toBeGreaterThan(0);
    expect(surfaceIds.size).toBe(LAYOUT.surfaces.length);

    for (const surface of LAYOUT.surfaces) {
      expect(sectionIds.has(surface.sectionId), surface.id).toBe(true);
      // §10 Q2: wall run is an explicit non-goal for the whole section.
      expect(surface.wallRunSurface, surface.id).toBe(false);
      // Keeps the validator's SURFACE_WITHOUT_TRAVERSAL_METADATA warning away.
      expect(
        surface.walkable ||
          surface.landingSurface ||
          surface.wallRunSurface ||
          surface.wallJumpSurface ||
          surface.vaultObstacle,
        surface.id,
      ).toBe(true);
    }

    for (const geometry of LAYOUT.geometry) {
      expect(surfaceIds.has(geometry.surfaceId), geometry.id).toBe(true);
    }

    expect(findSurface("surface_slide_slot").surfaceType).toBe("metal");
    expect(findSurface("surface_vault").vaultObstacle).toBe(true);
  });

  it("seats the S2 north parapets on the deck without closing the entrance", () => {
    const deck = boundsOf(findGeometry("geo_plant_deck"));
    const step = boundsOf(findGeometry("geo_plant_step"));
    const west = boundsOf(findGeometry("geo_plant_parapet_n_w"));
    const east = boundsOf(findGeometry("geo_plant_parapet_n_e"));
    const spawn = requireItem(
      LAYOUT.spawnPoints.find((candidate) => candidate.id === "sp_entry_technical"),
      "technical entry spawn",
    );
    const trigger = findTrigger("trigger_to_technical");

    for (const [label, parapet] of [
      ["west", west],
      ["east", east],
    ] as const) {
      // The whole footprint rests on the deck plan, not beyond its edge.
      expect(parapet.minX, label).toBeGreaterThanOrEqual(deck.minX - EPSILON);
      expect(parapet.maxX, label).toBeLessThanOrEqual(deck.maxX + EPSILON);
      expect(parapet.minZ, label).toBeGreaterThanOrEqual(deck.minZ - EPSILON);
      expect(parapet.maxZ, label).toBeLessThanOrEqual(deck.maxZ + EPSILON);
      expect(parapet.minY, label).toBeCloseTo(deck.maxY, 6);
      expect(parapet.maxY - parapet.minY, label).toBeCloseTo(1.05, 6);
      // Outer face is flush with the deck's north edge; the step runs 0.02 m
      // under that edge to provide the C4 overlap.
      expect(parapet.maxZ, label).toBeCloseTo(deck.maxZ, 6);
      expect(step.minZ, label).toBeLessThan(deck.maxZ);
    }

    // Symmetric 8 m entrance between the two inner faces.
    expect(east.minX - west.maxX).toBeCloseTo(8, 6);

    // The entry spawn and the transition trigger stay in that opening.
    expect(spawn.position.x).toBeGreaterThan(west.maxX);
    expect(spawn.position.x).toBeLessThan(east.minX);
    expect(spawn.position.z).toBeGreaterThanOrEqual(west.minZ - EPSILON);
    expect(spawn.position.z).toBeLessThanOrEqual(west.maxZ + EPSILON);
    expect(trigger.center.x).toBeGreaterThan(west.maxX);
    expect(trigger.center.x).toBeLessThan(east.minX);

    for (const geometry of LAYOUT.geometry) {
      const bounds = boundsOf(geometry);
      const containsSpawn =
        spawn.position.x >= bounds.minX - EPSILON &&
        spawn.position.x <= bounds.maxX + EPSILON &&
        spawn.position.y >= bounds.minY - EPSILON &&
        spawn.position.y <= bounds.maxY + EPSILON &&
        spawn.position.z >= bounds.minZ - EPSILON &&
        spawn.position.z <= bounds.maxZ + EPSILON;

      expect(containsSpawn, geometry.id).toBe(false);
    }

    const entrance: Bounds = {
      minX: west.maxX,
      maxX: east.minX,
      minY: deck.maxY,
      maxY: Math.min(west.maxY, east.maxY),
      minZ: Math.min(west.minZ, east.minZ),
      maxZ: Math.max(west.maxZ, east.maxZ),
    };
    const triggerVolume = triggerBounds(trigger);

    // The transition volume still covers the full entrance opening.
    expect(xOverlap(triggerVolume, entrance)).toBeGreaterThan(0);
    expect(zOverlap(triggerVolume, entrance)).toBeGreaterThan(0);

    for (const geometry of LAYOUT.geometry) {
      expect(intersectsInterior(geometry, entrance), geometry.id).toBe(false);
    }
  });

  it("overlaps every continuous route seam by at least 0.02 m", () => {
    const firstFlight = stairFlight("geo_stair1");
    const secondFlight = stairFlight("geo_stair2");
    const seams: Array<readonly [string, string]> = [
      ["geo_roof_c", "geo_plant_step"],
      ["geo_plant_step", "geo_plant_deck"],
      ["geo_plant_deck", "geo_slide_runway"],
      ["geo_slide_runway", "geo_slide_floor"],
      ["geo_slide_floor", "geo_slide_exit"],
      ["geo_slide_exit", "geo_vault_deck"],
      ["geo_vault_deck", "geo_finish_approach"],
      ["geo_finish_approach", "geo_stair1_1"],
    ];

    for (const [first, second] of pairsOf(firstFlight)) {
      seams.push([first.id, second.id]);
    }

    seams.push(["geo_stair1_6", "geo_stair_landing"], ["geo_stair_landing", "geo_stair2_1"]);

    for (const [first, second] of pairsOf(secondFlight)) {
      seams.push([first.id, second.id]);
    }

    seams.push(["geo_stair2_6", "geo_finish_deck"]);

    // §5.1–§5.6 continuous route: 8 floor/platform seams + 13 stair seams.
    expect(seams).toHaveLength(21);

    for (const [first, second] of seams) {
      expectContinuousSeam(first, second);
    }

    // Same-height seams must not change either walkable top.
    const levelSeams: Array<readonly [string, string]> = [
      ["geo_plant_step", "geo_plant_deck"],
      ["geo_plant_deck", "geo_slide_runway"],
      ["geo_slide_runway", "geo_slide_floor"],
      ["geo_slide_floor", "geo_slide_exit"],
      ["geo_slide_exit", "geo_vault_deck"],
      ["geo_vault_deck", "geo_finish_approach"],
      ["geo_stair1_6", "geo_stair_landing"],
      ["geo_stair2_6", "geo_finish_deck"],
    ];

    for (const [first, second] of levelSeams) {
      expect(boundsOf(findGeometry(first)).maxY, `${first} / ${second}`).toBeCloseTo(
        boundsOf(findGeometry(second)).maxY,
        6,
      );
    }

    // Step-up underlaps stay hidden inside the higher tread: they never poke
    // out past its far edge and never rise above it.
    const heightSeams: Array<readonly [string, string]> = [
      ["geo_roof_c", "geo_plant_step"],
      ["geo_finish_approach", "geo_stair1_1"],
    ];

    for (const [first, second] of pairsOf(firstFlight)) {
      heightSeams.push([first.id, second.id]);
    }

    heightSeams.push(["geo_stair_landing", "geo_stair2_1"]);

    for (const [first, second] of pairsOf(secondFlight)) {
      heightSeams.push([first.id, second.id]);
    }

    for (const [lowerId, higherId] of heightSeams) {
      const lower = boundsOf(findGeometry(lowerId));
      const higher = boundsOf(findGeometry(higherId));

      expect(lower.minZ, `${lowerId} / ${higherId}`).toBeGreaterThan(higher.minZ + EPSILON);
      expect(lower.maxY, `${lowerId} / ${higherId}`).toBeLessThanOrEqual(higher.maxY + EPSILON);
    }
  });

  it("keeps the two authored gaps free of artificial overlap", () => {
    const startDeck = boundsOf(findGeometry("geo_start_deck"));
    const roofB = boundsOf(findGeometry("geo_roof_b"));
    const roofC = boundsOf(findGeometry("geo_roof_c"));
    const gaps = [
      { name: "gap A", minZ: roofB.maxZ, maxZ: startDeck.minZ, width: 3.4 },
      { name: "gap B", minZ: roofC.maxZ, maxZ: roofB.minZ, width: 4.2 },
    ];

    for (const gap of gaps) {
      expect(gap.maxZ - gap.minZ, gap.name).toBeCloseTo(gap.width, 6);

      for (const geometry of LAYOUT.geometry) {
        const bounds = boundsOf(geometry);

        expect(
          overlapLength(bounds.minZ, bounds.maxZ, gap.minZ, gap.maxZ),
          `${gap.name}: ${geometry.id}`,
        ).toBeLessThanOrEqual(EPSILON);
      }
    }
  });

  it("keeps the galleries, entrance, and vault aisle free of unintended geometry", () => {
    const plantDeck = boundsOf(findGeometry("geo_plant_deck"));
    const galleryWest = boundsOf(findGeometry("geo_gallery_wall_w"));
    const galleryEast = boundsOf(findGeometry("geo_gallery_wall_e"));
    const galleryCeiling = boundsOf(findGeometry("geo_gallery_ceiling"));
    const chamberWest = boundsOf(findGeometry("geo_chamber_wall_w"));
    const chamberEast = boundsOf(findGeometry("geo_chamber_wall_e"));
    const chamberCeiling = boundsOf(findGeometry("geo_chamber_ceiling"));
    const northWest = boundsOf(findGeometry("geo_plant_parapet_n_w"));
    const northEast = boundsOf(findGeometry("geo_plant_parapet_n_e"));
    const vaultDeck = boundsOf(findGeometry("geo_vault_deck"));
    const vaultWest = boundsOf(findGeometry("geo_vault_wall_w"));
    const vaultEast = boundsOf(findGeometry("geo_vault_wall_e"));
    const slideExit = boundsOf(findGeometry("geo_slide_exit"));
    const vaultObstacleIds = new Set(["geo_vault_1", "geo_vault_2", "geo_vault_3"]);

    const galleryZone: Bounds = {
      minX: galleryWest.maxX,
      maxX: galleryEast.minX,
      minY: plantDeck.maxY,
      maxY: galleryCeiling.minY,
      minZ: Math.max(galleryWest.minZ, galleryCeiling.minZ),
      maxZ: Math.min(galleryWest.maxZ, galleryCeiling.maxZ),
    };
    // Stop at the gallery exit so the intended 0.1 m gallery/chamber lap does
    // not count as an obstruction of the chamber opening.
    const chamberZone: Bounds = {
      minX: chamberWest.maxX,
      maxX: chamberEast.minX,
      minY: plantDeck.maxY,
      maxY: chamberCeiling.minY,
      minZ: chamberWest.minZ,
      maxZ: Math.min(chamberWest.maxZ, galleryWest.minZ),
    };
    const entranceZone: Bounds = {
      minX: northWest.maxX,
      maxX: northEast.minX,
      minY: plantDeck.maxY,
      maxY: Math.min(northWest.maxY, northEast.maxY),
      minZ: Math.min(northWest.minZ, northEast.minZ),
      maxZ: Math.max(northWest.maxZ, northEast.maxZ),
    };
    const vaultZone: Bounds = {
      minX: vaultWest.maxX,
      maxX: vaultEast.minX,
      minY: vaultDeck.maxY,
      maxY: vaultWest.maxY,
      minZ: vaultDeck.minZ,
      maxZ: slideExit.minZ,
    };

    for (const [zone, label] of [
      [galleryZone, "S2 gallery"],
      [chamberZone, "S2 chamber"],
      [entranceZone, "S2 entrance"],
      [vaultZone, "S4 vault aisle"],
    ] as const) {
      for (const geometry of LAYOUT.geometry) {
        if (label === "S4 vault aisle" && vaultObstacleIds.has(geometry.id)) {
          continue;
        }

        expect(intersectsInterior(geometry, zone), `${label}: ${geometry.id}`).toBe(false);
      }
    }
  });

  it("keeps the slide duct clearance at 1.00 m over its full length", () => {
    const floor = findGeometry("geo_slide_floor");
    const ceiling = findGeometry("geo_slide_ceiling");
    const west = findGeometry("geo_slide_wall_w");
    const east = findGeometry("geo_slide_wall_e");
    const floorBounds = boundsOf(floor);
    const ceilingBounds = boundsOf(ceiling);
    const westBounds = boundsOf(west);
    const eastBounds = boundsOf(east);
    const clearance = ceilingBounds.minY - floorBounds.maxY;
    const duct = {
      minX: westBounds.maxX,
      maxX: eastBounds.minX,
      minZ: Math.max(floorBounds.minZ, ceilingBounds.minZ),
      maxZ: Math.min(floorBounds.maxZ, ceilingBounds.maxZ),
    };

    expect(Math.abs(clearance - SLIDE_CLEARANCE_METERS)).toBeLessThanOrEqual(
      CLEARANCE_TOLERANCE_METERS,
    );
    expect(duct.maxX - duct.minX).toBeCloseTo(3.2, 5);
    expect(duct.maxZ - duct.minZ).toBeCloseTo(7, 5);

    // Nothing else in the section may intrude into the capsule's slot.
    for (const geometry of geometryOfSection(FIRST_SECTION_SECTION_IDS.slide)) {
      if (geometry.id === floor.id || geometry.id === ceiling.id) {
        continue;
      }

      if (geometry.id === west.id || geometry.id === east.id) {
        continue;
      }

      const bounds = boundsOf(geometry);
      const overlapsSlot =
        bounds.maxX > duct.minX + EPSILON &&
        bounds.minX < duct.maxX - EPSILON &&
        bounds.maxZ > duct.minZ + EPSILON &&
        bounds.minZ < duct.maxZ - EPSILON &&
        bounds.maxY > floorBounds.maxY + EPSILON &&
        bounds.minY < ceilingBounds.minY - EPSILON;

      expect(overlapsSlot, geometry.id).toBe(false);
    }
  });

  it("raises the slide-duct ceiling above the measured jump apex", () => {
    const floorBounds = boundsOf(findGeometry("geo_slide_floor"));
    const ceilingBounds = boundsOf(findGeometry("geo_slide_ceiling"));
    const ceilingAboveFloor = ceilingBounds.maxY - floorBounds.maxY;
    const ceilingThickness = ceilingBounds.maxY - ceilingBounds.minY;

    // §5.7 / §9.8 / §11.7 criterion 30: the duct can no longer be bypassed on top.
    expect(ceilingAboveFloor).toBeGreaterThan(MEASURED_JUMP_APEX_METERS);
    expect(ceilingAboveFloor).toBeCloseTo(2, 3);
    // Q10(a): solid 1.00 m slab instead of the original 0.20 m plate.
    expect(ceilingThickness).toBeCloseTo(1, 3);
    // The clearance floor is still the authored 0.90 m surface.
    expect(floorBounds.maxY).toBeCloseTo(0.9, 3);
  });

  it("seals the slide duct laterally between floor, walls, and ceiling", () => {
    const floorBounds = boundsOf(findGeometry("geo_slide_floor"));
    const ceilingBounds = boundsOf(findGeometry("geo_slide_ceiling"));
    const westBounds = boundsOf(findGeometry("geo_slide_wall_w"));
    const eastBounds = boundsOf(findGeometry("geo_slide_wall_e"));
    const innerWest = westBounds.maxX;
    const innerEast = eastBounds.minX;

    for (const [label, bounds] of [
      ["floor", floorBounds],
      ["ceiling", ceilingBounds],
    ] as const) {
      // Horizontal overlap: the slab reaches past both wall inner faces.
      expect(bounds.minX, label).toBeLessThanOrEqual(innerWest + EPSILON);
      expect(bounds.maxX, label).toBeGreaterThanOrEqual(innerEast - EPSILON);
    }

    for (const [label, wall] of [
      ["west wall", westBounds],
      ["east wall", eastBounds],
    ] as const) {
      // Vertical seal: walls start at the floor and reach the ceiling top.
      expect(wall.minY, label).toBeLessThanOrEqual(floorBounds.maxY + CLEARANCE_TOLERANCE_METERS);
      expect(Math.abs(wall.minY - floorBounds.maxY), label).toBeLessThanOrEqual(
        CLEARANCE_TOLERANCE_METERS,
      );
      expect(wall.maxY, label).toBeGreaterThanOrEqual(
        ceilingBounds.maxY - CLEARANCE_TOLERANCE_METERS,
      );
      // Longitudinal seal: floor and ceiling cover the wall span.
      expect(ceilingBounds.minZ, label).toBeLessThanOrEqual(wall.minZ + EPSILON);
      expect(ceilingBounds.maxZ, label).toBeGreaterThanOrEqual(wall.maxZ - EPSILON);
      expect(floorBounds.minZ, label).toBeLessThanOrEqual(wall.minZ + EPSILON);
      expect(floorBounds.maxZ, label).toBeGreaterThanOrEqual(wall.maxZ - EPSILON);
    }
  });

  it("authors the complete collision set from the six segment tables", () => {
    const perSection = SECTIONS_IN_ORDER.map((sectionId) => geometryOfSection(sectionId).length);

    // §5.1–§5.6 boxes per segment: 5, 8, 11, 8, 6, 20.
    expect(perSection).toEqual([5, 8, 11, 8, 6, 20]);
    expect(LAYOUT.geometry).toHaveLength(58);

    // Later substeps own the Kit, decorations, and the composed level.
    expect(LAYOUT.decorations).toBeUndefined();
    expect(LAYOUT.architecture).toBeUndefined();
  });

  it("matches the route and segment dimensions from the specification tables", () => {
    const allBounds = LAYOUT.geometry.map(boundsOf);
    const routeMinZ = Math.min(...allBounds.map((bounds) => bounds.minZ));
    const routeMaxZ = Math.max(...allBounds.map((bounds) => bounds.maxZ));
    // Vertical route envelope uses walkable floors, not parapet copings.
    const walkableSurfaceIds = new Set(
      LAYOUT.surfaces.filter((surface) => surface.walkable).map((surface) => surface.id),
    );
    const walkableTops = LAYOUT.geometry
      .filter((geometry) => walkableSurfaceIds.has(geometry.surfaceId))
      .map((geometry) => boundsOf(geometry).maxY);
    const routeMinTop = Math.min(...walkableTops);
    const routeMaxTop = Math.max(...walkableTops);

    // §4.2: 105.5 m along the route and 0.00 → 4.50 m vertically.
    expect(routeMaxZ).toBeCloseTo(ROUTE_Z_START, 5);
    expect(routeMinZ).toBeCloseTo(ROUTE_Z_END, 5);
    expect(routeMaxZ - routeMinZ).toBeCloseTo(ROUTE_LENGTH_METERS, 5);
    expect(routeMinTop).toBeCloseTo(0, 5);
    expect(routeMaxTop).toBeCloseTo(4.5, 5);

    // §5.1/§5.2: roof lengths and the two authored gaps.
    const startDeck = boundsOf(findGeometry("geo_start_deck"));
    const roofB = boundsOf(findGeometry("geo_roof_b"));
    const roofC = boundsOf(findGeometry("geo_roof_c"));
    const plantStep = boundsOf(findGeometry("geo_plant_step"));
    const plantDeck = boundsOf(findGeometry("geo_plant_deck"));

    expect(startDeck.maxZ - startDeck.minZ).toBeCloseTo(20, 5);
    expect(roofB.maxZ - roofB.minZ).toBeCloseTo(8, 5);
    // Visible roof C between the gap edge and the step face; the 0.02 m
    // seam underlap is hidden under the step.
    expect(roofC.maxZ - plantStep.maxZ).toBeCloseTo(7.4, 5);
    expect(startDeck.minZ - roofB.maxZ).toBeCloseTo(3.4, 5);
    expect(roofB.minZ - roofC.maxZ).toBeCloseTo(4.2, 5);
    // §5.2: the 0.90 m ledge closes the 25.4 m section at the deck's north edge.
    expect(plantStep.maxY - roofC.maxY).toBeCloseTo(0.9, 5);
    expect(startDeck.minZ - plantDeck.maxZ).toBeCloseTo(25.4, 5);

    // §5.3: 13.6 m deck, 2.8 m wide gallery with a 2.4 m clear height.
    const galleryWest = boundsOf(findGeometry("geo_gallery_wall_w"));
    const galleryEast = boundsOf(findGeometry("geo_gallery_wall_e"));
    const galleryCeiling = boundsOf(findGeometry("geo_gallery_ceiling"));

    expect(plantDeck.maxZ - plantDeck.minZ).toBeCloseTo(13.6, 5);
    expect(galleryEast.minX - galleryWest.maxX).toBeCloseTo(2.8, 5);
    expect(galleryCeiling.minY - plantDeck.maxY).toBeCloseTo(2.4, 5);

    // §5.4: 16 m slide section made of a 6 m runway, 7 m duct, and 3 m exit.
    const runway = boundsOf(findGeometry("geo_slide_runway"));
    const slideFloor = boundsOf(findGeometry("geo_slide_floor"));
    const slideExit = boundsOf(findGeometry("geo_slide_exit"));

    // Visible spans: the runway/exit carry the hidden seam allowance, while
    // the duct floor keeps its authored 7.0 m.
    expect(plantDeck.minZ - slideFloor.maxZ).toBeCloseTo(6, 5);
    expect(slideFloor.maxZ - slideFloor.minZ).toBeCloseTo(7, 5);
    expect(slideFloor.minZ - slideExit.minZ).toBeCloseTo(3, 5);
    expect(plantDeck.minZ - slideExit.minZ).toBeCloseTo(16, 5);
    expect(runway.maxY).toBeCloseTo(slideFloor.maxY, 6);
    expect(slideExit.maxY).toBeCloseTo(slideFloor.maxY, 6);

    // §5.5: 14 m vault channel, 4.4 m clear width, 4.0 m obstacles.
    const vaultDeck = boundsOf(findGeometry("geo_vault_deck"));
    const vaultWest = boundsOf(findGeometry("geo_vault_wall_w"));
    const vaultEast = boundsOf(findGeometry("geo_vault_wall_e"));

    // Authored section span; the 0.02 m seam allowance is hidden under the
    // slide exit.
    expect(slideExit.minZ - vaultDeck.minZ).toBeCloseTo(14, 5);
    expect(vaultEast.minX - vaultWest.maxX).toBeCloseTo(4.4, 5);

    for (const [index, expectedHeight] of [0.5, 0.7, 1.1].entries()) {
      const obstacle = findGeometry(`geo_vault_${index + 1}`);
      const obstacleBounds = boundsOf(obstacle);

      expect(obstacleBounds.maxY - vaultDeck.maxY).toBeCloseTo(expectedHeight, 5);
      expect(obstacle.size.x).toBeCloseTo(4, 5);
      expect(vaultEast.minX - obstacleBounds.maxX).toBeCloseTo(0.2, 5);
      expect(obstacleBounds.minX - vaultWest.maxX).toBeCloseTo(0.2, 5);
    }

    // §5.6: 0.30 m stairs with 0.35 m treads, 3.6 m total climb, 10 × 9 m podium.
    const approach = boundsOf(findGeometry("geo_finish_approach"));
    const podium = boundsOf(findGeometry("geo_finish_deck"));
    const firstFlight = stairFlight("geo_stair1");
    const secondFlight = stairFlight("geo_stair2");
    const landing = boundsOf(findGeometry("geo_stair_landing"));
    const firstStep = boundsOf(requireItem(firstFlight[0], "first stair of flight 1"));
    const lastFirstStep = boundsOf(
      requireItem(firstFlight[firstFlight.length - 1], "last stair of flight 1"),
    );
    const firstSecondStep = boundsOf(requireItem(secondFlight[0], "first stair of flight 2"));
    const lastSecondStep = boundsOf(
      requireItem(secondFlight[secondFlight.length - 1], "last stair of flight 2"),
    );

    expect(firstStep.maxY - approach.maxY).toBeCloseTo(0.3, 5);
    // Visible approach between the vault deck and the first riser (2.0 m);
    // its far edge carries the hidden underlap into the stair.
    expect(vaultDeck.minZ - firstStep.maxZ).toBeCloseTo(2, 5);

    for (const [current, next] of [...pairsOf(firstFlight), ...pairsOf(secondFlight)] as const) {
      const currentBounds = boundsOf(current);
      const nextBounds = boundsOf(next);

      expect(nextBounds.maxY - currentBounds.maxY).toBeCloseTo(0.3, 5);
      // Visible tread: current step front to the next step front. The hidden
      // 0.02 m underlap lies inside the next step and does not change it.
      expect(currentBounds.maxZ - nextBounds.maxZ).toBeCloseTo(0.35, 5);
    }

    expect(landing.maxY).toBeCloseTo(lastFirstStep.maxY, 5);
    expect(firstSecondStep.maxY - landing.maxY).toBeCloseTo(0.3, 5);
    expect(lastSecondStep.maxY).toBeCloseTo(podium.maxY, 5);
    // Visible landing tread between the two flights stays 1.30 m.
    expect(lastFirstStep.minZ - firstSecondStep.maxZ).toBeCloseTo(1.3, 5);
    expect(podium.maxX - podium.minX).toBeCloseTo(10, 5);
    expect(podium.maxZ - podium.minZ).toBeCloseTo(9, 5);
    // The 16.5 m finish section runs from the vault-channel seam to the podium end.
    expect(vaultDeck.minZ - podium.minZ).toBeCloseTo(16.5, 5);
  });
});
