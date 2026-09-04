import * as RAPIER from "@dimforge/rapier3d-compat";

import {
    PartType,
    type PartSpec
} from "./PartSpec";

export interface CreatedPart {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
}

function validatePartSpec(spec: PartSpec): void {
    if (!spec.id.trim()) {
        throw new Error("Part ID cannot be empty.");
    }

    if (spec.size.x <= 0 || spec.size.y <= 0 || spec.size.z <= 0) {
        throw new Error(
            `Part "${spec.id}" must have positive dimensions.`
        );
    }

    if (spec.material?.density !== undefined) {
        if (spec.material.density < 0) {
            throw new Error(
                `Part "${spec.id}" density cannot be negative.`
            );
        }
    }

    if (spec.material?.mass !== undefined) {
        if (spec.material.mass < 0) {
            throw new Error(
                `Part "${spec.id}" mass cannot be negative.`
            );
        }
    }

    if (spec.material?.friction !== undefined) {
        if (spec.material.friction < 0) {
            throw new Error(
                `Part "${spec.id}" friction cannot be negative.`
            );
        }
    }

    if (spec.material?.restitution !== undefined) {
        if (
            spec.material.restitution < 0 ||
            spec.material.restitution > 1
        ) {
            throw new Error(
                `Part "${spec.id}" restitution must be between 0 and 1.`
            );
        }
    }

    if (spec.type === PartType.sphere) {
        if (
            spec.size.x !== spec.size.y ||
            spec.size.x !== spec.size.z
        ) {
            throw new Error(
                `Sphere "${spec.id}" must have equal x, y and z dimensions.`
            );
        }
    }
}

export function partFactory(
    world: RAPIER.World,
    spec: PartSpec
): CreatedPart {
    validatePartSpec(spec);

    const rigidBodyDesc = spec.dynamic
        ? RAPIER.RigidBodyDesc.dynamic()
        : RAPIER.RigidBodyDesc.fixed();

    rigidBodyDesc
        .setTranslation(
            spec.position.x,
            spec.position.y,
            spec.position.z
        )
        .setUserData(spec.id);

    if (spec.rotation !== undefined) {
        rigidBodyDesc.setRotation(spec.rotation);
    }

    if (spec.linearVelocity !== undefined) {
        rigidBodyDesc.setLinvel(
            spec.linearVelocity.x,
            spec.linearVelocity.y,
            spec.linearVelocity.z
        );
    }

    if (spec.angularVelocity !== undefined) {
        rigidBodyDesc.setAngvel(spec.angularVelocity);
    }

    if (spec.gravityScale !== undefined) {
        rigidBodyDesc.setGravityScale(spec.gravityScale);
    }

    if (spec.linearDamping !== undefined) {
        rigidBodyDesc.setLinearDamping(spec.linearDamping);
    }

    if (spec.angularDamping !== undefined) {
        rigidBodyDesc.setAngularDamping(spec.angularDamping);
    }

    if (spec.ccd !== undefined) {
        rigidBodyDesc.setCcdEnabled(spec.ccd);
    }

    if (spec.canSleep !== undefined) {
        rigidBodyDesc.setCanSleep(spec.canSleep);
    }

    const body = world.createRigidBody(rigidBodyDesc);

    let colliderDesc: RAPIER.ColliderDesc;

    switch (spec.type) {
        case PartType.box:
        case PartType.beam:
            colliderDesc = RAPIER.ColliderDesc.cuboid(
                spec.size.x / 2,
                spec.size.y / 2,
                spec.size.z / 2
            );
            break;

        case PartType.sphere:
            colliderDesc = RAPIER.ColliderDesc.ball(
                spec.size.x / 2
            );
            break;

        default:
            throw new Error(
                `Unsupported part type: ${String(spec.type)}`
            );
    }

    const material = spec.material;

    if (material?.mass !== undefined) {
        
        colliderDesc.setDensity(0);
        colliderDesc.setMass(material.mass);
    } else if (material?.density !== undefined) {
        colliderDesc.setDensity(material.density);
    }

    if (material?.friction !== undefined) {
        colliderDesc.setFriction(material.friction);
    }

    if (material?.restitution !== undefined) {
        colliderDesc.setRestitution(material.restitution);
    }

    if (material?.sensor !== undefined) {
        colliderDesc.setSensor(material.sensor);
    }

    const collider = world.createCollider(
        colliderDesc,
        body
    );

    return {
        body,
        collider
    };
}