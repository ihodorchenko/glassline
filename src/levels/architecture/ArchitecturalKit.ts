/**
 * Architectural Kit — public builder API.
 *
 * A module is generated once per authored variant, then instanced across every
 * placement by the level content loader. The builder is deliberately free of
 * level/world concepts: it returns shared geometry in module-local metres plus
 * the semantic material of each batch. Placement, batching, shadows and disposal
 * belong to the level runtime (`LevelContentLoader`).
 */

import type { MaterialKey } from "../../rendering/MaterialLibrary";
import { countPartTriangles, type KitGeometryPool, KitPartCollector } from "./KitGeometry";
import {
  buildCorner,
  buildCurtainWall,
  buildFacadeBay,
  buildJoint,
  buildParapet,
} from "./KitModulesEnvelope";
import {
  buildFacadeScreen,
  buildGlassRailing,
  buildLouver,
  buildServicePortal,
  buildVentilation,
} from "./KitModulesServices";
import {
  buildBridge,
  buildCanopy,
  buildCantilever,
  buildColumn,
  buildStair,
} from "./KitModulesStructure";
import {
  type ArchitecturalModuleDefinition,
  type ArchitecturalModuleKind,
  architecturalModuleKey,
  type KitModuleModel,
  type KitModulePart,
  validateArchitecturalModuleDefinition,
} from "./KitTypes";

export type {
  ArchitecturalModuleDefinition,
  ArchitecturalModuleKind,
  KitModuleModel,
  KitModulePart,
} from "./KitTypes";
export {
  architecturalModuleKey,
  architecturalModuleSignature,
  validateArchitecturalModuleDefinition,
} from "./KitTypes";
export type { MaterialKey };

/** Every authored module kind, in documentation order. */
export const ARCHITECTURAL_KIT_MODULE_KINDS: readonly ArchitecturalModuleKind[] = [
  "facade-bay",
  "curtain-wall",
  "corner",
  "column",
  "cantilever",
  "canopy",
  "bridge",
  "stair",
  "parapet",
  "service-portal",
  "ventilation",
  "louver",
  "glass-railing",
  "facade-screen",
  "joint",
];

/**
 * Builds one reusable module variant.
 *
 * Throws on invalid authored data: non-finite or non-positive dimensions would
 * otherwise produce broken geometry. `validateArchitecturalModuleDefinition`
 * exposes the same checks to `LevelValidator` so a bad level fails before load.
 */
export function buildArchitecturalModule(
  definition: ArchitecturalModuleDefinition,
  pool: KitGeometryPool,
): KitModuleModel {
  const issues = validateArchitecturalModuleDefinition(definition);

  if (issues.length > 0) {
    throw new Error(`Invalid architectural module: ${issues.join(" ")}`);
  }

  const collector = new KitPartCollector(pool);
  let parts: readonly KitModulePart[] = [];

  try {
    switch (definition.kind) {
      case "facade-bay":
        buildFacadeBay(collector, definition);
        break;
      case "curtain-wall":
        buildCurtainWall(collector, definition);
        break;
      case "corner":
        buildCorner(collector, definition);
        break;
      case "column":
        buildColumn(collector, definition);
        break;
      case "cantilever":
        buildCantilever(collector, definition);
        break;
      case "canopy":
        buildCanopy(collector, definition);
        break;
      case "bridge":
        buildBridge(collector, definition);
        break;
      case "stair":
        buildStair(collector, definition);
        break;
      case "parapet":
        buildParapet(collector, definition);
        break;
      case "service-portal":
        buildServicePortal(collector, definition);
        break;
      case "ventilation":
        buildVentilation(collector, definition);
        break;
      case "louver":
        buildLouver(collector, definition);
        break;
      case "glass-railing":
        buildGlassRailing(collector, definition);
        break;
      case "facade-screen":
        buildFacadeScreen(collector, definition);
        break;
      case "joint":
        buildJoint(collector, definition);
        break;
    }

    parts = collector.finish();

    if (parts.length === 0) {
      throw new Error(`Architectural module "${definition.kind}" produced no geometry.`);
    }

    let disposed = false;

    return {
      key: architecturalModuleKey(definition),
      kind: definition.kind,
      parts,
      triangles: countPartTriangles(parts),
      dispose(): void {
        if (disposed) {
          return;
        }

        disposed = true;

        for (const part of parts) {
          part.geometry.dispose();
        }
      },
    };
  } catch (error) {
    collector.abort();

    for (const part of parts) {
      part.geometry.dispose();
    }

    throw error;
  }
}
