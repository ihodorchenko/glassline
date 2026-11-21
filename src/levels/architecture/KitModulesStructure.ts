/**
 * Architectural Kit — structural modules.
 *
 * Column, cantilever, canopy, bridge and stair. These modules are the pieces a
 * player reads as load-bearing architecture: they carry the kit's silhouettes
 * and the spans between volumes, so they are built from real structural
 * profiles (tapered shafts, tapered slab edges, outriggers, stringers) rather
 * than from decorated boxes.
 */

import { count, dimension, type KitPartCollector, loftPrism, rectRingShape } from "./KitGeometry";
import type {
  BridgeModule,
  CanopyModule,
  CantileverModule,
  ColumnModule,
  StairModule,
} from "./KitTypes";

const COLUMN_TAPER = 0.82;

export function buildColumn(collector: KitPartCollector, definition: ColumnModule): void {
  const height = dimension(definition.height, 5.2, "column height");
  const width = dimension(definition.width, 0.9, "column width");
  const accent = definition.accent ?? true;
  const baseHeight = Math.min(0.2, height * 0.045);
  const capitalHeight = Math.min(0.24, height * 0.05);
  const shaftHeight = height - baseHeight - capitalHeight;
  const chamfer = width * 0.14;
  const halfWidth = width / 2;

  const section = (half: number): readonly (readonly [number, number])[] => [
    [-half + chamfer * (half / halfWidth), half],
    [half - chamfer * (half / halfWidth), half],
    [half, half - chamfer * (half / halfWidth)],
    [half, -half + chamfer * (half / halfWidth)],
    [half - chamfer * (half / halfWidth), -half],
    [-half + chamfer * (half / halfWidth), -half],
    [-half, -half + chamfer * (half / halfWidth)],
    [-half, half - chamfer * (half / halfWidth)],
  ];

  // Tapered, chamfered concrete shaft: the faces between chamfers are wide,
  // calm planes that take the key light, while the chamfers stay in half-light.
  collector.addOwned(
    loftPrism(section(halfWidth), section(halfWidth * COLUMN_TAPER), shaftHeight),
    "concrete",
    { position: [0, baseHeight, 0] },
  );

  // Shadow reveals follow the taper as thin anodized fins on two faces.
  const faceBottom = halfWidth;
  const faceTop = halfWidth * COLUMN_TAPER;
  const taperAngle = Math.atan((faceBottom - faceTop) / shaftHeight);
  const faceMiddle = (faceBottom + faceTop) / 2;
  const finY = baseHeight + shaftHeight / 2;

  collector.box([0.05, shaftHeight * 0.82, 0.085], [faceMiddle + 0.012, finY, 0], "aluminium", {
    rotation: [0, 0, taperAngle],
  });
  collector.box([0.085, shaftHeight * 0.82, 0.05], [0, finY, faceMiddle + 0.012], "aluminium", {
    rotation: [-taperAngle, 0, 0],
  });

  // Base plinth and capital: the column visibly meets the ground and a slab.
  collector.roundedBox(
    [width + 0.22, baseHeight, width + 0.22],
    [0, baseHeight / 2, 0],
    "concrete",
    {
      bevel: 0.018,
    },
  );
  collector.roundedBox(
    [width * 0.94, capitalHeight * 0.42, width * 0.94],
    [0, height - capitalHeight, 0],
    "aluminium",
    { bevel: 0.01 },
  );
  collector.roundedBox(
    [width * 1.02, capitalHeight * 0.58, width * 1.02],
    [0, height - capitalHeight * 0.29, 0],
    "concrete",
    { bevel: 0.012 },
  );

  if (accent) {
    // A single red serviced band at the base collar: navigation scale, not paint.
    collector.box(
      [0.1, baseHeight * 0.5, 0.014],
      [0, baseHeight / 2, (width + 0.22) / 2 + 0.006],
      "red",
    );
  }
}

