import { DEFAULT_LANGUAGE_ID, SUPPORTED_LANGUAGE_IDS } from "../localization/Language";
import type {
  SettingApplyPolicy,
  SettingCategory,
  SettingDefinition,
  SettingValue,
} from "./SettingsTypes";

const DEFAULT_APPLY_POLICY: SettingApplyPolicy = "immediate";

function booleanSetting(
  id: string,
  category: SettingCategory,
  defaultValue: boolean,
  applyPolicy: SettingApplyPolicy = DEFAULT_APPLY_POLICY,
): SettingDefinition {
  return { id, category, type: "boolean", defaultValue, applyPolicy };
}

function numberSetting(
  id: string,
  category: SettingCategory,
  defaultValue: number,
  minimum: number,
  maximum: number,
  applyPolicy: SettingApplyPolicy = DEFAULT_APPLY_POLICY,
): SettingDefinition {
  return {
    id,
    category,
    type: "number",
    defaultValue,
    applyPolicy,
    constraints: { minimum, maximum },
  };
}

function enumSetting(
  id: string,
  category: SettingCategory,
  defaultValue: string,
  allowedValues: readonly SettingValue[],
  applyPolicy: SettingApplyPolicy = DEFAULT_APPLY_POLICY,
): SettingDefinition {
  return {
    id,
    category,
    type: "enum",
    defaultValue,
    applyPolicy,
    constraints: { allowedValues },
  };
}

function stringSetting(
  id: string,
  category: SettingCategory,
  defaultValue: string,
  constraints: { readonly minimumLength?: number; readonly maximumLength?: number } = {},
  applyPolicy: SettingApplyPolicy = DEFAULT_APPLY_POLICY,
): SettingDefinition {
  return {
    id,
    category,
    type: "string",
    defaultValue,
    applyPolicy,
    ...(Object.keys(constraints).length > 0 ? { constraints } : {}),
  };
}

/**
 * Canonical initial settings registry.
 * IDs and defaults follow `docs/25_SETTINGS_SYSTEM_SPEC.md` §7.
 */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  // 7.1 Audio
  numberSetting("audio.master_volume", "audio", 1, 0, 1),
  numberSetting("audio.music_volume", "audio", 0.8, 0, 1),
  numberSetting("audio.sfx_volume", "audio", 1, 0, 1),
  numberSetting("audio.ui_volume", "audio", 0.8, 0, 1),
  booleanSetting("audio.muted", "audio", false),

  // 7.2 Controls
  numberSetting("controls.mouse_sensitivity", "controls", 1, 0.1, 5),
  booleanSetting("controls.invert_mouse_y", "controls", false),
  numberSetting("controls.gamepad_sensitivity", "controls", 1, 0.1, 5),
  booleanSetting("controls.invert_gamepad_y", "controls", false),
  numberSetting("controls.gamepad_dead_zone", "controls", 0.15, 0, 0.95),
  numberSetting("controls.gamepad_look_dead_zone", "controls", 0.1, 0, 0.95),

  // 7.3 Camera
  numberSetting("camera.field_of_view", "camera", 75, 60, 100),
  numberSetting("camera.bob_intensity", "camera", 1, 0, 1.5),
  numberSetting("camera.motion_intensity", "camera", 1, 0, 1.5),

  // 7.4 Display
  booleanSetting("display.fullscreen", "display", false, "requires_confirmation"),
  stringSetting(
    "display.resolution",
    "display",
    "auto",
    { minimumLength: 1, maximumLength: 32 },
    "requires_confirmation",
  ),
  enumSetting(
    "display.quality",
    "display",
    "medium",
    ["low", "medium", "high"],
    "requires_confirmation",
  ),
  booleanSetting("display.vsync", "display", true),

  // 7.5 HUD
  booleanSetting("hud.enabled", "hud", true),
  booleanSetting("hud.show_speed_indicator", "hud", true),
  booleanSetting("hud.show_speedrun_timer", "hud", true),
  booleanSetting("hud.show_section_progress", "hud", true),
  booleanSetting("hud.show_training_objectives", "hud", true),
  booleanSetting("hud.show_training_hints", "hud", true),
  booleanSetting("hud.show_interaction_prompts", "hud", true),
  numberSetting("hud.ui_scale", "hud", 1, 0.8, 1.4),

  // 7.6 Accessibility
  booleanSetting("accessibility.reduced_motion", "accessibility", false),
  booleanSetting("accessibility.high_contrast", "accessibility", false),
  booleanSetting("accessibility.color_independent_status", "accessibility", true),
  booleanSetting("accessibility.large_text", "accessibility", false),

  // 7.7 Gameplay
  booleanSetting("gameplay.show_tutorial_hints", "gameplay", true),
  booleanSetting("gameplay.contextual_assistance", "gameplay", true),
  enumSetting("gameplay.training_assistance", "gameplay", "standard", ["off", "basic", "standard"]),
  booleanSetting("gameplay.show_checkpoint_feedback", "gameplay", true),

  // 7.8 Localization
  enumSetting("general.language", "general", DEFAULT_LANGUAGE_ID, [...SUPPORTED_LANGUAGE_IDS]),
];

export const SETTINGS_BY_ID: ReadonlyMap<string, SettingDefinition> = new Map(
  SETTING_DEFINITIONS.map((definition) => [definition.id, definition]),
);
