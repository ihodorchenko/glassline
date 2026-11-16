# 05_PROCEDURAL_GENERATION_SPEC.md

**Project:** MIRROR'S EDGE — RUNNER PROTOCOL  
**Document:** Procedural Generation Specification  
**Version:** 1.0  
**Status:** Technical Specification  
**Applies to:** Procedural Geometry, Environment Generation, Textures, Asset Composition, Collision Proxies

---

## 1. Purpose

This document defines the technical requirements for procedural environment generation.

The project uses procedural generation to create:

- Buildings.
- Building facades.
- Rooftops.
- Industrial structures.
- Pipes and ventilation systems.
- Platforms and walkways.
- Railings and stairs.
- Construction scaffolding.
- Environmental signs.
- Distant city backgrounds.
- Procedural textures and surface variations.

All generated game assets must be created at runtime or during development using project code.

Do not download or import pre-made game models, texture packs, or environmental asset collections.

The primary goals are:

1. Deterministic generation.
2. Reusable geometry.
3. Configurable generation parameters.
4. Consistent dimensions and alignment.
5. Separation of visual and physical representations.
6. Predictable resource ownership.
7. Performance suitable for browser-based gameplay.
8. Easy integration with manually designed level layouts.

Procedural generation should support level design, not replace intentional level design.

The Training and Prologue levels are authored gameplay experiences. Procedural systems provide their architectural and environmental components.

---

## 2. Relationship to Other Documents

This document extends the requirements defined in:

- `00_PROJECT_BRIEF.md`
- `01_AGENT_RULES.md`
- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `04_ASSET_BIBLE.md`

Document responsibilities:

| Document | Responsibility |
|---|---|
| Project Brief | Project goals and scope |
| Agent Rules | Implementation workflow and constraints |
| Technical Architecture | System boundaries and architecture |
| Gameplay Spec | Movement and gameplay requirements |
| Asset Bible | Visual identity and asset standards |
| Procedural Generation Spec | Generation algorithms and implementation contracts |

If a generator implementation conflicts with gameplay requirements, gameplay requirements take priority.

If an implementation conflicts with the visual identity, revise the generated output rather than introducing arbitrary exceptions.

---

## 3. Generation Philosophy

### 3.1 Controlled Procedural Generation

The project does not use unrestricted random generation.

Generated environments must follow predefined architectural rules and gameplay constraints.

A generator should produce controlled variations within a known design space.

For example, a building generator may vary:

- Width.
- Depth.
- Height.
- Floor count.
- Window layout.
- Facade pattern.
- Rooftop equipment.
- Surface color variation.

It must not randomly generate arbitrary geometry that violates architectural proportions.

### 3.2 Deterministic Output

The same seed and configuration must produce the same logical result.

This applies to:

- Building dimensions.
- Facade layout.
- Window placement.
- Rooftop equipment.
- Pipe routes.
- Scaffolding layout.
- Material variations.
- Procedural texture patterns.

Do not use uncontrolled global randomness.

### 3.3 Gameplay-Aware Generation

Environment generation must respect gameplay requirements.

Generated geometry must not accidentally:

- Block a required route.
- Create unintended collision gaps.
- Obstruct a landing area.
- Intersect the player starting position.
- Produce unreachable platforms.
- Create invisible obstacles.
- Place decorative objects inside required traversal spaces.

For important parkour structures, use explicit authored configurations rather than relying on unconstrained random placement.

### 3.4 Composition over Randomness

Randomness should create variation, not determine the entire environment.

Use:

- Authored module layouts.
- Procedural detail placement.
- Seeded variations.
- Configurable architectural patterns.
- Explicit gameplay metadata.

The level designer or level configuration remains responsible for the final spatial composition.

---

## 4. Core Generation Architecture

### 4.1 Proposed Directory Structure