export function buildCantilever(collector: KitPartCollector, definition: CantileverModule): void {
  const width = dimension(definition.width, 8, "cantilever width");
  const depth = dimension(definition.depth, 3.2, "cantilever depth");
  const thickness = dimension(definition.thickness, 0.8, "cantilever thickness");
  const railing = definition.railing ?? true;
  const halfWidth = width / 2;

  // Tapered slab: deep at the wall, thin at the tip. The underside slope is the
  // whole point of the module — it is a cantilever, not a box on a wall.
  collector.profileAlongX(
    [
      [0, 0],
      [depth, 0],
      [depth, -thickness * 0.46],
      [0.24, -thickness],
      [0, -thickness],
    ],
    width,
    [0, 0, 0],
    "concrete",
    { bevel: 0.018 },
  );

  // Underside ribs express how the slab works structurally.
  for (let index = 0; index < 4; index += 1) {
    const x = -halfWidth + 0.32 + (index * (width - 0.64)) / 3;

    collector.box([0.06, 0.17, depth * 0.8], [x, -thickness * 0.62, depth * 0.43], "dark-metal");
  }

  // Metal fascia capping and the red navigation line along the exposed edge.
  collector.box([width, 0.055, 0.06], [0, -thickness * 0.2, depth], "aluminium");
  collector.box([width * 0.92, 0.02, 0.012], [0, -thickness * 0.5, depth + 0.012], "red");

  if (railing) {
    const railHeight = 1.08;
    const glassHeight = railHeight - 0.24;

    for (const x of [-halfWidth + 0.08, 0, halfWidth - 0.08]) {
      collector.box([0.05, railHeight, 0.05], [x, railHeight / 2, depth - 0.08], "aluminium");
    }

    for (const x of [-halfWidth + 0.07, halfWidth - 0.07]) {
      collector.box([0.05, railHeight, 0.05], [x, railHeight / 2, depth * 0.5], "aluminium");
    }

    collector.box(
      [width - 0.3, glassHeight, 0.015],
      [0, glassHeight / 2 + 0.08, depth - 0.06],
      "glass-rail",
      { castShadow: false },
    );

    for (const x of [-halfWidth + 0.055, halfWidth - 0.055]) {
      collector.box(
        [0.015, glassHeight, depth - 0.24],
        [x, glassHeight / 2 + 0.08, depth / 2],
        "glass-rail",
        { castShadow: false },
      );
    }

    collector.box([width, 0.045, 0.07], [0, railHeight - 0.02, depth - 0.06], "aluminium");

    for (const x of [-halfWidth + 0.055, halfWidth - 0.055]) {
      collector.box([0.07, 0.045, depth], [x, railHeight - 0.02, depth / 2], "aluminium");
    }
  }
}

export function buildCanopy(collector: KitPartCollector, definition: CanopyModule): void {
  const width = dimension(definition.width, 7, "canopy width");
  const depth = dimension(definition.depth, 3.4, "canopy depth");
  const thickness = dimension(definition.thickness, 0.24, "canopy thickness");
  const tensionRods = definition.tensionRods ?? true;
  const halfWidth = width / 2;

  // A thin blade that lifts slightly towards its free edge: the underside plane
  // stays almost flat, which is what makes a canopy read as light.
  collector.profileAlongX(
    [
      [0, 0],
      [depth, 0.06],
      [depth, 0.06 + thickness],
      [0, thickness],
    ],
    width,
    [0, 0, 0],
    "white",
    { bevel: 0.014 },
  );

  // Front gutter, expressed as a crisp anodized edge.
  collector.box([width, 0.075, 0.06], [0, 0.055, depth + 0.02], "aluminium");
  collector.box([width - 0.12, 0.025, 0.04], [0, 0.018, depth * 0.82], "dark-metal");

  // Wall brackets and cantilevered outriggers.
  for (const x of [-width * 0.32, 0, width * 0.32]) {
    collector.box([0.09, 0.15, depth * 0.9], [x, -0.055, depth * 0.45], "dark-metal");
    collector.box([0.13, 0.3, 0.1], [x, -0.08, 0.06], "dark-metal");
  }

  if (tensionRods) {
    for (const x of [-halfWidth * 0.72, halfWidth * 0.72]) {
      const anchorY = 1.5;
      const anchorZ = 0.08;
      const tipY = 0.08;
      const tipZ = depth * 0.86;
      const deltaY = tipY - anchorY;
      const deltaZ = tipZ - anchorZ;
      const length = Math.hypot(deltaY, deltaZ);
      const angle = Math.atan2(deltaZ, deltaY);

      collector.cylinder(
        0.018,
        0.018,
        length,
        [x, (anchorY + tipY) / 2, (anchorZ + tipZ) / 2],
        "aluminium",
        { rotation: [angle, 0, 0], sides: 8 },
      );
      collector.box([0.11, 0.1, 0.09], [x, anchorY, 0.05], "dark-metal");
    }
  }
}

