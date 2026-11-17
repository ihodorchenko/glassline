/**
 * Settings System types.
 * See `docs/25_SETTINGS_SYSTEM_SPEC.md` §5.
 */

export type SettingCategory =
  | "general"
  | "audio"
  | "controls"
  | "camera"
  | "display"
  | "hud"
  | "accessibility"
  | "gameplay";

export type SettingType = "boolean" | "number" | "integer" | "string" | "enum";

export type SettingValue = boolean | number | string;

export type SettingApplyPolicy =
  | "immediate"
  | "preview"
  | "on_commit"
  | "requires_confirmation"
  | "requires_restart";

export interface SettingConstraints {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly allowedValues?: readonly SettingValue[];
  readonly minimumLength?: number;
  readonly maximumLength?: number;
}

export interface SettingDefinition {
  readonly id: string;
  readonly category: SettingCategory;
  readonly type: SettingType;
  readonly defaultValue: SettingValue;
  readonly applyPolicy: SettingApplyPolicy;
  readonly constraints?: SettingConstraints;
}

export type SettingsValues = Readonly<Record<string, SettingValue>>;

export interface SettingsSnapshot {
  readonly revision: number;
  readonly values: SettingsValues;
}

export function readNumberValue(
  values: SettingsValues,
  settingId: string,
  fallback: number,
): number {
  const value = values[settingId];

  return typeof value === "number" ? value : fallback;
}

export function readBooleanValue(
  values: SettingsValues,
  settingId: string,
  fallback: boolean,
): boolean {
  const value = values[settingId];

  return typeof value === "boolean" ? value : fallback;
}

export function readStringValue(
  values: SettingsValues,
  settingId: string,
  fallback: string,
): string {
  const value = values[settingId];

  return typeof value === "string" ? value : fallback;
}
