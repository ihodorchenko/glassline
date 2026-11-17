import type { StatisticDefinition } from "./StatisticsTypes";

function statistic(
  id: string,
  category: StatisticDefinition["category"],
  aggregation: StatisticDefinition["aggregation"],
  source: string,
  eventTypes: readonly string[],
  options: {
    readonly unit?: StatisticDefinition["unit"];
    readonly valueType?: StatisticDefinition["valueType"];
    readonly persistent?: boolean;
    readonly visible?: boolean;
  } = {},
): StatisticDefinition {
  return {
    id,
    category,
    valueType: options.valueType ?? "integer",
    aggregation,
    source,
    eventTypes,
    ...(options.unit === undefined ? {} : { unit: options.unit }),
    persistent: options.persistent ?? true,
    visible: options.visible ?? true,
  };
}

/**
 * Initial statistic catalog (`docs/30` §7).
 *
 * Session-level values are always tracked; persistent values also aggregate into
 * lifetime and mode scopes.
 */
export const STATISTIC_DEFINITIONS: readonly StatisticDefinition[] = [
  statistic("general.total_distance", "general", "sum", "movement", ["movement.distance"], {
    unit: "meters",
    valueType: "float",
  }),
  statistic("general.total_jumps", "movement", "sum", "movement", ["movement.jump"]),
  statistic("general.total_vaults", "movement", "sum", "movement", ["movement.vault"]),
  statistic("general.total_slides", "movement", "sum", "movement", ["movement.slide"]),
  statistic("general.total_wall_runs", "movement", "sum", "movement", ["movement.wall_run"]),
  statistic("general.total_wall_jumps", "movement", "sum", "movement", ["movement.wall_jump"]),
  statistic("general.total_landings", "movement", "sum", "movement", ["movement.landing"]),
  statistic("general.total_falls", "movement", "sum", "movement", ["movement.fall"]),
  statistic(
    "movement.maximum_speed",
    "movement",
    "maximum",
    "movement",
    ["movement.maximum_speed"],
    { unit: "meters-per-second", valueType: "float" },
  ),
  statistic("training.total_attempts", "training", "sum", "training", ["training.attempt"]),
  statistic("training.completed_exercises", "training", "sum", "training", [
    "training.exercise_completed",
  ]),
  statistic("training.completed_sessions", "training", "sum", "training", [
    "training.session_completed",
  ]),
  statistic("speedrun.total_attempts", "speedrun", "sum", "speedrun", ["speedrun.attempt"]),
  statistic("speedrun.completed_runs", "speedrun", "sum", "speedrun", ["speedrun.completed"]),
  statistic("speedrun.invalid_runs", "speedrun", "sum", "speedrun", ["speedrun.invalid"]),
  statistic("speedrun.medals", "speedrun", "count", "speedrun", ["speedrun.medal"]),
  statistic("interaction.total_interactions", "interaction", "sum", "interaction", [
    "interaction.completed",
  ]),
  statistic("exploration.checkpoints_activated", "exploration", "sum", "checkpoint", [
    "checkpoint.activated",
  ]),
  statistic("exploration.sections_entered", "exploration", "sum", "level", ["section.entered"]),
  statistic("exploration.levels_completed", "exploration", "sum", "level", ["level.completed"]),
  statistic("progression.completed_exercises", "progression", "sum", "training", [
    "training.exercise_completed",
  ]),
  statistic("progression.completed_levels", "progression", "sum", "level", ["level.completed"]),
];
