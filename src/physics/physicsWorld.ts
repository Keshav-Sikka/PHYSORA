import * as RAPIER from "@dimforge/rapier3d-compat";

import {
    PartType,
    type BodyState,
    type JointSpec,
    type PartSpec,
    type PhysicsWorldOptions,
    type Quaternion,
    type Vector3
} from "../parts/PartSpec";

import {
    partFactory
} from "../parts/PartFactory";

import {
    jointFactory
} from "./JointFactory";

export class PhysicsWorld {
    private world: RAPIER.World | null = null;

    private readonly bodies =
        new Map<string, RAPIER.RigidBody>();

    private readonly joints =
        new Map<string, RAPIER.ImpulseJoint>();

    private readonly jointSpecs =
        new Map<string, JointSpec>();

    private readonly gravity: Vector3;

    private readonly fixedTimestep: number;

    private readonly maxSubSteps: number;

    private readonly maxFrameDelta: number;

    private accumulator = 0;

    constructor(options: PhysicsWorldOptions = {}) {
        this.gravity = options.gravity ?? {
            x: 0,
            y: -9.81,
            z: 0
        };

        this.fixedTimestep =
            options.fixedTimestep ?? 1 / 60;

        this.maxSubSteps =
            options.maxSubSteps ?? 8;

        this.maxFrameDelta =
            options.maxFrameDelta ?? 0.25;

        if (this.fixedTimestep <= 0) {
            throw new Error(
                "fixedTimestep must be greater than zero."
            );
        }

        if (this.maxSubSteps <= 0) {
            throw new Error(
                "maxSubSteps must be greater than zero."
            );
        }

        if (this.maxFrameDelta <= 0) {
            throw new Error(
                "maxFrameDelta must be greater than zero."
            );
        }
    }

    async init(): Promise<void> {
        if (this.world !== null) {
            return;
        }

        await RAPIER.init();

        this.world = new RAPIER.World(
            this.gravity
        );

        this.world.timestep =
            this.fixedTimestep;
    }

    private requireWorld(): RAPIER.World {
        if (this.world === null) {
            throw new Error(
                "PhysicsWorld has not been initialized. Call init() first."
            );
        }

        return this.world;
    }

    /*
     * Advances the simulation by exactly one fixed timestep.
     */
    step(): void {
        const world = this.requireWorld();

        world.timestep =
            this.fixedTimestep;

        world.step();
    }

    /*
     * Feed real frame time into the physics engine.
     *
     * Example:
     * physics.advance(deltaSeconds);
     *
     * Returns the number of physics steps executed.
     */
    advance(deltaSeconds: number): number {
        if (!Number.isFinite(deltaSeconds)) {
            throw new Error(
                "deltaSeconds must be a finite number."
            );
        }

        if (deltaSeconds < 0) {
            throw new Error(
                "deltaSeconds cannot be negative."
            );
        }

        const clampedDelta =
            Math.min(
                deltaSeconds,
                this.maxFrameDelta
            );

        this.accumulator += clampedDelta;

        let steps = 0;

        while (
            this.accumulator >= this.fixedTimestep &&
            steps < this.maxSubSteps
        ) {
            this.step();

            this.accumulator -=
                this.fixedTimestep;

            steps++;
        }

        /*
         * Prevent a spiral of death after a very long frame.
         */
        if (
            steps === this.maxSubSteps &&
            this.accumulator >= this.fixedTimestep
        ) {
            this.accumulator = 0;
        }

        return steps;
    }

    getInterpolationAlpha(): number {
        return (
            this.accumulator /
            this.fixedTimestep
        );
    }

    addPart(
        spec: PartSpec
    ): RAPIER.RigidBody {
        const world = this.requireWorld();

        if (this.bodies.has(spec.id)) {
            throw new Error(
                `Part with ID "${spec.id}" already exists.`
            );
        }

        const created =
            partFactory(world, spec);

        this.bodies.set(
            spec.id,
            created.body
        );

        return created.body;
    }

    getPart(
        id: string
    ): RAPIER.RigidBody | null {
        return this.bodies.get(id) ?? null;
    }

    getPartState(
        id: string
    ): BodyState | null {
        const body = this.bodies.get(id);

        if (body === undefined) {
            return null;
        }

        return this.createBodyState(
            id,
            body
        );
    }

    getAllPartStates(): BodyState[] {
        const states: BodyState[] = [];

        for (const [id, body] of this.bodies) {
            states.push(
                this.createBodyState(id, body)
            );
        }

        return states;
    }

    private createBodyState(
        id: string,
        body: RAPIER.RigidBody
    ): BodyState {
        const position =
            body.translation();

        const rotation =
            body.rotation();

        const linearVelocity =
            body.linvel();

        const angularVelocity =
            body.angvel();

        return {
            id,

            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },

            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z,
                w: rotation.w
            },

            linearVelocity: {
                x: linearVelocity.x,
                y: linearVelocity.y,
                z: linearVelocity.z
            },

            angularVelocity: {
                x: angularVelocity.x,
                y: angularVelocity.y,
                z: angularVelocity.z
            },

