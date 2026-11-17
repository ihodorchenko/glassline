import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { Database } from "../../src/storage/Database";
import { SettingsRepository } from "../../src/storage/repositories/SettingsRepository";
import { OBJECT_STORES, type SaveMigration } from "../../src/storage/SaveSchema";

let databaseCounter = 0;

const openedDatabases: Database[] = [];
const createdDatabaseNames = new Set<string>();

function nextDatabaseName(): string {
  databaseCounter += 1;

  return `glassline-test-${databaseCounter}`;
}

function createDatabase(
  name: string,
  version = 1,
  migrations?: readonly SaveMigration[],
): Database {
  const options = migrations
    ? { name, version, openTimeoutMs: 2000, migrations }
    : { name, version, openTimeoutMs: 2000 };
  const database = new Database(options);

  openedDatabases.push(database);
  createdDatabaseNames.add(name);

  return database;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

afterEach(async () => {
  for (const database of openedDatabases) {
    database.close();
  }

  openedDatabases.length = 0;

  for (const name of createdDatabaseNames) {
    await deleteDatabase(name);
  }

  createdDatabaseNames.clear();
});

describe("Database", () => {
  it("creates every documented object store", async () => {
    const database = createDatabase(nextDatabaseName());

    await database.open();
    expect(database.isOpen).toBe(true);

    for (const store of OBJECT_STORES) {
      await database.put(store, "probe", { store });
      await expect(database.get(store, "probe")).resolves.toEqual({ store });
    }
  });

  it("stores and retrieves values, lists and clears records", async () => {
    const database = createDatabase(nextDatabaseName());

    await database.open();
    await database.put("metadata", "first", { value: 1 });
    await database.put("metadata", "second", { value: 2 });

    await expect(database.getAll("metadata")).resolves.toHaveLength(2);
    await database.clear("metadata");
    await expect(database.getAll("metadata")).resolves.toHaveLength(0);

    await database.put("metadata", "first", { value: 1 });
    await database.delete("metadata", "first");
    await expect(database.get("metadata", "first")).resolves.toBeUndefined();
  });

  it("persists data across close and reopen", async () => {
    const name = nextDatabaseName();
    const database = createDatabase(name);

    await database.open();
    await new SettingsRepository(database).save({ audio: { master: 0.5 } }, 7);
    database.close();

    const reopened = createDatabase(name);

    await reopened.open();

    const settings = await new SettingsRepository(reopened).load();

    expect(settings?.revision).toBe(7);
    expect(settings?.values).toEqual({ audio: { master: 0.5 } });
  });

  it("rejects access after close", async () => {
    const database = createDatabase(nextDatabaseName());

    await database.open();
    database.close();

    await expect(database.get("metadata", "missing")).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("reports unavailable IndexedDB", async () => {
    const database = new Database(
      { name: nextDatabaseName(), version: 1, openTimeoutMs: 100 },
      null,
    );

    await expect(database.open()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("runs schema migrations when the database version increases", async () => {
    const name = nextDatabaseName();
    const versionOne = createDatabase(name, 1);

    await versionOne.open();
    await versionOne.put("metadata", "marker1", { marker: 1 });
    versionOne.close();

    const migrations: readonly SaveMigration[] = [
      { version: 1, upgrade: () => undefined },
      {
        version: 2,
        upgrade: (_database, transaction) => {
          transaction.objectStore("metadata").put({ marker: 2 }, "marker2");
        },
      },
    ];

    const versionTwo = createDatabase(name, 2, migrations);

    await versionTwo.open();

    await expect(versionTwo.get("metadata", "marker1")).resolves.toEqual({ marker: 1 });
    await expect(versionTwo.get("metadata", "marker2")).resolves.toEqual({ marker: 2 });
  });
});

describe("SettingsRepository", () => {
  it("returns null when no settings were saved", async () => {
    const database = createDatabase(nextDatabaseName());

    await database.open();

    await expect(new SettingsRepository(database).load()).resolves.toBeNull();
  });

  it("rejects a malformed payload instead of silently repairing it", async () => {
    const database = createDatabase(nextDatabaseName());

    await database.open();
    await database.put("settings", "settings", { schemaVersion: "not-a-number" });

    await expect(new SettingsRepository(database).load()).rejects.toMatchObject({
      code: "INVALID_RECORD",
    });
  });

  it("clears the persisted payload", async () => {
    const database = createDatabase(nextDatabaseName());
    const repository = new SettingsRepository(database);

    await database.open();
    await repository.save({}, 1);
    await repository.clear();

    await expect(repository.load()).resolves.toBeNull();
  });
});
