import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { PhysicsWorld, PartType } from "./physics";
import { BridgeBuilder, BridgeJSON } from "./bridge";
import { PhysicsBridgeAdapter } from "./adapter";
import { generateBlueprint } from "./llm";
import "./style.css";

// 1. DOM Elements
const container = document.getElementById("canvas-container")!;
const chatHistory = document.getElementById("chat-history")!;
const chatForm = document.getElementById("chat-form") as HTMLFormElement;
const userInput = document.getElementById("user-input") as HTMLInputElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const dropBtn = document.getElementById("drop-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const exportBtn = document.getElementById("export-gltf-btn") as HTMLButtonElement;
const loadMassInput = document.getElementById("load-mass") as HTMLInputElement;
const telemetryBadge = document.getElementById("telemetry-badge")!;
const telemetryText = document.getElementById("telemetry-text")!;
const quickPrompts = document.querySelectorAll<HTMLButtonElement>(".prompt-chip");

// Drawer Elements
const blueprintDrawer = document.getElementById("blueprint-drawer")!;
const drawerToggle = document.getElementById("drawer-toggle")!;
const drawerClose = document.getElementById("drawer-close")!;
const blueprintCode = document.getElementById("blueprint-code")!;

// 2. Synthesized Zero-Dependency Audio Engine
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playTone(freq: number, type: OscillatorType, duration: number, gainVal: number) {
  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio unavailable:", e);
  }
}

function playImpactSound() {
  playTone(85, "triangle", 0.4, 0.4);
}

function playCollapseSound() {
  playTone(45, "sawtooth", 0.8, 0.6);
  setTimeout(() => playTone(30, "square", 0.6, 0.4), 100);
}

// 3. Three.js Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050706);
scene.fog = new THREE.FogExp2(0x050706, 0.0035);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting Setup
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(60, 100, 40);
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x00ea75, 0.4);
rimLight.position.set(-60, 20, -40);
scene.add(rimLight);

const grid = new THREE.GridHelper(500, 50, 0x10b981, 0x111c16);
grid.position.y = -0.5;
scene.add(grid);

// 4. Initialize Physics & Builders
const physics = new PhysicsWorld();
await physics.init();

const bridge = new BridgeBuilder(scene);
const adapter = new PhysicsBridgeAdapter(physics);

// Camera Shake State
let shakeIntensity = 0;

let currentLoadMesh: THREE.Mesh | null = null;
let activeTestLoadId: string | null = null;
let testLoadMassKg = 0;
let currentBridgeData: BridgeJSON | null = null;

function clearLoad(): void {
  if (currentLoadMesh) {
    scene.remove(currentLoadMesh);
    currentLoadMesh.geometry.dispose();
    physics.removePart("test-load");
    currentLoadMesh = null;
  }
  activeTestLoadId = null;
  testLoadMassKg = 0;
}

function updateTelemetry(status: "intact" | "failed", lengthM: number) {
  if (status === "intact") {
    telemetryBadge.className = "badge-intact";
    telemetryText.textContent = `STATUS: INTACT [${lengthM}m]`;
  } else {
    telemetryBadge.className = "badge-failed";
    telemetryText.textContent = `STATUS: CRITICAL FAILURE [SEVERED]`;
  }
}

function buildStructure(data: BridgeJSON) {
  clearLoad();
  physics.clear();
  currentBridgeData = data;

  bridge.build(data);
  const manifest = bridge.getPhysicsManifest();
  adapter.loadManifest(manifest);

  updateTelemetry("intact", data.bridge.length);

  blueprintCode.textContent = JSON.stringify(data, null, 2);

  // Auto-Frame Camera
  const midX = data.bridge.length / 2;
  const height = Math.max(data.bridge.deckHeight, data.cables?.towerHeight ?? 0);
  const distance = Math.max(data.bridge.length * 0.85, 75);

  controls.target.set(midX, height * 0.5, 0);
  camera.position.set(midX + distance * 0.5, height + distance * 0.35, distance * 0.8);
  controls.update();
}

// 5. Initial Load (Default Bridge)
fetch("/bridge.json")
  .then((res) => res.json())
  .then((data: BridgeJSON) => buildStructure(data))
  .catch((err) => console.warn("Default bridge.json load skipped:", err));

