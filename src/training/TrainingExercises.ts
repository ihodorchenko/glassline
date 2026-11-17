import type { TrainingExerciseDefinition } from "./TrainingTypes";

const BODY_Y = 0.93;

/**
 * Initial ten-exercise Training set (`docs/21` §8).
 *
 * Objectives are authored against the temporary training_test arena. Final
 * Training environments may re-author positions without changing the Training
 * System contract.
 */
export const TRAINING_EXERCISES: readonly TrainingExerciseDefinition[] = [
  {
    id: "ex_01_movement_basics",
    title: "Basic Movement",
    description: "Move continuously and reach the first rooftop marker.",
    mechanic: "movement",
    estimatedDurationSeconds: 15,
    objectives: [
      {
        id: "move",
        description: "Move at walking speed or faster for 0.5 seconds.",
        type: "maintain_speed",
        required: true,
        targetSpeed: 1.5,
        targetDurationSeconds: 0.5,
      },
      {
        id: "reach_rooftop",
        description: "Reach the rooftop checkpoint marker.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: 3 },
        radius: 2,
      },
    ],
  },
  {
    id: "ex_02_running",
    title: "Running",
    description: "Build running speed and approach the vault obstacle.",
    mechanic: "running",
    estimatedDurationSeconds: 15,
    objectives: [
      {
        id: "run_speed",
        description: "Maintain running speed for 0.8 seconds.",
        type: "maintain_speed",
        required: true,
        targetSpeed: 5,
        targetDurationSeconds: 0.8,
      },
      {
        id: "reach_approach",
        description: "Reach the vault approach zone.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: 0 },
        radius: 2,
      },
    ],
  },
  {
    id: "ex_03_jumping",
    title: "Basic Jump",
    description: "Jump twice and hold position before the vault.",
    mechanic: "jumping",
    estimatedDurationSeconds: 15,
    objectives: [
      {
        id: "jump_count",
        description: "Perform two jumps.",
        type: "perform_action_count",
        required: true,
        action: "jump",
        targetCount: 2,
      },
      {
        id: "stay_ready",
        description: "Return to the take-off marker.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -0.2 },
        radius: 1.2,
      },
    ],
  },
  {
    id: "ex_04_vaulting",
    title: "Basic Vault",
    description: "Vault over the white obstacle and land beyond it.",
    mechanic: "vaulting",
    estimatedDurationSeconds: 20,
    objectives: [
      {
        id: "vault",
        description: "Execute a vault.",
        type: "perform_action",
        required: true,
        action: "vault_started",
      },
      {
        id: "reach_landing",
        description: "Reach the landing area beyond the obstacle.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -3 },
        radius: 2,
      },
    ],
  },
  {
    id: "ex_05_sliding",
    title: "Slide",
    description: "Slide under the low ceiling and reach the exit.",
    mechanic: "sliding",
    estimatedDurationSeconds: 25,
    objectives: [
      {
        id: "slide",
        description: "Initiate a slide.",
        type: "perform_action",
        required: true,
        action: "slide_started",
      },
      {
        id: "reach_exit",
        description: "Reach the tunnel exit.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -10 },
        radius: 2,
      },
    ],
  },
  {
    id: "ex_06_wall_running",
    title: "Wall Run",
    description: "Wall run through the corridor and reach the far platform.",
    mechanic: "wall_running",
    estimatedDurationSeconds: 30,
    objectives: [
      {
        id: "wallrun",
        description: "Start a wall run.",
        type: "perform_action",
        required: true,
        action: "wallrun_started",
      },
      {
        id: "reach_corridor_end",
        description: "Reach the corridor exit.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -14 },
        radius: 2.5,
      },
    ],
  },
  {
    id: "ex_07_wall_jumping",
    title: "Wall Jump",
    description: "Wall jump away from the wall and reach the final platform.",
    mechanic: "wall_jumping",
    estimatedDurationSeconds: 30,
    objectives: [
      {
        id: "walljump",
        description: "Perform a wall jump.",
        type: "perform_action",
        required: true,
        action: "walljumped",
      },
      {
        id: "reach_final",
        description: "Reach the final platform.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -16.5 },
        radius: 2,
      },
    ],
  },
  {
    id: "ex_08_landing_momentum",
    title: "Controlled Landing",
    description: "Land twice while keeping momentum toward the finish area.",
    mechanic: "landing",
    estimatedDurationSeconds: 25,
    objectives: [
      {
        id: "landings",
        description: "Register two landings.",
        type: "perform_action_count",
        required: true,
        action: "landed",
        targetCount: 2,
      },
      {
        id: "momentum",
        description: "Maintain running speed for 0.5 seconds.",
        type: "maintain_speed",
        required: true,
        targetSpeed: 5,
        targetDurationSeconds: 0.5,
      },
      {
        id: "reach_finish_zone",
        description: "Reach the finish approach zone.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -18 },
        radius: 2.5,
      },
    ],
  },
  {
    id: "ex_09_interaction",
    title: "Interaction Basics",
    description: "Approach the terminal and use the Interact action.",
    mechanic: "interaction",
    estimatedDurationSeconds: 20,
    objectives: [
      {
        id: "reach_terminal",
        description: "Reach the training terminal.",
        type: "reach_location",
        required: true,
        position: { x: 2.5, y: BODY_Y, z: -18 },
        radius: 2,
      },
      {
        id: "interact",
        description: "Access the training terminal.",
        type: "interact_with_target",
        required: true,
        targetId: "test_terminal",
      },
    ],
  },
  {
    id: "ex_10_combined_traversal",
    title: "Parkour Sequence",
    description: "Finish the training route with a final jump and landing.",
    mechanic: "combined_traversal",
    estimatedDurationSeconds: 30,
    objectives: [
      {
        id: "final_jump",
        description: "Perform a jump.",
        type: "perform_action",
        required: true,
        action: "jump",
      },
      {
        id: "final_landing",
        description: "Land safely.",
        type: "perform_action",
        required: true,
        action: "landed",
      },
      {
        id: "final_speed",
        description: "Maintain speed toward the finish marker.",
        type: "maintain_speed",
        required: true,
        targetSpeed: 4,
        targetDurationSeconds: 0.5,
      },
      {
        id: "final_zone",
        description: "Reach the finish marker.",
        type: "reach_location",
        required: true,
        position: { x: 0, y: BODY_Y, z: -18.5 },
        radius: 2.5,
      },
    ],
  },
];
