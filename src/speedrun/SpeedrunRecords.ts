import type { SpeedrunMedal } from "./SpeedrunSystem";

export interface SpeedrunRecordSplit {
  readonly checkpointId: string;
  readonly sectionId: string;
  readonly index: number;
  readonly splitTimeMs: number;
  readonly totalTimeMs: number;
}

export interface SpeedrunRecordEntry {
  readonly id: string;
  readonly routeId: string;
  readonly routeVersion: number;
  readonly completionTimeMs: number;
  readonly medal: SpeedrunMedal;
  readonly completedAt: number;
  readonly splits: readonly SpeedrunRecordSplit[];
  readonly validation: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
  readonly sessionId: string;
  readonly statisticsSummaryId?: string;
}

export interface PersistedSpeedrunRecords {
  readonly schemaVersion: number;
  readonly records: readonly SpeedrunRecordEntry[];
  readonly updatedAt: number;
}

export interface SpeedrunRecordsPersistence {
  load(): Promise<PersistedSpeedrunRecords | null>;
  save(data: PersistedSpeedrunRecords): Promise<void>;
}

export interface SpeedrunRecordStoreOptions {
  readonly persistence?: SpeedrunRecordsPersistence | null;
  readonly clock?: () => number;
}