// 6. UI Handlers
function appendMessage(text: string, sender: "user" | "assistant" | "system-alert") {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;

  if (sender === "assistant") {
    const author = document.createElement("span");
    author.className = "msg-author";
    author.textContent = "CORE_AI";
    msg.appendChild(author);
  }

  const content = document.createElement("span");
  content.textContent = text;
  msg.appendChild(content);

  chatHistory.appendChild(msg);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function handleGenerate(prompt: string) {
  if (!prompt) return;

  appendMessage(prompt, "user");
  userInput.value = "";
  sendBtn.disabled = true;
  sendBtn.classList.add("loading");

  try {
    const blueprint = await generateBlueprint(prompt);
    buildStructure(blueprint);
    appendMessage("Blueprint compiled and loaded into real-time simulation.", "assistant");
  } catch (error: any) {
    appendMessage(`Error: ${error.message || "Failed to compile blueprint."}`, "system-alert");
  } finally {
    sendBtn.disabled = false;
    sendBtn.classList.remove("loading");
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleGenerate(userInput.value.trim());
});

quickPrompts.forEach((btn) => {
  btn.addEventListener("click", () => {
    const prompt = btn.getAttribute("data-prompt");
    if (prompt) handleGenerate(prompt);
  });
});

resetBtn.addEventListener("click", () => {
  if (currentBridgeData) {
    buildStructure(currentBridgeData);
    appendMessage("Simulation reset to baseline parameters.", "assistant");
  }
});

// GLTF 3D Export
exportBtn.addEventListener("click", () => {
  const exporter = new GLTFExporter();
  exporter.parse(
    bridge.object3D,
    (gltf) => {
      const output = JSON.stringify(gltf, null, 2);
      const blob = new Blob([output], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `physora-blueprint-${Date.now()}.gltf`;
      link.click();
      URL.revokeObjectURL(url);
      appendMessage("3D GLTF model exported and downloaded successfully.", "assistant");
    },
    (error) => console.error("Export error:", error),
    { binary: false }
  );
});

drawerToggle.addEventListener("click", () => {
  blueprintDrawer.classList.toggle("open");
});
drawerClose.addEventListener("click", () => {
  blueprintDrawer.classList.remove("open");
});

// 7. Weight Drop Benchmark Logic
function dropLoad(tons: number) {
  clearLoad();

  const manifest = bridge.getPhysicsManifest();
  if (manifest.bodies.length === 0 || !currentBridgeData) return;

  const deckSegments = manifest.bodies.filter((b) => b.id.startsWith("deck-segment"));
  if (deckSegments.length === 0) return;

  const midBridgeX = currentBridgeData.bridge.length / 2;
  let targetSegment = deckSegments[0]!;
  let minDiff = Infinity;

  for (const seg of deckSegments) {
    const diff = Math.abs(seg.position[0] - midBridgeX);
    if (diff < minDiff) {
      minDiff = diff;
      targetSegment = seg;
    }
  }

  // Spawn 1.2m above deck
  const dropX = targetSegment.position[0];
  const deckY = targetSegment.position[1];

  testLoadMassKg = tons * 1000;

  const size = Math.min(Math.max(3.2, Math.cbrt(testLoadMassKg / 1000) * 0.42), 6.5);
  const geom = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    roughness: 0.4,
    metalness: 0.2
  });

  currentLoadMesh = new THREE.Mesh(geom, mat);
  currentLoadMesh.position.set(dropX, deckY + size / 2 + 1.2, 0);
  scene.add(currentLoadMesh);

  playImpactSound();

  activeTestLoadId = "test-load";
  physics.addPart({
    id: activeTestLoadId,
    type: PartType.box,
    position: { x: dropX, y: deckY + size / 2 + 1.2, z: 0 },
    size: { x: size, y: size, z: size },
    dynamic: true,
    material: {
      mass: testLoadMassKg,
      friction: 0.95,
      restitution: 0.0
    }
  });

  appendMessage(`Deployed a ${tons.toLocaleString()} Ton test load onto deck span.`, "assistant");
}

dropBtn.addEventListener("click", () => {
  const tons = parseFloat(loadMassInput.value) || 50;
  dropLoad(tons);
});