            sleeping: body.isSleeping(),

            dynamic: body.isDynamic(),

            fixed: body.isFixed(),

            kinematic: body.isKinematic()
        };
    }

    removePart(id: string): boolean {
        const world = this.requireWorld();

        const body =
            this.bodies.get(id);

        if (body === undefined) {
            return false;
        }

        /*
         * Removing a rigid-body also removes
         * its attached colliders and joints.
         *
         * Remove corresponding joint entries
         * from our registry as well.
         */
        for (const [
            jointId,
            spec
        ] of this.jointSpecs) {
            if (
                spec.bodyA === id ||
                spec.bodyB === id
            ) {
                this.jointSpecs.delete(
                    jointId
                );

                this.joints.delete(
                    jointId
                );
            }
        }

        world.removeRigidBody(body);

        this.bodies.delete(id);

        return true;
    }

    createJoint(
        spec: JointSpec
    ): RAPIER.ImpulseJoint {
        const world = this.requireWorld();

        if (this.joints.has(spec.id)) {
            throw new Error(
                `Joint with ID "${spec.id}" already exists.`
            );
        }

        const bodyA =
            this.bodies.get(spec.bodyA);

        const bodyB =
            this.bodies.get(spec.bodyB);

        if (bodyA === undefined) {
            throw new Error(
                `Joint "${spec.id}" references missing body "${spec.bodyA}".`
            );
        }

        if (bodyB === undefined) {
            throw new Error(
                `Joint "${spec.id}" references missing body "${spec.bodyB}".`
            );
        }

        const joint =
            jointFactory(
                world,
                spec,
                bodyA,
                bodyB
            );

        this.joints.set(
            spec.id,
            joint
        );

        this.jointSpecs.set(
            spec.id,
            spec
        );

        return joint;
    }

    getJoint(
        id: string
    ): RAPIER.ImpulseJoint | null {
        return this.joints.get(id) ?? null;
    }

    removeJoint(id: string): boolean {
        const world = this.requireWorld();

        const joint =
            this.joints.get(id);

        if (joint === undefined) {
            return false;
        }

        world.removeImpulseJoint(
            joint,
            true
        );

        this.joints.delete(id);
        this.jointSpecs.delete(id);

        return true;
    }

    setPosition(
        id: string,
        position: Vector3
    ): void {
        const body = this.requireBody(id);

        body.setTranslation(
            position,
            true
        );
    }

    setRotation(
        id: string,
        rotation: Quaternion
    ): void {
        const body = this.requireBody(id);

        body.setRotation(
            rotation,
            true
        );
    }

    setLinearVelocity(
        id: string,
        velocity: Vector3
    ): void {
        const body = this.requireBody(id);

        body.setLinvel(
            velocity,
            true
        );
    }

    setAngularVelocity(
        id: string,
        velocity: Vector3
    ): void {
        const body = this.requireBody(id);

        body.setAngvel(
            velocity,
            true
        );
    }

    applyForce(
        id: string,
        force: Vector3
    ): void {
        const body = this.requireBody(id);

        body.addForce(
            force,
            true
        );
    }

    applyImpulse(
        id: string,
        impulse: Vector3
    ): void {
        const body = this.requireBody(id);

        body.applyImpulse(
            impulse,
            true
        );
    }

    applyTorque(
        id: string,
        torque: Vector3
    ): void {
        const body = this.requireBody(id);

        body.addTorque(
            torque,
            true
        );
    }

    applyTorqueImpulse(
        id: string,
        torqueImpulse: Vector3
    ): void {
        const body = this.requireBody(id);

        body.applyTorqueImpulse(
            torqueImpulse,
            true
        );
    }

    wakePart(id: string): void {
        const body = this.requireBody(id);

        body.wakeUp();
    }

    sleepPart(id: string): void {
        const body = this.requireBody(id);

        body.sleep();
    }

    private requireBody(
        id: string
    ): RAPIER.RigidBody {
        const body =
            this.bodies.get(id);

        if (body === undefined) {
            throw new Error(
                `Part "${id}" does not exist.`
            );
        }

        return body;
    }

    getPartCount(): number {
        return this.bodies.size;
    }

    getJointCount(): number {
        return this.joints.size;
    }

    clear(): void {
        const world = this.requireWorld();

        /*
         * Rapier removes attached joints when
         * rigid-bodies are removed, so clear our
         * registries first.
         */
        this.joints.clear();
        this.jointSpecs.clear();

        for (const body of this.bodies.values()) {
            world.removeRigidBody(body);
        }

        this.bodies.clear();

        this.accumulator = 0;
    }

    dispose(): void {
        if (this.world === null) {
            return;
        }

        this.bodies.clear();
        this.joints.clear();
        this.jointSpecs.clear();

        this.world.free();

        this.world = null;
        this.accumulator = 0;
    }

    getFixedTimestep(): number {
        return this.fixedTimestep;
    }

    getGravity(): Vector3 {
        return {
            x: this.gravity.x,
            y: this.gravity.y,
            z: this.gravity.z
        };
    }
}