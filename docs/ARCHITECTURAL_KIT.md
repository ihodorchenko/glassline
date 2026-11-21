# Architectural Kit

**Status:** Implemented / Integrated / Verified (2026-11-21)
**Scope:** reusable procedural architecture modules, their level contract, and the review composition.

This document owns the Architectural Kit contract. It supplements, and does not replace:

- `docs/02_TECHNICAL_ARCHITECTURE.md` §8 (rendering) and §12 (procedural generation);
- `docs/04_ASSET_BIBLE.md` §6–§10 (architectural language, modular kit, geometry, visual/physics separation);
- `docs/06_LEVEL_DESIGN_SPEC.md` §3–§4 (level standards and lifecycle);
- `docs/15_LEVEL_RUNTIME_SYSTEM_SPEC.md` §5.1 (level definition) and §6 (content lifecycle).

## 1. Purpose

The kit replaces the "city assembled from decorated boxes" presentation with a small
set of repeatable, deliberately proportioned architectural modules:

- deep window reveals with real wall thickness;
- glazed volumes with mullion/transom grids and a dark glazing cavity;
- expressed corners, copings, sills and joints;
- structural elements that read as structure (tapered columns, cantilevers,
  canopies, bridges, stairs);
- technical language (service portals, intakes, louvers, ribbon screens) that
  stays architectural instead of turning into industrial clutter;
- thin red navigation accents used consistently as a system, never as a base
  colour.

The kit is **content generation**, not a renderer, level system or physics layer.
It creates `BufferGeometry`; the existing `LevelContentLoader` batches it, places
it, and disposes it. The kit authors no colliders and owns no gameplay state.

## 2. Module catalog

Fifteen authored modules. Local conventions: metres, Y up, base at local y = 0,
+X = width, and **+Z = the side the architecture faces** unless stated otherwise.

| Kind | Local origin / direction | Parameters | Material batches | Triangles* |
|---|---|---|---|---|
| `facade-bay` | bottom-centre on the wall plane, faces +Z; reveal goes −Z | `width`, `height`, `revealDepth` (0.7), `accent` | 6 | 2,108 |
| `curtain-wall` | bottom-centre on the wall plane, faces +Z | `width`, `height`, `columns`, `rows`, `depth`, `spandrel` | 3–4 | 376 |
| `corner` | bottom outer corner; wings extend −X / −Z, facades +X / +Z | `width`, `depth`, `height`, `accent` | 6 | 1,776 |
| `column` | base centre | `height`, `width`, `accent` | 3 | 964 |
| `cantilever` | floor top at the wall plane, projects +Z | `width`, `depth`, `thickness`, `railing` | 5 | 240 |
| `canopy` | wall plane at the canopy soffit, projects +Z | `width`, `depth`, `thickness`, `tensionRods` | 3 | 212 |
| `bridge` | deck top centre, span runs along X | `length`, `width`, `height`, `bays` | 5 | 1,388 |
| `stair` | bottom floor top centre, flight runs +Z | `width`, `height`, `run`, `steps`, `railing`, `glassInfill` | 4 | 9,720 |
| `parapet` | roof level, run centred on X, upstand depth along Z | `length`, `height`, `accent` | 5 | 364 |
| `service-portal` | ground level on the wall plane, faces +Z | `width`, `height`, `depth`, `louvered` | 4 | 1,084 |
| `ventilation` | wall plane at grade, faces +Z | `width`, `height`, `depth`, `blades` | 4 | 1,060 |
| `louver` | wall plane at grade, faces +Z | `width`, `height`, `depth`, `bladeCount` | 3 | 276 |
| `glass-railing` | deck top, run centred on X | `length`, `height` | 3 | 168 |
| `facade-screen` | wall plane at grade, faces +Z | `width`, `height`, `ribbons`, `depth` | 3 | 216 |
| `joint` | wall plane at grade, faces +Z | `width`, `height`, `depth` | 4 | 108 |

\* canonical variant; ~20 k triangles for all fifteen variants together. The stair
is the only tri-heavy module because of its open treads (~2.3 k per metre of rise);
the composition uses one flight.

### Geometry construction

- **Beveled boxes** (`RoundedBoxGeometry`) for concrete volumes, sills, copings,
  treads and plates.
- **Extruded arches/profiles** (`ExtrudeGeometry`) for wall fields with punched
  openings, expressed frames, copings, fascia blades, fins and joints.
- **Lofted prisms** for the tapered, chamfered column shaft.
- **Faceted cylinders** for rods, handrails and posts.
- Plain boxes only for genuinely thin elements (mullions, glass, gaskets).
- Geometry is authored in module-local space and merged to **one part per material
  batch** before leaving the builder. A module therefore costs 3–6 draw batches,
  independent of how many times it is placed.

