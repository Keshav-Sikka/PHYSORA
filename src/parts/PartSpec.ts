export type Vector3 = {
    x: number;
    y: number;
    z: number;
};

export type Quaternion = {
    x: number;
    y: number;
    z: number;
    w: number;
};

export enum PartType {
    box = "BOX",
    sphere = "SPHERE",
    beam = "BEAM"
}

export interface PhysicsMaterial {
    density?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    sensor?: boolean;
}

export interface PartSpec {
    id: string;

    type: PartType;

    position: Vector3;

    
    size: Vector3;

    dynamic: boolean;

    rotation?: Quaternion;

    linearVelocity?: Vector3;

    angularVelocity?: Vector3;

    gravityScale?: number;

    linearDamping?: number;

    angularDamping?: number;

    ccd?: boolean;

    canSleep?: boolean;

    material?: PhysicsMaterial;
}

export enum JointType {
    fixed = "FIXED",
    spherical = "SPHERICAL",
    revolute = "REVOLUTE",
    rope = "ROPE"
}

export interface JointSpec {
    id: string;

    type: JointType;

    bodyA: string;

    bodyB: string;

    anchorA: Vector3;

    anchorB: Vector3;

    
    axis?: Vector3;

    
    length?: number;

    
    frameA?: Quaternion;

    frameB?: Quaternion;
}

export interface BodyState {
    id: string;

    position: Vector3;

    rotation: Quaternion;

    linearVelocity: Vector3;

    angularVelocity: Vector3;

    sleeping: boolean;

    dynamic: boolean;

    fixed: boolean;

    kinematic: boolean;
}

export interface PhysicsWorldOptions {
    gravity?: Vector3;

    fixedTimestep?: number;

    maxSubSteps?: number;

    maxFrameDelta?: number;
}