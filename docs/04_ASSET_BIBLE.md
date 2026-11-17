# 04_ASSET_BIBLE.md

**Project:** Glassline  
**Document:** Asset Bible  
**Version:** 1.0  
**Status:** Design Specification  
**Applies to:** Environment Art, Procedural Geometry, Materials, Textures, Lighting, Visual Effects

---

## 1. Purpose

This document defines the visual identity and procedural asset standards for **Glassline**.

It describes how the game world should look, how its environment is constructed, and how procedural assets must be generated and managed.

The goal is to establish a consistent visual language that supports fast first-person movement, readable parkour routes, and experimentation with Three.js rendering techniques.

This is an original project inspired by the visual direction of the original *Mirror's Edge* (2008). Glassline is not a remake of Mirror's Edge, and it must not reproduce the original game's levels, proprietary assets, textures, models, or exact environmental layouts.

The project should capture a similar design philosophy:

- Clean architectural forms.
- Bright, open environments.
- Strong contrast between neutral surfaces and red accents.
- Industrial infrastructure integrated into urban architecture.
- Minimal visual clutter.
- Clear navigation and readable movement opportunities.

The result should have its own identity.

## 2. Core Visual Direction

### 2.1 Visual Principles

The environment follows these principles:

**Minimalism**

Architecture should use simple, recognizable geometric forms. Avoid unnecessary decorative complexity.

**Clarity**

The player must quickly understand which surfaces are walkable, which objects are obstacles, and where the intended route continues.

**Contrast**

White and light-gray architecture provides the dominant visual background. Red identifies important gameplay elements and route guidance.

**Scale**

Buildings and structures should feel large enough to create a convincing urban environment while remaining readable at gameplay distance.

**Industrial detail**

Pipes, ventilation systems, railings, construction scaffolding, metal walkways, and technical infrastructure provide secondary visual complexity.

**Controlled detail density**

The environment should be visually interesting without overwhelming the player during high-speed movement.

**Functional architecture**

Objects should look as though they serve a practical purpose. Avoid random decorative geometry.

### 2.2 Visual Hierarchy

Use three levels of visual detail:

| Level | Purpose | Examples |
|---|---|---|
| Primary | Defines navigation and architecture | Buildings, roofs, walls, platforms |
| Secondary | Adds structural identity | Pipes, vents, railings, stairs |
| Tertiary | Adds atmosphere and surface detail | Small panels, bolts, markings, dirt |

Primary geometry must remain readable from a distance.

Secondary geometry should reinforce the architecture and parkour routes.

Tertiary details should never obscure important gameplay information.

### 2.3 Reference Mood

The intended atmosphere combines:

- Bright daylight.
- Pale concrete and white painted surfaces.
- Cool gray steel.
- Muted blue-gray sky.
- Deep red navigation and infrastructure accents.
- Large architectural silhouettes.
- Open rooftops and distant urban density.

Avoid excessive saturation, fantasy architecture, cyberpunk lighting, and heavy grunge.

---

## 3. Color System

### 3.1 Core Palette

The following colors establish the initial visual identity.

| Name | Hex | Usage |
|---|---|---|
| Pure White | `#F1F1ED` | Main architectural surfaces |
| Concrete | `#C7C9C7` | Concrete structures |
| Light Gray | `#A8ADAE` | Secondary surfaces |
| Steel | `#747A7D` | Metal structures |
| Dark Metal | `#33393D` | Structural contrast |
| Runner Red | `#D52E36` | Gameplay accents and route markers |
| Sky | `#A7B9C4` | Initial sky color |
| Asphalt | `#62686B` | Rooftops and ground surfaces |

The canonical palette values are defined in `02_TECHNICAL_ARCHITECTURE.md` §8.4: Pure White, Concrete, Steel, Dark Metal, Runner Red, and Sky. Light Gray and Asphalt are derived working values for secondary surfaces and rooftops; they must stay within the same restrained neutral range and must not replace the canonical six.

These are baseline colors, not mandatory values for every object.

Material definitions may introduce controlled variations.

### 3.2 Color Usage Rules

Recommended distribution:

- 65–75% neutral architectural surfaces.
- 15–25% secondary gray and metallic surfaces.
- 5–10% accent colors and high-contrast details.

