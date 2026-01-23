import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';

/* =========================
   SCENE
========================= */
const scene = new THREE.Scene();

/* =========================
   RENDERERS
========================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
/* =========================
   GPU DETECTION & QUALITY
========================= */
function detectQuality(renderer) {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

  let gpu = 'unknown';
  if (debugInfo) {
    gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  }

  gpu = gpu.toLowerCase();
  console.log("Detected GPU:", gpu);

  // Heuristics
  if (
    gpu.includes("mali") ||
    gpu.includes("adreno 5") ||
    gpu.includes("adreno 6") ||
    gpu.includes("powervr") ||
    gpu.includes("intel") ||
    gpu.includes("uhd") ||
    gpu.includes("hd graphics")
  ) {
    return "low";
  }

  if (
    gpu.includes("adreno 7") ||
    gpu.includes("apple") ||
    gpu.includes("radeon") ||
    gpu.includes("iris")
  ) {
    return "medium";
  }

  if (
    gpu.includes("nvidia") ||
    gpu.includes("rtx") ||
    gpu.includes("gtx") ||
    gpu.includes("rx ")
  ) {
    return "high";
  }

  return "medium"; // fallback
}

const QUALITY = detectQuality(renderer);
console.log("Quality profile:", QUALITY);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  QUALITY === "low" ? 1 : Math.min(window.devicePixelRatio, 2)
);

renderer.setClearColor(0x87ceeb);

renderer.shadowMap.enabled = QUALITY !== "low";
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);


const minimapContainer = document.getElementById('minimap');
const minimapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
minimapRenderer.setPixelRatio(window.devicePixelRatio);
minimapContainer.appendChild(minimapRenderer.domElement);

/* =========================
   CAMERAS
========================= */
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const minimapCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
minimapCamera.position.set(0, 50, 0);
minimapCamera.up.set(0, 0, -1);
minimapCamera.lookAt(0, 0, 0);

/* =========================
   LIGHTS
========================= */
const light = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(light);

/* =========================
   CSM SHADOWS
========================= */
let csm = null;

if (QUALITY !== "low") {
  csm = new CSM({
    maxFar: camera.far,
    cascades: QUALITY === "high" ? 4 : 2,
    mode: 'practical',
    parent: scene,
    shadowMapSize: QUALITY === "high" ? 2048 : 1024,
    lightDirection: new THREE.Vector3(-1, -1, -1),
    camera
  });

  csm.lights.forEach(l => {
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
  });
}


/* =========================
   LOADER
========================= */
const loadingContainer = document.querySelector('.progress-bar-container');
const progressBar = document.getElementById('progress-bar');

const loadingManager = new THREE.LoadingManager(
  () => loadingContainer.style.display = 'none',
  (url, loaded, total) => progressBar.value = (loaded / total) * 100
);

const loader = new GLTFLoader(loadingManager);

/* =========================
   WORLD
========================= */
loader.load('public/models/scene223.glb', gltf => {
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if(csm){
      csm.setupMaterial(o.material);}
    }
  });
  scene.add(gltf.scene);
});

loader.load('public/models/death_note.glb', gltf => {
  const base = gltf.scene;
  base.position.set(5,-35,0);
  base.scale.set(1.5,1.5,1.5);
  base.rotation.y = Math.PI/4 + Math.PI/2;

 // base.rotation.x = Math.PI/2;
  scene.add(base);

})
/* =========================
   CHARACTER
========================= */
const character = new THREE.Object3D();
scene.add(character);

/* =========================
   FOLLOW CIRCLE
========================= */
const followCircle = new THREE.Mesh(
  new THREE.CircleGeometry(2),
  new THREE.MeshBasicMaterial({
    color: 0x32CD32,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
followCircle.rotation.x = -Math.PI / 2;
followCircle.position.set(0, 100, 0);
scene.add(followCircle);

followCircle.add(new THREE.LineSegments(
  new THREE.EdgesGeometry(followCircle.geometry),
  new THREE.LineBasicMaterial({ color: 0x000000 })
));

/* =========================
   PLAYER MODEL + ANIMATIONS
========================= */
let mixer, currentAction;
const actions = {};

loader.load('public/models/finalmainmodel.glb', gltf => {
  const soldier = gltf.scene;
  soldier.scale.set(0.97, 0.97, 0.97);
  soldier.position.y = -1;

  soldier.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if(csm){
      csm.setupMaterial(o.material);}
    }
  });

  character.add(soldier);

  mixer = new THREE.AnimationMixer(soldier);
  gltf.animations.forEach(clip => {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  });

  currentAction = actions.idle;
  currentAction?.play();
});

/* =========================
   INPUT (KEYBOARD)
========================= */
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

/* =========================
   CAMERA ROTATION (MOUSE)
========================= */
let yaw = 0, pitch = 0, mouseDown = false;
window.addEventListener('mousedown', () => mouseDown = true);
window.addEventListener('mouseup', () => mouseDown = false);
window.addEventListener('mousemove', e => {
  if (!mouseDown) return;
  yaw -= e.movementX * 0.008;
  pitch -= e.movementY * 0.002;
  pitch = THREE.MathUtils.clamp(pitch, -0.6, 0.4);
});

