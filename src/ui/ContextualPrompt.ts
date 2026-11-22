/**
 * Single-line contextual prompt ownership (Step 3.7 F-04).
 *
 * The HUD has exactly one bottom-centre action line. Interaction targets
 * (`InteractionSystem`), the Training tutorial panel and the contextual
 * `E · VAULT` affordance must never compete for it: the vault affordance is the
 * lowest-priority source and is only shown when nothing more specific is on
 * screen. Keeping the decision in one pure function makes the priority
 * explicit and testable without a DOM.
 *
 * See `docs/23_HUD_SYSTEM_SPEC.md` §6 and `docs/28_TUTORIAL_SYSTEM_SPEC.md` §5.
 */
export interface VaultPromptConditions {
  /** The level opts into the affordance through `LevelMetadata.vaultAffordance`. */
  readonly levelSupportsVaultAffordance: boolean;
  /**
   * `PlayerSystem.isVaultAffordanceAvailable()` for the latest fixed step: the
   * wider, presentation-only reach, not the vault execution condition.
   */
  readonly vaultAffordanceVisible: boolean;
  /** A validated interaction target currently owns the prompt line. */
  readonly interactionPrompt: string | null;
  /** The Training tutorial panel is presenting a step hint. */
  readonly tutorialHintVisible: boolean;
}

/**
 * Whether the `E · VAULT` affordance should own the contextual prompt line.
 *
 * Priority: interaction target → Training tutorial hint → vault affordance.
 * A vault is only advertised where the level opts in, only while the same
 * detection the action uses reports an obstacle, and never on top of another
 * contextual instruction.
 */
export function shouldShowVaultPrompt(conditions: VaultPromptConditions): boolean {
  if (!conditions.levelSupportsVaultAffordance || !conditions.vaultAffordanceVisible) {
    return false;
  }

  if (conditions.interactionPrompt !== null) {
    return false;
  }

  return !conditions.tutorialHintVisible;
}
