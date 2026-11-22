import * as THREE from "three";
import { afterAll, describe, expect, it } from "vitest";

import { buildArchitecturalModule } from "../../src/levels/architecture/ArchitecturalKit";
import { KitGeometryPool } from "../../src/levels/architecture/KitGeometry";
import type { ArchitecturalModuleDefinition } from "../../src/levels/architecture/KitTypes";
import {
  FIRST_SECTION_ARCHITECTURE,
  FIRST_SECTION_ARCHITECTURE_VARIANTS,
} from "../../src/levels/first-section/FirstSectionArchitecture";
import { FIRST_SECTION_LAYOUT } from "../../src/levels/first-section/FirstSectionLayout";
import type { LevelArchitecturePlacement } from "../../src/levels/LevelTypes";

/**
 * Step 3.8 F-02 — route-clearance regression for the Architectural Kit layer.
 *
 * The Kit is visual-only, so an authored module can stand in the first-person
 * route without any collision stopping the player. Step 3.6 found seven 2 m
 * `joint` columns standing on the route centreline (S0 ×2, S2 ×2, S4 ×3), where
 * they covered the starting checkpoint and every vault obstacle.
 *
 * The rule pinned here is geometric, not a coordinate snapshot: a visual module
 * must not intrude into the volume the first-person camera travels through on
 * the authored route. The bounding boxes are derived from the real generated
 * module parts (so a future geometry change is accounted for), and the same
 * function is re-run against the historical coordinates to prove the check
 * would have failed before the fix.
 */

interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

interface RouteVolume {
  readonly id: string;
  readonly description: string;
  readonly bounds: Bounds;
}

/**
 * Camera-travel volumes of the authored route. Half-widths are the capsule
 * centre envelope (capsule radius 0.30 m): the S0 route band is the 4 m authored
 * corridor, and the gallery/vault widths are the authored inside widths minus
 * the capsule radius.
 */
const ROUTE_VOLUMES: readonly RouteVolume[] = [
  {
    id: "s0-route-band",
    description: "Starting Roof run from the spawn to the first gap edge",
    bounds: { minX: -2, maxX: 2, minY: 0, maxY: 2.2, minZ: -2, maxZ: 14.6 },
  },
  {
    id: "s2-gallery",
    description: "3.2 m wide, 2.4 m high gallery corridor",
    bounds: { minX: -1.1, maxX: 1.1, minY: 0.9, maxY: 2.4, minZ: -36.4, maxZ: -29.6 },
  },
  {
    id: "s4-vault-aisle",
    description: "vault channel camera envelope between the 2.2 m walls",
    bounds: { minX: -1.9, maxX: 1.9, minY: 0.9, maxY: 2.9, minZ: -71.1, maxZ: -57 },
  },
];

/** The seven Step 3.6 centreline joint placements, before the Step 3.8 fix. */
const HISTORICAL_ROUTE_JOINTS = [
  { id: "arch_start_joint_1", x: 0, y: 0, z: 2 },
  { id: "arch_start_joint_2", x: 0, y: 0, z: 10 },
  { id: "arch_technical_joint_entry", x: 0, y: 0.9, z: -30 },
  { id: "arch_technical_joint_chamber", x: 0, y: 0.9, z: -36.3 },
  { id: "arch_vault_joint_1", x: 0, y: 0.9, z: -59.5 },
  { id: "arch_vault_joint_2", x: 0, y: 0.9, z: -63.5 },
  { id: "arch_vault_joint_3", x: 0, y: 0.9, z: -67.5 },
] as const;

const pool = new KitGeometryPool();
const boundsCache = new Map<string, Bounds>();