/* =========================
   MOBILE JOYSTICK
========================= */
let joyActive = false;
let joyStart = new THREE.Vector2();
let joyDelta = new THREE.Vector2();
let joyVector = new THREE.Vector2();

const joystick = document.getElementById('joystick');
const stick = joystick.querySelector('.stick');

joystick.addEventListener('touchstart', e => {
  joyActive = true;
  const t = e.touches[0];
  joyStart.set(t.clientX, t.clientY);
});

joystick.addEventListener('touchmove', e => {
  if (!joyActive) return;
  const t = e.touches[0];
  joyDelta.set(t.clientX - joyStart.x, t.clientY - joyStart.y);

  const max = 40;
  joyDelta.clampLength(0, max);
  stick.style.transform = `translate(${joyDelta.x - 25}px, ${joyDelta.y - 25}px)`;

  joyVector.set(joyDelta.x / max, joyDelta.y / max);
});

joystick.addEventListener('touchend', () => {
  joyActive = false;
  joyDelta.set(0, 0);
  joyVector.set(0, 0);
  stick.style.transform = `translate(-50%, -50%)`;
});

/* =========================
   MOBILE CAMERA TOUCH
========================= */
let touchLook = false;
let lastTouch = new THREE.Vector2();

window.addEventListener('touchstart', e => {
  if (e.target.closest('#joystick')) return;
  touchLook = true;
  lastTouch.set(e.touches[0].clientX, e.touches[0].clientY);
});

window.addEventListener('touchmove', e => {
  if (!touchLook) return;

  const t = e.touches[0];
  const dx = t.clientX - lastTouch.x;
  const dy = t.clientY - lastTouch.y;

  yaw -= dx * 0.005;
  pitch -= dy * 0.003;
  pitch = THREE.MathUtils.clamp(pitch, -0.6, 0.4);

  lastTouch.set(t.clientX, t.clientY);
});

window.addEventListener('touchend', () => {
  touchLook = false;
});

/* =========================
   CAMERA FOLLOW
========================= */
const cameraOffset = new THREE.Vector3();
function updateCamera() {
  cameraOffset.set(Math.sin(yaw) * 8, 3 + pitch * 2, Math.cos(yaw) * 8);
  camera.position.lerp(character.position.clone().add(cameraOffset), 0.1);
  camera.lookAt(character.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
}

/* =========================
   MISSION STOPS
========================= */
const missionStops = [];

function createMissionStop(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 2, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff2fd5,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );

  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 2.3, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff66ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.3, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff2fd5,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;

  group.add(column, glow, ring);
  missionStops.push({ group, column, glow, baseY: y });
}

createMissionStop(7, 0, 7);
createMissionStop(-4, 0, -72);
createMissionStop(7, 0, 50);
createMissionStop(-60, 0, -10);
createMissionStop(35, 0, -30);
createMissionStop(-97, 0, 80);

/* =========================
   ANIMATE
========================= */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixer?.update(delta);

  const camDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));
  const moveDir = new THREE.Vector3();

  // Keyboard
  if (keys.w) moveDir.add(camDir);
  if (keys.s) moveDir.sub(camDir);
  if (keys.a) moveDir.sub(camRight);
  if (keys.d) moveDir.add(camRight);

  // Mobile joystick
  if (joyVector.lengthSq() > 0.01) {
    moveDir
      .addScaledVector(camDir, -joyVector.y)
      .addScaledVector(camRight, joyVector.x);
  }

  let nextAction = actions.idle;

  if (moveDir.lengthSq()) {
    moveDir.normalize();
    character.position.addScaledVector(moveDir, delta * 10);
    character.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    nextAction = actions.running;
  }

  if (nextAction && nextAction !== currentAction) {
    currentAction.fadeOut(0.15);
    nextAction.reset().fadeIn(0.15).play();
    currentAction = nextAction;
  }

  character.position.y = 0;
  followCircle.position.set(character.position.x, 49, character.position.z);

  updateCamera();

  minimapCamera.position.x = character.position.x;
  minimapCamera.position.z = character.position.z;
  minimapCamera.lookAt(character.position.x, 0, character.position.z);

  const t = performance.now() * 0.004;
  missionStops.forEach(ms => {
    ms.group.position.y = ms.baseY + Math.sin(t) * 0.25;
    const pulse = Math.sin(t * 2) * 0.15 + 1;
    ms.column.scale.set(pulse, 1, pulse);
    ms.glow.scale.set(pulse * 1.2, 1, pulse * 1.2);
    ms.group.rotation.y += 0.005;
  });

  if(csm){csm.update();}
  renderer.render(scene, camera);
  minimapRenderer.render(scene, minimapCamera);
}

animate();

/* =========================
   RESIZE
========================= */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
});
