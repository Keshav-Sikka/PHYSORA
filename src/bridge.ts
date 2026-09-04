import * as THREE from "three";

export type Vector3Tuple = [number, number, number];
export type PhysicsBodyType = "static" | "dynamic" | "kinematic";
export type PhysicsJointType = "fixed" | "hinge" | "spring";

export interface PhysicsBodyDefinition {
  id: string;
  type: PhysicsBodyType;
  collider: "box" | "cylinder";
  position: Vector3Tuple;
  size: Vector3Tuple;
  massKg?: number;
}

export interface PhysicsJointDefinition {
  id: string;
  type: PhysicsJointType;
  bodyA: string;
  bodyB: string;
  anchor: Vector3Tuple;
  breakForceN?: number;
  breakTorqueNm?: number;
}

export interface PhysicsManifest {
  bodies: PhysicsBodyDefinition[];
  joints: PhysicsJointDefinition[];
}

export interface BridgeJSON {
  bridge: { length: number; width: number; deckHeight: number };
  deck: {
    thickness: number;
    jointPositions?: number[];
    jointGap?: number;
    massKgPerMeter?: number;
  };
  pillars: { positions: number[]; radius: number; height: number };
  joints?: { type?: PhysicsJointType; breakForceN?: number; breakTorqueNm?: number };
  cables?: { enabled: boolean; towerHeight: number; cableRadius: number; hangers: number };
}

export class BridgeBuilder {
  private group = new THREE.Group();
  private manifest: PhysicsManifest = { bodies: [], joints: [] };
  private meshesByBodyId = new Map<string, THREE.Mesh>();

  constructor(private scene: THREE.Scene) {
    this.group.name = "parametric-bridge";
    scene.add(this.group);
  }

  get object3D(): THREE.Group {
    return this.group;
  }

  getPhysicsManifest(): PhysicsManifest {
    return structuredClone(this.manifest);
  }

  getMeshForBody(bodyId: string): THREE.Mesh | undefined {
    return this.meshesByBodyId.get(bodyId);
  }

