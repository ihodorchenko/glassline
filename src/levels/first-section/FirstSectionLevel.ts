import { KIT_DEMO_ENVIRONMENT } from "../demo/KitDemoLayout";
import type { LevelDefinition } from "../LevelTypes";
import { FIRST_SECTION_ARCHITECTURE } from "./FirstSectionArchitecture";
import { FIRST_SECTION_DECORATIONS } from "./FirstSectionCity";
import { FIRST_SECTION_LAYOUT } from "./FirstSectionLayout";

/**
 * First standalone gameplay section — composed level definition (Step 3.2B.6).
 *
 * Source of truth: `docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md` §10 Q1
 * (mode), §11.1 (content and validation), §12 item 5 (composition and DEV
 * registration), and the three authored layers:
 *
 * - collision, sections, spawn points, triggers, checkpoints — `FirstSectionLayout`;
 * - Architectural Kit placements — `FirstSectionArchitecture`;
 * - decorations and city massing — `FirstSectionCity`.
 *
 * The composition only adds gameplay-mode and visual-layer fields. Sections,
 * spawn points, triggers, checkpoints, interaction targets, surfaces, geometry,
 * and metadata are the exact authored values from `FIRST_SECTION_LAYOUT`: the
 * spread preserves their object identity, so there are no copied or
 * re-authored arrays that could drift from the collision layer.
 *
 * `mode: "prologue"` follows §10 Q1(a): a dedicated single-section mode does
 * not exist yet. The level is not the campaign Prologue; Prologue-specific
 * progression is gated by level id in `LevelCompletionPolicy`, and the
 * five-section Prologue taxonomy in `LevelValidator` is gated by the same
 * authored id.
 *
 * Registration is development-only for now (see `Application`). The menu
 * entry, the capture route (`?capture=1&level=first_section`), and the
 * integration/traversal suites are separate sub-steps.
 */
export const FIRST_SECTION_LEVEL: LevelDefinition = {
  ...FIRST_SECTION_LAYOUT,
  mode: "prologue",
  architecture: FIRST_SECTION_ARCHITECTURE,
  decorations: FIRST_SECTION_DECORATIONS,
  environment: KIT_DEMO_ENVIRONMENT,
};

export const FIRST_SECTION_LEVEL_DEFINITIONS: readonly LevelDefinition[] = [FIRST_SECTION_LEVEL];
