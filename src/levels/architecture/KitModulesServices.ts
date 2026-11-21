/**
 * Architectural Kit — service and screen modules.
 *
 * Service portal, ventilation intake, vertical louver, ribbon facade screen and
 * glass railing. These modules carry the technical language of the kit: they
 * are the places where the building is serviced, ventilated and shaded. They
 * stay architectural — expressed reveals, crisp metal sections, controlled
 * louvre rhythm — instead of turning into industrial clutter.
 */

import { count, dimension, type KitPartCollector, rectRingShape } from "./KitGeometry";
import type {
  FacadeScreenModule,
  GlassRailingModule,
  LouverModule,
  ServicePortalModule,
  VentilationModule,
} from "./KitTypes";

export function buildServicePortal(
  collector: KitPartCollector,
  definition: ServicePortalModule,
): void {
  const width = dimension(definition.width, 2.8, "service-portal width");
  const height = dimension(definition.height, 3, "service-portal height");
  const depth = dimension(definition.depth, 0.7, "service-portal depth");
  const louvered = definition.louvered ?? true;
  const halfWidth = width / 2;
  const outerHeight = height + 0.55;

  // A deep concrete portal: the reveal is the architectural gesture, the door
  // sits at the back of it in shadow.
  collector.extrusion(
    rectRingShape(width + 0.7, outerHeight, 0.35, 0.02),
    depth + 0.24,
    [0, outerHeight / 2, 0.02],
    "concrete",
    { bevel: 0.01 },
  );

  for (const x of [-halfWidth - 0.175, halfWidth + 0.175]) {
    collector.box([0.35, outerHeight, depth], [x, outerHeight / 2, -depth / 2], "concrete");
  }

  collector.box([width + 0.7, 0.35, depth], [0, outerHeight - 0.175, -depth / 2], "concrete");

  // Door leaf, recessed at the back of the reveal.
  collector.box(
    [width - 0.05, height - 0.5, 0.08],
    [0, (height - 0.5) / 2 + 0.16, -depth + 0.08],
    "dark-metal",
  );

  if (louvered) {
    const slats = 7;

    for (let index = 0; index < slats; index += 1) {
      const y = 0.42 + (index * (height - 1.16)) / (slats - 1);

      collector.box([width - 0.3, 0.075, 0.032], [0, y, -depth + 0.04], "aluminium", {
        rotation: [0.42, 0, 0],
      });
    }

    for (const x of [-halfWidth + 0.1, halfWidth - 0.1]) {
      collector.box(
        [0.08, height - 0.5, 0.06],
        [x, (height - 0.5) / 2 + 0.16, -depth + 0.04],
        "aluminium",
      );
    }
  }

  // Anodized door frame around the opening.
  for (const x of [-halfWidth - 0.03, halfWidth + 0.03]) {
    collector.box([0.06, height - 0.12, 0.05], [x, (height - 0.12) / 2 + 0.12, 0.03], "aluminium");
  }
  collector.box([width + 0.12, 0.06, 0.05], [0, height, 0.03], "aluminium");

  // Hood and threshold: a small piece of shadow-casting architecture at eye level.
  collector.roundedBox([width + 1.0, 0.16, 0.62], [0, outerHeight + 0.1, 0.2], "concrete", {
    bevel: 0.015,
  });
  collector.box([width + 1.0, 0.04, 0.07], [0, outerHeight + 0.015, 0.49], "aluminium");
  collector.roundedBox([width + 0.5, 0.12, 0.62], [0, 0.06, 0.26], "concrete", { bevel: 0.012 });
  collector.box([width, 0.018, 0.05], [0, 0.126, 0.5], "aluminium");

  // Red jamb accent: navigation, at door-handle height.
  collector.box([0.07, height * 0.7, 0.018], [-halfWidth + 0.05, height * 0.45, 0.065], "red");
}

export function buildVentilation(collector: KitPartCollector, definition: VentilationModule): void {
  const width = dimension(definition.width, 2.8, "ventilation width");
  const height = dimension(definition.height, 2.4, "ventilation height");
  const depth = dimension(definition.depth, 1.0, "ventilation depth");
  const blades = count(definition.blades, 6, "ventilation blades");
  const halfWidth = width / 2;
  const outerHeight = height + 0.5;

  // Expressed concrete intake surround.
  collector.extrusion(
    rectRingShape(width + 0.55, outerHeight, 0.275, 0.02),
    depth * 0.86,
    [0, outerHeight / 2, 0],
    "concrete",
    { bevel: 0.01 },
  );

  for (const x of [-halfWidth - 0.1375, halfWidth + 0.1375]) {
    collector.box([0.275, height, depth], [x, height / 2, -depth / 2], "concrete");
  }

  // Dark plenum: the intake needs to read as a void, not a black sticker.
  collector.box([width, height, 0.06], [0, height / 2, -depth + 0.02], "dark-metal");
  collector.box([0.06, height, depth * 0.9], [-halfWidth, height / 2, -depth / 2], "dark-metal");
  collector.box([0.06, height, depth * 0.9], [halfWidth, height / 2, -depth / 2], "dark-metal");
  collector.box([width, 0.06, depth * 0.9], [0, 0.24, -depth / 2], "dark-metal");
  collector.box([width, 0.06, depth * 0.9], [0, height - 0.24, -depth / 2], "dark-metal");

  // Angled intake blades with a crisp anodized edge.
  for (let index = 0; index < blades; index += 1) {
    const y = 0.32 + (index * (height - 0.64)) / Math.max(1, blades - 1);

    collector.box([width - 0.06, 0.05, depth * 0.6], [0, y, -depth * 0.43], "aluminium", {
      rotation: [0.5, 0, 0],
    });
  }

  for (const x of [-halfWidth - 0.06, halfWidth + 0.06]) {
    collector.box([0.06, height, 0.1], [x, height / 2, 0.06], "aluminium");
  }

  // Hood, sill and a single red service tag.
  collector.roundedBox(
    [width + 0.9, 0.18, depth + 0.34],
    [0, height + 0.36, -depth / 2 + 0.15],
    "concrete",
    { bevel: 0.016 },
  );
  collector.box([width + 0.9, 0.04, 0.08], [0, height + 0.26, 0.29], "aluminium");
  collector.roundedBox(
    [width + 0.75, 0.14, depth + 0.16],
    [0, 0.07, -depth / 2 + 0.06],
    "concrete",
    { bevel: 0.012 },
  );
  collector.box([0.66, 0.034, 0.02], [0, 0.155, 0.09], "red");
}

