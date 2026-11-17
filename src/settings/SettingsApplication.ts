import type { SettingCategory, SettingsSnapshot } from "./SettingsTypes";

/**
 * Runtime application adapter provided by a consuming system.
 * See `docs/25_SETTINGS_SYSTEM_SPEC.md` §11.
 */
export interface ISettingsApplicationAdapter {
  readonly domain: SettingCategory;
  apply(snapshot: SettingsSnapshot): void | Promise<void>;
}

export interface SettingsApplicationFailure {
  readonly domain: SettingCategory;
  readonly message: string;
}

export interface SettingsApplicationResult {
  readonly appliedDomains: readonly SettingCategory[];
  readonly failures: readonly SettingsApplicationFailure[];
}

/**
 * Applies committed settings to their owning systems in registration order.
 * A failing adapter must not prevent the remaining domains from being applied.
 */
export class SettingsApplicationPipeline {
  private readonly adapters: ISettingsApplicationAdapter[] = [];

  constructor(adapters: readonly ISettingsApplicationAdapter[] = []) {
    this.adapters.push(...adapters);
  }

  register(adapter: ISettingsApplicationAdapter): void {
    this.adapters.push(adapter);
  }

  get registeredDomains(): readonly SettingCategory[] {
    return this.adapters.map((adapter) => adapter.domain);
  }

  async apply(snapshot: SettingsSnapshot): Promise<SettingsApplicationResult> {
    const appliedDomains: SettingCategory[] = [];
    const failures: SettingsApplicationFailure[] = [];

    for (const adapter of this.adapters) {
      try {
        await adapter.apply(snapshot);
        appliedDomains.push(adapter.domain);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ domain: adapter.domain, message });
        console.error(`[Glassline] Failed to apply settings for "${adapter.domain}".`, error);
      }
    }

    return { appliedDomains, failures };
  }
}
