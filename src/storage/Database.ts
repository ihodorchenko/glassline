import type { Disposable } from "../core/Disposable";
import { type ObjectStoreName, SAVE_MIGRATIONS, type SaveMigration } from "./SaveSchema";

export type StorageErrorCode =
  | "UNAVAILABLE"
  | "OPEN_FAILED"
  | "OPEN_TIMEOUT"
  | "TRANSACTION_FAILED"
  | "REQUEST_FAILED"
  | "INVALID_RECORD"
  | "CLOSED";

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.code = code;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface DatabaseOptions {
  readonly name: string;
  readonly version: number;
  readonly openTimeoutMs: number;

  /** Overridable for schema tests; defaults to the production migration list. */
  readonly migrations?: readonly SaveMigration[];
}

function resolveIndexedDbFactory(): IDBFactory | null {
  if (typeof globalThis.indexedDB === "undefined") {
    return null;
  }

  return globalThis.indexedDB;
}

/**
 * Owns the IndexedDB connection, schema upgrades, and transactions.
 *
 * Domain systems must access their data through repositories, never through
 * this class directly (see `docs/10_SAVE_SYSTEM_SPEC.md` §2.5).
 */
export class Database implements Disposable {
  private readonly options: DatabaseOptions;
  private readonly migrations: readonly SaveMigration[];
  private readonly factory: IDBFactory | null;
  private database: IDBDatabase | null = null;
  private opening: Promise<void> | null = null;

  constructor(options: DatabaseOptions, factory: IDBFactory | null = resolveIndexedDbFactory()) {
    if (!Number.isInteger(options.version) || options.version < 1) {
      throw new RangeError(`Invalid database version: ${options.version}.`);
    }

    if (!Number.isFinite(options.openTimeoutMs) || options.openTimeoutMs <= 0) {
      throw new RangeError(`Invalid database open timeout: ${options.openTimeoutMs}.`);
    }

    this.options = options;
    this.migrations = [...(options.migrations ?? SAVE_MIGRATIONS)].sort(
      (left, right) => left.version - right.version,
    );
    this.factory = factory;
  }

  get isOpen(): boolean {
    return this.database !== null;
  }

  async open(): Promise<void> {
    if (this.database) {
      return;
    }

    if (this.opening) {
      await this.opening;
      return;
    }

    this.opening = this.openInternal();

    try {
      await this.opening;
    } finally {
      this.opening = null;
    }
  }

  close(): void {
    if (this.database) {
      this.database.close();
      this.database = null;
    }
  }

  dispose(): void {
    this.close();
  }

  async get<T>(store: ObjectStoreName, key: IDBValidKey): Promise<T | undefined> {
    const request = this.requireDatabase()
      .transaction(store, "readonly")
      .objectStore(store)
      .get(key) as IDBRequest<T | undefined>;

    return this.requestAsPromise(request);
  }

  async getAll<T>(store: ObjectStoreName): Promise<T[]> {
    const request = this.requireDatabase()
      .transaction(store, "readonly")
      .objectStore(store)
      .getAll() as IDBRequest<T[]>;

    return this.requestAsPromise(request);
  }

  async put(store: ObjectStoreName, key: IDBValidKey, value: unknown): Promise<void> {
    const transaction = this.requireDatabase().transaction(store, "readwrite");

    transaction.objectStore(store).put(value, key);
    await this.transactionDone(transaction);
  }

  async delete(store: ObjectStoreName, key: IDBValidKey): Promise<void> {
    const transaction = this.requireDatabase().transaction(store, "readwrite");

    transaction.objectStore(store).delete(key);
    await this.transactionDone(transaction);
  }

  async clear(store: ObjectStoreName): Promise<void> {
    const transaction = this.requireDatabase().transaction(store, "readwrite");

    transaction.objectStore(store).clear();
    await this.transactionDone(transaction);
  }

  private openInternal(): Promise<void> {
    const factory = this.factory;

    if (!factory) {
      return Promise.reject(
        new StorageError("UNAVAILABLE", "IndexedDB is not available in this environment."),
      );
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let upgradeError: unknown;
      const timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(
          new StorageError(
            "OPEN_TIMEOUT",
            `Opening IndexedDB "${this.options.name}" timed out after ${this.options.openTimeoutMs} ms.`,
          ),
        );
      }, this.options.openTimeoutMs);

      let request: IDBOpenDBRequest;

      try {
        request = factory.open(this.options.name, this.options.version);
      } catch (error) {
        clearTimeout(timeoutId);
        settled = true;
        reject(
          new StorageError(
            "OPEN_FAILED",
            `Could not request IndexedDB "${this.options.name}".`,
            error,
          ),
        );
        return;
      }

      request.onupgradeneeded = (event) => {
        const database = request.result;
        const transaction = request.transaction;

        if (!database || !transaction) {
          return;
        }

        try {
          for (const migration of this.migrations) {
            if (migration.version > event.oldVersion && migration.version <= this.options.version) {
              migration.upgrade(database, transaction);
            }
          }
        } catch (error) {
          upgradeError = error;
          transaction.abort();
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        if (settled) {
          database.close();
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        database.onversionchange = () => {
          database.close();
          this.database = null;
        };
        this.database = database;
        resolve();
      };

      request.onerror = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        reject(
          new StorageError(
            "OPEN_FAILED",
            `Failed to open IndexedDB "${this.options.name}" (version ${this.options.version}).`,
            upgradeError ?? request.error,
          ),
        );
      };

      request.onblocked = () => {
        console.warn(
          `[Glassline] Opening IndexedDB "${this.options.name}" is blocked by another connection.`,
        );
      };
    });
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) {
      throw new StorageError("CLOSED", "Database is not open. Await open() first.");
    }

    return this.database;
  }

  private requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new StorageError("REQUEST_FAILED", "IndexedDB request failed.", request.error));
    });
  }

  private transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          new StorageError(
            "TRANSACTION_FAILED",
            "IndexedDB transaction failed.",
            transaction.error,
          ),
        );
      transaction.onabort = () =>
        reject(
          new StorageError(
            "TRANSACTION_FAILED",
            "IndexedDB transaction was aborted.",
            transaction.error,
          ),
        );
    });
  }
}
