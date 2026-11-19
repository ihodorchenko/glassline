import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

interface BirdOrbit {
  readonly center: THREE.Vector3;
  readonly radius: number;
  readonly height: number;
  readonly phase: number;
  readonly speed: number;
  readonly bankPhase: number;
}

/**
 * A small, cheap flock of distant birds. One instanced draw call; birds bank
 * and circle above the city to keep the reference skyline alive.
 */
export class CityLife implements Disposable {
  readonly group = new THREE.Group();

  private readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly hoistPivot = new THREE.Group();
  private readonly hoistGeometries: THREE.BufferGeometry[] = [];
  private readonly hoistMaterials: THREE.Material[] = [];
  private readonly orbits: BirdOrbit[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private elapsedSeconds = 0;
  private motionEnabled = true;
  private disposed = false;

  constructor(count = 18) {
    this.geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0.18, -0.55, 0.16, -0.24, 0, 0, -0.1, 0, 0, 0.18, 0, 0, -0.1, 0.55, 0.16, -0.24,
    ]);

    this.geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    this.geometry.computeVertexNormals();
    this.material = new THREE.MeshBasicMaterial({
      color: 0x272d32,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.group.add(this.mesh);
    this.buildHoist();

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;

      this.orbits.push({
        center: new THREE.Vector3(
          Math.cos(angle * 1.7) * 18,
          13 + (index % 5) * 2.4,
          -26 - (index % 6) * 9,
        ),
        radius: 7 + (index % 4) * 4.5,
        height: 11 + (index % 7) * 1.8,
        phase: angle * 2.3,
        speed: 0.08 + (index % 5) * 0.018,
        bankPhase: (index % 6) * 0.9,
      });
    }

    this.update(0);
  }

  setMotionEnabled(enabled: boolean): void {
    this.motionEnabled = enabled;
  }

  update(deltaSeconds: number): void {
    if (this.disposed || !this.motionEnabled) {
      return;
    }

    this.elapsedSeconds += Math.max(0, deltaSeconds);

    this.hoistPivot.rotation.z = Math.sin(this.elapsedSeconds * 0.62) * 0.045;
    this.hoistPivot.rotation.x = Math.cos(this.elapsedSeconds * 0.47) * 0.028;

    for (const [index, orbit] of this.orbits.entries()) {
      const angle = this.elapsedSeconds * orbit.speed + orbit.phase;
      const x = orbit.center.x + Math.cos(angle) * orbit.radius;
      const z = orbit.center.z + Math.sin(angle) * orbit.radius;
      const y = orbit.height + Math.sin(angle * 2.2 + orbit.phase) * 1.8;
      const yaw = -angle + Math.PI / 2;
      const bank = Math.sin(this.elapsedSeconds * 3.2 + orbit.bankPhase) * 0.42;

      this.position.set(x, y, z);
      this.euler.set(bank, yaw, 0);
      this.quaternion.setFromEuler(this.euler);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.group.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();

    for (const geometry of this.hoistGeometries) {
      geometry.dispose();
    }

    for (const material of this.hoistMaterials) {
      material.dispose();
    }
  }

  private buildHoist(): void {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x2e3439, roughness: 0.7, metalness: 0.4 }),
    );
    const load = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xc0262d, roughness: 0.55, metalness: 0.12 }),
    );
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.22, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.8, metalness: 0.25 }),
    );

    cable.position.y = -1.1;
    load.position.y = -2.35;
    cap.position.y = -2.71;
    this.hoistPivot.position.set(4.2, 8.3, -6);
    this.hoistPivot.add(cable, load, cap);
    this.hoistGeometries.push(cable.geometry, load.geometry, cap.geometry);
    this.hoistMaterials.push(
      cable.material as THREE.Material,
      load.material as THREE.Material,
      cap.material as THREE.Material,
    );
    this.group.add(this.hoistPivot);
  }
}