These percentages are visual guidelines rather than strict rendering constraints.

Red must have a clear semantic purpose.

Use red for:

- Runner Vision route indicators.
- Important navigation arrows.
- Selected pipes and structural accents.
- Interactive parkour elements.
- Checkpoint indicators.
- Important gameplay warnings.

Do not paint every interactive object red. The player should learn the visual language through consistent usage.

### 3.3 Color Accessibility

Important gameplay information must not depend on color alone.

Combine red accents with at least one additional visual cue:

- Shape.
- Iconography.
- Surface markings.
- Lighting contrast.
- Position or animation.

Provide an alternative Runner Vision color configuration in settings.

---

## 4. Material System

All game materials must be generated or configured procedurally.

Do not download game-ready material packs or external texture assets.

Use Three.js materials and custom shaders where appropriate.

### 4.1 Material Library

Implement a centralized material library.

Suggested initial material definitions:

| Material | Base appearance | Main properties |
|---|---|---|
| White Concrete | Pale, slightly rough | Non-metallic, matte |
| Rough Concrete | Gray, irregular | Non-metallic, rough |
| Painted Concrete | Smooth painted surface | Non-metallic, medium roughness |
| Brushed Metal | Cool gray metal | Metallic, directional detail |
| Dark Steel | Dark structural metal | Metallic, moderately rough |
| Red Painted Metal | Saturated red paint | Non-metallic or low metallic |
| Glass | Muted blue-gray | Controlled transparency |
| Rubber | Dark, matte | Non-metallic, high roughness |
| Asphalt | Dark gray | Rough, subtle surface variation |

Visual materials are not the same thing as physics surface types. The SurfaceRegistry defines the canonical surface identifiers `concrete`, `metal`, `rubber`, `glass`, and `asphalt` (`02_TECHNICAL_ARCHITECTURE.md` §9.6). Materials map to those identifiers through explicit level metadata; audio, friction, and landing response must use the registered surface type, not the visual material or mesh name.

Suggested mapping:

| SurfaceType | Materials |
|---|---|
| `concrete` | White Concrete, Rough Concrete, Painted Concrete |
| `metal` | Brushed Metal, Dark Steel, Red Painted Metal |
| `rubber` | Rubber |
| `glass` | Glass |
| `asphalt` | Asphalt |

Initial material parameters should be tuned visually rather than treated as physically measured material properties.

### 4.2 Material Implementation

Prefer reusable material instances.

Suggested structure:

```text
MaterialLibrary
├── concrete
│   ├── whiteConcrete
│   ├── roughConcrete
│   └── paintedConcrete
├── metal
│   ├── brushedMetal
│   ├── darkSteel
│   └── redPaintedMetal
├── surface
│   ├── asphalt
│   └── rubber
└── transparent
    └── glass
```

The material library should:

- Create and cache shared materials.
- Expose configurable material parameters.
- Support controlled color variation.
- Avoid unnecessary material duplication.
- Dispose resources during application shutdown.
- Keep material creation separate from geometry generation.

Generators should request materials by semantic identifier rather than constructing arbitrary materials for every object.

### 4.3 Procedural Surface Variation

Materials should avoid looking completely flat.

Use subtle variations such as:

- Low-frequency color noise.
- Small-scale roughness variation.
- Concrete stains.
- Directional metal patterns.
- Subtle surface imperfections.
- Controlled edge darkening.

Avoid excessive noise and high-frequency patterns.

Surface detail should remain subtle at normal gameplay distance.

### 4.4 Shader Usage

Use custom shaders only when they provide a meaningful visual or technical benefit.

Suitable applications include:

- Procedural concrete variation.
- Directional brushed-metal patterns.
- Animated Runner Vision elements.
- Simple water or glass effects if required later.
- Atmospheric effects.
- Specialized surface effects.

Prefer standard Three.js materials for ordinary architecture.

Do not introduce a custom shader for every material.

---

## 5. Procedural Texture Generation

### 5.1 Allowed Techniques

Use:

- `CanvasTexture`
- `DataTexture`
- Procedural GLSL shaders
- Generated geometry attributes
- Mathematical noise functions
- Deterministic random values

No external game textures are required.

