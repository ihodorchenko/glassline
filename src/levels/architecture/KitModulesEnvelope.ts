/**
 * Architectural Kit — building envelope modules.
 *
 * Facade bay, curtain wall, corner, roof parapet and expressed construction
 * joint. These are the modules that define how the building meets the sky, the
 * ground and itself, so their geometry carries the strongest architectural
 * hierarchy: deep reveals, expressed edges, and a light-over-dark material
 * stack (white composite frame / tinted glass / anodized metal / red accent).
 */

import { count, dimension, type KitPartCollector, rectRingShape } from "./KitGeometry";
import type {
  CornerModule,
  CurtainWallModule,
  FacadeBayModule,
  JointModule,
  ParapetModule,
} from "./KitTypes";

/** Depth of the expressed front frame of a facade bay. */
const FACADE_FRAME_DEPTH = 0.12;

export function buildFacadeBay(collector: KitPartCollector, definition: FacadeBayModule): void {
  const width = dimension(definition.width, 4.2, "facade-bay width");
  const height = dimension(definition.height, 4.2, "facade-bay height");
  const reveal = dimension(definition.revealDepth, 0.7, "facade-bay reveal depth");
  const accent = definition.accent ?? true;
  // Wide piers and a storey band make this a punched opening in a wall, not a
  // continuous glazed strip: 4.2 m bay = 0.84 m pier + 2.5 m window + 0.84 m pier.
  const borderX = Math.min(0.9, Math.max(0.32, width * 0.2));
  const borderY = Math.min(0.6, Math.max(0.28, height * 0.12));
  const openingWidth = width - borderX * 2;
  const openingHeight = height - borderY * 2;
  const halfHeight = height / 2;
  const openingCenterY = halfHeight;
  const wallDepth = 0.12;
  const glassZ = -reveal + 0.07;

  // Solid front wall field around the opening, then the deep mineral reveal
  // that carries the window depth.
  collector.extrusion(
    rectRingShape(width, height, borderX, 0.014, borderY),
    wallDepth,
    [0, halfHeight, -wallDepth / 2],
    "white",
    { bevel: 0.006 },
  );

  const revealDepth = reveal - wallDepth;

  collector.roundedBox(
    [borderX, height, revealDepth],
    [-width / 2 + borderX / 2, halfHeight, -wallDepth - revealDepth / 2],
    "reveal",
    { bevel: 0.014 },
  );
  collector.roundedBox(
    [borderX, height, revealDepth],
    [width / 2 - borderX / 2, halfHeight, -wallDepth - revealDepth / 2],
    "reveal",
    { bevel: 0.014 },
  );
  collector.roundedBox(
    [openingWidth, borderY, revealDepth],
    [0, height - borderY / 2, -wallDepth - revealDepth / 2],
    "reveal",
    { bevel: 0.014 },
  );
  collector.roundedBox(
    [openingWidth, borderY, revealDepth],
    [0, borderY / 2, -wallDepth - revealDepth / 2],
    "reveal",
    { bevel: 0.014 },
  );

  // Expressed composite surround around the punched opening, proud of the wall.
  collector.extrusion(
    rectRingShape(openingWidth + 0.3, openingHeight + 0.3, 0.15, 0.012),
    FACADE_FRAME_DEPTH,
    [0, openingCenterY, 0.04],
    "composite",
    { bevel: 0.008 },
  );

  // Glazing set deep inside the reveal.
  collector.box(
    [openingWidth - 0.09, openingHeight - 0.09, 0.04],
    [0, openingCenterY, glassZ],
    "glass-near",
  );

  // Dark anodized lining around the glass: a crisp shadow line that keeps the
  // opening legible even when direct sun reaches into the reveal.
  collector.box(
    [0.04, openingHeight - 0.05, 0.05],
    [-openingWidth / 2 + 0.02, openingCenterY, glassZ],
    "dark-metal",
  );
  collector.box(
    [0.04, openingHeight - 0.05, 0.05],
    [openingWidth / 2 - 0.02, openingCenterY, glassZ],
    "dark-metal",
  );
  collector.box([openingWidth, 0.04, 0.05], [0, height - borderY - 0.02, glassZ], "dark-metal");
  collector.box([openingWidth, 0.04, 0.05], [0, borderY + 0.02, glassZ], "dark-metal");

  // Fine central mullion: the 2.5 m pane gets a vertical split so the bay reads
  // as crafted glazing rather than a dark hole.
  collector.box([0.05, openingHeight - 0.1, 0.06], [0, openingCenterY, glassZ + 0.03], "composite");

  // Stone sill: protrudes past the wall plane and fills the bottom of the
  // reveal, with a dark drip groove under the front edge.
  collector.roundedBox(
    [openingWidth + 0.32, 0.09, reveal + 0.16],
    [0, borderY - 0.045, -reveal / 2 + 0.08],
    "white",
    { bevel: 0.01 },
  );
  collector.box(
    [openingWidth + 0.32, 0.014, 0.03],
    [0, borderY - 0.087, reveal / 2 - 0.09],
    "dark-metal",
  );

  if (accent) {
    // Runner red reads as navigation, not decoration: one thin vertical line
    // deep inside the reveal, where only a player close to the facade sees it.
    collector.box(
      [0.014, openingHeight * 0.62, 0.09],
      [-openingWidth / 2 + 0.01, borderY + openingHeight * 0.4, glassZ + 0.11],
      "red",
    );
  }
}