```text
src/
└── procedural/
    ├── core/
    │   ├── RandomGenerator.ts
    │   ├── SeedUtils.ts
    │   ├── GeneratorContext.ts
    │   ├── GeometryFactory.ts
    │   ├── MaterialResolver.ts
    │   └── GenerationTypes.ts
    │
    ├── geometry/
    │   ├── BoxBuilder.ts
    │   ├── CylinderBuilder.ts
    │   ├── ExtrusionBuilder.ts
    │   └── GeometryUtils.ts
    │
    ├── architecture/
    │   ├── BuildingGenerator.ts
    │   ├── FacadeGenerator.ts
    │   ├── WindowGenerator.ts
    │   └── RooftopGenerator.ts
    │
    ├── industrial/
    │   ├── PipeGenerator.ts
    │   ├── VentGenerator.ts
    │   ├── StairGenerator.ts
    │   ├── RailGenerator.ts
    │   ├── PlatformGenerator.ts
    │   └── ScaffoldGenerator.ts
    │
    ├── environment/
    │   ├── CityGenerator.ts
    │   ├── SkylineGenerator.ts
    │   └── EnvironmentComposer.ts
    │
    ├── navigation/
    │   └── SignGenerator.ts
    │
    ├── textures/
    │   ├── ConcreteTextureGenerator.ts
    │   ├── MetalTextureGenerator.ts
    │   ├── AsphaltTextureGenerator.ts
    │   └── TextureUtils.ts
    │
    └── collision/
        ├── CollisionProxyBuilder.ts
        └── CollisionGeometry.ts
```

This is a proposed organization.

Do not create all files in advance. Introduce modules incrementally when required by an implementation task.

### 4.2 Generator Responsibilities

Every generator must have a clearly defined responsibility.

Examples:

- `BuildingGenerator` creates a building from high-level parameters.
- `FacadeGenerator` creates facade elements for a supplied building surface.
- `RooftopGenerator` creates rooftop structures inside supplied bounds.
- `PipeGenerator` creates pipe geometry along a defined path.
- `ScaffoldGenerator` creates a modular scaffold structure.
- `CollisionProxyBuilder` creates simplified physical representations.

Generators should not:

- Start the game loop.
- Modify global application state.
- Register arbitrary global event listeners.
- Create unrelated gameplay systems.
- Manage the lifetime of the entire level.
- Access hidden global randomness.

### 4.3 Generation Context

Generators may receive a shared context containing the dependencies required for generation.

Illustrative interface:

```ts
interface GeneratorContext {
  random: RandomGenerator;
  materials: MaterialResolver;
  geometry: GeometryFactory;
  options: GenerationOptions;
}
```

The actual interface should remain as small as possible.

Avoid turning the context into a service locator containing every application dependency.

---

## 5. Deterministic Random System

### 5.1 Random Generator

Implement a seeded random number generator.

It must support:

- `next()`: returns a normalized value in the range `[0, 1)`.
- `nextRange(min, max)`: returns a floating-point value.
- `nextInt(min, max)`: returns an integer in the inclusive range.
- `pick(items)`: selects one array element.
- `chance(probability)`: performs a probability check.
- `shuffle(items)`: produces a deterministic shuffled copy.

The generator must not mutate its input arrays.

### 5.2 Independent Random Streams

Avoid using one shared random sequence for every part of a large environment.

If the number of windows changes, the generated rooftop equipment should not unexpectedly change.

Use independent streams derived from a parent seed.

Example:

```ts
const buildingSeed = deriveSeed(worldSeed, 'building-01');

const facadeSeed = deriveSeed(buildingSeed, 'facade');
const rooftopSeed = deriveSeed(buildingSeed, 'rooftop');
const equipmentSeed = deriveSeed(buildingSeed, 'equipment');
```

The exact hashing implementation may vary.

It must be deterministic across supported browsers.

Do not rely on unstable object serialization or runtime-specific hash behavior.

### 5.3 Stable Seed Derivation

Seed derivation should use stable identifiers.

Good identifiers:

- `building-01`
- `north-facade`
- `rooftop-equipment`
- `scaffold-section-03`

Avoid identifiers derived from temporary array indices if insertion or reordering could change generation unexpectedly.

### 5.4 Randomness Rules

Do not use:

```ts
Math.random();
```

inside procedural generators.

All randomness must be supplied through the generator context or a derived local stream.

A generator must produce the same output for the same configuration and seed, regardless of unrelated generator execution order.

---

## 6. Generation Data Model

### 6.1 Configuration Types

All generator inputs must be explicit and typed.

Example:

```ts
interface BaseGeneratorConfig {
  seed: number;
}

interface Dimensions3D {
  width: number;
  height: number;
  depth: number;
}

interface BuildingConfig extends BaseGeneratorConfig {
  dimensions: Dimensions3D;
  floorHeight: number;
  facadeStyle: FacadeStyle;
  rooftop: RooftopConfig;
}
```