### 5.2 Texture Categories

Initial procedural texture categories:

**Concrete**

- Subtle color variation.
- Low-frequency noise.
- Small stains.
- Occasional darker patches.
- Very subtle surface grain.

**Metal**

- Directional brushed patterns.
- Fine scratches.
- Slight roughness variation.
- Edge wear only where appropriate.

**Asphalt**

- Dark gray base.
- Fine irregular noise.
- Occasional small patches.
- Subtle color variation.

**Painted surfaces**

- Mostly uniform color.
- Slight roughness.
- Minor imperfections.
- Optional warning stripes and painted markings.

**Glass**

- Muted reflections.
- Subtle tint.
- Controlled transparency.
- Avoid excessive transparency in distant buildings.

### 5.3 Texture Resolution

Use the smallest resolution that produces an acceptable result.

Suggested starting points:

| Texture use | Initial resolution |
|---|---:|
| Small surface detail | 128 × 128 |
| Standard material texture | 256 × 256 |
| Large reusable surface | 512 × 512 |
| Special close-up surface | 1024 × 1024 |

These are initial limits for experimentation, not requirements to generate every texture at every resolution.

Prefer tileable textures when a material is used across large surfaces.

### 5.4 Deterministic Generation

Procedural textures must support deterministic generation.

The same seed and configuration should produce the same texture.

Do not use uncontrolled global randomness.

Use the project's shared seeded random generator.

---

## 6. Architectural Language

The world consists of three major architectural families:

1. Residential and office buildings.
2. Industrial and infrastructure buildings.
3. Distant city background.

Each family has a different level of detail.

### 6.1 Residential and Office Buildings

Visual characteristics:

- Rectangular volumes.
- Flat roofs.
- Repetitive windows.
- Strong horizontal and vertical lines.
- Simple facade panels.
- Occasional balconies and exterior walkways.
- Rooftop technical structures.

Suggested generator parameters:

| Parameter | Initial range |
|---|---:|
| Width | 15–45 m |
| Depth | 12–35 m |
| Height | 20–100 m |
| Floor height | 2.8–4.0 m |
| Window width | 1.5–3.0 m |

These values are approximate procedural ranges.

The generator should support variations in:

- Building proportions.
- Floor count.
- Window layout.
- Facade panel arrangement.
- Roof configuration.
- Color distribution.
- Rooftop equipment.

Avoid generating buildings that differ only in scale.

Use combinations of facade patterns and structural details to create visual variety.

### 6.2 Industrial Buildings

Industrial architecture should provide more visible infrastructure.

Typical elements:

- Large concrete walls.
- Metal ventilation systems.
- External pipes.
- Service ladders.
- Technical platforms.
- Safety railings.
- Cable trays.
- Rooftop equipment.
- Maintenance walkways.
- Structural support frames.

Industrial structures are important for parkour gameplay.

Their geometry must clearly communicate which elements can be used by the player.

### 6.3 Distant City Background

The distant city exists primarily to create scale and atmosphere.

It does not require detailed interiors or fully modeled architecture.

Use simplified building volumes with:

- Basic silhouettes.
- Low-detail facades.
- Repeated window patterns.
- Simplified rooftop geometry.
- Limited material variation.

Distant buildings should not receive expensive collision geometry.

They should be static and inexpensive to render.

### 6.4 Skyline Composition

The skyline should avoid a uniform wall of identical buildings.

Vary:

- Building height.
- Width and depth.
- Roof silhouettes.
- Building spacing.
- Facade density.
- Relative distance.

Use a deterministic seed to generate a reproducible skyline.

The skyline should frame the playable environment rather than compete with it.

---

## 7. Modular Environment Kit

The environment should be built from reusable modular components.

The purpose of the modular kit is to make level construction predictable, reusable, and easy to modify.

### 7.1 Structural Modules

Required module families:

**Walls**

- Straight wall.
- Corner wall.
- Low wall (usable as a vault obstacle when marked by level metadata).
- Tall wall.
- Wall with opening.
- Continuous wall segment suitable for wallrun and walljump contact.

**Floors and Platforms**

- Flat floor.
- Rooftop platform.
- Raised platform.
- Narrow platform.
- Landing platform.
- Connecting platform.
- Structural support platform.