export function buildCurtainWall(collector: KitPartCollector, definition: CurtainWallModule): void {
  const width = dimension(definition.width, 6, "curtain-wall width");
  const height = dimension(definition.height, 4.2, "curtain-wall height");
  const depth = dimension(definition.depth, 0.34, "curtain-wall depth");
  const columns = count(definition.columns, 3, "curtain-wall columns");
  const rows = count(definition.rows, 2, "curtain-wall rows");
  const spandrel = definition.spandrel ?? false;
  const halfWidth = width / 2;
  const border = 0.1;
  const spandrelHeight = spandrel ? 0.48 : 0;
  const usableWidth = width - border * 2;
  const usableHeight = height - border * 2 - spandrelHeight;
  const panelWidth = usableWidth / columns;
  const panelHeight = usableHeight / rows;
  const baseY = border + spandrelHeight;

  // Dark cavity behind the glazing: gaps between panes read as depth instead of
  // showing the backing mass through the facade.
  collector.box([width - 0.12, height - 0.12, 0.025], [0, height / 2, -0.14], "glass-far");

  // Perimeter frame: head, sill and jambs in anodized aluminium.
  collector.extrusion(
    rectRingShape(width, height, border, 0.008),
    depth * 0.7,
    [0, height / 2, 0],
    "aluminium",
    { bevel: 0.006 },
  );

  // Glazing grid. Alternating pane setbacks catch different sky reflections
  // and keep a large flat facade from reading as one sheet of glass.
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = -halfWidth + border + panelWidth * (column + 0.5);
      const y = baseY + panelHeight * (row + 0.5);
      const paneZ = (column + row) % 2 === 0 ? 0.055 : 0.02;

      collector.box([panelWidth - 0.055, panelHeight - 0.055, 0.035], [x, y, paneZ], "glass-near");
    }
  }

  // Vertical mullions and horizontal transoms, proud of the glass line.
  for (let column = 1; column < columns; column += 1) {
    collector.box(
      [0.07, usableHeight, 0.18],
      [-halfWidth + border + panelWidth * column, baseY + usableHeight / 2, 0.07],
      "aluminium",
    );
  }

  for (let row = 1; row < rows; row += 1) {
    collector.box([usableWidth, 0.06, 0.16], [0, baseY + panelHeight * row, 0.065], "aluminium");
  }

  if (spandrel) {
    collector.box(
      [usableWidth, spandrelHeight - 0.06, 0.06],
      [0, border + spandrelHeight / 2, 0.03],
      "composite",
    );
    collector.box(
      [usableWidth, 0.025, 0.025],
      [0, border + spandrelHeight - 0.005, 0.07],
      "dark-metal",
    );
  }
}

