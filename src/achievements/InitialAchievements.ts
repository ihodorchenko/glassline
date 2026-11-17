import type { AchievementDefinition } from "./AchievementTypes";

function counter(
  id: string,
  source: string,
  eventType: string,
  targetValue: number,
): AchievementDefinition["groups"][number]["conditions"][number] {
  return { id, type: "counter", source, eventType, targetValue };
}

function event(
  id: string,
  source: string,
  eventType: string,
): AchievementDefinition["groups"][number]["conditions"][number] {
  return { id, type: "event", source, eventType };
}

/**
 * Initial achievement set (`docs/29` §10), limited to conditions supported by
 * the implemented authoritative event contracts.
 */
export const INITIAL_ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "first_steps",
    category: "training",
    titleKey: "achievements.first_steps.title",
    descriptionKey: "achievements.first_steps.description",
    iconId: "training-first",
    rarity: "common",
    hidden: false,
    enabled: true,
    prerequisites: [],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [event("c1", "training", "training.exercise_completed")],
      },
    ],
  },
  {
    id: "learning_the_basics",
    category: "training",
    titleKey: "achievements.learning_the_basics.title",
    descriptionKey: "achievements.learning_the_basics.description",
    iconId: "training-basics",
    rarity: "common",
    hidden: false,
    enabled: true,
    prerequisites: [],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [counter("c1", "training", "training.exercise_completed", 3)],
      },
    ],
  },
  {
    id: "parkour_foundations",
    category: "training",
    titleKey: "achievements.parkour_foundations.title",
    descriptionKey: "achievements.parkour_foundations.description",
    iconId: "training-all",
    rarity: "rare",
    hidden: false,
    enabled: true,
    prerequisites: ["first_steps"],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [counter("c1", "training", "training.exercise_completed", 10)],
      },
    ],
  },
  {
    id: "first_run",
    category: "speedrun",
    titleKey: "achievements.first_run.title",
    descriptionKey: "achievements.first_run.description",
    iconId: "speedrun-first",
    rarity: "common",
    hidden: false,
    enabled: true,
    prerequisites: [],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [event("c1", "speedrun", "speedrun.completed")],
      },
    ],
  },
  {
    id: "no_hesitation",
    category: "speedrun",
    titleKey: "achievements.no_hesitation.title",
    descriptionKey: "achievements.no_hesitation.description",
    iconId: "speedrun-clean",
    rarity: "uncommon",
    hidden: false,
    enabled: true,
    prerequisites: ["first_run"],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [event("c1", "speedrun", "speedrun.clean")],
      },
    ],
  },
  {
    id: "speed_is_everything",
    category: "speedrun",
    titleKey: "achievements.speed_is_everything.title",
    descriptionKey: "achievements.speed_is_everything.description",
    iconId: "speedrun-silver",
    rarity: "rare",
    hidden: false,
    enabled: true,
    prerequisites: ["first_run"],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [
          {
            id: "c1",
            type: "threshold",
            source: "speedrun",
            eventType: "speedrun.medal",
            targetValue: 2,
          },
        ],
      },
    ],
  },
  {
    id: "gold_standard",
    category: "speedrun",
    titleKey: "achievements.gold_standard.title",
    descriptionKey: "achievements.gold_standard.description",
    iconId: "speedrun-gold",
    rarity: "exceptional",
    hidden: false,
    enabled: true,
    prerequisites: ["speed_is_everything"],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [
          {
            id: "c1",
            type: "threshold",
            source: "speedrun",
            eventType: "speedrun.medal",
            targetValue: 3,
          },
        ],
      },
    ],
  },
  {
    id: "checkpoint_pro",
    category: "speedrun",
    titleKey: "achievements.checkpoint_pro.title",
    descriptionKey: "achievements.checkpoint_pro.description",
    iconId: "speedrun-checkpoints",
    rarity: "uncommon",
    hidden: false,
    enabled: true,
    prerequisites: ["first_run"],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [event("c1", "checkpoint", "checkpoint.prologue_all")],
      },
    ],
  },
  {
    id: "master_of_movement",
    category: "movement",
    titleKey: "achievements.master_of_movement.title",
    descriptionKey: "achievements.master_of_movement.description",
    iconId: "movement-core",
    rarity: "rare",
    hidden: false,
    enabled: true,
    prerequisites: [],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [
          counter("c1", "movement", "movement.vault", 1),
          counter("c2", "movement", "movement.slide", 1),
          counter("c3", "movement", "movement.wall_run", 1),
          counter("c4", "movement", "movement.wall_jump", 1),
        ],
      },
    ],
  },
  {
    id: "interaction_complete",
    category: "interaction",
    titleKey: "achievements.interaction_complete.title",
    descriptionKey: "achievements.interaction_complete.description",
    iconId: "interaction-first",
    rarity: "common",
    hidden: false,
    enabled: true,
    prerequisites: [],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [event("c1", "interaction", "interaction.completed")],
      },
    ],
  },
  {
    id: "tutorial_graduate",
    category: "progression",
    titleKey: "achievements.tutorial_graduate.title",
    descriptionKey: "achievements.tutorial_graduate.description",
    iconId: "tutorial-graduate",
    rarity: "uncommon",
    hidden: false,
    enabled: true,
    prerequisites: ["first_steps"],
    groups: [
      {
        id: "g1",
        operator: "all",
        conditions: [event("c1", "tutorial", "tutorial.completed")],
      },
    ],
  },
];