/**
 * Known, already-reported intrusions that this step does not change.
 *
 * - `arch_technical_portal_entry` is a ring: the AABB is its outer frame, but
 *   the 2.8 × 2.4 m opening passes the camera envelope (the ring is solid only
 *   near the perimeter).
 * - `arch_technical_ventilation_north` is pre-existing and outside F-02: the
 *   1 m deep intake plenum was mounted on the gallery's east wall facing away
 *   from the corridor, so it penetrates the wall and reaches x = 0.83 (0.57 m
 *   inside the clear width). It is recorded as a separate finding in
 *   `docs/FIRST_SECTION_REMAINING_POLISH_REPORT.md`; narrowing the module's
 *   mount is a level-art decision outside this step.
 *
 * The self-check below fails if an entry stops intruding, so the allowlist
 * cannot silently outlive the content.
 */
const KNOWN_PRE_EXISTING_INTRUSIONS: Readonly<Record<string, string>> = {
  arch_technical_portal_entry:
    "portal ring: open in the middle; the AABB is the outer frame, not the opening",
  arch_technical_ventilation_north:
    "pre-existing external intake plenum penetrates the gallery east wall (separate finding)",
};

afterAll(() => {
  pool.dispose();
});

/** World AABB of a placement, derived from the real generated module parts. */
function placementBounds(
  placement: Pick<LevelArchitecturePlacement, "module" | "position" | "rotationY">,
): Bounds {
  const cacheKey = `${placement.module.kind}:${JSON.stringify(placement.module)}:${placement.position.x},${placement.position.y},${placement.position.z}:${placement.rotationY ?? 0}`;
  const cached = boundsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const model = buildArchitecturalModule(placement.module, pool);
  const local = new THREE.Box3();

  for (const part of model.parts) {
    part.geometry.computeBoundingBox();

    const box = part.geometry.boundingBox;

    if (box !== null) {
      local.union(box);
    }
  }

  model.dispose();

  const matrix = new THREE.Matrix4().makeRotationY(placement.rotationY ?? 0);
  const world = new THREE.Box3();
  const corner = new THREE.Vector3();

  for (const x of [local.min.x, local.max.x]) {
    for (const y of [local.min.y, local.max.y]) {
      for (const z of [local.min.z, local.max.z]) {
        corner.set(x, y, z).applyMatrix4(matrix);
        world.expandByPoint(corner);
      }
    }
  }

  const bounds: Bounds = {
    minX: world.min.x + placement.position.x,
    maxX: world.max.x + placement.position.x,
    minY: world.min.y + placement.position.y,
    maxY: world.max.y + placement.position.y,
    minZ: world.min.z + placement.position.z,
    maxZ: world.max.z + placement.position.z,
  };

  boundsCache.set(cacheKey, bounds);

  return bounds;
}

function geometryBounds(geometry: (typeof FIRST_SECTION_LAYOUT.geometry)[number]): Bounds {
  return {
    minX: geometry.position.x - geometry.size.x / 2,
    maxX: geometry.position.x + geometry.size.x / 2,
    minY: geometry.position.y - geometry.size.y / 2,
    maxY: geometry.position.y + geometry.size.y / 2,
    minZ: geometry.position.z - geometry.size.z / 2,
    maxZ: geometry.position.z + geometry.size.z / 2,
  };
}

function overlaps(left: Bounds, right: Bounds): boolean {
  return (
    left.minX < right.maxX &&
    left.maxX > right.minX &&
    left.minY < right.maxY &&
    left.maxY > right.minY &&
    left.minZ < right.maxZ &&
    left.maxZ > right.minZ
  );
}

function intrudedVolumes(bounds: Bounds): RouteVolume[] {
  return ROUTE_VOLUMES.filter((volume) => overlaps(bounds, volume.bounds));
}

function format(bounds: Bounds): string {
  return (
    `x ${bounds.minX.toFixed(2)}…${bounds.maxX.toFixed(2)}, ` +
    `y ${bounds.minY.toFixed(2)}…${bounds.maxY.toFixed(2)}, ` +
    `z ${bounds.minZ.toFixed(2)}…${bounds.maxZ.toFixed(2)}`
  );
}