Use semantic types rather than large collections of unrelated numeric parameters.

### 6.2 Validation

Validate all configurations before creating geometry.

Reject or normalize:

- Negative dimensions.
- Zero or near-zero dimensions.
- Invalid floor heights.
- Invalid probabilities.
- Unsupported style identifiers.
- Invalid seed values.
- Impossible component counts.

Do not allow invalid values to propagate into vertex buffers or physics shapes.

### 6.3 Generated Asset Result

A generated asset should provide access to its visual representation and optional collision description.

Illustrative model:

```ts
interface GeneratedAsset {
  root: THREE.Group;
  collision: CollisionDescription[];
  metadata: GeneratedAssetMetadata;
  dispose(): void;
}
```

The collision description is data. It must not require the rendering generator to instantiate Rapier bodies directly.

Physics integration should be handled by the appropriate physics or level system.

### 6.4 Metadata

Useful metadata may include:

- Generator type.
- Configuration version.
- Seed.
- Stable asset ID.
- Bounding dimensions.
- Gameplay tags.
- Collision requirements.

Metadata should be typed and should not become an unrestricted object containing arbitrary values.

---

## 7. Geometry Factory

### 7.1 Purpose

The geometry factory provides reusable low-level geometry creation.

It should centralize common operations such as:

- Box creation.
- Cylinder creation.
- Beam creation.
- Plane creation.
- Pipe segment creation.
- Repeated structural elements.
- Simple custom mesh construction.

It should not contain high-level building or level generation logic.

### 7.2 Geometry Reuse

Repeated geometry should be shared.

For example, identical railing posts should use one geometry instance and multiple transforms.

Prefer `InstancedMesh` when:

- Geometry is identical.
- Material is identical.
- Per-instance transforms are sufficient.
- Independent object behavior is unnecessary.

Use separate meshes when objects require different materials, visibility, or behavior.

### 7.3 Geometry Ownership

Define whether geometry is:

- Shared by the geometry factory.
- Owned by a generated asset.
- Owned by a material or texture cache.
- Temporary during generation.

Never dispose shared geometry from an individual asset.

The owner of a resource must be responsible for its final disposal.

### 7.4 Transform Conventions

Use consistent local coordinate conventions.

Recommended:

- Generated objects are centered around a documented local origin.
- Dimensions are expressed in meters.
- Local axes are documented.
- Parent transforms are used for placement.
- Geometry generation avoids unnecessary world-space transforms.

For example, a box module may be centered at its local origin with its height aligned to Y.

A generator may choose a different origin when that is more useful, but it must document the convention.

---

## 8. Building Generation

### 8.1 Building Generator

`BuildingGenerator` creates a building from high-level dimensions and architectural parameters.

Inputs:

- Seed.
- Width.
- Depth.
- Height.
- Floor height.
- Facade style.
- Window configuration.
- Rooftop configuration.
- Material variation.
- Optional building family.

Outputs:

- Main building geometry.
- Facade geometry.
- Optional rooftop structures.
- Bounding dimensions.
- Simplified collision representation.
- Generation metadata.

### 8.2 Building Dimensions

Initial procedural ranges from the Asset Bible:

| Parameter | Range |
|---|---:|
| Width | 15–45 m |
| Depth | 12–35 m |
| Height | 20–100 m |
| Floor height | 2.8–4.0 m |

These are starting ranges.

A specific level may use manually configured dimensions outside these ranges when required.

### 8.3 Building Construction Algorithm

Recommended high-level process:

1. Validate configuration.
2. Create the main building volume.
3. Determine floor count.
4. Generate facade layout.
5. Generate windows and facade panels.
6. Apply material variation.
7. Generate rooftop configuration.
8. Generate optional external infrastructure.
9. Calculate bounds.
10. Generate collision descriptions.
11. Return the generated asset.

Do not create individual complex objects for every window if a combined facade mesh or instanced geometry can achieve the same result.

### 8.4 Building Variants

Support a limited number of architectural families:

- Office.
- Residential.
- Industrial.

Each family should use shared generation logic with different configuration presets.

Avoid creating entirely separate implementations for every building type.

---

## 9. Facade Generation

### 9.1 Facade Generator

The facade generator creates a facade layout within a supplied rectangular surface.

Inputs:

