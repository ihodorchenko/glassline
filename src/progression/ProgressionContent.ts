import type {
  ProgressionContentDefinition,
  ProgressionMilestoneDefinition,
} from "./ProgressionTypes";

function exerciseContent(
  id: string,
  titleKey: string,
  prerequisiteExerciseId: string | null,
): ProgressionContentDefinition {
  return {
    id,
    type: "training_exercise",
    titleKey,
    initiallyUnlocked: prerequisiteExerciseId === null,
    unlockRule: {
      id: `unlock_${id}`,
      operator: "all",
      conditions:
        prerequisiteExerciseId === null
          ? []
          : [{ type: "exercise_completed", exerciseId: prerequisiteExerciseId }],
    },
  };
}

/** Initial progression content (`docs/22` §6.3). Prologue stays accessible. */
export const PROGRESSION_CONTENT: readonly ProgressionContentDefinition[] = [
  exerciseContent("training_movement", "content.training_movement", null),
  exerciseContent("training_running", "content.training_running", "ex_01_movement_basics"),
  exerciseContent("training_jumping", "content.training_jumping", "ex_02_running"),
  exerciseContent("training_sliding", "content.training_sliding", "ex_03_jumping"),
  exerciseContent("training_vaulting", "content.training_vaulting", "ex_04_vaulting"),
  exerciseContent("training_wall_running", "content.training_wall_running", "ex_05_sliding"),
  exerciseContent("training_wall_jumping", "content.training_wall_jumping", "ex_06_wall_running"),
  exerciseContent("training_landing", "content.training_landing", "ex_07_wall_jumping"),
  exerciseContent("training_interaction", "content.training_interaction", "ex_08_landing_momentum"),
  exerciseContent(
    "training_combined_traversal",
    "content.training_combined_traversal",
    "ex_09_interaction",
  ),
  {
    id: "prologue",
    type: "level",
    titleKey: "content.prologue",
    initiallyUnlocked: true,
    unlockRule: { id: "unlock_prologue", operator: "all", conditions: [] },
  },
  {
    id: "ranked_prologue",
    type: "game_mode",
    titleKey: "content.ranked_prologue",
    initiallyUnlocked: true,
    unlockRule: { id: "unlock_ranked_prologue", operator: "all", conditions: [] },
  },
];

export const PROGRESSION_MILESTONES: readonly ProgressionMilestoneDefinition[] = [
  {
    id: "first_training_exercise",
    titleKey: "milestones.first_training_exercise",
    operator: "all",
    conditions: [{ type: "count_threshold", source: "training_exercises", minimum: 1 }],
  },
  {
    id: "all_training_exercises",
    titleKey: "milestones.all_training_exercises",
    operator: "all",
    conditions: [{ type: "count_threshold", source: "training_exercises", minimum: 10 }],
  },
  {
    id: "first_prologue_completion",
    titleKey: "milestones.first_prologue_completion",
    operator: "all",
    conditions: [{ type: "prologue_completed" }],
  },
  {
    id: "tutorial_graduate",
    titleKey: "milestones.tutorial_graduate",
    operator: "all",
    conditions: [{ type: "achievement_unlocked", achievementId: "tutorial_graduate" }],
  },
  {
    id: "gold_standard_route",
    titleKey: "milestones.gold_standard_route",
    operator: "all",
    conditions: [{ type: "achievement_unlocked", achievementId: "gold_standard" }],
  },
  {
    id: "checkpoint_master",
    titleKey: "milestones.checkpoint_master",
    operator: "all",
    conditions: [{ type: "achievement_unlocked", achievementId: "checkpoint_pro" }],
  },
];