describe("F-02 — Architectural Kit route clearance", () => {
  it("keeps every authored module out of the camera-travel volumes", () => {
    const intrusions: { id: string; report: string }[] = [];

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      const bounds = placementBounds(placement);
      const volumes = intrudedVolumes(bounds);

      if (volumes.length > 0) {
        intrusions.push({
          id: placement.id,
          report: `${placement.id} (${placement.module.kind}) → ${volumes
            .map((volume) => volume.id)
            .join(", ")}; ${format(bounds)}`,
        });
      }
    }

    const unexpected = intrusions.filter(
      (intrusion) => KNOWN_PRE_EXISTING_INTRUSIONS[intrusion.id] === undefined,
    );
    const allowed = intrusions.filter(
      (intrusion) => KNOWN_PRE_EXISTING_INTRUSIONS[intrusion.id] !== undefined,
    );

    // The allowlist must describe content that actually still intrudes: if a
    // known intrusion disappears, its entry becomes stale and must be removed.
    expect(allowed.map((intrusion) => intrusion.id).sort()).toEqual(
      Object.keys(KNOWN_PRE_EXISTING_INTRUSIONS).sort(),
    );
    expect(
      unexpected.map((intrusion) => intrusion.report),
      `unexpected modules intrude into the route:\n${unexpected
        .map((intrusion) => intrusion.report)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("would have rejected the seven Step 3.6 centreline joints", () => {
    const joint: ArchitecturalModuleDefinition = FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters;
    const missed: string[] = [];

    for (const historical of HISTORICAL_ROUTE_JOINTS) {
      const bounds = placementBounds({
        module: joint,
        position: { x: historical.x, y: historical.y, z: historical.z },
        rotationY: 0,
      });

      if (intrudedVolumes(bounds).length === 0) {
        missed.push(historical.id);
      }
    }

    // A self-check, not content: if this fails, the predicate is broken and the
    // route-clearance test above proves nothing.
    expect(missed, "predicate no longer detects the historical intrusions").toEqual([]);
  });

  it("mounts every joint module in solid geometry instead of free-standing", () => {
    const joints = FIRST_SECTION_ARCHITECTURE.filter(
      (placement) => placement.module.kind === "joint",
    );
    const floating: string[] = [];

    expect(joints.length).toBeGreaterThanOrEqual(7);

    for (const placement of joints) {
      const bounds = placementBounds(placement);
      const embedded = FIRST_SECTION_LAYOUT.geometry.some((geometry) =>
        overlaps(bounds, geometryBounds(geometry)),
      );

      if (!embedded) {
        floating.push(`${placement.id} (${format(bounds)})`);
      }
    }

    expect(floating, `joints not mounted in a wall/parapet:\n${floating.join("\n")}`).toEqual([]);
  });

  it("keeps the S0, S2 and S4 joints off the centreline", () => {
    const routeJoints = FIRST_SECTION_ARCHITECTURE.filter((placement) =>
      /^arch_(start|technical|vault)_joint/.test(placement.id),
    );

    expect(routeJoints.map((placement) => placement.id).sort()).toEqual(
      HISTORICAL_ROUTE_JOINTS.map((placement) => placement.id).sort(),
    );

    for (const placement of routeJoints) {
      const bounds = placementBounds(placement);
      const nearest = Math.min(Math.abs(bounds.minX), Math.abs(bounds.maxX));

      expect(
        nearest,
        `${placement.id} still straddles the centreline (${format(bounds)})`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the visual layer independent of the authored collision geometry", () => {
    const collisionIds = new Set(FIRST_SECTION_LAYOUT.geometry.map((geometry) => geometry.id));

    // The fix moved kit placements only: no collision box was added, removed or
    // re-identified, and no placement id shadows collision geometry.
    expect(collisionIds.size).toBe(FIRST_SECTION_LAYOUT.geometry.length);

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      expect(collisionIds.has(placement.id), placement.id).toBe(false);
    }
  });
});
