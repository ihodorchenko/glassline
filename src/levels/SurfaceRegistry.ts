import type { LevelBounds, LevelSurfaceDefinition, LevelVector3 } from "./LevelTypes";

export interface RuntimeSurface {
  readonly id: string;
  readonly sectionId: string;
  readonly definition: LevelSurfaceDefinition;
  readonly colliderHandle: number | null;
  readonly bounds: LevelBounds | null;
  readonly active: boolean;
}

function inBounds(bounds: LevelBounds, position: LevelVector3, tolerance = 0.05): boolean {
  return (
    Math.abs(position.x - bounds.center.x) <= bounds.halfExtents.x + tolerance &&
    Math.abs(position.z - bounds.center.z) <= bounds.halfExtents.z + tolerance
  );
}

function topOf(bounds: LevelBounds): number {
  return bounds.center.y + bounds.halfExtents.y;
}

/**
 * Exposes traversal surface metadata registered by level content
 * (`docs/02` §9.6, `docs/06` §3.4, `docs/15` §16.4).
 */
export class SurfaceRegistry {
  private readonly surfaces = new Map<string, RuntimeSurface>();

  register(surface: RuntimeSurface): void {
    if (this.surfaces.has(surface.id)) {
      throw new Error(`Surface "${surface.id}" is already registered.`);
    }

    this.surfaces.set(surface.id, surface);
  }

  unregister(surfaceId: string): void {
    this.surfaces.delete(surfaceId);
  }

  get(surfaceId: string): RuntimeSurface | null {
    return this.surfaces.get(surfaceId) ?? null;
  }

  getBySection(sectionId: string): RuntimeSurface[] {
    return [...this.surfaces.values()].filter((surface) => surface.sectionId === sectionId);
  }

  getByColliderHandle(colliderHandle: number): RuntimeSurface | null {
    for (const surface of this.surfaces.values()) {
      if (surface.colliderHandle === colliderHandle) {
        return surface;
      }
    }

    return null;
  }

  setActive(surfaceId: string, active: boolean): void {
    const surface = this.surfaces.get(surfaceId);

    if (surface && surface.active !== active) {
      this.surfaces.set(surfaceId, { ...surface, active });
    }
  }

  activateSection(sectionId: string): void {
    for (const surface of this.surfaces.values()) {
      if (surface.sectionId === sectionId) {
        this.setActive(surface.id, true);
      }
    }
  }

  deactivateSection(sectionId: string): void {
    for (const surface of this.surfaces.values()) {
      if (surface.sectionId === sectionId) {
        this.setActive(surface.id, false);
      }
    }
  }

  /**
   * Finds the active walkable/landing surface directly below a feet position.
   * This is metadata lookup, not collision simulation.
   */
  getSurfaceAt(feetPosition: LevelVector3): RuntimeSurface | null {
    let best: RuntimeSurface | null = null;
    let bestTop = Number.NEGATIVE_INFINITY;

    for (const surface of this.surfaces.values()) {
      if (!surface.active || !surface.bounds) {
        continue;
      }

      if (!inBounds(surface.bounds, feetPosition)) {
        continue;
      }

      const top = topOf(surface.bounds);
      const withinReach = feetPosition.y >= top - 0.3 && feetPosition.y <= top + 0.1;

      if (!withinReach || top <= bestTop) {
        continue;
      }

      best = surface;
      bestTop = top;
    }

    return best;
  }

  /**
   * Finds the active surface whose bounds contain a world point (any height,
   * unlike {@link getSurfaceAt} which targets feet-level walkable surfaces).
   * Used by traversal eligibility checks such as wall-run surface gating.
   */
  getSurfaceContaining(position: LevelVector3): RuntimeSurface | null {
    for (const surface of this.surfaces.values()) {
      if (!surface.active || !surface.bounds) {
        continue;
      }

      const bounds = surface.bounds;

      if (!inBounds(bounds, position)) {
        continue;
      }

      if (
        position.y < bounds.center.y - bounds.halfExtents.y ||
        position.y > bounds.center.y + bounds.halfExtents.y
      ) {
        continue;
      }

      return surface;
    }

    return null;
  }

  getActiveCount(): number {
    let count = 0;

    for (const surface of this.surfaces.values()) {
      if (surface.active) {
        count += 1;
      }
    }

    return count;
  }

  getCount(): number {
    return this.surfaces.size;
  }

  getAll(): readonly RuntimeSurface[] {
    return [...this.surfaces.values()];
  }

  clear(): void {
    this.surfaces.clear();
  }
}