export function buildBridge(collector: KitPartCollector, definition: BridgeModule): void {
  const length = dimension(definition.length, 10, "bridge length");
  const width = dimension(definition.width, 3.2, "bridge width");
  const height = dimension(definition.height, 3.4, "bridge height");
  const bays = count(definition.bays, 4, "bridge bays");
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const glassBottom = 0.16;
  const glassHeight = Math.max(0.8, height - 0.72);

  // Deck, floor finish, edge beams and the two longitudinal structure beams.
  collector.roundedBox([length, 0.35, width], [0, -0.175, 0], "concrete", { bevel: 0.02 });
  for (const side of [-1, 1]) {
    // Edge beam sits proud of the deck slab: a coplanar fascia face would
    // z-fight against the slab's side face (visible as a broken highlight line).
    collector.box([length, 0.26, 0.14], [0, -0.24, side * (halfWidth - 0.005)], "dark-metal");
    collector.box([length, 0.3, 0.16], [0, -0.52, side * width * 0.24], "dark-metal");
  }

  // Glazed sides with a sill and head channel, plus a mullion per bay.
  for (const side of [-1, 1]) {
    collector.box(
      [length - 0.55, glassHeight, 0.03],
      [0, glassBottom + glassHeight / 2, side * (halfWidth - 0.04)],
      "glass",
    );
    collector.box(
      [length, 0.1, 0.13],
      [0, glassBottom - 0.05, side * (halfWidth - 0.02)],
      "aluminium",
    );
    collector.box(
      [length, 0.12, 0.15],
      [0, glassBottom + glassHeight + 0.06, side * (halfWidth - 0.02)],
      "aluminium",
    );

    for (let bay = 0; bay <= bays; bay += 1) {
      const x = -halfLength + 0.28 + ((length - 0.56) * bay) / bays;

      collector.box(
        [0.07, glassHeight, 0.11],
        [x, glassBottom + glassHeight / 2, side * (halfWidth - 0.03)],
        "aluminium",
      );
    }
  }

  // Roof plate and expressed roof edge.
  collector.roundedBox([length, 0.2, width], [0, height + 0.1, 0], "concrete", { bevel: 0.018 });
  collector.box([length, 0.08, 0.05], [0, height + 0.04, halfWidth], "dark-metal");
  collector.box([length, 0.08, 0.05], [0, height + 0.04, -halfWidth], "dark-metal");

  // Portal frames at both ends tie the bridge into the volumes it connects.
  for (const x of [-halfLength + 0.17, halfLength - 0.17]) {
    collector.extrusion(
      rectRingShape(width, height + 0.24, 0.24, 0.02),
      0.34,
      [x, (height + 0.24) / 2, 0],
      "concrete",
      { rotation: [0, Math.PI / 2, 0], bevel: 0.008 },
    );
  }

  // A single red ceiling line reads as navigation when crossing the bridge.
  collector.box([length - 0.6, 0.02, 0.05], [0, height - 0.01, 0], "red");
}