**Roof Elements**

- Roof perimeter.
- Roof edge.
- Parapet.
- Roof access structure.
- Rooftop equipment base.
- Roof maintenance area.

**Columns and Beams**

- Concrete column.
- Steel column.
- Horizontal beam.
- Structural crossbeam.
- Support frame.

Modules should use consistent dimensions and connection conventions.

### 7.2 Pipes

Pipe generation must support:

- Straight sections.
- Elbows.
- T-junctions.
- Cross-junctions.
- Connectors.
- Wall mounts.
- Vertical sections.
- Horizontal sections.
- Support brackets.

Pipe dimensions should be configurable.

Use cylinders and custom curved geometry where appropriate.

Avoid creating a separate complex mesh for every short pipe segment if instancing or shared geometry can be used.

### 7.3 Ventilation

Ventilation modules include:

- Rectangular ducts.
- Cylindrical ducts.
- Ventilation boxes.
- Air intake structures.
- Exhaust structures.
- Grilles.
- Connectors.
- Support brackets.

Ventilation geometry may be decorative or interactive.

Only designated objects should participate in gameplay collision.

### 7.4 Railings and Safety Structures

Required modules:

- Horizontal rail.
- Vertical posts.
- Corner rail.
- Stair railing.
- Platform railing.
- Industrial guardrail.
- Low safety barrier.

Use shared geometry for repeated posts and rails.

Railings should have simple and predictable collision proxies.

### 7.5 Stairs and Ladders

Required modules:

- Straight stairs.
- Industrial stairs.
- Vertical ladder.
- Ladder with landing.
- Ladder attached to wall.
- Stair support structure.

The initial gameplay implementation may use simplified collision shapes.

Do not create complex physics meshes for every stair step unless required by gameplay.

Ladders are decorative industrial structures in the initial release. Their presence does not imply a climbing mechanic (`03_GAMEPLAY_SPEC.md` §13, `05_PROCEDURAL_GENERATION_SPEC.md` §3.5).

### 7.6 Construction Scaffolding

Scaffolding is a major visual and gameplay element in the Prologue.

Required elements:

- Vertical supports.
- Horizontal beams.
- Diagonal braces.
- Platforms.
- Ladders.
- Safety rails.
- Connecting joints.

Scaffolding should be generated from a configurable grid.

Support parameters such as:

- Width.
- Height.
- Number of levels.
- Number of horizontal sections.
- Platform positions.
- Rail configuration.
- Support density.

The generator must produce stable geometry and consistent module alignment.

### 7.7 Bridges and Walkways

Required modules:

- Narrow metal walkway.
- Wide maintenance walkway.
- Connecting bridge.
- Elevated platform.
- Support beam.
- Bridge railing.

These objects should support predictable player movement and collision.

Narrow walkways remain ordinary walkable geometry; do not add balance-specific assets or metadata for them.

### 7.8 Signs and Navigation

Create a procedural signage system.

Elements include:

- Direction arrows.
- Warning markings.
- Platform labels.
- Industrial labels.
- Checkpoint markers.
- Route indicators.
- Minimal environmental text.

Use a consistent typography and graphic language.

Typography may use the project's UI font resources. Fonts and development dependencies are not game assets (`00_PROJECT_BRIEF.md` §2.3).

Do not use large decorative text everywhere.

Signage must remain readable at the intended gameplay distance.

### 7.9 Runner Vision

Runner Vision is a gameplay navigation aid.

It may highlight:

- Route direction.
- Intended jump destinations.
- Interactive parkour objects.
- Checkpoints.
- Important transitions.

Visual techniques may include:

- Red surface accents.
- Emissive markings.
- Directional arrows.
- Short animations.
- Temporary highlights.

Runner Vision must not obscure the environment.

It should be possible to disable or reduce its intensity in settings.

---

## 8. Geometry Standards

### 8.1 Coordinate System

Follow the project-wide coordinate conventions:

- Y is up.
- One world unit represents one meter.
- All dimensions use meters.
- Geometry and collision dimensions must use the same scale.

The project's forward direction must be consistent across generators, player movement, and level construction.

### 8.2 Geometry Construction

Use:

- `BoxGeometry`
- `CylinderGeometry`
- `SphereGeometry`
- `PlaneGeometry`
- `BufferGeometry`
- Custom generated vertex buffers

Use custom `BufferGeometry` when it provides better control over topology, memory usage, or repeated structures.

Do not create unnecessarily complex geometry for simple objects.

### 8.3 Bevels and Edges

Perfectly sharp edges can make procedural architecture look artificial.

Use small bevels where they improve visual quality.

Possible techniques:

- Beveled custom geometry.
- Additional edge geometry.
- Simple bevel shaders.
- Slightly inset panels.

Do not add bevel geometry to every edge.

Prioritize:

- Large foreground objects.
- Objects close to the camera.
- Important interactive structures.

### 8.4 Normals

Generated geometry must have correct normals.

Use:

- Flat shading for intentionally hard surfaces.
- Smooth normals for curved pipes and rounded structures.
- Separate geometry sections where material boundaries require them.

Incorrect normals and lighting artifacts must be treated as generator defects.

### 8.5 UV Coordinates

Procedural geometry should generate valid UV coordinates when textures are used.

Avoid obvious stretching across large surfaces.

For repeated modules, use consistent UV conventions.

Where appropriate, use world-space or object-space shader coordinates instead of generating unique texture layouts.

### 8.6 Geometry Reuse

Reusable modules should share geometry whenever possible.

Use:

- Shared `BufferGeometry`.
- Shared material instances.
- `InstancedMesh` for repeated objects.
- Batched static geometry where appropriate.

Do not clone geometry unnecessarily.

---

## 9. Procedural Generator Architecture

### 9.1 Generator Principles

Every generator should:

1. Accept an explicit configuration.
2. Use a seeded random generator.
3. Produce predictable geometry.
4. Return or expose generated resources.
5. Support cleanup and disposal.
6. Separate visual geometry from collision generation.
7. Avoid direct dependencies on global application state.

Generators should be composable.

A building generator may use facade, rooftop, ventilation, and signage generators.

### 9.2 Proposed Generator Modules

```text
procedural/
├── core/
│   ├── RandomGenerator.ts
│   ├── GeometryFactory.ts
│   ├── TextureGenerator.ts
│   └── GeneratorContext.ts
├── architecture/
│   ├── BuildingGenerator.ts
│   ├── FacadeGenerator.ts
│   └── RooftopGenerator.ts
├── industrial/
│   ├── PipeGenerator.ts
│   ├── VentGenerator.ts
│   ├── StairGenerator.ts
│   ├── RailGenerator.ts
│   ├── PlatformGenerator.ts
│   └── ScaffoldGenerator.ts
├── navigation/
│   └── SignGenerator.ts
└── materials/
    └── ProceduralMaterialFactory.ts
```

This is a proposed organization.

Do not create every module before it is needed by the implementation roadmap.

### 9.3 Generator Contract

A generator should expose a predictable interface.

Example:

```ts
interface GeneratorConfig {
  seed: number;
}

interface GeneratedAsset {
  object: THREE.Object3D;
  dispose(): void;
}

interface AssetGenerator<
  TConfig extends GeneratorConfig
> {
  generate(config: TConfig): GeneratedAsset;
}
```

This is an illustrative contract. Adapt it to the actual project architecture.

If an asset requires physics, provide collision data separately rather than embedding Rapier objects inside rendering geometry.

### 9.4 Seed Management

Each generator must support deterministic output.

Use explicit seeds and avoid uncontrolled calls to `Math.random()`.

A useful approach is to derive child seeds from a parent seed and a stable object identifier.

This allows individual buildings and props to remain reproducible even when unrelated generation order changes.

### 9.5 Configuration

Prefer typed configuration objects.

Example:

```ts
interface BuildingConfig {
  seed: number;
  width: number;
  depth: number;
  height: number;
  floorHeight: number;
  facadeStyle: 'grid' | 'horizontal' | 'industrial';
  rooftopEnabled: boolean;
}
```

Validate configuration values.

Invalid dimensions must not produce broken or non-finite geometry.

---

## 10. Visual Geometry and Physics Separation

This is a critical architectural rule.

Rendering geometry and physical collision geometry serve different purposes.

