import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { MovementModelSnapshot } from "../player/MovementModel";

interface ArmRig {
  readonly root: THREE.Group;
  readonly forearm: THREE.Mesh;
  readonly hand: THREE.Group;
  readonly sleeve: THREE.Mesh;
  readonly basePosition: THREE.Vector3;
  readonly baseRotation: THREE.Euler;
}

function createBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
}

/**
 * First-person runner body: forearms, gloves, and wrist wraps attached to the
 * camera. Geometry is deliberately low-poly; the shape reads through silhouette,
 * bob, and the red glove accents.
 */
export class ViewModel implements Disposable {
  private readonly root = new THREE.Group();
  private readonly arms: ArmRig[] = [];
  private readonly light: THREE.PointLight;
  private readonly materials: THREE.Material[] = [];
  private readonly camera: THREE.PerspectiveCamera;
  private elapsedSeconds = 0;
  private bobPhase = 0;
  private disposed = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.root.name = "view-model";
    this.root.layers.set(1);

    const skin = new THREE.MeshStandardMaterial({
      color: 0xbc8f6c,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x3a2418,
      emissiveIntensity: 0.35,
    });
    const glove = new THREE.MeshStandardMaterial({
      color: 0x24282b,
      roughness: 0.82,
      metalness: 0.04,
      emissive: 0x111315,
      emissiveIntensity: 0.45,
    });
    const wrap = new THREE.MeshStandardMaterial({
      color: 0xc0262d,
      roughness: 0.6,
      metalness: 0.05,
      emissive: 0x501013,
      emissiveIntensity: 0.4,
    });
    const sleeve = new THREE.MeshStandardMaterial({
      color: 0x2b3036,
      roughness: 0.88,
      metalness: 0.03,
      emissive: 0x15181b,
      emissiveIntensity: 0.35,
    });

    this.materials.push(skin, glove, wrap, sleeve);

    const left = this.createArm(-1, skin, glove, wrap, sleeve);
    const right = this.createArm(1, skin, glove, wrap, sleeve);

    this.arms.push(left, right);
    this.root.add(left.root, right.root);
    this.root.position.set(0, 0, 0);

    camera.layers.enable(1);
    camera.add(this.root);

    this.light = new THREE.PointLight(0xffe6cc, 2.4, 4, 2);
    this.light.position.set(0.35, 0.45, 0.1);
    this.light.layers.set(1);
    camera.add(this.light);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  update(deltaSeconds: number, movement: MovementModelSnapshot): void {
    if (this.disposed) {
      return;
    }

    this.elapsedSeconds += deltaSeconds;

    const speedRatio = Math.min(movement.speed / 7.5, 1);
    const running = movement.grounded ? speedRatio : 0;
    const air = movement.grounded ? 0 : 1;
    const slide = movement.stance === "sliding" ? 1 : 0;
    const wallRun = movement.wallRunSide ? 1 : 0;
    const wallSign = movement.wallRunSide === "left" ? -1 : 1;
    // Match the camera's half-sine dip: zero on touchdown, peak mid-recovery.
    const landingCurve =
      movement.landingRemainingSeconds > 0
        ? Math.sin(Math.PI * (1 - movement.landingIntensity))
        : 0;
    const time = this.elapsedSeconds;

    this.bobPhase += deltaSeconds * (4.2 + speedRatio * 7.4 + air * 1.5);

    const bobX = Math.sin(this.bobPhase) * (0.004 + running * 0.012);
    const bobY = Math.abs(Math.cos(this.bobPhase)) * (0.003 + running * 0.014);
    const breathe = Math.sin(time * 1.35) * 0.003;
    const idleSway = Math.sin(time * 0.62) * 0.004;

    for (const arm of this.arms) {
      const side = arm.basePosition.x < 0 ? -1 : 1;
      const phase = side < 0 ? 0 : Math.PI;
      const swing = Math.sin(this.bobPhase + phase) * running * 0.045;
      const lift = running * 0.055 + air * 0.08 + slide * 0.02;
      const roll = side * (wallRun * 0.13 * wallSign + Math.sin(time * 0.8 + phase) * 0.01);

      arm.root.position.set(
        arm.basePosition.x + bobX * side + idleSway * side,
        arm.basePosition.y + bobY + breathe - landingCurve * 0.055 - lift * 0.35 + slide * 0.05,
        arm.basePosition.z - swing - landingCurve * 0.02,
      );
      arm.root.rotation.set(
        arm.baseRotation.x - lift + Math.sin(this.bobPhase + phase) * running * 0.04,
        arm.baseRotation.y + side * (running * 0.03 + wallRun * 0.06),
        arm.baseRotation.z + roll,
      );

      arm.hand.rotation.x = Math.sin(this.bobPhase * 0.5 + phase) * 0.04 + running * 0.08;
      arm.hand.rotation.z = side * (0.04 + wallRun * 0.12);
    }

    this.root.position.y = -landingCurve * 0.01;
    this.light.intensity = 2.2 + Math.sin(time * 1.2) * 0.08;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.camera.remove(this.root, this.light);
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });

    for (const material of this.materials) {
      material.dispose();
    }

    this.materials.length = 0;
  }

  private createArm(
    side: number,
    skin: THREE.Material,
    glove: THREE.Material,
    wrap: THREE.Material,
    sleeve: THREE.Material,
  ): ArmRig {
    const root = new THREE.Group();
    root.layers.set(1);

    const sleeveGeometry = new THREE.CylinderGeometry(0.068, 0.076, 0.2, 10);
    const sleeveMesh = new THREE.Mesh(sleeveGeometry, sleeve);
    sleeveMesh.rotation.x = Math.PI / 2;
    sleeveMesh.position.set(0, 0, -0.08);

    const forearmGeometry = new THREE.CylinderGeometry(0.066, 0.042, 0.27, 10);
    const forearm = new THREE.Mesh(forearmGeometry, skin);
    forearm.rotation.x = Math.PI / 2;
    forearm.position.set(0, 0, -0.3);

    const hand = new THREE.Group();
    const palm = createBox(0.078, 0.044, 0.11, glove);
    palm.position.set(0, 0, -0.06);
    hand.add(palm);

    const knuckle = createBox(0.082, 0.036, 0.04, wrap);
    knuckle.position.set(0, 0.004, -0.115);
    hand.add(knuckle);

    for (let finger = 0; finger < 4; finger += 1) {
      const digit = createBox(0.016, 0.02, 0.068, finger === 0 ? skin : glove);
      digit.position.set(-0.027 + finger * 0.018, -0.002, -0.162);
      digit.rotation.x = 0.12;
      hand.add(digit);
    }

    const thumb = createBox(0.023, 0.026, 0.055, skin);
    thumb.position.set(side * 0.048, -0.008, -0.075);
    thumb.rotation.z = side * 0.6;
    hand.add(thumb);

    const wristWrap = createBox(0.086, 0.052, 0.05, wrap);
    wristWrap.position.set(0, 0, -0.006);
    hand.add(wristWrap);

    hand.position.set(0, 0, -0.43);

    root.add(sleeveMesh, forearm, hand);
    root.traverse((object) => object.layers.set(1));

    const basePosition = new THREE.Vector3(side * 0.31, -0.295, -0.2);
    const baseRotation = new THREE.Euler(-0.12, -side * 0.22, side * 0.1, "YXZ");

    root.position.copy(basePosition);
    root.rotation.copy(baseRotation);
    root.scale.setScalar(0.76);

    return { root, forearm, hand, sleeve: sleeveMesh, basePosition, baseRotation };
  }
}
