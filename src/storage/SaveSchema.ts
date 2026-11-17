/**
 * Persisted save schema.
 * See `docs/10_SAVE_SYSTEM_SPEC.md` §2.
 */

/** Canonical database name. Owned exclusively by the Save System specification. */
export const DATABASE_NAME = "GlasslineSaveData";

/** IndexedDB structural schema version. Increase when the store layout changes. */
export const DATABASE_VERSION = 1;

/** Logical save-data version, independent of the IndexedDB structure version. */
export const SAVE_DATA_VERSION = 1;

export const OBJECT_STORES = [
  "settings",
  "progress",
  "training",
  "speedrun",
  "statistics",
  "achievements",
  "tutorial",
  "metadata",
  "backups",
] as const;

export type ObjectStoreName = (typeof OBJECT_STORES)[number];

export interface SaveMigration {
  /** Schema version introduced by this migration. */
  readonly version: number;

  upgrade(database: IDBDatabase, transaction: IDBTransaction): void;
}

/** Initial schema: every domain store is created empty with out-of-line keys. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [
  {
    version: 1,
    upgrade(database: IDBDatabase): void {
      for (const storeName of OBJECT_STORES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      }
    },
  },
];