  clear(): void {
    this.manifest = { bodies: [], joints: [] };
    this.meshesByBodyId.clear();
    while (this.group.children.length > 0) {
      const object = this.group.children[0]!;
      this.group.remove(object);
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) {
          Array.isArray(mesh.material)
            ? mesh.material.forEach((m) => m.dispose())
            : mesh.material.dispose();
        }
      });
    }
  }

  build(data: BridgeJSON): void {
    this.clear();
    this.createPillars(data);
    this.createDeckSegments(data);
    if (data.cables?.enabled) this.createCables(data);
  }

  private createPillars(data: BridgeJSON): void {
    for (const x of data.pillars.positions) {
      const id = `pillar-${x}`;
      const geom = new THREE.CylinderGeometry(
        data.pillars.radius,
        data.pillars.radius,
        data.pillars.height,
        32
      );
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          color: 0x052e16,
          emissive: 0x00ea75,
          emissiveIntensity: 0.35,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: 0.85
        })
      );
      mesh.name = id;
      mesh.position.set(x, data.bridge.deckHeight - data.pillars.height / 2, 0);

      this.registerBody(mesh, {
        id,
        type: "static",
        collider: "cylinder",
        position: [x, mesh.position.y, 0],
        size: [data.pillars.radius, data.pillars.height, data.pillars.radius]
      });
    }
  }

  private createDeckSegments(data: BridgeJSON): void {
    const joints = this.getDeckJointPositions(data);
    const gap = Math.max(0, data.deck.jointGap ?? 0.12);
    const segmentIds: string[] = [];

    for (let index = 0; index < joints.length - 1; index++) {
      const left = joints[index]!;
      const right = joints[index + 1]!;
      const fullLength = right - left;
      const id = `deck-segment-${index}`;

      const geom = new THREE.BoxGeometry(
        Math.max(0.01, fullLength - gap),
        data.deck.thickness,
        data.bridge.width
      );

      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          color: 0x064e3b,
          emissive: 0x10b981,
          emissiveIntensity: 0.45,
          roughness: 0.15,
          metalness: 0.85,
          transparent: true,
          opacity: 0.88
        })
      );
      mesh.name = id;
      mesh.position.set((left + right) / 2, data.bridge.deckHeight, 0);

      const edges = new THREE.EdgesGeometry(geom);
      const edgeLines = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45 })
      );
      mesh.add(edgeLines);

      this.registerBody(mesh, {
        id,
        type: "dynamic",
        collider: "box",
        position: [mesh.position.x, mesh.position.y, 0],
        size: [fullLength, data.deck.thickness, data.bridge.width],
        massKg: fullLength * (data.deck.massKgPerMeter ?? 1500)
      });
      segmentIds.push(id);
    }

    for (let index = 1; index < joints.length - 1; index++) {
      const x = joints[index]!;
      this.createJointMarker(x, data.bridge.deckHeight, data.bridge.width);
      this.registerJoint({
        id: `deck-joint-${index}`,
        type: data.joints?.type ?? "fixed",
        bodyA: segmentIds[index - 1]!,
        bodyB: segmentIds[index]!,
        anchor: [x, data.bridge.deckHeight, 0],
        breakForceN: data.joints?.breakForceN,
        breakTorqueNm: data.joints?.breakTorqueNm
      });
    }

    for (const x of data.pillars.positions) {
      const pillarId = `pillar-${x}`;
      const matchingSegments = segmentIds.filter(
        (_, index) =>
          Math.abs(joints[index]! - x) < 0.0001 || Math.abs(joints[index + 1]! - x) < 0.0001
      );
      for (const deckId of matchingSegments) {
        this.registerJoint({
          id: `support-${pillarId}-${deckId}`,
          type: data.joints?.type ?? "fixed",
          bodyA: pillarId,
          bodyB: deckId,
          anchor: [x, data.bridge.deckHeight, 0],
          breakForceN: data.joints?.breakForceN,
          breakTorqueNm: data.joints?.breakTorqueNm
        });
      }
    }
  }

  private getDeckJointPositions(data: BridgeJSON): number[] {
    const values = [0, data.bridge.length, ...(data.deck.jointPositions ?? data.pillars.positions)];
    return [...new Set(values.filter((x) => x >= 0 && x <= data.bridge.length))].sort((a, b) => a - b);
  }

  private createJointMarker(x: number, y: number, width: number): void {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.3, width + 0.08),
      new THREE.MeshStandardMaterial({
        color: 0x6ee7b7,
        emissive: 0x6ee7b7,
        emissiveIntensity: 0.95
      })
    );
    marker.name = `joint-marker-${x}`;
    marker.position.set(x, y, 0);
    marker.userData.physics = { role: "joint-marker" };
    this.group.add(marker);
  }

  private registerBody(mesh: THREE.Mesh, body: PhysicsBodyDefinition): void {
    mesh.userData.physics = { role: "body", bodyId: body.id, bodyType: body.type };
    this.group.add(mesh);
    this.meshesByBodyId.set(body.id, mesh);
    this.manifest.bodies.push(body);
  }

  private registerJoint(joint: PhysicsJointDefinition): void {
    this.manifest.joints.push(joint);
  }

  private createCables(data: BridgeJSON): void {
    const cable = data.cables!;
    const positions = data.pillars.positions;
    if (positions.length < 2) return;
    const leftTower = positions[0]!;
    const rightTower = positions[positions.length - 1]!;

    for (const x of [leftTower, rightTower]) {
      const geom = new THREE.BoxGeometry(2, cable.towerHeight, 2);
      const tower = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          color: 0x064e3b,
          emissive: 0x00ea75,
          emissiveIntensity: 0.4,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: 0.82
        })
      );
      tower.name = `tower-${x}`;
      tower.position.set(x, data.bridge.deckHeight + cable.towerHeight / 2, 0);
      tower.userData.physics = { role: "visual-tower" };

      const towerEdges = new THREE.EdgesGeometry(geom);
      const towerLines = new THREE.LineSegments(
        towerEdges,
        new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.5 })
      );
      tower.add(towerLines);

      this.group.add(tower);
    }

    const points = Array.from({ length: 31 }, (_, index) => {
      const t = index / 30;
      return new THREE.Vector3(
        leftTower + (rightTower - leftTower) * t,
        data.bridge.deckHeight + cable.towerHeight - 25 * Math.sin(Math.PI * t),
        0
      );
    });

    const mainCable = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, cable.cableRadius, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x10b981,
        emissiveIntensity: 0.7,
        roughness: 0.1,
        metalness: 0.9
      })
    );
    mainCable.name = "main-cable";
    this.group.add(mainCable);
  }
}