- Width.
- Height.
- Floor height.
- Window dimensions.
- Horizontal and vertical spacing.
- Facade style.
- Seed.
- Material palette.

Outputs:

- Wall panels.
- Window recesses or frames.
- Horizontal and vertical facade elements.
- Optional balconies or external details.

### 9.2 Facade Layout

Use a grid-based layout as the baseline.

For a facade with width `W` and height `H`:

1. Calculate floor count.
2. Calculate available horizontal columns.
3. Apply margins.
4. Calculate window positions.
5. Select optional facade elements.
6. Generate repeated geometry.

All generated elements must fit inside the supplied facade bounds.

### 9.3 Window Generation

Windows may use:

- Dark inset surfaces.
- Simple frames.
- Slightly tinted glass.
- Recessed geometry.

Avoid expensive transparent geometry for every distant window.

For distant buildings, use simplified dark panels or facade textures.

### 9.4 Facade Variations

Supported initial styles:

- Grid facade.
- Horizontal facade.
- Vertical facade.
- Industrial facade.

Variations should come from parameter changes and deterministic pattern selection.

Do not generate arbitrary asymmetry without architectural logic.

---

## 10. Rooftop Generation

### 10.1 Rooftop Generator

The rooftop generator creates structures inside a supplied rooftop area.

Possible elements:

- Ventilation boxes.
- Exhaust ducts.
- Pipes.
- Access structures.
- Maintenance platforms.
- Small equipment housings.
- Railings.
- Antennas.

### 10.2 Placement Constraints

Each rooftop object must respect:

- Roof bounds.
- Minimum spacing.
- Reserved access areas.
- Required landing areas.
- Player traversal corridors.
- Structural clearance.

### 10.3 Placement Algorithm

Recommended process:

1. Define rooftop bounds.
2. Define reserved gameplay zones.
3. Define available placement regions.
4. Select object candidates.
5. Generate candidate positions using the local random stream.
6. Check bounds and overlap.
7. Check gameplay exclusion zones.
8. Accept or reject candidates.
9. Stop when the configured object budget is reached.

Use a bounded number of placement attempts.

Do not allow an invalid configuration to create an infinite placement loop.

### 10.4 Gameplay-Aware Rooftops

For playable rooftops, provide authored placement constraints.

For example:

```ts
interface RooftopGenerationConfig extends BaseGeneratorConfig {
  bounds: Dimensions3D;
  reservedZones: PlacementZone[];
  objectDensity: number;
  allowedCategories: RooftopObjectCategory[];
}
```

This is illustrative.

The actual level configuration may provide explicit object placements instead of random density.

---

## 11. Pipe Generation

### 11.1 Pipe Generator

The pipe generator creates geometry along a defined path.

Supported path segments:

- Straight.
- Vertical.
- Horizontal.
- Curved.
- Elbow.
- T-junction.
- Connector.

### 11.2 Pipe Path

A pipe route should be represented by an ordered sequence of points or explicit segment definitions.

For example:

```ts
interface PipePath {
  points: THREE.Vector3[];
  radius: number;
}
```

The generator must handle:

- Segment direction.
- Segment length.
- Connections.
- Bend transitions.
- Consistent radius.
- Correct orientation.

### 11.3 Geometry Construction

Possible approaches:

- Cylinder geometry for straight sections.
- Custom tube geometry for curved paths.
- Dedicated elbow geometry.
- Instanced connectors for repeated details.

Avoid generating visually disconnected segments.

### 11.4 Pipe Collision

Collision should be generated separately.

Use simple cylinder or capsule proxies where needed.

Small mounting brackets and decorative connectors usually do not need collision.

---

## 12. Ventilation Generation

### 12.1 Ventilation Modules

The ventilation generator should support:

- Rectangular ducts.
- Cylindrical ducts.
- Ventilation boxes.
- Exhaust structures.
- Air intake structures.
- Grilles.
- Connectors.
- Supports.

### 12.2 Configuration

A ventilation module may define:

- Width.
- Height.
- Depth.
- Duct dimensions.
- Segment count.
- Grille style.
- Material variant.
- Support configuration.

### 12.3 Generation Rules

- Keep proportions consistent.
- Avoid visible intersections.
- Reuse repeated grille geometry.
- Use simplified geometry for distant details.
- Generate collision only for gameplay-relevant surfaces.

---

## 13. Platforms and Walkways

