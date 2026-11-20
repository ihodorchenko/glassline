/**
 * Language definitions and the supported-language registry.
 * See `docs/27_LOCALIZATION_SYSTEM_SPEC.md` §3, §5.
 */

export type TextDirection = "ltr" | "rtl";

export interface LanguageDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly nativeDisplayName: string;
  readonly locale: string;
  readonly direction: TextDirection;
  readonly supported: boolean;
}

/** Languages shipped in the initial release. */
export const SUPPORTED_LANGUAGE_IDS = ["en", "ru"] as const;

export const DEFAULT_LANGUAGE_ID = "en";

const ENGLISH: LanguageDefinition = {
  id: "en",
  displayName: "English",
  nativeDisplayName: "English",
  locale: "en-US",
  direction: "ltr",
  supported: true,
};

const RUSSIAN: LanguageDefinition = {
  id: "ru",
  displayName: "Russian",
  nativeDisplayName: "Русский",
  locale: "ru-RU",
  direction: "ltr",
  supported: true,
};

const BUILT_IN_LANGUAGES: readonly LanguageDefinition[] = [ENGLISH, RUSSIAN];

export class LanguageRegistry {
  private readonly languages = new Map<string, LanguageDefinition>();

  constructor(languages: readonly LanguageDefinition[] = BUILT_IN_LANGUAGES) {
    for (const language of languages) {
      this.languages.set(language.id, language);
    }
  }

  get(languageId: string): LanguageDefinition | undefined {
    return this.languages.get(languageId);
  }

  has(languageId: string): boolean {
    return this.languages.has(languageId);
  }

  getSupportedLanguages(): readonly LanguageDefinition[] {
    return [...this.languages.values()].filter((language) => language.supported);
  }

  getSupportedLanguageIds(): readonly string[] {
    return this.getSupportedLanguages().map((language) => language.id);
  }
}

export const DEFAULT_LANGUAGE_REGISTRY = new LanguageRegistry();

/**
 * Player-facing label for a language setting value. Uses the language's own
 * name so the switcher is readable regardless of the active language
 * ("English" / "Русский"), and falls back to the raw id for unknown values.
 */
export function getLanguageLabel(
  languageId: string,
  registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY,
): string {
  const language = registry.get(languageId);

  return language?.nativeDisplayName ?? language?.displayName ?? languageId;
}