export function buildCorner(collector: KitPartCollector, definition: CornerModule): void {
  const width = dimension(definition.width, 4.2, "corner width");
  const depth = dimension(definition.depth, 4.2, "corner depth");
  const height = dimension(definition.height, 9, "corner height");
  const accent = definition.accent ?? true;
  const pier = Math.min(0.66, Math.min(width, depth) * 0.18);
  const upperBand = height - 0.55;
  const glassBottom = 1.4;
  const glassHeight = Math.max(1.2, upperBand - 0.7 - glassBottom);

  // Corner pier: the one heavy concrete mass, expressed as a chamfered volume.
  collector.roundedBox([pier, height, pier], [-pier / 2, height / 2, -pier / 2], "concrete", {
    bevel: 0.03,
  });

  // Base plinths run along both wings and turn the corner.
  collector.roundedBox([0.42, 0.5, depth], [-0.21, 0.25, -depth / 2], "concrete", {
    bevel: 0.02,
  });
  collector.roundedBox([width, 0.5, 0.42], [-width / 2, 0.25, -0.21], "concrete", {
    bevel: 0.02,
  });

  // Wing A: facade plane x = 0 faces +X, running along -Z.
  collector.box([0.3, 0.9, depth - 0.1], [-0.15, 0.5 + 0.45, -depth / 2], "composite");
  collector.box([0.3, 0.9, depth - 0.1], [-0.15, upperBand - 0.45, -depth / 2], "composite");
  collector.box(
    [0.06, glassHeight, depth - 1.2],
    [-0.02, glassBottom + glassHeight / 2, -depth / 2],
    "glass-near",
  );
  collector.box(
    [0.1, glassHeight, 0.08],
    [-0.02, glassBottom + glassHeight / 2, -0.6],
    "aluminium",
  );
  collector.box(
    [0.1, glassHeight, 0.08],
    [-0.02, glassBottom + glassHeight / 2, -depth + 0.6],
    "aluminium",
  );
  collector.box(
    [0.1, 0.08, depth - 1.2],
    [-0.02, glassBottom + glassHeight / 2, -depth / 2],
    "aluminium",
  );

  // Wing B: facade plane z = 0 faces +Z, running along -X.
  collector.box([width - 0.1, 0.9, 0.3], [-width / 2, 0.5 + 0.45, -0.15], "composite");
  collector.box([width - 0.1, 0.9, 0.3], [-width / 2, upperBand - 0.45, -0.15], "composite");
  collector.box(
    [width - 1.2, glassHeight, 0.06],
    [-width / 2, glassBottom + glassHeight / 2, -0.02],
    "glass-near",
  );
  collector.box(
    [0.08, glassHeight, 0.1],
    [-0.6, glassBottom + glassHeight / 2, -0.02],
    "aluminium",
  );
  collector.box(
    [0.08, glassHeight, 0.1],
    [-width + 0.6, glassBottom + glassHeight / 2, -0.02],
    "aluminium",
  );
  collector.box(
    [width - 1.2, 0.08, 0.1],
    [-width / 2, glassBottom + glassHeight / 2, -0.02],
    "aluminium",
  );

  // Storey bands wrap the corner pier and continue as transoms across both
  // glass returns, tying the corner to the curtain-wall floor rhythm.
  for (const step of [1, 2]) {
    const bandY = (height * step) / 3;

    collector.box([pier + 0.04, 0.1, pier + 0.04], [-pier / 2, bandY, -pier / 2], "composite");
    collector.box([0.1, 0.08, depth - 1.2], [-0.02, bandY, -depth / 2], "aluminium");
    collector.box([width - 1.2, 0.08, 0.1], [-width / 2, bandY, -0.02], "aluminium");
  }

  // Roof caps with an exposed metal drip edge: the corner silhouette.
  collector.roundedBox([0.56, 0.2, depth + 0.2], [-0.2, height - 0.1, -depth / 2], "concrete", {
    bevel: 0.02,
  });
  collector.roundedBox([width + 0.2, 0.2, 0.56], [-width / 2, height - 0.1, -0.2], "concrete", {
    bevel: 0.02,
  });
  collector.box([0.04, 0.04, depth + 0.16], [0.055, height - 0.22, -depth / 2], "aluminium");
  collector.box([width + 0.16, 0.04, 0.04], [-width / 2, height - 0.22, 0.055], "aluminium");

  // Expressed corner joint: a dark anodized reveal with a red navigation line.
  collector.box([0.022, height - 1.0, 0.12], [0.012, height / 2, -0.1], "dark-metal");
  collector.box([0.12, height - 1.0, 0.022], [-0.1, height / 2, 0.012], "dark-metal");

  if (accent) {
    collector.box([0.012, height - 1.0, 0.055], [0.026, height / 2, -0.065], "red");
  }
}