Do not use every rendered mesh as a physical collider.

### 10.1 Visual Geometry

Visual geometry may contain:

- Small panels.
- Bolts.
- Surface markings.
- Decorative pipes.
- Thin rails.
- Bevel details.
- Texture-driven details.
- Complex architectural surfaces.

These elements do not automatically require collision.

### 10.2 Collision Geometry

Collision geometry should be simple and gameplay-oriented.

Prefer:

- Boxes.
- Capsules.
- Cylinders.
- Simplified convex shapes.
- Static trimeshes only when justified.

Examples:

| Visual object | Suggested collision |
|---|---|
| Concrete platform | Box |
| Large wall | Box |
| Pipe | Cylinder or simplified proxy |
| Narrow walkway | Box |
| Scaffolding | Simplified boxes |
| Decorative panel | None |
| Small bolts | None |
| Complex rooftop machine | One or several simple boxes |

### 10.3 Gameplay Metadata

Objects and trigger volumes that participate in gameplay should expose explicit gameplay metadata.

Examples:

- `walkable` — ordinary traversable surface.
- `landingSurface` — surface intended for a controlled landing.
- `vaultObstacle` — object the Vault System may traverse.
- `wallrunSurface` — wall segment valid for wallrun contact.
- `walljumpSurface` — wall segment valid for walljump contact.
- `checkpoint` — checkpoint trigger volume.
- `finishTrigger` — Prologue finish trigger.
- `hazard` / `killVolume` — failure or kill volume.

Ledge, balance, and zipline metadata are deferred and must not be added in the initial release (`03_GAMEPLAY_SPEC.md` §13).

Do not infer all gameplay behavior from visual material or mesh names.

Use explicit component data or tags.

### 10.4 Collision Validation

Collision proxies must be checked against visual geometry.

Important requirements:

- No invisible walls.
- No unintended gaps.
- No excessive collision protrusion.
- No decorative collision obstacles.
- Stable player movement over module boundaries.

The player should interact with the intended physical structure, not with arbitrary visual detail.

---

## 11. Lighting and Atmosphere

### 11.1 General Lighting Direction

The initial environment should use bright daylight.

The target look:

- Clear visibility.
- Soft but readable shadows.
- Neutral white surfaces.
- Cool environmental tones.
- Strong separation between light and dark geometry.

Avoid excessively dramatic lighting during initial gameplay development.

### 11.2 Lighting Setup

The initial rendering setup may include:

- Hemisphere or ambient-style environmental fill.
- One primary directional light.
- Shadow mapping.
- Optional subtle local lights for special elements.

Lighting should be centralized through a lighting manager.

Do not create an independent directional light for every building.

### 11.3 Shadows

Shadows are important for depth perception.

Prioritize shadows for:

- Player surroundings.
- Large architecture.
- Major platforms.
- Important obstacles.
- Nearby industrial structures.

Distant background buildings may use simplified shading without real-time shadows.

Shadow quality should be configurable.

### 11.4 Sky

Use a procedural sky solution.

Possible approaches:

- `Sky` from Three.js examples.
- A custom atmospheric shader.
- A gradient sky with controlled atmospheric scattering.

The sky should remain visually restrained.

### 11.5 Distance Atmosphere

Use subtle distance fog or atmospheric fading to separate foreground architecture from the skyline.

The effect should:

- Preserve visibility of the route.
- Avoid hiding nearby obstacles.
- Reduce visual contrast with distance.
- Improve perceived city scale.

Fog parameters should be configurable and tuned with the actual level scale.

### 11.6 Post-Processing

Post-processing is optional and must be introduced incrementally.

Potential effects:

- Tone mapping.
- Color correction.
- Subtle vignette.
- Very restrained bloom for emissive elements.
- Optional motion-related effects.

Avoid excessive bloom, chromatic aberration, film grain, or motion blur.

Gameplay readability takes priority over cinematic appearance.

---

## 12. Environment Construction Guidelines

### 12.1 Composition

A playable environment should combine:

- Large architectural masses.
- Clear traversable surfaces.
- Intermediate parkour structures.
- Vertical variation.
- Open sightlines.
- Distant skyline elements.

Do not fill every empty space with objects.

