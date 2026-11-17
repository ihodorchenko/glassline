import type { SettingDefinition, SettingsValues, SettingValue } from "./SettingsTypes";

export type SettingsIssueCode =
  | "UNKNOWN_SETTING"
  | "INVALID_TYPE"
  | "OUT_OF_RANGE"
  | "INVALID_ENUM"
  | "INVALID_LENGTH";

export interface SettingsValidationIssue {
  readonly settingId: string;
  readonly code: SettingsIssueCode;
  readonly message: string;
}

export interface SettingsValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SettingsValidationIssue[];
}

function issue(
  settingId: string,
  code: SettingsIssueCode,
  message: string,
): SettingsValidationIssue {
  return { settingId, code, message };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validates a single candidate value against its definition.
 * Returns `null` when the value is acceptable.
 */
export function validateSettingValue(
  definition: SettingDefinition,
  value: unknown,
): SettingsValidationIssue | null {
  const constraints = definition.constraints;

  switch (definition.type) {
    case "boolean":
      return typeof value === "boolean"
        ? null
        : issue(definition.id, "INVALID_TYPE", "Expected a boolean value.");

    case "number":
    case "integer": {
      if (!isFiniteNumber(value)) {
        return issue(definition.id, "INVALID_TYPE", "Expected a finite number.");
      }

      if (definition.type === "integer" && !Number.isInteger(value)) {
        return issue(definition.id, "INVALID_TYPE", "Expected an integer.");
      }

      if (constraints?.minimum !== undefined && value < constraints.minimum) {
        return issue(
          definition.id,
          "OUT_OF_RANGE",
          `Value ${value} is below the minimum ${constraints.minimum}.`,
        );
      }

      if (constraints?.maximum !== undefined && value > constraints.maximum) {
        return issue(
          definition.id,
          "OUT_OF_RANGE",
          `Value ${value} is above the maximum ${constraints.maximum}.`,
        );
      }

      return null;
    }

    case "string": {
      if (typeof value !== "string") {
        return issue(definition.id, "INVALID_TYPE", "Expected a string value.");
      }

      if (constraints?.minimumLength !== undefined && value.length < constraints.minimumLength) {
        return issue(
          definition.id,
          "INVALID_LENGTH",
          `Value is shorter than ${constraints.minimumLength} characters.`,
        );
      }

      if (constraints?.maximumLength !== undefined && value.length > constraints.maximumLength) {
        return issue(
          definition.id,
          "INVALID_LENGTH",
          `Value is longer than ${constraints.maximumLength} characters.`,
        );
      }

      return null;
    }

    case "enum": {
      if (typeof value !== "string") {
        return issue(definition.id, "INVALID_TYPE", "Expected an enum string value.");
      }

      const allowedValues = constraints?.allowedValues ?? [];

      if (!allowedValues.includes(value)) {
        return issue(
          definition.id,
          "INVALID_ENUM",
          `Value "${value}" is not one of: ${allowedValues.join(", ")}.`,
        );
      }

      return null;
    }
  }
}

export interface MergedSettingsValues {
  readonly values: SettingsValues;
  readonly issues: readonly SettingsValidationIssue[];
}

/**
 * Builds a complete settings value set: known defaults plus valid persisted
 * values. Invalid or unknown persisted entries are reported and ignored rather
 * than silently persisted back.
 */
export function buildSettingsValues(
  definitions: readonly SettingDefinition[],
  persisted: Readonly<Record<string, unknown>>,
): MergedSettingsValues {
  const values: Record<string, SettingValue> = {};
  const issues: SettingsValidationIssue[] = [];

  for (const definition of definitions) {
    values[definition.id] = definition.defaultValue;
  }

  for (const [settingId, persistedValue] of Object.entries(persisted)) {
    const definition = definitions.find((candidate) => candidate.id === settingId);

    if (!definition) {
      issues.push(
        issue(settingId, "UNKNOWN_SETTING", "Unknown setting ID in persisted data; ignored."),
      );
      continue;
    }

    const validationIssue = validateSettingValue(definition, persistedValue);

    if (validationIssue) {
      issues.push(validationIssue);
      continue;
    }

    values[settingId] = persistedValue as SettingValue;
  }

  return { values, issues };
}

export function validateSettingChanges(
  definitions: ReadonlyMap<string, SettingDefinition>,
  changes: Readonly<Record<string, unknown>>,
): SettingsValidationResult {
  const issues: SettingsValidationIssue[] = [];

  for (const [settingId, value] of Object.entries(changes)) {
    const definition = definitions.get(settingId);

    if (!definition) {
      issues.push(issue(settingId, "UNKNOWN_SETTING", `Unknown setting ID "${settingId}".`));
      continue;
    }

    const validationIssue = validateSettingValue(definition, value);

    if (validationIssue) {
      issues.push(validationIssue);
    }
  }

  return { valid: issues.length === 0, issues };
}
