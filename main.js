import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';

/* =========================
   SCENE
========================= */
const scene = new THREE.Scene();

/* =========================
   MAIN RENDERER
========================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x87ceeb);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

/* =========================
   MINIMAP RENDERER
========================= */
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
   BASE PLANE
========================= */
const basePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: 0x000000 })
);
basePlane.rotation.x = -Math.PI / 2;
basePlane.position.y = 2;
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
  soldier.position.set(0, -1.8, 0);
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
   TERRAIN
========================= */
const terrainMeshes = [];

loader.load('public/models/terrain2.glb', gltf => {
  gltf.scene.scale.set(0.5, 0.5, 0.5);
  gltf.scene.position.set(0, 0.34, 0);

  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.receiveShadow = true;
      csm.setupMaterial(o.material);
      terrainMeshes.push(o);
    }
  });

  scene.add(gltf.scene);
});
loader.load('public/models/building.glb', gltf=>{
  gltf.scene.scale.set(0.5,0.5,0.5)
  gltf.scene.position.set(0,0,0)
  scene.add(gltf.scene)
});
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
   ANIMATE
========================= */
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

const MOVE_SPEED = 5;
const RUN_MULTIPLIER = 2;
const PLAYER_HEIGHT = 1.7;
const RAY_HEIGHT = 10;
const GRAVITY_SMOOTH = 0.35;
const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT = 3;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  // MOVEMENT
  const camDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0,1,0)).normalize();
  const moveDir = new THREE.Vector3();
  if(keys.w) moveDir.add(camDir);
  if(keys.s) moveDir.sub(camDir);
  if(keys.a) moveDir.sub(camRight);
  if(keys.d) moveDir.add(camRight);

  if(moveDir.lengthSq()){
    moveDir.normalize();
    let speed = MOVE_SPEED * delta;
    if(keys.shift) speed *= RUN_MULTIPLIER;
    character.position.addScaledVector(moveDir, speed);
    character.rotation.y = Math.atan2(moveDir.x, moveDir.z);

    const next = keys.shift ? actions.Run : actions.Walk;
    if(next && currentAction !== next){
      currentAction.fadeOut(0.15);
      next.reset().fadeIn(0.15).play();
      currentAction = next;
    }
  } else if(actions.Idle && currentAction !== actions.Idle){
    currentAction.fadeOut(0.15);
    actions.Idle.reset().fadeIn(0.15).play();
    currentAction = actions.Idle;
  }

  // TERRAIN PHYSICS
  if(terrainMeshes.length){
    const origin = character.position.clone(); origin.y += RAY_HEIGHT;
    raycaster.set(origin, DOWN);
    const hit = raycaster.intersectObjects(terrainMeshes)[0];
    if(hit){
      const targetY = hit.point.y + PLAYER_HEIGHT;
      character.position.y += (targetY - character.position.y) * GRAVITY_SMOOTH;
    }
  }

  // CAMERA FOLLOW
  camera.position.copy(character.position).add(
    new THREE.Vector3(
      Math.sin(yaw) * CAMERA_DISTANCE,
      CAMERA_HEIGHT + pitch * 5,
      Math.cos(yaw) * CAMERA_DISTANCE
    )
  );
  camera.lookAt(character.position.clone().add(new THREE.Vector3(0,1.5,0)));

  // MINIMAP FOLLOW
  minimapCamera.position.x = character.position.x;
  minimapCamera.position.z = character.position.z;
  minimapCamera.lookAt(character.position.x,0,character.position.z);

  // RENDER
  csm.update();

  renderer.setViewport(0,0,window.innerWidth,window.innerHeight);
  renderer.render(scene, camera);

  minimapRenderer.render(scene, minimapCamera);
}

animate();

/* =========================
   RESIZE
========================= */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
});
