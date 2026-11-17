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
export const SUPPORTED_LANGUAGE_IDS = ["en"] as const;

export const DEFAULT_LANGUAGE_ID = "en";

const ENGLISH: LanguageDefinition = {
  id: "en",
  displayName: "English",
  nativeDisplayName: "English",
  locale: "en-US",
  direction: "ltr",
  supported: true,
};

const BUILT_IN_LANGUAGES: readonly LanguageDefinition[] = [ENGLISH];

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
