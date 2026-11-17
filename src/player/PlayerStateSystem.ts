import type { MovementModelSnapshot, MovementState } from "./MovementModel";

/** Lifecycle states from `docs/18_PLAYER_STATE_SYSTEM_SPEC.md` §5.1. */
export type PlayerLifecycleState =
  | "initializing"
  | "inactive"
  | "active"
  | "disabled"
  | "respawning"
  | "unavailable";

export interface PlayerControlState {
  readonly gameplayInputEnabled: boolean;
  readonly movementInputEnabled: boolean;
  readonly lookInputEnabled: boolean;
  readonly uiInputEnabled: boolean;
}

export interface PlayerCapabilities {
  readonly canMove: boolean;
  readonly canLook: boolean;
  readonly canJump: boolean;
  readonly canSprint: boolean;
  readonly canCrouch: boolean;
  readonly canSlide: boolean;
  readonly canInteract: boolean;
  readonly canPause: boolean;
  readonly canRestart: boolean;
}

export interface PlayerStateSnapshot {
  readonly playerId: string;
  readonly sessionId: string;
  readonly lifecycle: PlayerLifecycleState;
  readonly locomotion: {
    readonly state: MovementState;
    readonly isGrounded: boolean;
    readonly isMoving: boolean;
    readonly isTraversing: boolean;
  };
  readonly control: PlayerControlState;
  readonly respawn: { readonly isInProgress: boolean };
  readonly capabilities: PlayerCapabilities;
  readonly revision: number;
  readonly timestamp: number;
}

export type PlayerStateListener = (snapshot: PlayerStateSnapshot) => void;

const DEFAULT_CONTROL: PlayerControlState = {
  gameplayInputEnabled: true,
  movementInputEnabled: true,
  lookInputEnabled: true,
  uiInputEnabled: true,
};

const DEFAULT_LOCOMOTION = {
  state: "IDLE" as MovementState,
  isGrounded: false,
  isMoving: false,
  isTraversing: false,
};

function resolveCapabilities(
  lifecycle: PlayerLifecycleState,
  control: PlayerControlState,
  locomotion: MovementModelSnapshot | null,
): PlayerCapabilities {
  const active = lifecycle === "active";
  const canMove = active && control.gameplayInputEnabled && control.movementInputEnabled;
  const canLook = active && control.gameplayInputEnabled && control.lookInputEnabled;
  const grounded = locomotion?.grounded ?? false;

  return {
    canMove,
    canLook,
    canJump: canMove && (locomotion?.canJump ?? false),
    canSprint: canMove && grounded,
    canCrouch: canMove && grounded,
    // Sliding and traversal mechanics arrive with the Phase 3 movement work.
    canSlide: false,
    canInteract: canMove && grounded,
    // Application-level actions remain available while gameplay movement is not.
    canPause: true,
    canRestart: true,
  };
}

function capabilitiesEqual(left: PlayerCapabilities, right: PlayerCapabilities): boolean {
  return (
    left.canMove === right.canMove &&
    left.canLook === right.canLook &&
    left.canJump === right.canJump &&
    left.canSprint === right.canSprint &&
    left.canCrouch === right.canCrouch &&
    left.canSlide === right.canSlide &&
    left.canInteract === right.canInteract &&
    left.canPause === right.canPause &&
    left.canRestart === right.canRestart
  );
}

/**
 * Owns the aggregated player lifecycle state and capability projection.
 * Locomotion data is projected from the Movement System; it is not re-simulated
 * here (`docs/18_PLAYER_STATE_SYSTEM_SPEC.md` §3).
 */
export class PlayerStateSystem {
  private readonly playerId: string;
  private readonly sessionId: string;
  private readonly listeners = new Set<PlayerStateListener>();

  private lifecycle: PlayerLifecycleState = "initializing";
  private control: PlayerControlState = DEFAULT_CONTROL;
  private locomotionSnapshot: MovementModelSnapshot | null = null;
  private revision = 0;
  private lastTimestampMs = 0;
  private snapshot: PlayerStateSnapshot;

  constructor(playerId = "local-player", sessionId = "boot-session") {
    this.playerId = playerId;
    this.sessionId = sessionId;
    this.snapshot = this.buildSnapshot(DEFAULT_LOCOMOTION);
  }

  getSnapshot(): PlayerStateSnapshot {
    return this.snapshot;
  }

  getLifecycle(): PlayerLifecycleState {
    return this.lifecycle;
  }

  activate(): void {
    this.setLifecycle("active");
  }

  deactivate(): void {
    this.setLifecycle("inactive");
  }

  disable(): void {
    this.setLifecycle("disabled");
  }

  markUnavailable(): void {
    this.setLifecycle("unavailable");
  }

  setControlState(partial: Partial<PlayerControlState>): void {
    this.control = { ...this.control, ...partial };
    this.refresh();
  }

  /** Projects the authoritative Movement System state into the aggregate snapshot. */
  updateFromMovement(movement: MovementModelSnapshot, timestampMs: number): void {
    this.locomotionSnapshot = movement;
    this.lastTimestampMs = timestampMs;
    this.refresh();
  }

  subscribe(listener: PlayerStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    this.locomotionSnapshot = null;
  }

  private setLifecycle(lifecycle: PlayerLifecycleState): void {
    if (this.lifecycle === lifecycle) {
      return;
    }

    this.lifecycle = lifecycle;
    this.refresh();
  }

  private refresh(): void {
    const locomotion = this.locomotionSnapshot
      ? {
          state: this.locomotionSnapshot.state,
          isGrounded: this.locomotionSnapshot.grounded,
          isMoving: this.locomotionSnapshot.moving,
          isTraversing: false,
        }
      : DEFAULT_LOCOMOTION;

    const next = this.buildSnapshot(locomotion);

    if (this.snapshotsEqual(this.snapshot, next)) {
      return;
    }

    this.snapshot = next;
    this.revision += 1;
    this.snapshot = { ...next, revision: this.revision };

    for (const listener of [...this.listeners]) {
      try {
        listener(this.snapshot);
      } catch (error) {
        console.error("[Glassline] A player-state listener failed.", error);
      }
    }
  }

  private buildSnapshot(locomotion: {
    readonly state: MovementState;
    readonly isGrounded: boolean;
    readonly isMoving: boolean;
    readonly isTraversing: boolean;
  }): PlayerStateSnapshot {
    return {
      playerId: this.playerId,
      sessionId: this.sessionId,
      lifecycle: this.lifecycle,
      locomotion,
      control: this.control,
      respawn: { isInProgress: false },
      capabilities: resolveCapabilities(this.lifecycle, this.control, this.locomotionSnapshot),
      revision: this.revision,
      timestamp: this.lastTimestampMs,
    };
  }

  private snapshotsEqual(left: PlayerStateSnapshot, right: PlayerStateSnapshot): boolean {
    return (
      left.lifecycle === right.lifecycle &&
      left.locomotion.state === right.locomotion.state &&
      left.locomotion.isGrounded === right.locomotion.isGrounded &&
      left.locomotion.isMoving === right.locomotion.isMoving &&
      left.locomotion.isTraversing === right.locomotion.isTraversing &&
      left.control.gameplayInputEnabled === right.control.gameplayInputEnabled &&
      left.control.movementInputEnabled === right.control.movementInputEnabled &&
      left.control.lookInputEnabled === right.control.lookInputEnabled &&
      left.control.uiInputEnabled === right.control.uiInputEnabled &&
      left.respawn.isInProgress === right.respawn.isInProgress &&
      capabilitiesEqual(left.capabilities, right.capabilities)
    );
  }
}