// 8. Continuous Structural Strain Solver
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  physics.advance(delta);

  const states = physics.getAllPartStates();
  for (const state of states) {
    const mesh = bridge.getMeshForBody(state.id);
    if (mesh && state.dynamic) {
      mesh.position.set(state.position.x, state.position.y, state.position.z);
      mesh.quaternion.set(
        state.rotation.x,
        state.rotation.y,
        state.rotation.z,
        state.rotation.w
      );
    }
  }

  if (currentLoadMesh) {
    const loadState = physics.getPartState("test-load");
    if (loadState) {
      currentLoadMesh.position.set(
        loadState.position.x,
        loadState.position.y,
        loadState.position.z
      );
      currentLoadMesh.quaternion.set(
        loadState.rotation.x,
        loadState.rotation.y,
        loadState.rotation.z,
        loadState.rotation.w
      );
    }
  }

  // CONTINUOUS MULTI-CONSTRAINT SHEAR EVALUATOR
  const activeJoints = adapter.getActiveJoints();
  const manifest = bridge.getPhysicsManifest();

  // 1. Natural Dead-Load Equilibrium (Cantilever / Self-Weight Bending)
  for (const [jointId, def] of activeJoints) {
    const stateA = physics.getPartState(def.bodyA);
    const stateB = physics.getPartState(def.bodyB);
    if (!stateA || !stateB) continue;

    const tiltA = Math.abs(stateA.rotation.z);
    const tiltB = Math.abs(stateB.rotation.z);
    const maxTilt = Math.max(tiltA, tiltB);

    const initYA = adapter.getInitialY(def.bodyA);
    const initYB = adapter.getInitialY(def.bodyB);
    const deflA = initYA !== undefined ? Math.abs(stateA.position.y - initYA) : 0;
    const deflB = initYB !== undefined ? Math.abs(stateB.position.y - initYB) : 0;
    const maxDeflection = Math.max(deflA, deflB);

    if (maxTilt > 0.18 || maxDeflection > 1.2) {
      const failingBody = deflA > deflB ? def.bodyA : def.bodyB;
      const allJoints = adapter.getConnectedJoints(failingBody);

      for (const j of allJoints) {
        physics.removeJoint(j);
        adapter.removeActiveJoint(j);
      }

      playCollapseSound();
      shakeIntensity = 0.5;
      if (currentBridgeData) updateTelemetry("failed", currentBridgeData.bridge.length);

      appendMessage(
        `DEAD-LOAD FAILURE: Segment "${failingBody}" sheared all connections under self-weight!`,
        "system-alert"
      );
      break;
    }
  }

  // 2. Live Dropped Mass Overload (Sever all joints on impacted slab)
  if (activeTestLoadId) {
    const loadState = physics.getPartState(activeTestLoadId);
    if (loadState) {
      const currentLoadTons = testLoadMassKg / 1000;
      const ratedCapacityTons = 100;

      if (currentLoadTons > ratedCapacityTons) {
        const deckBodies = manifest.bodies.filter((b) => b.id.startsWith("deck-segment"));

        for (const b of deckBodies) {
          const bodyState = physics.getPartState(b.id);
          if (!bodyState) continue;

          const dist = Math.hypot(
            loadState.position.x - bodyState.position.x,
            loadState.position.y - bodyState.position.y,
            loadState.position.z - bodyState.position.z
          );

          if (dist < b.size[0] / 2 + 2.5) {
            const jointsToBreak = adapter.getConnectedJoints(b.id);

            if (jointsToBreak.length > 0) {
              for (const jId of jointsToBreak) {
                physics.removeJoint(jId);
                adapter.removeActiveJoint(jId);
              }

              physics.applyImpulse(b.id, { x: 0, y: -25000, z: 0 });

              playCollapseSound();
              shakeIntensity = 0.8;
              if (currentBridgeData) updateTelemetry("failed", currentBridgeData.bridge.length);

              appendMessage(
                `LIVE LOAD FAILURE: Segment "${b.id}" suffered total shear under ${currentLoadTons.toLocaleString()} Tons!`,
                "system-alert"
              );
              activeTestLoadId = null;
              break;
            }
          }
        }
      }
    }
  }

  // Camera Shake Decay
  if (shakeIntensity > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity *= 0.85;
    if (shakeIntensity < 0.02) shakeIntensity = 0;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});