## 3. Public API

`src/levels/architecture/`:

```text
KitTypes.ts            authored module definitions + validation + stable variant key
KitGeometry.ts         geometry pool, part collector, extrusion/loft helpers, guards
KitModulesEnvelope.ts  facade-bay, curtain-wall, corner, parapet, joint
KitModulesStructure.ts column, cantilever, canopy, bridge, stair
KitModulesServices.ts  service-portal, ventilation, louver, facade-screen, glass-railing
ArchitecturalKit.ts    public builder, registry, re-exports
```

```ts
const pool = new KitGeometryPool();
const model: KitModuleModel = buildArchitecturalModule(
  { kind: "facade-bay", width: 4.2, height: 4.2, revealDepth: 0.7 },
  pool,
);

model.key;        // stable authored-variant identity ("facade-bay|accent=1|height=4.200|...")
model.parts;      // [{ geometry, material: MaterialKey, castShadow, receiveShadow }]
model.triangles;  // diagnostic triangle count
model.dispose();  // disposes the merged part geometries
pool.dispose();   // disposes all shared cached primitives
```

Rules:

- **Geometry and placement are separate.** Builders never know world positions;
  placement is authored data on the level.
- **One generated model per authored variant.** `architecturalModuleKey` is the
  cache identity; the same variant is generated once and instanced everywhere.
  Keys canonicalize omitted/default and boolean parameters, then quantize metres
  to 1 mm so floating-point noise does not multiply variants. The loader also
  compares `architecturalModuleSignature` (1 µm precision) for every cached key;
  two different full definitions with the same key fail loudly instead of
  silently sharing the first model.
- **Materials are semantic keys of the existing `MaterialLibrary`.** The kit does
  not create a material library or per-instance materials.
- **Builds are deterministic.** No `Math.random`; identical input produces
  identical vertex/triangle counts and bounds (unit-tested).
- **Invalid data fails before the scene changes.** Per-kind schemas reject
  unknown parameters, wrong types (including booleans in numeric fields),
  non-finite/non-positive dimensions, non-integer counts and incompatible
  cross-field combinations. `LevelValidator` reports them before load; the
  content loader validates again for direct callers and guarantees idempotent
  cleanup of partially created scene objects, geometries, collider bodies and
  the level atmosphere if a later load step throws.

## 4. Level contract extension

The existing `LevelDecorationDefinition` (box/cylinder/plane, instanced unit
primitives) cannot express composed arches, extrusions or deep reveals. The
minimal additive extension is a new optional array on `LevelDefinition`:

```ts
interface LevelArchitecturePlacement {
  id: string;
  sectionId: string;
  position: LevelVector3;      // module origin in world metres
  module: ArchitecturalModuleDefinition;
  rotationX?: number;
  rotationY?: number;          // yaw around the vertical module axis
  rotationZ?: number;
}

interface LevelDefinition {
  // ...existing fields
  architecture?: readonly LevelArchitecturePlacement[];
}
```

- No new loader, no parallel level system: `BoxLevelContentLoader` (the existing
  content loader used by Level Runtime) consumes the array.
- Placements are visual-only. They are section-scoped authored data (validated
  against existing sections) and never create Rapier colliders.
- `LevelValidator` adds `INVALID_ARCHITECTURE_SECTION`,
  `INVALID_ARCHITECTURE_POSITION`, `INVALID_ARCHITECTURE_ROTATION` and
  `INVALID_ARCHITECTURE_MODULE`; ids are checked by the existing unique-id pass.

### Loader integration

For every placement the loader:

1. resolves the variant key and builds the module once (shared `KitGeometryPool`);
2. accumulates the placement matrix per variant;
3. creates one `InstancedMesh` per module material batch — `module parts ×
   variants` draw calls for the whole level, **not** per placement;
4. enables the authored shadow flags and disables frustum culling (matches the
   existing static decoration batches);
5. on unload: removes and disposes the instanced meshes, disposes every merged
   module geometry, disposes the geometry pool, and restores the default scene
   atmosphere. No material is disposed — `MaterialLibrary` owns it.

Measured on the review composition: 85 placements, 26 module variants,
118 geometries, 121 instanced meshes, 270 draw calls, 305,727 rendered triangles
at the general-view pose (1600×900, high quality). Geometry/child counts return to
the menu baseline across reload and two restarts (see §7).

## 5. Materials

The kit uses the shared `MaterialLibrary` and extends it with three semantic keys
(no duplicated library):

