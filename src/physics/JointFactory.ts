import * as RAPIER from "@dimforge/rapier3d-compat";

import {
    JointType,
    type JointSpec,
    type Quaternion
} from "../parts/PartSpec";

const IDENTITY_ROTATION: Quaternion = {
    x: 0,
    y: 0,
    z: 0,
    w: 1
};

export function jointFactory(
    world: RAPIER.World,
    spec: JointSpec,
    bodyA: RAPIER.RigidBody,
    bodyB: RAPIER.RigidBody
): RAPIER.ImpulseJoint {
    switch (spec.type) {
        case JointType.spherical:
            return world.createImpulseJoint(
                RAPIER.JointData.spherical(
                    spec.anchorA,
                    spec.anchorB
                ),
                bodyA,
                bodyB,
                true
            );

        case JointType.revolute:
            if (spec.axis === undefined) {
                throw new Error(
                    `Revolute joint "${spec.id}" requires an axis.`
                );
            }

            return world.createImpulseJoint(
                RAPIER.JointData.revolute(
                    spec.anchorA,
                    spec.anchorB,
                    spec.axis
                ),
                bodyA,
                bodyB,
                true
            );

        case JointType.rope:
            if (spec.length === undefined) {
                throw new Error(
                    `Rope joint "${spec.id}" requires a length.`
                );
            }

            if (spec.length <= 0) {
                throw new Error(
                    `Rope joint "${spec.id}" must have a positive length.`
                );
            }

            return world.createImpulseJoint(
                RAPIER.JointData.rope(
                    spec.length,
                    spec.anchorA,
                    spec.anchorB
                ),
                bodyA,
                bodyB,
                true
            );

        case JointType.fixed: {
            const frameA =
                spec.frameA ?? IDENTITY_ROTATION;

            const frameB =
                spec.frameB ?? IDENTITY_ROTATION;

            return world.createImpulseJoint(
                RAPIER.JointData.fixed(
                    spec.anchorA,
                    frameA,
                    spec.anchorB,
                    frameB
                ),
                bodyA,
                bodyB,
                true
            );
        }

        default:
            throw new Error(
                `Unsupported joint type: ${String(spec.type)}`
            );
    }
}