### 13.1 Platform Generator

The platform generator creates structural surfaces.

Supported variants:

- Concrete platform.
- Metal platform.
- Narrow balance beam.
- Maintenance walkway.
- Elevated landing platform.
- Connecting bridge.

### 13.2 Configuration

Typical inputs:

- Width.
- Length.
- Thickness.
- Surface material.
- Support configuration.
- Railing configuration.
- Gameplay tags.

### 13.3 Gameplay Metadata

A platform may expose:

- Walkable.
- Landing surface.
- Balance surface.
- Vault obstacle.
- Checkpoint area.

These tags must be explicit.

A platform should not become a balance surface merely because it is narrow unless the level or gameplay configuration identifies it as such.

---

## 14. Rail and Stair Generation

### 14.1 Rail Generator

The rail generator creates:

- Horizontal rails.
- Vertical posts.
- Corner connections.
- Guardrails.
- Stair railings.
- Platform safety rails.

Use modular repeated components.

Ensure that corners and intersections align correctly.

### 14.2 Stair Generator

The stair generator creates:

- Straight staircases.
- Industrial staircases.
- Simplified ladder structures.
- Stair landings.

Inputs may include:

- Total height.
- Width.
- Step count.
- Step depth.
- Step height.
- Railing options.
- Support style.

Calculate dimensions so that the complete staircase fits the requested bounds.

Avoid accumulating floating-point errors across long sequences of steps.

### 14.3 Physics Simplification

The visual staircase may contain many steps.

Its collision representation may use:

- A simplified ramp.
- A small number of boxes.
- A dedicated collision mesh.

Choose the representation based on actual player movement requirements.

Do not assume a visually accurate collision model is always better.

---

## 15. Scaffolding Generation

### 15.1 Scaffold Generator

The scaffolding generator creates modular temporary structures.

Required components:

- Vertical supports.
- Horizontal beams.
- Diagonal braces.
- Platforms.
- Ladders.
- Railings.
- Connection elements.

### 15.2 Configuration

Example:

```ts
interface ScaffoldConfig extends BaseGeneratorConfig {
  width: number;
  height: number;
  depth: number;
  horizontalSections: number;
  verticalLevels: number;
  platformLevels: number[];
  includeBraces: boolean;
  includeRailings: boolean;
}
```

### 15.3 Grid Construction

Generate a structural grid.

1. Calculate horizontal support positions.
2. Calculate vertical level positions.
3. Generate vertical supports.
4. Generate horizontal beams.
5. Generate diagonal braces.
6. Generate platform surfaces.
7. Generate optional railings and ladders.
8. Produce collision descriptions.

All connections must be aligned using shared grid coordinates.

### 15.4 Gameplay Integration

Scaffolding may contain:

- Climbable surfaces.
- Walkable platforms.
- Wallrun surfaces.
- Ledges.
- Jump transitions.

Gameplay capabilities must be explicitly assigned.

Do not infer traversal capabilities from the presence of a visual beam.

---

## 16. Sign Generation

### 16.1 Sign Generator

The sign generator creates reusable environmental navigation elements.

Supported elements:

- Direction arrows.
- Warning signs.
- Platform labels.
- Checkpoint markers.
- Route markings.
- Industrial identification labels.

### 16.2 Implementation

Use:

- Generated geometry.
- Canvas-based text textures.
- Simple emissive materials where appropriate.
- Shared arrow and symbol geometry.

Text must be configurable.

Avoid creating unique large textures for every sign when shared layouts or cached textures can be used.

### 16.3 Gameplay Semantics

A sign may contain semantic information:

- Route direction.
- Checkpoint identity.
- Warning category.
- Level section identifier.

Visual appearance should be separated from gameplay meaning.

---

## 17. City and Skyline Generation

### 17.1 City Generator

The city generator creates a simplified background environment.

It must prioritize:

- Silhouette variation.
- Building distribution.
- Height variation.
- Large-scale composition.
- Low rendering cost.

### 17.2 Generation Process

1. Define the city generation area.
2. Divide the area into placement regions.
3. Generate building dimensions.
4. Determine building positions.
5. Resolve overlaps.
6. Select facade variants.
7. Generate simplified geometry.
8. Assign distant materials.
9. Calculate visibility bounds.

### 17.3 Skyline Constraints

