import { PhysicsWorld, PartType, JointType } from "./physics";
import type { PhysicsManifest, PhysicsJointDefinition } from "./bridge";

export class PhysicsBridgeAdapter {
  private activeJoints = new Map<string, PhysicsJointDefinition>();
  private initialYPositions = new Map<string, number>();

  constructor(private physics: PhysicsWorld) {}

  public getActiveJoints(): Map<string, PhysicsJointDefinition> {
    return this.activeJoints;
  }

  public getInitialY(bodyId: string): number | undefined {
    return this.initialYPositions.get(bodyId);
  }

  /** Returns all active joint IDs connected to a specific rigid body */
  public getConnectedJoints(bodyId: string): string[] {
    const connected: string[] = [];
    for (const [jointId, def] of this.activeJoints) {
      if (def.bodyA === bodyId || def.bodyB === bodyId) {
        connected.push(jointId);
      }
    }
    return connected;
  }

  public removeActiveJoint(jointId: string): void {
    this.activeJoints.delete(jointId);
  }

  public loadManifest(manifest: PhysicsManifest): void {
    this.activeJoints.clear();
    this.initialYPositions.clear();

    const bodyPositions = new Map<string, [number, number, number]>();

    // 1. Register Bodies with Proportional Sizing and Damping
    for (const b of manifest.bodies) {
      bodyPositions.set(b.id, b.position);
      this.initialYPositions.set(b.id, b.position[1]);

      const isDeck = b.id.startsWith("deck-segment");

      // 22% shrinkage locks out adjacent slab collisions
      const shrinkMargin = isDeck
      ? Math.min(Math.max(b.size[0] * 0.22, 1.5), 4.5)
      : 0;;

      this.physics.addPart({
        id: b.id,
        type: b.collider === "cylinder" ? PartType.beam : PartType.box,
        position: { x: b.position[0], y: b.position[1], z: b.position[2] },
        size: {
          x: isDeck ? Math.max(0.2, b.size[0] - shrinkMargin) : b.size[0],
          y: b.size[1],
          z: b.size[2]
        },
        dynamic: b.type === "dynamic",
        linearDamping: b.type === "dynamic" ? 2.0 : 0,
        angularDamping: b.type === "dynamic" ? 3.0 : 0,
        canSleep: false,
        material: {
          mass: b.massKg ?? (b.type === "dynamic" ? 1500 : 0),
          friction: 0.95,
          restitution: 0.0
        }
      });
    }

    // 2. Register Joints
    for (const j of manifest.joints) {
      const posA = bodyPositions.get(j.bodyA);
      const posB = bodyPositions.get(j.bodyB);

      if (!posA || !posB) continue;

      const localAnchorA = {
        x: j.anchor[0] - posA[0],
        y: j.anchor[1] - posA[1],
        z: j.anchor[2] - posA[2]
      };

      const localAnchorB = {
        x: j.anchor[0] - posB[0],
        y: j.anchor[1] - posB[1],
        z: j.anchor[2] - posB[2]
      };

      let jointType = JointType.fixed;
      if (j.type === "hinge") jointType = JointType.revolute;
      if (j.type === "spring") jointType = JointType.spherical;

      try {
        this.physics.createJoint({
          id: j.id,
          type: jointType,
          bodyA: j.bodyA,
          bodyB: j.bodyB,
          anchorA: localAnchorA,
          anchorB: localAnchorB,
          axis: { x: 0, y: 0, z: 1 }
        });

        this.activeJoints.set(j.id, j);
      } catch (err) {
        console.warn(`Could not bind joint ${j.id}:`, err);
      }
    }
  }
}