Negative space is an important part of the visual style.

### 12.2 Rooftops

Rooftops should include functional architectural features:

- Parapets.
- Ventilation units.
- Service structures.
- Pipes.
- Access doors.
- Maintenance walkways.
- Occasional antennas.
- Red navigation details.

The roof must remain readable as a movement surface.

Avoid excessive clutter around landing areas.

### 12.3 Industrial Areas

Industrial sections may be denser.

Use:

- Pipes.
- Ventilation.
- Steel frames.
- Narrow platforms.
- Maintenance walkways.
- Scaffolding.
- Vertical structures.

However, every obstacle must have a clear gameplay purpose or visual role.

### 12.4 Construction Areas

Construction environments should use a modular scaffolding system.

The visual design should communicate:

- Verticality.
- Temporary structures.
- Exposed supports.
- Narrow routes.
- Multiple traversal opportunities.

Avoid creating a visually dense structure that makes the intended route impossible to read.

### 12.5 Route Readability

Important parkour routes should be visually distinguishable.

Use combinations of:

- Platform placement.
- Contrasting surfaces.
- Red accents.
- Directional signs.
- Lighting.
- Runner Vision.

The player should be able to understand the next movement opportunity without relying entirely on HUD markers.

---

## 13. Performance and Resource Budgets

Procedural generation must not result in uncontrolled rendering complexity.

Performance is part of the asset design.

### 13.1 General Rules

- Reuse geometry.
- Reuse materials.
- Use instancing for repeated objects.
- Keep distant geometry simple.
- Avoid unnecessary transparency.
- Avoid excessive real-time shadows.
- Dispose unused resources.
- Avoid per-frame object allocation in hot paths.
- Generate static environment geometry before gameplay when possible.

### 13.2 Draw Calls

Reduce draw calls through:

- Material reuse.
- Instanced meshes.
- Static geometry batching.
- Combining compatible static objects.

Do not combine objects if doing so makes visibility culling or level management significantly worse.

### 13.3 Level of Detail

Use simplified geometry for distant objects.

Possible LOD levels:

| Level | Usage |
|---|---|
| LOD0 | Close gameplay objects |
| LOD1 | Medium-distance architecture |
| LOD2 | Distant architecture |
| Billboard / silhouette | Far skyline, where appropriate |

LOD transitions must not create distracting visual changes.

Not every object needs an LOD system.

Prioritize buildings, repeated industrial structures, and large environment assets.

### 13.4 Visibility and Culling

Use frustum culling and level-based visibility management.

For large environments, consider spatial grouping.

Avoid keeping unnecessary detailed geometry active when it cannot contribute to the current view.

### 13.5 Target Performance

The project's initial performance target is 60 FPS on a reasonable desktop system.

Rendering budgets should be measured in the actual browser and target hardware.

Do not define arbitrary universal limits for:

- Draw calls.
- Triangle count.
- Texture memory.
- Shadow map resolution.

Instead, establish measured budgets during implementation and document them in performance notes.

### 13.6 Resource Lifecycle

Generated assets must have explicit ownership.

When an asset or level is removed:

- Dispose geometries that are no longer shared.
- Dispose textures that are no longer shared.
- Dispose materials that are no longer shared.
- Remove event listeners.
- Remove references to generated objects.
- Release associated physics resources.

Shared resources must not be disposed while still in use.

---

## 14. Asset Naming Conventions

Use descriptive names based on asset family and purpose.

Suggested format:

```text
<family>_<type>_<variant>
```

Examples:

```text
building_office_tall
building_industrial_low
pipe_horizontal_medium
pipe_elbow_90
vent_rooftop_large
rail_industrial_red
platform_metal_narrow
scaffold_section_standard
sign_direction_arrow
material_concrete_white
material_metal_brushed
```

Names should be stable and useful for debugging.

Avoid generic identifiers such as `object1`, `mesh2`, or `tempAsset`.

Generated instances may include stable IDs derived from the level and generation configuration.

---

## 15. Initial Asset Set

The following is the minimum useful asset set for the first playable environments.

### 15.1 Training Level

