import {
  DEFAULT_LANGUAGE_ID,
  DEFAULT_LANGUAGE_REGISTRY,
  type LanguageDefinition,
  type LanguageRegistry,
} from "./Language";
import type { LocalizationResourceLoader } from "./LocalizationResourceLoader";
import type {
  PluralCategory,
  TranslationParams,
  TranslationResources,
  TranslationValue,
} from "./TranslationTypes";

export interface LocalizationManagerOptions {
  readonly loader: LocalizationResourceLoader;
  readonly registry?: LanguageRegistry;
  readonly fallbackLanguageId?: string;
}

export interface LocalizationChange {
  readonly previousLanguageId: string;
  readonly languageId: string;
}

export type LocalizationListener = (change: LocalizationChange) => void;

export type Unsubscribe = () => void;

export type LocalizationInitializationResult =
  | { readonly languageId: string; readonly usedFallback: false }
  | { readonly languageId: string; readonly usedFallback: true; readonly error: string };

export type LocalizationSwitchResult =
  | { readonly changed: true; readonly languageId: string }
  | { readonly changed: false; readonly languageId: string; readonly error: string };

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) => {
    const value = params[name];

    return value === undefined ? placeholder : String(value);
  });
}

/**
 * Language registry access, translation resolution, fallback handling, and
 * runtime language switching.
 *
 * Translation resources are owned here; the selected language preference is
 * owned by the Settings System (`docs/27_LOCALIZATION_SYSTEM_SPEC.md` §3, §6).
 */
export class LocalizationManager {
  private readonly registry: LanguageRegistry;
  private readonly loader: LocalizationResourceLoader;
  private readonly fallbackLanguageId: string;
  private readonly resources = new Map<string, TranslationResources>();
  private readonly missingKeys = new Set<string>();
  private readonly listeners = new Set<LocalizationListener>();

  private activeLanguageId: string;

  constructor(options: LocalizationManagerOptions) {
    this.registry = options.registry ?? DEFAULT_LANGUAGE_REGISTRY;
    this.loader = options.loader;
    this.fallbackLanguageId = options.fallbackLanguageId ?? DEFAULT_LANGUAGE_ID;
    this.activeLanguageId = this.fallbackLanguageId;
  }

  get activeLanguage(): LanguageDefinition {
    const language = this.registry.get(this.activeLanguageId);

    if (!language) {
      throw new Error(`Active language "${this.activeLanguageId}" is not registered.`);
    }

    return language;
  }

  get availableLanguages(): readonly LanguageDefinition[] {
    return this.registry.getSupportedLanguages();
  }

  /**
   * Loads fallback resources and activates the requested language.
   * Falls back to the default language when the request cannot be satisfied.
   */
  async initialize(
    languageId: string = this.fallbackLanguageId,
  ): Promise<LocalizationInitializationResult> {
    await this.loadResources(this.fallbackLanguageId);

    const requested = this.registry.get(languageId);

    if (requested === undefined || !requested.supported) {
      this.activeLanguageId = this.fallbackLanguageId;

      return {
        languageId: this.fallbackLanguageId,
        usedFallback: true,
        error: `Language "${languageId}" is not supported.`,
      };
    }

    if (requested.id !== this.fallbackLanguageId) {
      try {
        await this.loadResources(requested.id);
      } catch (error) {
        this.activeLanguageId = this.fallbackLanguageId;

        return {
          languageId: this.fallbackLanguageId,
          usedFallback: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    this.activeLanguageId = requested.id;

    return { languageId: requested.id, usedFallback: false };
  }

  /** Switches the active language atomically; failures retain the previous one. */
  async setLanguage(languageId: string): Promise<LocalizationSwitchResult> {
    const target = this.registry.get(languageId);

    if (target === undefined || !target.supported) {
      return {
        changed: false,
        languageId: this.activeLanguageId,
        error: `Language "${languageId}" is not supported.`,
      };
    }

    if (target.id === this.activeLanguageId) {
      return { changed: true, languageId: this.activeLanguageId };
    }

    try {
      await this.loadResources(target.id);
    } catch (error) {
      return {
        changed: false,
        languageId: this.activeLanguageId,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const previousLanguageId = this.activeLanguageId;

    this.activeLanguageId = target.id;

    for (const listener of [...this.listeners]) {
      try {
        listener({ previousLanguageId, languageId: target.id });
      } catch (error) {
        console.error("[Glassline] A localization listener failed.", error);
      }
    }

    return { changed: true, languageId: target.id };
  }

  /**
   * Resolves a translation key: active language, then fallback language, then
   * the key itself. Missing keys are recorded for diagnostics.
   */
  t(key: string, params: TranslationParams = {}): string {
    const activeValue = this.resources.get(this.activeLanguageId)?.[key];
    const fallbackValue =
      this.activeLanguageId === this.fallbackLanguageId
        ? undefined
        : this.resources.get(this.fallbackLanguageId)?.[key];
    const value = activeValue ?? fallbackValue;

    if (value === undefined) {
      this.missingKeys.add(key);

      return key;
    }

    if (typeof value === "string") {
      return interpolate(value, params);
    }

    return interpolate(this.selectPluralTemplate(value, params), params);
  }

  has(key: string): boolean {
    return (
      this.resources.get(this.activeLanguageId)?.[key] !== undefined ||
      this.resources.get(this.fallbackLanguageId)?.[key] !== undefined
    );
  }

  getMissingKeys(): readonly string[] {
    return [...this.missingKeys];
  }

  clearMissingKeys(): void {
    this.missingKeys.clear();
  }

  subscribe(listener: LocalizationListener): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    this.resources.clear();
    this.missingKeys.clear();
  }

  private async loadResources(languageId: string): Promise<void> {
    if (this.resources.has(languageId)) {
      return;
    }

    const resources = await this.loader.load(languageId);

    this.resources.set(languageId, resources);
  }

  private selectPluralTemplate(
    value: Exclude<TranslationValue, string>,
    params: TranslationParams,
  ): string {
    const count = this.readPluralCount(params);

    if (count === null) {
      return value.other;
    }

    const locale = this.activeLanguage.locale;
    const category = new Intl.PluralRules(locale).select(count) as PluralCategory;

    return value[category] ?? value.other;
  }

  private readPluralCount(params: TranslationParams): number | null {
    const count = params.count ?? params.quantity;

    return typeof count === "number" && Number.isFinite(count) ? count : null;
  }
}