- Avoid excessive overlap.
- Avoid identical building repetition.
- Preserve visual depth.
- Keep distant structures inexpensive.
- Do not generate unnecessary physics bodies.
- Use simplified windows and facade detail.

### 17.4 Reproducibility

The same world seed must produce the same skyline.

Changing an unrelated foreground prop must not regenerate the entire city.

Use independent generation streams for city regions and individual buildings.

---

## 18. Procedural Texture Generation

### 18.1 Texture Generator Responsibilities

Texture generators create reusable procedural textures.

They must not depend on the scene or player.

Each generator should accept:

- Seed.
- Resolution.
- Material-specific parameters.
- Optional color palette.

### 18.2 CanvasTexture

Use `CanvasTexture` when generating:

- Concrete patterns.
- Asphalt noise.
- Painted markings.
- Signage.
- Window patterns.
- Simple surface imperfections.

Canvas generation should happen during asset preparation, not repeatedly inside the render loop.

### 18.3 DataTexture

Use `DataTexture` when:

- Direct pixel generation is more efficient.
- A compact procedural pattern is needed.
- A specific channel layout is required.

Keep texture formats and memory usage under control.

### 18.4 Shader-Based Textures

Use shader-based patterns when procedural detail can be generated without storing large texture data.

Suitable effects:

- Fine noise.
- Surface variation.
- Brushed metal.
- Animated navigation markings.

Avoid unnecessary shader complexity.

### 18.5 Texture Caching

Cache generated textures by a stable key containing all parameters that affect the result.

For example:

```ts
interface TextureCacheKey {
  type: string;
  seed: number;
  width: number;
  height: number;
  variant: string;
}
```

The cache must have a clear disposal policy.

Do not create duplicate textures for identical configurations.

---

## 19. Placement and Spatial Validation

### 19.1 Placement Data

Objects should be placed using explicit spatial data.

A placement may include:

- Position.
- Rotation.
- Scale.
- Bounds.
- Category.
- Gameplay metadata.
- Collision settings.

### 19.2 Overlap Validation

Generators that place independent objects must detect invalid overlaps where necessary.

Possible techniques:

- Axis-aligned bounding boxes.
- Oriented bounding boxes.
- Distance checks.
- Grid occupancy.
- Reserved placement regions.

Do not implement expensive general-purpose collision algorithms for simple placement problems.

### 19.3 Reserved Zones

A level may define reserved regions.

Examples:

- Player spawn area.
- Landing area.
- Checkpoint area.
- Required jump trajectory clearance.
- Route corridor.
- Finish area.

Generators must respect these zones.

### 19.4 Bounded Generation

All placement loops must have a maximum number of attempts.

If a configuration cannot be satisfied:

- Return a structured generation error.
- Report the failed constraint.
- Avoid silently producing invalid geometry.

---

## 20. Collision Proxy Generation

### 20.1 Separation

Collision generation is a separate responsibility from visual mesh generation.

A generator may describe collision requirements, but Rapier body creation belongs to the physics integration layer.

### 20.2 Collision Description

Illustrative model:

```ts
type CollisionDescription =
  | {
      shape: 'box';
      position: [number, number, number];
      rotation: [number, number, number];
      dimensions: [number, number, number];
    }
  | {
      shape: 'cylinder';
      position: [number, number, number];
      rotation: [number, number, number];
      radius: number;
      height: number;
    };
```

This is an example, not a required final physics API.

Use the actual project's coordinate and rotation conventions.

### 20.3 Collision Categories

Support semantic collision categories such as:

- Static environment.
- Walkable platform.
- Wallrun surface.
- Climbable surface.
- Vault obstacle.
- Balance surface.
- Trigger volume.

The physics layer should translate these descriptions into actual Rapier colliders and gameplay metadata.

### 20.4 Collision Validation

Validate:

- Collider dimensions.
- Position.
- Orientation.
- Bounds.
- Intended gameplay category.

Avoid creating collision bodies for distant background objects.

---

## 21. Environment Composition

### 21.1 Environment Composer

`EnvironmentComposer` combines generated assets into a larger environment.

Its responsibilities may include:

- Resolving generator configurations.
- Creating generated assets.
- Applying transforms.
- Registering asset ownership.
- Collecting collision descriptions.
- Producing environment metadata.
- Supporting cleanup.

It should not implement level progression or player gameplay logic.

### 21.2 Composition Model

