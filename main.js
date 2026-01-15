import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';

/* =========================
   SCENE & RENDERER
========================= */
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x87ceeb);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

/* =========================
   CAMERA
========================= */
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

/* =========================
   LIGHTS (DAYLIGHT ONLY)
========================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

/* =========================
   CSM SHADOWS
========================= */
const csm = new CSM({
  maxFar: camera.far,
  cascades: 4,
  mode: 'practical',
  parent: scene,
  shadowMapSize: 2048,
  lightDirection: new THREE.Vector3(-1, -1, -1),
  camera
});

csm.lights.forEach(l => {
  l.shadow.bias = -0.0005;
  l.shadow.normalBias = 0.02;
});

/* =========================
   LOADERS
========================= */
const loader = new GLTFLoader();
/* =========================
   LEVELING PLANE (WORLD BASE)
========================= */
const basePlaneGeo = new THREE.PlaneGeometry(500, 500);
const basePlaneMat = new THREE.MeshStandardMaterial({
  color: 0x727276,   // natural ground color
  roughness: 1,
  metalness: 0
});

const basePlane = new THREE.Mesh(basePlaneGeo, basePlaneMat);
basePlane.rotation.x = -Math.PI / 2; // ✅ horizontal
basePlane.position.y = 1;            // ✅ world base level
basePlane.receiveShadow = true;

scene.add(basePlane);

/* =========================
   CHARACTER
========================= */
const character = new THREE.Object3D();
scene.add(character);

let soldier, mixer;
const actions = {};
let currentAction;

loader.load('public/models/Soldier.glb', gltf => {
  soldier = gltf.scene;
  soldier.scale.set(1.5, 1.5, 1.5);
  soldier.position.set(0,-1.6,0)
  soldier.rotation.y = Math.PI;

  soldier.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      csm.setupMaterial(o.material);
    }
  });

  character.add(soldier);

  mixer = new THREE.AnimationMixer(soldier);
  gltf.animations.forEach(clip => {
    actions[clip.name] = mixer.clipAction(clip);
  });

  currentAction = actions['Idle'];
  currentAction.play();
});



/* =========================
   TERRAIN (PHYSICS SOURCE)
========================= */
const terrainMeshes = [];

loader.load('public/models/terrain2.glb', gltf => {
  gltf.scene.scale.set(0.5, 0.5, 0.5);
  gltf.scene.position.set(0, 0.34, 0);

  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.receiveShadow = true;
      csm.setupMaterial(o.material);
      terrainMeshes.push(o); // ✅ ALL TERRAIN MESHES
    }
  });

  scene.add(gltf.scene);
});
let building;

loader.load('public/models/building1.glb', gltf => {
  building = gltf.scene;
  building.scale.set(0.5, 0.5, 0.5);
  building.position.set(0, 0.589, 0);

  building.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      csm.setupMaterial(o.material);
    }
  });

  scene.add(building); // ✅ REQUIRED
});

let pp;




/* =========================
   INPUT
========================= */
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

/* =========================
   MOUSE CAMERA
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
   PHYSICS CONSTANTS
========================= */
const clock = new THREE.Clock();

const MOVE_SPEED = 5;
const RUN_MULTIPLIER = 2;

const PLAYER_HEIGHT = 1.7;
const RAY_HEIGHT = 10;
const GRAVITY_SMOOTH = 0.35;

const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT = 3;

const raycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

/* =========================
   ANIMATE
========================= */
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  /* ===== MOVEMENT (XZ ONLY) ===== */
  const camDir = new THREE.Vector3(
    -Math.sin(yaw),
    0,
    -Math.cos(yaw)
  ).normalize();

  const camRight = new THREE.Vector3()
    .crossVectors(camDir, new THREE.Vector3(0, 1, 0))
    .normalize();

  const moveDir = new THREE.Vector3();

  if (keys['w']) moveDir.add(camDir);
  if (keys['s']) moveDir.sub(camDir);
  if (keys['a']) moveDir.sub(camRight);
  if (keys['d']) moveDir.add(camRight);

  moveDir.y = 0;

  const moving = moveDir.lengthSq() > 0;

  if (moving) {
    moveDir.normalize();

    let speed = MOVE_SPEED * delta;
    if (keys['shift']) speed *= RUN_MULTIPLIER;

    character.position.x += moveDir.x * speed;
    character.position.z += moveDir.z * speed;

    character.rotation.y = Math.atan2(moveDir.x, moveDir.z);

    const next =
      (keys['shift'] && actions['Run']) ? actions['Run'] : actions['Walk'];

    if (currentAction !== next) {
      currentAction.fadeOut(0.15);
      next.reset().fadeIn(0.15).play();
      currentAction = next;
    }
  } else if (actions['Idle'] && currentAction !== actions['Idle']) {
    currentAction.fadeOut(0.15);
    actions['Idle'].reset().fadeIn(0.15).play();
    currentAction = actions['Idle'];
  }

  /* ===== TERRAIN PHYSICS (REAL) ===== */
  if (terrainMeshes.length > 0) {
    const origin = character.position.clone();
    origin.y += RAY_HEIGHT;

    raycaster.set(origin, DOWN);
    const hits = raycaster.intersectObjects(terrainMeshes, true);

    if (hits.length > 0) {
      const groundY = hits[0].point.y;
      const targetY = groundY + PLAYER_HEIGHT;

      character.position.y +=
        (targetY - character.position.y) * GRAVITY_SMOOTH;
    }
  }

  /* ===== CAMERA FOLLOW ===== */
  const camOffset = new THREE.Vector3(
    Math.sin(yaw) * CAMERA_DISTANCE,
    CAMERA_HEIGHT + pitch * 5,
    Math.cos(yaw) * CAMERA_DISTANCE
  );

  camera.position.copy(character.position).add(camOffset);
  camera.lookAt(character.position.clone().add(new THREE.Vector3(0, 1.5, 0)));

  csm.update();
  renderer.render(scene, camera);
}

animate();

/* =========================
   RESIZE
========================= */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
