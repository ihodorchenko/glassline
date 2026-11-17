import { EventBus, type Unsubscribe } from "../core/EventBus";

export type GameplayFlowState =
  | "boot"
  | "main-menu"
  | "loading"
  | "gameplay"
  | "paused"
  | "results"
  | "error";

export type FlowTransitionReason =
  | "boot-complete"
  | "start-gameplay"
  | "gameplay-ready"
  | "pause"
  | "resume"
  | "complete"
  | "restart"
  | "abandon"
  | "error"
  | "return-to-menu";

export interface GameplayFlowSnapshot {
  readonly state: GameplayFlowState;
  readonly previousState: GameplayFlowState | null;
  readonly reason: FlowTransitionReason | null;
  readonly updatedAt: number;
}

export interface FlowTransition {
  readonly from: GameplayFlowState | null;
  readonly to: GameplayFlowState;
  readonly reason: FlowTransitionReason;
  readonly timestamp: number;
}

export interface FlowNavigationRequest {
  readonly target: GameplayFlowState;
  readonly reason: FlowTransitionReason;
}

export interface FlowOperationResult {
  readonly success: boolean;
  readonly snapshot: GameplayFlowSnapshot;
  readonly error?: string;
}

export interface GameplayFlowEventMap {
  [key: string]: unknown;
  "flow:transitioned": FlowTransition;
}

/**
 * Owns application navigation state (`docs/20`).
 *
 * It presents screens; it does not own gameplay session lifecycle, gameplay
 * systems, or UI rendering.
 */
export class GameplayFlowManager {
  private readonly allowedTransitions: Readonly<
    Record<GameplayFlowState, readonly GameplayFlowState[]>
  > = {
    boot: ["main-menu", "error"],
    "main-menu": ["loading", "error"],
    loading: ["gameplay", "error", "main-menu"],
    gameplay: ["paused", "results", "main-menu", "error"],
    paused: ["gameplay", "main-menu", "results", "error"],
    results: ["main-menu", "loading", "error"],
    error: ["main-menu"],
  };

  private state: GameplayFlowState = "boot";
  private previousState: GameplayFlowState | null = null;
  private reason: FlowTransitionReason | null = null;
  private updatedAt: number;
  private readonly history: FlowTransition[] = [];
  private readonly clock: () => number;
  private readonly events = new EventBus<GameplayFlowEventMap>();

  constructor(options: { readonly clock?: () => number } = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.updatedAt = this.clock();
  }

  getState(): GameplayFlowState {
    return this.state;
  }

  getSnapshot(): GameplayFlowSnapshot {
    return {
      state: this.state,
      previousState: this.previousState,
      reason: this.reason,
      updatedAt: this.updatedAt,
    };
  }

  getHistory(): readonly FlowTransition[] {
    return [...this.history];
  }

  canTransitionTo(target: GameplayFlowState): boolean {
    return this.allowedTransitions[this.state].includes(target);
  }

  navigate(request: FlowNavigationRequest): FlowOperationResult {
    if (!this.canTransitionTo(request.target)) {
      return {
        success: false,
        snapshot: this.getSnapshot(),
        error: `Navigation from "${this.state}" to "${request.target}" is not allowed.`,
      };
    }

    const transition: FlowTransition = {
      from: this.state,
      to: request.target,
      reason: request.reason,
      timestamp: this.clock(),
    };

    this.previousState = this.state;
    this.state = request.target;
    this.reason = request.reason;
    this.updatedAt = transition.timestamp;
    this.history.push(transition);

    if (this.history.length > 50) {
      this.history.shift();
    }

    this.events.emit("flow:transitioned", transition);

    return { success: true, snapshot: this.getSnapshot() };
  }

  subscribe(listener: (event: FlowTransition) => void): Unsubscribe {
    return this.events.on("flow:transitioned", listener);
  }

  dispose(): void {
    this.events.clear();
  }
}