export function buildStair(collector: KitPartCollector, definition: StairModule): void {
  const width = dimension(definition.width, 2.4, "stair width");
  const height = dimension(definition.height, 4.2, "stair height");
  const run = dimension(definition.run, 4.8, "stair run");
  const steps = count(definition.steps, Math.max(4, Math.round(height / 0.17)), "stair steps");
  const railing = definition.railing ?? true;
  const glassInfill = definition.glassInfill ?? true;
  const rise = height / steps;
  const treadDepth = run / steps;
  const slopeAngle = Math.atan2(height, run);
  const slopeLength = Math.hypot(height, run);
  const halfWidth = width / 2;

  // Floating treads with a fine front nosing; the open risers keep the stair
  // reading as architecture rather than a solid ramp.
  for (let step = 0; step < steps; step += 1) {
    const topY = (step + 1) * rise;
    const centerZ = (step + 0.5) * treadDepth;

    collector.roundedBox(
      [width, 0.075, treadDepth + 0.02],
      [0, topY - 0.0375, centerZ],
      "concrete",
      {
        bevel: 0.012,
      },
    );
    collector.box([width, 0.026, 0.045], [0, topY - 0.013, step * treadDepth], "aluminium");
  }

  // Folded side stringers.
  for (const x of [-halfWidth + 0.16, halfWidth - 0.16]) {
    collector.box([0.3, 0.42, slopeLength + 0.1], [x, height / 2 - 0.2, run / 2], "concrete", {
      rotation: [-slopeAngle, 0, 0],
      bevel: 0.018,
    });
  }

  // Top landing with a metal nosing.
  collector.roundedBox([width + 0.12, 0.26, 1.15], [0, height - 0.13, run + 0.575], "concrete", {
    bevel: 0.018,
  });
  collector.box([width + 0.12, 0.026, 0.045], [0, height - 0.013, run], "aluminium");
  collector.box([width + 0.12, 0.46, 0.05], [0, height - 0.36, run + 1.15], "concrete");

  if (railing) {
    const railHeight = 0.95;
    const railRotation = Math.PI / 2 - slopeAngle;

    for (const x of [-halfWidth + 0.06, halfWidth - 0.06]) {
      collector.cylinder(
        0.025,
        0.025,
        slopeLength + 0.35,
        [x, height / 2 + railHeight, run / 2],
        "aluminium",
        { rotation: [railRotation, 0, 0] },
      );

      if (glassInfill) {
        collector.box(
          [0.014, 0.58, slopeLength - 0.5],
          [x, height / 2 + 0.58, run / 2],
          "glass-rail",
          { rotation: [-slopeAngle, 0, 0], castShadow: false },
        );
      }

      for (let step = 0; step <= steps; step += 4) {
        const clamped = Math.min(step, steps - 1);
        const postY = (clamped + 1) * rise;
        const postZ = clamped * treadDepth;

        collector.cylinder(
          0.018,
          0.018,
          railHeight - 0.03,
          [x, postY + railHeight / 2, postZ],
          "aluminium",
        );
      }
    }

    // Landing guard rail: horizontal, independent of the flight.
    for (const x of [-halfWidth + 0.06, halfWidth - 0.06]) {
      collector.cylinder(0.025, 0.025, 1.2, [x, height + railHeight, run + 0.55], "aluminium", {
        rotation: [Math.PI / 2, 0, 0],
      });
      collector.cylinder(
        0.018,
        0.018,
        railHeight,
        [x, height + railHeight / 2, run + 1.1],
        "aluminium",
      );
    }
  }

  // Red nosing on the first tread: the entry point of the flight.
  collector.box([width * 0.9, 0.022, 0.02], [0, rise - 0.02, -0.005], "red");
}
