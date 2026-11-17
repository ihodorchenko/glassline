/**
 * Translation resource model.
 * See `docs/27_LOCALIZATION_SYSTEM_SPEC.md` §7.
 */

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

export type PluralTranslation = Readonly<
  Partial<Record<PluralCategory, string>> & { readonly other: string }
>;

export type TranslationValue = string | PluralTranslation;

export type TranslationResources = Readonly<Record<string, TranslationValue>>;

export type TranslationParams = Readonly<Record<string, string | number>>;
