import { ResourceLoadError, type ResourceLoader } from "../resources/ResourceLoader";
import { DEFAULT_LANGUAGE_ID } from "./Language";
import { ENGLISH_RESOURCES } from "./resources/en";
import type { TranslationResources } from "./TranslationTypes";

export interface LocalizationResourceSource {
  readonly languageId: string;
  readonly load: () => Promise<TranslationResources>;
}

export interface LocalizationResourceLoader {
  has(languageId: string): boolean;
  load(languageId: string): Promise<TranslationResources>;
}

const DEFAULT_RESOURCE_TIMEOUT_MS = 5000;

/**
 * Loads bundled translation resources through the shared `ResourceLoader`,
 * so failures are structured and recoverable.
 */
export class BundledLocalizationResourceLoader implements LocalizationResourceLoader {
  private readonly sources = new Map<string, LocalizationResourceSource>();
  private readonly resourceLoader: ResourceLoader;
  private readonly timeoutMs: number;

  constructor(
    sources: readonly LocalizationResourceSource[],
    resourceLoader: ResourceLoader,
    timeoutMs: number = DEFAULT_RESOURCE_TIMEOUT_MS,
  ) {
    for (const source of sources) {
      this.sources.set(source.languageId, source);
    }

    this.resourceLoader = resourceLoader;
    this.timeoutMs = timeoutMs;
  }

  has(languageId: string): boolean {
    return this.sources.has(languageId);
  }

  load(languageId: string): Promise<TranslationResources> {
    const source = this.sources.get(languageId);

    if (!source) {
      return Promise.reject(
        new ResourceLoadError(
          "FAILED",
          `locales:${languageId}`,
          `No translation resources are registered for language "${languageId}".`,
        ),
      );
    }

    return this.resourceLoader.load(`locales:${languageId}`, async () => source.load(), {
      timeoutMs: this.timeoutMs,
    });
  }
}

export function createDefaultLocalizationResourceLoader(
  resourceLoader: ResourceLoader,
): BundledLocalizationResourceLoader {
  return new BundledLocalizationResourceLoader(
    [
      {
        languageId: DEFAULT_LANGUAGE_ID,
        load: async () => ENGLISH_RESOURCES,
      },
    ],
    resourceLoader,
  );
}