export function buildLouver(collector: KitPartCollector, definition: LouverModule): void {
  const width = dimension(definition.width, 5, "louver width");
  const height = dimension(definition.height, 4, "louver height");
  const depth = dimension(definition.depth, 0.45, "louver depth");
  const bladeCount = count(definition.bladeCount, 18, "louver blades");
  const halfWidth = width / 2;
  const usableWidth = width - 0.5;
  const spacing = usableWidth / bladeCount;

  // Tinted glass behind the screen keeps the louver reading as a facade layer.
  collector.box([width - 0.1, height - 0.2, 0.025], [0, height / 2, -0.06], "glass-near");

  // Frame rails and side posts.
  collector.box([width, 0.11, depth * 0.78], [0, height - 0.055, depth * 0.28], "dark-metal");
  collector.box([width, 0.11, depth * 0.78], [0, 0.055, depth * 0.28], "dark-metal");

  for (const x of [-halfWidth + 0.06, halfWidth - 0.06]) {
    collector.box([0.12, height, depth * 0.52], [x, height / 2, depth * 0.24], "dark-metal");
  }

  // Vertical fins: a calm rhythm with one expressed direction.
  for (let index = 0; index < bladeCount; index += 1) {
    const x = -usableWidth / 2 + spacing * (index + 0.5);

    collector.box([0.055, height - 0.34, depth * 0.74], [x, height / 2, depth * 0.4], "composite", {
      rotation: [0, 0.2, 0],
    });
  }
}

export function buildFacadeScreen(
  collector: KitPartCollector,
  definition: FacadeScreenModule,
): void {
  const width = dimension(definition.width, 5, "facade-screen width");
  const height = dimension(definition.height, 4.5, "facade-screen height");
  const depth = dimension(definition.depth, 0.4, "facade-screen depth");
  const ribbons = count(definition.ribbons, 12, "facade-screen ribbons");
  const spacing = (height - 0.3) / ribbons;

  // Glass behind the ribbon screen.
  collector.box([width - 0.1, height - 0.1, 0.025], [0, height / 2, -0.04], "glass-near");

  // Three vertical supports carry the ribbons.
  for (const x of [-width / 3, 0, width / 3]) {
    collector.box([0.05, height, depth * 0.3], [x, height / 2, depth * 0.08], "dark-metal");
  }

  // Horizontal ribbons, tilted down towards the sun: both shade and silhouette.
  for (let index = 0; index < ribbons; index += 1) {
    const y = 0.15 + spacing * (index + 0.5);

    collector.box([width - 0.24, 0.09, depth * 0.78], [0, y, depth * 0.42], "aluminium", {
      rotation: [0.34, 0, 0],
    });
  }

  collector.box([width, 0.1, depth * 0.5], [0, height - 0.05, depth * 0.22], "aluminium");
  collector.box([width, 0.1, depth * 0.5], [0, 0.05, depth * 0.22], "aluminium");
}

export function buildGlassRailing(
  collector: KitPartCollector,
  definition: GlassRailingModule,
): void {
  const length = dimension(definition.length, 4, "glass-railing length");
  const height = dimension(definition.height, 1.15, "glass-railing height");
  const halfLength = length / 2;
  const postCount = Math.max(2, Math.round(length / 1.35) + 1);
  const panelSpan = (length - 0.2) / (postCount - 1);
  const glassTop = height - 0.28;

  // Continuous base channel: the glass appears to grow out of the metal shoe.
  collector.box([length, 0.08, 0.16], [0, 0.04, 0], "aluminium");

  for (let index = 0; index < postCount; index += 1) {
    const x = -halfLength + 0.1 + index * panelSpan;

    collector.box([0.05, height, 0.07], [x, height / 2, 0], "aluminium");
    collector.box([0.1, 0.02, 0.14], [x, 0.01, 0], "aluminium");
  }

  for (let index = 0; index < postCount - 1; index += 1) {
    const x = -halfLength + 0.1 + panelSpan * (index + 0.5);

    collector.box(
      [panelSpan - 0.07, glassTop - 0.08, 0.016],
      [x, (glassTop - 0.08) / 2 + 0.09, 0],
      "glass-rail",
      { castShadow: false },
    );
  }

  collector.box([length, 0.045, 0.07], [0, height - 0.02, 0], "aluminium");

  // Runner-red line under the handrail on the inside face.
  collector.box([length * 0.96, 0.014, 0.012], [0, height - 0.075, -0.028], "red", {
    castShadow: false,
  });
}
