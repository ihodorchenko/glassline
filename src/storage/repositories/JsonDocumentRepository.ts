import type { Database } from "../Database";
import type { ObjectStoreName } from "../SaveSchema";

/**
 * Save System adapter for single-document domain payloads.
 *
 * The physical database, store names, and migrations remain owned by the Save
 * System; domain systems define their payload shape.
 */
export class JsonDocumentRepository<T> {
  private readonly database: Database;
  private readonly storeName: ObjectStoreName;
  private readonly recordKey: string;

  constructor(database: Database, storeName: ObjectStoreName, recordKey: string) {
    this.database = database;
    this.storeName = storeName;
    this.recordKey = recordKey;
  }

  async load(): Promise<T | undefined> {
    return this.database.get<T>(this.storeName, this.recordKey);
  }

  async save(value: T): Promise<void> {
    await this.database.put(this.storeName, this.recordKey, value);
  }

  async clear(): Promise<void> {
    await this.database.delete(this.storeName, this.recordKey);
  }
}