export function buildParapet(collector: KitPartCollector, definition: ParapetModule): void {
  const length = dimension(definition.length, 6, "parapet length");
  const height = dimension(definition.height, 1.1, "parapet height");
  const accent = definition.accent ?? true;

  // Concrete upstand: a simple twisted prism is enough; the coping and shadow
  // gap carry the detail.
  collector.profileAlongX(
    [
      [-0.16, 0],
      [0.16, 0],
      [0.16, height - 0.18],
      [-0.16, height - 0.18],
    ],
    length,
    [0, 0, 0],
    "concrete",
  );

  // Coping with a slight overhang and beveled top edges.
  collector.roundedBox([length + 0.04, 0.17, 0.46], [0, height - 0.09, 0], "white", {
    bevel: 0.022,
  });

  // Composite inner-face panel with a fine shadow gap under the coping.
  collector.box([length - 0.08, 0.34, 0.025], [0, 0.5, -0.172], "composite");
  collector.box([length, 0.024, 0.02], [0, height - 0.19, -0.17], "dark-metal");

  if (accent) {
    collector.box([length * 0.94, 0.032, 0.012], [0, height - 0.27, -0.187], "red");
  }
}

export function buildJoint(collector: KitPartCollector, definition: JointModule): void {
  const width = dimension(definition.width, 0.9, "joint width");
  const height = dimension(definition.height, 3.6, "joint height");
  const depth = dimension(definition.depth, 0.5, "joint depth");
  const halfWidth = width / 2;

  // Two interlocking anodized extrusions flanking a compressible gasket.
  collector.box([0.15, height, depth * 0.62], [-0.115, height / 2, 0.04], "aluminium");
  collector.box([0.15, height, depth * 0.62], [0.115, height / 2, 0.04], "aluminium");
  collector.box([0.09, height, depth * 0.5], [0, height / 2, -0.02], "rubber");
  collector.box([0.32, height, 0.03], [0, height / 2, 0.055], "dark-metal");

  // Cover plates express the joint as a designed construction line, not a gap.
  collector.box([width * 0.62, 0.055, depth * 0.7], [0, height * 0.16, 0.12], "aluminium");
  collector.box([width * 0.62, 0.055, depth * 0.7], [0, height * 0.84, 0.12], "aluminium");

  // Red reveal strip: the navigation language uses the joint as an accent line.
  collector.box([0.016, height - 0.16, 0.02], [0, height / 2, 0.075], "red");

  // Steel splice plates every storey give the joint a believable structural
  // logic without adding a bolt for every plate.
  collector.box([width + 0.14, 0.16, 0.028], [0, height * 0.5, 0.135], "dark-metal");
  collector.box([0.02, height, 0.02], [-halfWidth, height / 2, 0.02], "dark-metal");
}