A level may define a composition using authored placements.

Illustrative example:

```ts
interface EnvironmentObjectDefinition {
  id: string;
  generator: string;
  seed: number;
  position: [number, number, number];
  rotation: [number, number, number];
  config: unknown;
}
```

The final implementation should use a typed configuration registry rather than unrestricted `unknown` values.

### 21.3 Authored and Procedural Content

Use authored placement for:

- Main parkour routes.
- Important jumps.
- Wallrun sections.
- Climbing sequences.
- Checkpoints.
- Finish areas.

Use procedural variation for:

- Building facades.
- Background architecture.
- Rooftop decoration.
- Repeated industrial details.
- Surface variations.

This combination preserves gameplay control while providing environmental variety.

---

## 22. Generation Lifecycle

### 22.1 Generation Timing

Do not generate expensive environment geometry every frame.

Generate assets:

- During level initialization.
- During controlled loading phases.
- During development-time preprocessing when appropriate.

Runtime generation may be used for specific effects or future extensions, but it must be intentional.

### 22.2 Lifecycle

Recommended lifecycle:

```text
Create Generator Context
        |
        v
Validate Configuration
        |
        v
Initialize Random Streams
        |
        v
Generate Visual Geometry
        |
        v
Generate Collision Descriptions
        |
        v
Validate Generated Result
        |
        v
Register Asset Ownership
        |
        v
Add to Level
        |
        v
Dispose on Level Unload
```

### 22.3 Cancellation

If asynchronous generation is introduced, support cancellation.

A cancelled generation task must release any resources it has already created.

Do not add asynchronous complexity to simple synchronous generators without a real requirement.

---

## 23. Performance Requirements

### 23.1 Geometry

- Reuse identical geometry.
- Use instancing for repeated components.
- Avoid excessive mesh fragmentation.
- Avoid unnecessarily high segment counts.
- Use simplified distant geometry.
- Avoid generating invisible surfaces when practical.

### 23.2 Materials and Textures

- Reuse materials.
- Cache deterministic textures.
- Avoid excessive unique material instances.
- Avoid large textures for small distant objects.
- Use opaque materials when transparency is unnecessary.

### 23.3 Generation Cost

Track expensive generator operations during development.

Useful measurements:

- Generation duration.
- Number of generated meshes.
- Number of unique geometries.
- Number of material instances.
- Number of textures.
- Number of collision descriptions.
- Approximate vertex count.

Use profiling results to guide optimization.

### 23.4 Memory

Avoid retaining generated assets after their level is unloaded.

Shared resources should be reference-counted or managed by a clearly defined owner.

Do not add a complex asset reference-counting system until actual sharing requirements justify it.

---

## 24. Testing Strategy

### 24.1 Unit Tests

Test individual generator behavior.

Examples:

- Same seed produces identical configuration output.
- Invalid dimensions are rejected.
- Building dimensions match requested values.
- Facade elements remain inside bounds.
- Pipe segments connect correctly.
- Scaffolding grid positions are aligned.
- Placement loops terminate.
- Collision descriptions have valid dimensions.

### 24.2 Determinism Tests

For deterministic generators:

1. Generate using seed A.
2. Capture a stable representation of the result.
3. Generate again using seed A.
4. Compare the results.
5. Generate using seed B.
6. Verify that expected variations occur.

Do not compare unstable object references.

Compare stable configuration and geometry data.

### 24.3 Geometry Tests

Check:

- Finite vertex positions.
- Valid indices.
- Valid normals.
- Valid UV coordinates when required.
- Expected bounding dimensions.
- No degenerate geometry where unintended.

### 24.4 Integration Tests

Test combinations of generators.

Examples:

- Building with facade and rooftop.
- Industrial building with pipes and ventilation.
- Scaffold with platforms and railings.
- City skyline with multiple building families.
- Generated environment with collision integration.

### 24.5 Visual Tests

Visual inspection is required.

Check:

- Material appearance.
- Geometry intersections.
- Repeated pattern quality.
- Architectural proportions.
- Route readability.
- Lighting response.
- Distant detail density.

Automated tests alone cannot establish visual quality.

---

## 25. Debugging and Development Tools

Procedural systems should support optional debugging output.

Useful development features:

- Display generated bounding boxes.
- Display collision proxies.
- Display object IDs.
- Display generator seeds.
- Display placement rejection reasons.
- Display geometry statistics.
- Display generation duration.