| Key | Role | Distinguishing response |
|---|---|---|
| `white` | architectural white plaster field | rough 0.62, no metalness |
| `concrete` | warm white structural concrete | rough 0.9 |
| `composite` | light matte composite cladding/frames | rough 0.56, panel-joint texture |
| `reveal` | deep window-reveal lining | rough 0.94, dark warm mineral tone |
| `glass-near` | near curtain-wall / punched glazing (kit) | ART_BRIEF curtain glass: `#1A2530`, rough 0.10, metal 0.6, near sheen for the reflection gradient |
| `glass` | Prologue / distant-city glazing (shared) | rough 0.13, metal 0.6, distance-tuned sheen |
| `glass-far` | glazing cavity / distant glass | dark, rougher, lower env response |
| `glass-rail` | balustrade glass | transparent 0.32 with Fresnel falloff |
| `aluminium` | anodized aluminium mullions/trims/rods | rough 0.30, metal 0.92, env 1.2 |
| `metal` | structural steel | brushed texture, metal 0.85 |
| `dark-metal` | dark structural metal / lining | rough 0.5, metal 0.8 |
| `red` | runner-red navigation accent | rough 0.6, non-metallic |

Hierarchy per module: a structural mass (`concrete`/`white`), one secondary skin
(`composite`/`glass-near`/`reveal`), one metal system (`aluminium`/`dark-metal`) and a
single red accent only where it carries navigation meaning (window reveal line,
joint, bridge ceiling, railing line, portal jamb, stair nosing, column base tag).

## 6. Demonstration composition

`src/levels/demo/`:

- `KitDemoLayout.ts` — authored site: 52 × 54 m plaza and its geometry layers, wing masses,
  atrium/tower interiors and roof decks, site paving, pool/benches, podium
  articulation, context city massing (window bands + roof caps), and all 85 kit
  placements.
- `ArchitecturalKitDemo.ts` — a `LevelDefinition` (`architectural_kit_demo`, mode
  `training`, one `Kit Plaza` section, one spawn, one physical plaza deck, no
  triggers/checkpoints/interactions). It is registered **only in development
  builds**, so production keeps the shipped level list unchanged.

Composition contents: long punched-reveal facade wing + end-wall louvers, fully
glazed 3-storey atrium with four expressed corners and a cantilever balcony over a
tensile canopy on two columns, east tower with curtain walls / louver face / ribbon
screen and a roof parapet, 15 m aerial bridge, outdoor stair to a column-supported
terrace, technical annex with service portal, intake, louver screen, rooftop plant
enclosure and roof intakes, glass railings, plaza pool/benches, and expressed
construction joints between facade bays.

### Review route and capture

```bash
# Nine deterministic shots (byte-identical on re-capture):
npm run capture -- --iteration arch-kit --level architecture --shot all

# Load / reload / restart x2 / unload resource-count probe:
npm run kit:lifecycle
```

`?capture=1&level=architecture&shot=<id>` is a dev-only deterministic capture
route; it boots the composition through the normal Gameplay Session and Level
Runtime (`startGameplay("training", "architectural_kit_demo")`), not through a
second loader. Evidence (shots, capture manifest, lifecycle report, Prologue
before/after manifests) lives in `docs/evidence/arch-kit/`.

## 7. Verification record

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run check` (Biome lint + format + imports) | pass |
| `npm test` | 443/443 pass (49 files) |
| `npm run build` | pass; demo level id is absent from the production JS bundle |
| Kit unit suite | 15 modules build, deterministic, valid geometry, material resolve, triangle budget |
| Composition runtime suite | valid definition, load/unload, geometry disposal, scene-graph return to baseline, reload stability, invalid-data rejection |
| Capture determinism | 9/9 shots byte-identical across two fresh-browser passes |
| Load/unload/restart resource probe | geometries 118 → 9 (menu baseline) and identical across reload + 2 restarts; 0 console/page errors |
| Prologue regression | `start-roof` capture is byte-identical before/after (sha256 `59c977dd…`), 210 draw calls / 4,363,071 triangles unchanged |

## 8. Known limits

- The kit is **visual-only by design**; modules get no colliders. A future
  playable level must author its physical layer explicitly (`docs/04` §10).
- The demonstration composition is a review scene, not a gameplay level: no
  route, checkpoints, interactions or gameplay completion. Its plaza deck is the
  only physical element.
- The demo level is registered in DEV builds only; production users cannot select
  it. Its capture entry lives in `src/diagnostics/captureShots.ts` (`architecture`
  route) and is compiled out of production capture metadata.
- Module variants are instanced per material batch. A level that uses many
  distinct parameter variants of the same module raises the draw-call count
  linearly with variants (not placements); the composition deliberately keeps
  variant count small.
- Distant context city is authored decoration massing (window bands + roof caps),
  not a procedural city generator; it exists to frame the review composition.
- The stair uses open treads; it is architectural geometry, not a collision ramp.
  If reused in gameplay, a simplified physical stair proxy belongs to the level's
  authored geometry.
