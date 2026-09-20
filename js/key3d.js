import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const KEY_URL = "/public/key.glb";

let renderer;
let scene;
let camera;
let canvas;
let pivot;
let yaw;
let pitch;
let roll;
let keyHeight = 1;
let ready = false;
let running = false;
let unlocking = false;
let cancelled = false;
let raf = 0;
let loadPromise = null;

function slotRect() {
  return document.querySelector("[data-key-slot]")?.getBoundingClientRect() || null;
}

function lockHole() {
  const lockEl = document.querySelector(".lock");
  if (!lockEl) return null;
  const to = lockEl.getBoundingClientRect();
  return {
    x: to.left + to.width / 2,
    y: to.top + to.height * 0.48,
    cx: to.left + to.width / 2,
    cy: to.top + to.height / 2,
  };
}

function cssToWorld(x, y) {
  return {
    x: x - window.innerWidth / 2,
    y: window.innerHeight / 2 - y,
  };
}

function syncCamera() {
  if (!camera || !renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
}

function placeIdle() {
  if (!pivot || unlocking) return;
  const slot = slotRect();
  const mono = document.querySelector(".monogram")?.getBoundingClientRect();
  if (!slot || !mono) return;
  const scale = (slot.height / keyHeight) * 1.35;
  const visualHeight = scale * keyHeight;
  pivot.scale.setScalar(scale);
  const pos = cssToWorld(
    slot.left + slot.width / 2,
    mono.top + mono.height / 2 + visualHeight / 2,
  );
  pivot.position.set(pos.x, pos.y, 0);
  yaw.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  roll.rotation.set(0, 0, 0);
}

function loop() {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  if (!unlocking) placeIdle();
  renderer.render(scene, camera);
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function smoother(t) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function across(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0;
  return smoother((t - start) / (end - start));
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function playUnlockClock(duration, update) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const step = (now) => {
      if (cancelled) {
        reject(new Error("cancelled"));
        return;
      }
      const t = clamp01((now - start) / duration);
      update(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

async function loadModel() {
  if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(KEY_URL);
  const model = gltf.scene;
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = false;
      node.receiveShadow = false;
      if (node.material) {
        node.material.envMapIntensity = 1.15;
        node.material.needsUpdate = true;
      }
    }
  });

  model.rotation.y = -Math.PI / 2;
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const boxed = new THREE.Box3().setFromObject(model);
  model.position.y -= boxed.min.y;
  keyHeight = boxed.max.y - boxed.min.y;

  roll.add(model);
  pitch.add(roll);
  yaw.add(pitch);
  pivot.add(yaw);
  scene.add(pivot);
  ready = true;
}

function createRenderer() {
  canvas = document.querySelector("[data-key3d]");
  if (!canvas) return;
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
  camera.position.set(0, 0, 800);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0xfff4e0, 0.45));
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.35);
  keyLight.position.set(180, 220, 320);
  scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0xc9d7ff, 0.35);
  fill.position.set(-220, 40, 160);
  scene.add(fill);

  pivot = new THREE.Group();
  yaw = new THREE.Group();
  pitch = new THREE.Group();
  roll = new THREE.Group();
  syncCamera();
}

export async function initKey3d() {
  if (running || loadPromise) return loadPromise;
  canvas = document.querySelector("[data-key3d]");
  if (!canvas) return;
  createRenderer();
  canvas.hidden = false;
  running = true;
  loop();
  window.addEventListener("resize", onResize);
  loadPromise = loadModel()
    .then(() => {
      placeIdle();
    })
    .catch((error) => {
      console.warn("Could not load 3D key", error);
      canvas.hidden = true;
      running = false;
      ready = false;
    });
  return loadPromise;
}

function onResize() {
  syncCamera();
  placeIdle();
}

export function hideKey3d() {
  cancelled = true;
  unlocking = false;
  running = false;
  cancelAnimationFrame(raf);
  if (canvas) canvas.hidden = true;
}

export function resetKey3d() {
  cancelled = false;
  unlocking = false;
  if (!ready || !canvas) return;
  canvas.hidden = false;
  if (!running) {
    running = true;
    loop();
  }
  yaw.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  roll.rotation.set(0, 0, 0);
  placeIdle();
}

export async function playKeyUnlock() {
  if (loadPromise) await loadPromise;
  if (!ready || !pivot) return true;
  const hole = lockHole();
  const slot = slotRect();
  if (!hole || !slot) return true;
  cancelled = false;
  unlocking = true;
  document.body.style.setProperty("--lock-ox", `${(hole.cx / window.innerWidth) * 100}%`);
  document.body.style.setProperty("--lock-oy", `${(hole.cy / window.innerHeight) * 100}%`);

  const from = {
    x: pivot.position.x,
    y: pivot.position.y,
    z: 0,
    s: pivot.scale.x,
  };
  const to = cssToWorld(hole.x, hole.y);
  const spanX = to.x - from.x;
  const spanY = to.y - from.y;
  const drift = Math.max(36, Math.abs(spanY) * 0.12);

  const c1 = {
    x: from.x + spanX * 0.18 + drift * 0.35,
    y: from.y + Math.abs(spanY) * 0.08,
    z: 110,
  };
  const c2 = {
    x: from.x + spanX * 0.78 - drift * 0.15,
    y: to.y + Math.abs(spanY) * 0.22,
    z: 36,
  };

  try {
    await playUnlockClock(2680, (t) => {
      const pathT = across(t, 0, 0.72);
      pivot.position.x = bezier(from.x, c1.x, c2.x, to.x, pathT);
      pivot.position.y = bezier(from.y, c1.y, c2.y, to.y, pathT);
      pivot.position.z = bezier(from.z, c1.z, c2.z, -58, pathT);

      const swell = across(t, 0.04, 0.48) - across(t, 0.52, 0.82) * 0.22;
      pivot.scale.setScalar(from.s * (1 + 0.22 * swell));

      yaw.rotation.z = (-Math.PI / 2) * across(t, 0.16, 0.58);
      pitch.rotation.x = (Math.PI / 2) * across(t, 0.4, 0.78);
      roll.rotation.y = (Math.PI / 2) * across(t, 0.58, 0.96);
    });
  } catch {
    unlocking = false;
    return false;
  }
  return true;
}
