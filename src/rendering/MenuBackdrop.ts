import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { LevelMaterialType } from "../levels/LevelTypes";
import type { MaterialLibrary } from "./MaterialLibrary";

/**
 * Visual-only prologue vignette shown behind the main menu and results screens.
 * It reuses the procedural material library but owns no physics, gameplay
 * objects, or level runtime state.
 */
export class MenuBackdrop implements Disposable {
  readonly group = new THREE.Group();

  private readonly materials: MaterialLibrary;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private disposed = false;

  constructor(materials: MaterialLibrary) {
    this.materials = materials;
    this.group.name = "menu-backdrop";
    this.group.visible = false;

    this.buildRoof();
    this.buildTower();
    this.buildCity();
    this.buildDetails();
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.group.removeFromParent();
    this.unitBox.dispose();

    for (const geometry of this.ownedGeometries) {
      geometry.dispose();
    }

    this.ownedGeometries.length = 0;
    this.group.clear();
  }

  private addBox(
    x: number,
    y: number,
    z: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    material: LevelMaterialType,
    castShadow = true,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.unitBox, this.materials.get(material));

    mesh.position.set(x, y, z);
    mesh.scale.set(sizeX, sizeY, sizeZ);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    return mesh;
  }

  private addSign(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    rotationY: number,
    background: number,
    textColor: number,
    accent: number,
  ): void {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(
      geometry,
      this.materials.getSign({ text, background, textColor, accent }),
    );

    this.ownedGeometries.push(geometry);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, 1);
    mesh.rotation.y = rotationY;
    this.group.add(mesh);
  }

  private buildRoof(): void {
    this.addBox(0, -0.1, 0, 22, 0.2, 44, "roof");
    this.addBox(-11.2, 0.52, 0, 0.36, 1.05, 44, "facade");
    this.addBox(11.2, 0.52, 0, 0.36, 1.05, 44, "facade");
    this.addBox(0, 0.52, -22.2, 22.4, 1.05, 0.36, "facade");

    // Central service duct and route paint, read as a parkour line from above.
    this.addBox(-1.9, 1.3, -7.6, 0.4, 2.6, 4, "white");
    this.addBox(1.9, 1.3, -7.6, 0.4, 2.6, 4, "white");
    this.addBox(0, 1.15, -7.6, 4, 0.2, 4, "metal");

    for (let z = 4.6; z > -20; z -= 2.6) {
      this.addBox(0, 0.014, z, 0.16, 0.02, 1.15, "red", false);
    }

    this.addBox(-8.6, 0.9, 2.2, 2.4, 1.6, 1.8, "metal");
    this.addBox(8.4, 1.0, -2.6, 2.4, 1.6, 1.8, "metal");
    this.addBox(6.5, 1.1, -8, 0.5, 2.2, 0.5, "red");
  }

  private buildTower(): void {
    this.addBox(-8.4, 9, -8, 0.8, 18, 36, "glass");

    for (let level = 0; level < 5; level += 1) {
      this.addBox(-7.96, 2.2 + level * 3.6, -8, 0.2, 0.22, 35.6, "facade");
    }

    for (let z = -25; z <= 9; z += 3.2) {
      this.addBox(-7.98, 9, z, 0.16, 17.6, 0.16, "metal", false);
    }

    for (const z of [-22, -12, -2]) {
      const brace = this.addBox(-7.82, 8.6, z, 0.26, 18.5, 0.26, "metal");
      brace.rotation.x = 0.28;
    }

    this.addSign("RUN", -7.54, 7.2, -4.6, 3, 3, Math.PI / 2, 0xdd5d1b, 0xfff6ea, 0x111418);
    this.addSign(
      "01\nROOFTOP",
      -7.9,
      3.1,
      1.4,
      2.2,
      0.95,
      Math.PI / 2,
      0xf4f1e9,
      0x14191d,
      0xd52e36,
    );
    this.addSign(
      "02\nINDUSTRIAL",
      -7.9,
      3.1,
      -8.2,
      2.2,
      0.95,
      Math.PI / 2,
      0xf4f1e9,
      0x14191d,
      0xd52e36,
    );
  }

  private buildCity(): void {
    const towers: readonly (readonly [
      number,
      number,
      number,
      number,
      number,
      LevelMaterialType,
    ])[] = [
      [28, -28, 18, 34, 38, "facade"],
      [35, -78, 24, 40, 62, "glass-far"],
      [-32, -42, 20, 32, 42, "facade"],
      [-27, 18, 18, 26, 24, "concrete"],
      [44, 8, 20, 26, 30, "glass-far"],
      [0, -88, 42, 34, 66, "glass-far"],
      [-48, -72, 26, 30, 50, "concrete"],
      [18, -58, 16, 24, 32, "facade"],
    ];

    for (const [x, z, width, depth, top, material] of towers) {
      this.addBox(x, (top + -31) / 2, z, width, top + 31, depth, material);
      this.addBox(x, top + 0.25, z, width + 0.5, 0.5, depth + 0.5, "concrete");

      for (let band = 0; band < 4; band += 1) {
        this.addBox(
          x + (x > 0 ? -1 : 1) * (width / 2 + 0.04),
          top - 4 - band * 4.4,
          z,
          0.1,
          1.2,
          depth * 0.8,
          band === 2 ? "warm-light" : "glass",
          false,
        );
      }
    }

    // Windows and a hero billboard on the near right tower, so the menu's
    // open side reads as a designed city view rather than a blank wall.
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        this.addBox(
          18.94,
          5.5 + row * 3.3,
          -43 + column * 5.4,
          0.08,
          1.7,
          3.2,
          (row + column) % 4 === 0 ? "warm-light" : "glass-far",
          false,
        );
      }
    }

    this.addSign("RUN", 18.86, 15, -29, 9, 5, -Math.PI / 2, 0xdd5d1b, 0xfff6ea, 0x111418);

    for (let index = 0; index < 18; index += 1) {
      const x = -70 + ((index * 37) % 140);
      const z = -105 - ((index * 23) % 120);
      const height = 26 + ((index * 17) % 70);

      this.addBox(
        x,
        (height + -31) / 2,
        z,
        12 + (index % 4) * 5,
        height + 31,
        12 + (index % 3) * 4,
        "glass-far",
        false,
      );
    }
  }

  private buildDetails(): void {
    // A few red/ivory accents make the composition read like the prologue.
    this.addBox(-9.8, 0.5, 12, 2.6, 1.0, 2.0, "metal");
    this.addBox(-9.8, 1.3, 12, 2.4, 0.14, 1.8, "dark-metal");
    this.addBox(7.4, 0.4, 16, 1.8, 0.8, 1.4, "white");
    this.addSign("GLASSLINE", 5.6, 4.4, -23.8, 5.4, 1.3, 0, 0x14191d, 0xf4f1e9, 0xd52e36);
  }
}
