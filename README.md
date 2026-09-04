# PHYSORA

> Generative Structural Engineering & Real-Time Physics Validation Simulator

<video src="./media/demo_video.mp4" controls width="100%"></video>

PHYSORA is an AI-powered simulation engine that translates natural language architectural prompts into parametric exportable 3D structural models and tests their physical integrity under real-time stress dynamics. Built during a hackathon, it targets civil engineers and architects looking to prototype and benchmark bridge blueprints before commissioning physical structures.

---

## Architecture Overview

PHYSORA operates as a pipeline connecting generative language models, 3D parametric rendering, and deterministic rigid-body impulse physics.

+-----------------------+       +-------------------------+       +------------------------+
|   User Natural Text   | ----> |      Gemini 3.6 LLM     | ----> |   Structured Blueprint |
|   "180m Dual-Pylon"   |       |   (Parametric Schema)   |       |      (BridgeJSON)      |
+-----------------------+       +-------------------------+       +------------------------+
                                                                               |
                                                                               v
+-----------------------+       +-------------------------+       +------------------------+
|   Three.js Viewport   | <---- |  PhysicsBridgeAdapter   | <---- |     BridgeBuilder      |
|  (Hologram Rendering) |       |  (Vector Translation)   |       |   (Assembly Engine)    |
+-----------------------+       +-------------------------+       +------------------------+
            |                               |
            v                               v
+---------------------------------------------------------+
|                Rapier3D Physics Core                    |
|    (Impulse Joints, Dynamic Shear, Real-Time Stress)    |
+---------------------------------------------------------+

![Interface Preview](./media/demo_images/Stable_Bridge.png)

## Data Pipeline Sequence

[User Prompt]
      │
      ▼
[Gemini API (gemini-3.6-flash)] 
      │ Validates parameters against structural grammar
      ▼
[BridgeJSON Blueprint]
      │ Dimensions, joint intervals, pier positions, cable specs
      ▼
[BridgeBuilder (Three.js)]
      │ Generates visual geometries and computes PhysicsManifest
      ▼
[PhysicsBridgeAdapter]
      │ Translates array tuples to vector objects, calculates
      │ relative anchor offsets, and scales collision gaps
      ▼
[Rapier3D World]
      │ Instantiates dynamic bodies and impulse joints
      ▼
[Render / Simulation Loop]
      │ Steps simulation (60 FPS) and syncs transforms to visual meshes
      ▼
[Stress Engine Benchmark]
      │ Evaluates concentrated loads and severs joints under critical shear

![Interface Preview](./media/demo_images/Inspect+download_feature.png)

## Key Features & Technical Strengths

• Zero-Hallucination Schema Enforcement: The LLM generates strict, type-checked blueprints containing spatial coordinates, pillar radiuses, deck thicknesses, and joint intervals.

• Seam-Collision Mitigation: Solves contact chatter across adjacent segmented road slabs via adaptive geometric shrinkage, isolating joint calculations from solver contact fighting.

• Deterministic Shear Failure: Unlike purely visual tools, PHYSORA tracks real-time strain and load application. Dropping excessive concentrated mass severs impulse constraints and triggers physical collapse.

• Unified Client Architecture: Powered by Vite, running WebAssembly-compiled physics (Rapier3D) and WebGL rendering (Three.js) in a single unified thread.

![Interface Preview](./media/demo_images/Unstable_Bridge_example.png)

## Tech Stack

• Language: TypeScript
• 3D Visual Engine: Three.js
• Physics Simulator: @dimforge/rapier3d-compat (Rapier3D WASM)
• LLM Engine: Google Gemini API (gemini-3.6-flash)
• Tooling: Vite, Node.js

## Local Development Setup

Prerequisites:
• Node.js (v18.0.0 or higher)
• npm (v9.0.0 or higher)
• Google Gemini API Key

**Installation**:
1. Clone the repository
2. Install dependencies: npm install
3. Configure .env file in the project root and add your API key
4. npm run dev: npm run dev

## Team Contributions

• **Keshav Sikka** (Team Lead): Architectural design, LLM integration (llm.ts), full-stack frontend interface, camera auto-framing, audio synthesis, and the PhysicsBridgeAdapter interop layer linking Three.js and Rapier3D.

• **Abhishek Gupta**: Three.js visual assembly core (bridge.ts), parametric geometry generation, cable catenary curve calculations, and scene lighting.

• **Udit Jain**: Physics engine implementation (physicsWorld.ts, PartFactory.ts, JointFactory.ts), Rapier3D wrapper, fixed timestep accumulator, and impulse joint bindings.

• **Sarthak Singh**: Project pitch presentation, deck architectur, and presentation collateral.