- Concrete floor and rooftop platform.
- Low and tall concrete walls.
- Parapets.
- Pipes.
- Ventilation units.
- Metal railings.
- Industrial stairs.
- Vault obstacles for the vaulting exercise.
- Wallrun surfaces with a safe exit.
- Low overhead obstacles for the sliding exercise.
- Landing platforms.
- Interaction targets for the interaction exercise.
- Directional signs.
- Checkpoint markers.

### 15.2 Prologue Level

- Rooftop building modules.
- Industrial building modules.
- Ventilation systems.
- Pipe networks.
- Construction scaffolding.
- Metal walkways.
- Narrow bridges.
- Safety railings.
- Vertical ladders (decorative industrial geometry).
- Large landing platforms.
- Skyline background.
- Checkpoint markers.
- Finish marker.

The initial asset set must not contain dedicated assets or gameplay metadata for deferred traversal mechanics (ledge grabbing, climbing, balance traversal, ziplines, swinging). Geometry that resembles a ledge, narrow beam, ladder, or cable is non-interactive environment art (`05_PROCEDURAL_GENERATION_SPEC.md` §3.5).

The asset set should be expanded only when a level section requires it.

---

## 16. Visual Quality Acceptance Criteria

An asset or generator is acceptable when:

### Geometry

- Dimensions are valid.
- Geometry is aligned to project conventions.
- Normals are correct.
- UVs are valid when required.
- No unintended holes or visible seams exist.
- Repeated modules align correctly.

### Materials

- Materials follow the project's visual palette.
- Surface variation is subtle and intentional.
- Material instances are reused where appropriate.
- No obvious texture stretching exists.
- Lighting response is visually consistent.

### Procedural Generation

- Generation is deterministic for a given seed and configuration.
- Invalid configurations are handled safely.
- Output is reproducible.
- Resources have explicit cleanup.
- Generators do not depend on hidden global state.

### Gameplay

- Important surfaces are readable.
- Parkour objects are visually identifiable.
- Collision geometry matches gameplay expectations.
- Decorative details do not interfere with movement.
- Route readability is preserved.

### Performance

- Geometry is reused where possible.
- Repeated elements use instancing where appropriate.
- Distant assets are simplified.
- Resource disposal is correct.
- The asset does not introduce unnecessary rendering overhead.

---

## 17. Implementation Priorities

Do not implement the entire procedural asset system at once.

Follow the project roadmap and build assets as required by playable vertical slices.

Recommended order:

1. Basic concrete and metal materials.
2. Simple floor, wall, and platform geometry.
3. Basic rooftop structures.
4. Pipes and ventilation.
5. Railings and stairs.
6. Wallrun surfaces and vault obstacles.
7. Scaffolding modules.
8. Building facade generation.
9. Rooftop generation.
10. Distant skyline generation.
11. Procedural surface textures.
12. Additional shaders and visual effects.
13. LOD and performance improvements.

Every stage should result in usable assets rather than speculative infrastructure.

---

## 18. AI Agent Rules

When implementing this document:

1. Treat this file as the source of truth for visual asset direction.
2. Follow `00_PROJECT_BRIEF.md` and `01_AGENT_RULES.md`.
3. Follow `02_TECHNICAL_ARCHITECTURE.md` for system boundaries.
4. Follow `03_GAMEPLAY_SPEC.md` for gameplay requirements.
5. Do not download or copy game assets from external sources.
6. Do not reproduce proprietary assets or exact original level layouts.
7. Prefer procedural geometry and materials.
8. Keep generators deterministic.
9. Keep rendering and physics responsibilities separate.
10. Reuse resources and implement proper disposal.
11. Do not build modules before they are needed.
12. Do not sacrifice gameplay readability for visual complexity.
13. Measure performance rather than guessing.
14. Document meaningful deviations from this specification.

If a visual or technical decision is ambiguous, prefer the simpler implementation that preserves the established visual identity.

---

## 19. Final Design Principle

The environment exists to support movement.

Architecture, lighting, materials, and procedural detail must reinforce the player's understanding of space and traversal.

The world should feel like a coherent modern urban environment built from clean architectural forms and functional industrial infrastructure.

The visual identity should remain recognizable through a restrained palette, strong geometry, selective red accents, and carefully controlled detail.

**Clarity, consistency, and movement readability always take priority over decorative complexity.**