Debug visualization must be disabled in normal gameplay builds unless explicitly requested.

### 25.1 Seed Reproduction

When a generated asset contains a defect, it must be possible to reproduce it using:

- Generator name.
- Seed.
- Configuration.
- Relevant parent seed or stable object ID.

Do not rely on recording a screenshot as the only reproduction method.

### 25.2 Generation Diagnostics

Generation failures should identify the source of the problem.

Prefer structured errors over silent fallback behavior.

Examples:

- Invalid dimensions.
- Placement constraints cannot be satisfied.
- Unsupported facade style.
- Missing material identifier.
- Invalid pipe path.
- Invalid scaffold configuration.

---

## 26. Implementation Roadmap

Implement procedural generation incrementally.

Recommended order:

### Phase 1 — Core Infrastructure

- Seeded random generator.
- Seed derivation.
- Generator context.
- Geometry factory.
- Resource ownership conventions.
- Basic generated asset result.

### Phase 2 — Basic Architecture

- Box and platform generation.
- Wall generation.
- Basic building generator.
- Basic facade generator.

### Phase 3 — Rooftop and Industrial Assets

- Rooftop generator.
- Pipe generator.
- Ventilation generator.
- Rail generator.
- Stair generator.

### Phase 4 — Parkour Structures

- Narrow platforms.
- Ledges.
- Scaffolding.
- Wallrun surfaces.
- Climbing structures.
- Balance beams.

### Phase 5 — Background Environment

- Simplified building generator.
- City generator.
- Skyline composition.
- Distant facade variation.

### Phase 6 — Textures and Refinement

- Concrete texture generation.
- Metal texture generation.
- Asphalt texture generation.
- Texture caching.
- Material refinements.

### Phase 7 — Optimization

- Instancing.
- Geometry reuse.
- LOD.
- Spatial grouping.
- Profiling.
- Resource lifecycle verification.

Do not start a later phase merely because earlier systems are technically available. Follow the project's main roadmap and the active implementation task.

---

## 27. Definition of Done

The procedural generation foundation is acceptable when:

### Architecture

- Generators have clear responsibilities.
- Configuration is explicit and typed.
- Shared generation utilities are reusable.
- Rendering and physics responsibilities are separated.

### Determinism

- Seeded generation is reproducible.
- Independent random streams are supported.
- Unrelated generation changes do not cause unnecessary variation.

### Geometry

- Generated dimensions are correct.
- Geometry is valid.
- Repeated modules align correctly.
- Shared geometry is reused.

### Gameplay

- Gameplay-critical placement is controlled.
- Reserved zones are respected.
- Collision descriptions match intended behavior.
- Generated geometry does not introduce unintended obstacles.

### Lifecycle

- Generated resources have explicit ownership.
- Cleanup works correctly.
- Shared resources are not disposed prematurely.
- Cancelled generation does not leak resources.

### Performance

- Generation does not run unnecessarily during gameplay.
- Repeated assets use appropriate reuse strategies.
- Distant assets are simplified.
- Generation and rendering costs can be measured.

### Testing

- Core generators have unit tests.
- Determinism is tested.
- Invalid configurations are handled.
- Representative combinations have integration tests.
- Visual output has been inspected.

---

## 28. AI Agent Implementation Rules

When implementing procedural generation:

1. Read the related project documents before changing architecture.
2. Inspect the existing code before creating new modules.
3. Implement only the generator required by the current task.
4. Prefer simple deterministic algorithms.
5. Avoid premature general-purpose frameworks.
6. Use explicit configuration types.
7. Do not use uncontrolled randomness.
8. Separate visual geometry from collision descriptions.
9. Reuse geometry, materials, and textures.
10. Implement cleanup and resource ownership.
11. Add tests for important invariants.
12. Verify generated output visually.
13. Record important architectural decisions.
14. Update implementation status.
15. Do not modify unrelated gameplay systems.

If a generator requires a new dependency or a significant architectural change, explain the need before introducing it.

---

## 29. Final Principle

Procedural generation is a controlled construction system.

It should create coherent architecture, reusable industrial structures, and believable urban environments while preserving the precision required by first-person parkour gameplay.

The project should never rely on randomness to solve a level-design problem.

**Use procedural generation for variation, reuse, and scale. Use intentional design for gameplay.**