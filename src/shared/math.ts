/** Two-dimensional value used by input and presentation layers. */
export interface Vector2Like {
  readonly x: number;
  readonly y: number;
}

/** Three-dimensional value used by physics, rendering, and world systems. */
export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Scales a 2D vector down so that its magnitude does not exceed `maxMagnitude`.
 * Returns the original object when no scaling is required.
 */
export function clampVector2Magnitude(vector: Vector2Like, maxMagnitude = 1): Vector2Like {
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude <= maxMagnitude || magnitude === 0) {
    return vector;
  }

  const scale = maxMagnitude / magnitude;

  return { x: vector.x * scale, y: vector.y * scale };
}

/** Applies a radial dead zone and rescales the remaining range back to 0..1. */
export function applyRadialDeadZone(vector: Vector2Like, deadZone: number): Vector2Like {
  if (deadZone <= 0) {
    return vector;
  }

  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude <= deadZone) {
    return { x: 0, y: 0 };
  }

  const normalizedMagnitude = Math.min((magnitude - deadZone) / (1 - deadZone), 1);
  const scale = normalizedMagnitude / magnitude;

  return { x: vector.x * scale, y: vector.y * scale };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
