const scene = new THREE.Scene();

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const textureloader = new THREE.TextureLoader();

// MINIMAP RENDERER
const minimapContainer = document.getElementById('minimap');
const minimapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
minimapRenderer.setPixelRatio(window.devicePixelRatio);
minimapContainer.appendChild(minimapRenderer.domElement);
/* =========================================================
   PROJECT: Ahouba 3D Interactive Experience
   AUTHOR: Sanjeev Singh
   ENGINE: Three.js
   DESCRIPTION:
   A third-person interactive 3D world with:
   - Character controller (physics + animation)
   - Dynamic camera system (orbit-based)
   - Adaptive quality system (FPS-based scaling)
   - Mission interaction system
   - Popup UI + Gallery
   - Minimap + Fullmap system
   - Mobile + Desktop control support
   - Dynamic shadow management (CSM)

   =========================================================
   GLOBAL SYSTEM VARIABLES EXPLAINED
   =========================================================

   --- CAMERA SYSTEM ---
   yaw                → Horizontal camera rotation (left/right orbit angle)
   pitch              → Vertical camera rotation (up/down orbit angle)
   targetYaw          → Smoothed target yaw for interpolation
   targetPitch        → Smoothed target pitch for interpolation
   cameraDist         → Distance between camera and character
   MIN_DIST/MAX_DIST  → Zoom limits
   MIN_PITCH/MAX_PITCH→ Vertical look constraints
   CAMERA_SMOOTHING   → Lerp factor for smooth camera motion

   --- CHARACTER MOVEMENT ---
   character.position.x → Character world X position
   character.position.y → Character vertical position (jumping/gravity)
   character.position.z → Character world Z position
   velocity            → Current player velocity (Vector3)
   GRAVITY             → Downward acceleration force
   JUMP_FORCE          → Upward impulse on jump
   WALK_SPEED          → Normal movement speed
   SPRINT_SPEED        → Sprint movement speed
   ACCELERATION        → Horizontal acceleration rate
   DECELERATION        → Friction when stopping
   AIR_CONTROL         → Movement control multiplier in air
   isGrounded          → Whether player is touching ground
   isSprinting         → Whether sprint key is active

   --- COLLISION SYSTEM ---
   BLOCKED_NAMES       → Mesh names treated as colliders
   blockedBoxes        → Bounding boxes of collidable meshes
   playerBox           → Player collision bounding box
   PLAYER_RADIUS       → Horizontal collision size
   PLAYER_HEIGHT       → Vertical collision size

   --- QUALITY SYSTEM ---
   QUALITY             → Current quality level ("low", "medium", "high")
   qualityLocked       → Prevents frequent switching
   avgFPS              → Averaged frame rate
   fpsSamples          → Recent FPS history

   --- MISSION SYSTEM ---
   missionStops        → All mission trigger objects
   activeMission       → Current interactable mission index
   INTERACT_DISTANCE   → Distance required to interact
   missionContentData  → Popup content mapping

   --- MOBILE CONTROLS ---
   joyVector           → Direction from joystick
   joyActive           → Whether joystick is active
   touchLook           → Whether touch-look camera is active

   =========================================================
   FILE STRUCTURE ORDER
   =========================================================
   1. Device Detection
   2. Imports
   3. Scene + Renderer Setup
   4. Quality System
   5. Camera Setup
   6. Lighting
   7. Shadow System (CSM)
   8. Loader + Loading Screen
   9. World Setup
   10. Collision System
   11. Character + Animation
   12. Input Handling
   13. Camera Logic
   14. Player Movement Logic
   15. Mission System
   16. UI + Popup System
   17. Gallery System
   18. Minimap + Fullmap
   19. Main Animation Loop
   20. Resize Handling
   21. Navbar UI System




/* =========================================================
AUTO DEVICE DETECTION + UI TOGGLE (ADDED)
   
(function () {
  const body = document.body;

  function detectDevice() {
    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;

    const width = window.innerWidth;
    let device = 'desktop';

    if (isTouch && width < 768) device = 'mobile';
    else if (isTouch && width < 1100) device = 'tablet';

    body.dataset.device = device;
    console.log('[DEVICE MODE]', device);

    const hud = document.getElementById('hud');
    const mobileControls = document.getElementById('mobile-controls');
    const joystick = document.getElementById('joystick');
    const minimap = document.querySelector('.minimap');

    /* ===== TOGGLE UI ===== */
    if (device === 'mobile') {
      hud && (hud.style.display = 'none');
      mobileControls && (mobileControls.style.display = 'flex');
      joystick && (joystick.style.display = 'block');
      minimap && (minimap.style.opacity = '0.85');

    }

    if (device === 'tablet') {
      hud && (hud.style.opacity = '0');
      mobileControls && (mobileControls.style.display = 'flex');
      joystick && (joystick.style.display = 'block');
      minimap && (minimap.style.opacity = '1');
    }

    if (device === 'desktop') {
      hud && (hud.style.display = 'flex');
      mobileControls && (mobileControls.style.display = 'none');
      joystick && (joystick.style.display = 'none');
      minimap && (minimap.style.opacity = '1');
    }
  }

  detectDevice();
  window.addEventListener('resize', detectDevice);
})();


/* =========================
   DYNAMIC QUALITY
========================= */
let QUALITY = "medium";
let qualityLocked = false;

function applyQualitySettings() {
  console.log("Applying quality:", QUALITY);
  if (QUALITY === "low") {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    disableCSM();
  }
  if (QUALITY === "medium") {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
    disableCSM();
  }
  if (QUALITY === "high") {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    enableCSM();
  }
}

/* =========================
   FPS
========================= */
let fpsSamples = [];
let lastTime = performance.now();
let avgFPS = 60;

function measureFPS() {
  const now = performance.now();
  const delta = now - lastTime;
  lastTime = now;
  const fps = 1000 / delta;
  fpsSamples.push(fps);
  if (fpsSamples.length > 60) fpsSamples.shift();
  avgFPS = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
}

const hud = document.createElement("div");
hud.style.position = "fixed";
hud.style.top = "10px";
hud.style.left = "10px";
hud.style.padding = "8px 12px";
hud.style.background = "rgba(0,0,0,0.7)";
hud.style.color = "#00f0ff";
hud.style.font = "13px monospace";
hud.style.zIndex = "9999";
hud.style.pointerEvents = "none";
hud.style.borderRadius = "6px";
hud.style.border = "1px solid rgba(0,240,255,0.3)";
hud.style.backdropFilter = "blur(5px)";
// Uncomment to show FPS on screen
// document.body.appendChild(hud);

setInterval(() => {
  hud.innerHTML = `FPS: ${avgFPS.toFixed(1)}<br>Quality: ${QUALITY}`;
}, 500);

setInterval(() => {
  if (qualityLocked) return;
  if (avgFPS < 28) {
    if (QUALITY === "high") QUALITY = "medium";
    else if (QUALITY === "medium") QUALITY = "low";
    applyQualitySettings();
    return;
  }
  if (avgFPS > 55) {
    if (QUALITY === "low") QUALITY = "medium";
    else if (QUALITY === "medium") QUALITY = "high";
    applyQualitySettings();
    return;
  }
  if (avgFPS > 45 && avgFPS < 55) qualityLocked = true;
}, 3000);




/*imports*/

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';


/* =========================
   SCENE SETUP
========================= */
const scene = new THREE.Scene();

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const textureloader = new THREE.TextureLoader();

// MINIMAP RENDERER
const minimapContainer = document.getElementById('minimap');
const minimapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
minimapRenderer.setPixelRatio(window.devicePixelRatio);
minimapContainer.appendChild(minimapRenderer.domElement);


/* =========================
   CAMERAS
========================= */
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
const minimapCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
minimapCamera.position.set(0, 50, 0);
minimapCamera.up.set(0, 0, -1);
minimapCamera.lookAt(0, 0, 0);


/* =========================
   CAMERA LOGIC
========================= */
let yaw = Math.PI;
let pitch = 0.55;
let cameraDist = 2.8;
const MIN_DIST = 2.0;
const MAX_DIST = 8.0;
const MIN_PITCH = -4.2;
const MAX_PITCH = 1.2;

const MOUSE_SENSITIVITY = 0.0022;
const CAMERA_SMOOTHING = 5;

let targetYaw = yaw;
let targetPitch = pitch;

renderer.domElement.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
    if (popupOverlay && popupOverlay.style.display !== 'flex') {
        document.body.requestPointerLock();
    }
});

document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.body) {
        targetYaw -= e.movementX * MOUSE_SENSITIVITY;
        targetPitch -= e.movementY * MOUSE_SENSITIVITY;
        //targetPitch = THREE.MathUtils.clamp(targetPitch, MIN_PITCH, MAX_PITCH);
        console.log("looking at ",targetPitch,camera.position.y);
    }
});

document.addEventListener('wheel', e => {
    cameraDist += e.deltaY * 0.007;
    cameraDist = THREE.MathUtils.clamp(cameraDist, MIN_DIST, MAX_DIST);
}, { passive: true });

/* =========================
   LIGHTS
========================= */
const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0xff2fd5, 1.2); 
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

//const backLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
//backLight.position.set(-50, 20, -50);
//scene.add(backLight);

/* =========================
   CSM SHADOWS
========================= */
let csm = null;
function enableCSM() {
  if (csm || QUALITY !== "high") return;
  csm = new CSM({
    maxFar: camera.far,
    cascades: 4,
    mode: 'practical',
    parent: scene,
    shadowMapSize: 2048,
    lightDirection: new THREE.Vector3(-10, -10, 1).normalize(),
    camera
  });
  csm.lights.forEach(l => {
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    l.intensity = 1.5;
  });
}
function disableCSM() {
  if (!csm) return;
  csm.dispose?.();
  csm = null;
}

/* =========================
   LOADER
========================= */
const loadingContainer = document.querySelector('.progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const loadingManager = new THREE.LoadingManager(
  () => { /* handled in tryStartGame */ },
  (url, loaded, total) => { if(progressBar) progressBar.value = (loaded / total) * 100; }
);
const loader = new GLTFLoader(loadingManager);

const startInstructions = document.createElement('p');
startInstructions.innerHTML = `Use W/A/S/D to move<br>Hold SHIFT to Sprint<br>Click to Look Around<br>Press ENTER to start`;
startInstructions.style.color = 'var(--secondary, #00f0ff)';
startInstructions.style.textAlign = 'center';
startInstructions.style.fontFamily = 'inherit';
startInstructions.style.marginTop = '10px';
if(loadingContainer) loadingContainer.appendChild(startInstructions);

let assetsLoaded = false;
let userReady = false;

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') { userReady = true; tryStartGame(); }
});
// FIX: Prevent game start if clicking navbar
document.addEventListener('click', (e) => { 
    if(e.target.closest('button') || e.target.closest('.navbar')) return;
    userReady = true; 
    tryStartGame(); 
});
document.addEventListener('touchstart', (e) => { 
    if(e.target.closest('button') || e.target.closest('.navbar')) return;
    userReady = true; 
    tryStartGame(); 
});
loadingManager.onLoad = () => { assetsLoaded = true; tryStartGame(); };

function tryStartGame() {
  if (assetsLoaded && userReady && loadingContainer.style.display !== 'none') {
    loadingContainer.style.display = 'none';
    animate(); 
  }
}

/* =========================
   WORLD
const skyGeo = new THREE.SphereGeometry(4,60,40);
const skyMat = new THREE.MeshBasicMaterial({
  map: textureloader.load("public/models/nightsky1.jpg"), 
  side: THREE.BackSide,
  color: 0xffffff
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);
sky.position.set(0,-1,0);
sky.scale.set(100,100,100);
sky.rotation.set(Math.PI/3, Math.PI/2, Math.PI/3);


/* =========================
   World + COLLISION
========================= */
const BLOCKED_NAMES = new Set(["Object_35", "Object_43", "Object_47", "Object_15", "Object_79"]);
const blockedBoxes = [];

loader.load('public/models/mainland.glb', gltf => {
  
  gltf.scene.position.set(0, 2.0, 0);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (csm) csm.setupMaterial(o.material);
      if (BLOCKED_NAMES.has(o.name)) {
        const box = new THREE.Box3().setFromObject(o);
        blockedBoxes.push({ box, name: o.name });
      }
      if(o.name == "Сфера"){
        o.position.set(0,10000,0);
        console.log('big model  loaded');

      }
    }
  });
  scene.add(gltf.scene);
});

const playerBox = new THREE.Box3();
const PLAYER_RADIUS = 0.6;
const PLAYER_HEIGHT = 2.0;

function wouldCollide(nextPos) {
  playerBox.min.set(nextPos.x - PLAYER_RADIUS, nextPos.y, nextPos.z - PLAYER_RADIUS);
  playerBox.max.set(nextPos.x + PLAYER_RADIUS, nextPos.y + PLAYER_HEIGHT, nextPos.z + PLAYER_RADIUS);
  for (let i = 0; i < blockedBoxes.length; i++) {
    if (playerBox.intersectsBox(blockedBoxes[i].box)) return true;
  }
  return false;
}

const MAP_BOUNDS = { minX: -145, maxX: 180, minZ: -80, maxZ: 240 };
function clampCharacterPosition() {
  character.position.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, character.position.x));
  character.position.z = Math.max(MAP_BOUNDS.minZ, Math.min(MAP_BOUNDS.maxZ, character.position.z));
}
const spheregeo = new THREE.SphereGeometry(360);
const sphermat = new THREE.MeshStandardMaterial({
  map: textureloader.load('public/models/stars.jpg'),
  side:THREE.DoubleSide
});
const sphere = new THREE.Mesh(spheregeo,sphermat);
scene.add(sphere);


/* =========================
   FULLMAP
========================= */
const closeMapBtn = document.getElementById('closeMapBtn');
const fullmapContainer = document.getElementById('fullmap');
let isFullMapOpen = false;
if (minimapContainer && fullmapContainer && closeMapBtn) {
    minimapContainer.addEventListener('click', () => {
        isFullMapOpen = true;
        document.exitPointerLock();
        fullmapContainer.style.display = 'flex';
        closeMapBtn.style.display = 'block';
        fullmapContainer.appendChild(minimapRenderer.domElement);
        minimapRenderer.setSize(window.innerWidth, window.innerHeight);
        const zoom = 100;
        minimapCamera.left = -zoom; minimapCamera.right = zoom;
        minimapCamera.top = zoom; minimapCamera.bottom = -zoom;
        minimapCamera.updateProjectionMatrix();
    });
    closeMapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isFullMapOpen = false;
        fullmapContainer.style.display = 'none';
        closeMapBtn.style.display = 'none';
        minimapContainer.appendChild(minimapRenderer.domElement);
        minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
        minimapCamera.left = -20; minimapCamera.right = 20;
        minimapCamera.top = 20; minimapCamera.bottom = -20;
        minimapCamera.updateProjectionMatrix();
    });
}


/* =========================
   CHARACTER
========================= */
const character = new THREE.Object3D();
scene.add(character);

const followCircle = new THREE.Mesh(
  new THREE.CircleGeometry(2.2),
  new THREE.MeshBasicMaterial({ color: 0x0D00FF, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
);
followCircle.rotation.x = -Math.PI / 2;
scene.add(followCircle);

const glowRing = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 2.8, 32),
  new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
glowRing.rotation.x = -Math.PI / 2;
scene.add(glowRing);

followCircle.add(new THREE.LineSegments(
  new THREE.EdgesGeometry(followCircle.geometry),
  new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
));

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
      if (csm) csm.setupMaterial(o.material);
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
   PHYSICS & MOVEMENT
========================= */
const GRAVITY = -35;
const JUMP_FORCE = 12;
const WALK_SPEED = 8;
const SPRINT_SPEED = 15;
const ACCELERATION = 60; 
const DECELERATION = 40; 
const AIR_CONTROL = 0.5;

let velocity = new THREE.Vector3();
let isGrounded = true;
let isSprinting = false;

/* =========================
   INPUT HANDLING
========================= */
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space' && isGrounded) {
    velocity.y = JUMP_FORCE;
    isGrounded = false;
  }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function updateKeyVisuals() {
    ['w', 'a', 's', 'd'].forEach(key => {
        const el = document.getElementById(`key-${key}`);
        if (el) {
            if (keys[key]) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
}

let yaw = Math.PI;
let pitch = 0.35;
let cameraDist = 2.8;
const MIN_DIST = 2.0;
const MAX_DIST = 8.0;
const MOUSE_SENSITIVITY = 0.0022;
const CAMERA_SMOOTHING = 5;

let targetYaw = yaw;
let targetPitch = pitch;

renderer.domElement.addEventListener('click', (e) => {
  // FIX: Don't lock pointer if clicking UI
  if (e.target.closest('button') || e.target.closest('.navbar')) return;
    if (popupOverlay && popupOverlay.style.display !== 'flex') {
        document.body.requestPointerLock();
    }
});

document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.body) {
        targetYaw -= e.movementX * MOUSE_SENSITIVITY;
        targetPitch -= e.movementY * MOUSE_SENSITIVITY;
        targetPitch = THREE.MathUtils.clamp(targetPitch, -0.3, 1.3);
    }
});

document.addEventListener('wheel', e => {
    cameraDist += e.deltaY * 0.007;
    cameraDist = THREE.MathUtils.clamp(cameraDist, MIN_DIST, MAX_DIST);
}, { passive: true });

/* =========================
   MOBILE
========================= */
let joyActive = false;
let joyStart = new THREE.Vector2();
let joyDelta = new THREE.Vector2();
let joyVector = new THREE.Vector2();
const joystick = document.getElementById('joystick');
const stick = joystick?.querySelector('.stick');

if (joystick) {
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
    if (stick) stick.style.transform = `translate(${joyDelta.x - 25}px, ${joyDelta.y - 25}px)`;
    joyVector.set(joyDelta.x / max, joyDelta.y / max);
  });
  joystick.addEventListener('touchend', () => {
    joyActive = false;
    joyDelta.set(0, 0);
    joyVector.set(0, 0);
    if (stick) stick.style.transform = `translate(-50%, -50%)`;
  });
}

let touchLook = false;
let lastTouch = new THREE.Vector2();

window.addEventListener('touchstart', e => {
  // FIX: Don't look around if touching UI
  if (e.target.closest('#joystick') || e.target.closest('.navbar')) return;
  touchLook = true;
  lastTouch.set(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchmove', e => {
  if (!touchLook) return;
  const t = e.touches[0];
  targetYaw -= (t.clientX - lastTouch.x) * 0.006;
  targetPitch -= (t.clientY - lastTouch.y) * 0.004;
  //targetPitch = THREE.MathUtils.clamp(targetPitch, -0.3, 1.3);
  lastTouch.set(t.clientX, t.clientY);
});
window.addEventListener('touchend', () => { touchLook = false; });






/* =========================
   UPDATE LOGIC
========================= */
function updateCamera(delta) {

  yaw = THREE.MathUtils.lerp(yaw, targetYaw, CAMERA_SMOOTHING * delta);
  pitch = THREE.MathUtils.lerp(pitch, targetPitch, CAMERA_SMOOTHING * delta);

  // 90° up/down clamp
  pitch = THREE.MathUtils.clamp(
    pitch,
    -Math.PI / 10 + 0.001,
    Math.PI / 2 - 0.001
  );

  // Proper spherical orbit calculation
  const offset = new THREE.Vector3();

  offset.x = cameraDist * Math.sin(yaw) * Math.cos(pitch);
  offset.y = cameraDist * Math.sin(pitch);
  offset.z = cameraDist * Math.cos(yaw) * Math.cos(pitch);

  const targetCamPos = character.position.clone().add(offset);

  camera.position.lerp(targetCamPos, 6 * delta);

  const lookTarget = character.position.clone();
  lookTarget.y += 1.7;

  camera.lookAt(lookTarget);
}


function updatePlayerMovement(delta) {
  const camForward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0));
  
  const inputDir = new THREE.Vector3();
  if (keys.w) inputDir.add(camForward);
  if (keys.s) inputDir.sub(camForward);
  if (keys.a) inputDir.sub(camRight);
  if (keys.d) inputDir.add(camRight);

  if (joyVector.lengthSq() > 0.01) {
    inputDir.addScaledVector(camForward, -joyVector.y);
    inputDir.addScaledVector(camRight, joyVector.x);
  }

  isSprinting = keys.shift && inputDir.lengthSq() > 0;
  const targetSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
  
  // Acceleration
  if (inputDir.lengthSq() > 0.001) {
    inputDir.normalize();
    const accel = isGrounded ? ACCELERATION : ACCELERATION * AIR_CONTROL;
    
    velocity.x += inputDir.x * accel * delta;
    velocity.z += inputDir.z * accel * delta;

    // Cap speed
    const hSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    if (hSpeed > targetSpeed) {
      const scale = targetSpeed / hSpeed;
      velocity.x *= scale;
      velocity.z *= scale;
    }
  } else {
    // Deceleration
    const decel = isGrounded ? DECELERATION : DECELERATION * AIR_CONTROL;
    const hSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    const newHSpeed = Math.max(0, hSpeed - decel * delta);
    const scale = hSpeed > 0 ? newHSpeed / hSpeed : 0;
    velocity.x *= scale;
    velocity.z *= scale;
  }

  if (!isGrounded) velocity.y += GRAVITY * delta;

  // Move
  const nextPos = character.position.clone();
  nextPos.x += velocity.x * delta;
  nextPos.y += velocity.y * delta;
  nextPos.z += velocity.z * delta;

  if (!wouldCollide(nextPos)) {
    character.position.copy(nextPos);
  } 
  clampCharacterPosition();

  // Floor collision
  if (character.position.y <= 0) {
    character.position.y = 0;
    velocity.y = 0;
    isGrounded = true;
  } else if (character.position.y > 0.1) {
    isGrounded = false;
  }

  // Rotation
  const hSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
  
  if (hSpeed > 0.5) {
      const targetRot = Math.atan2(velocity.x, velocity.z);
      const rotDiff = ((targetRot - character.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      character.rotation.y += rotDiff * 15 * delta;

      if(character.children[0]) {
          const tilt = -rotDiff * 0.5;
          character.children[0].rotation.z = THREE.MathUtils.lerp(character.children[0].rotation.z, tilt, 10 * delta);
      }
  } else {
      if(character.children[0]) {
           character.children[0].rotation.z = THREE.MathUtils.lerp(character.children[0].rotation.z, 0, 10 * delta);
      }
  }

  // Animation State
  let nextAction = actions.idle;
  if (!isGrounded) nextAction = actions.jump || actions.idle;
  else if (hSpeed > 0.5) nextAction = isSprinting ? (actions.sprint || actions.running) : actions.running;

  if (nextAction && nextAction !== currentAction) {
    currentAction?.fadeOut(0.12);
    nextAction.reset().fadeIn(0.12).play();
    currentAction = nextAction;
  }
}

/* =========================
   MISSIONS
========================= */
const missionStops = [];

function createMissionLabel(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 256;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(13, 0, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(0, 240, 255, 0.6)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; 
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  ctx.font = "bold 60px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; 
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(8, 4, 1);
  return sprite;
}

function createMissionStop(x, y, z, missionKey) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  const enableGlow = QUALITY !== "low";

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 2.5, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xff2fd5, emissive: 0xff2fd5, emissiveIntensity: 3.0, transparent: true, opacity: 0.8, side: THREE.DoubleSide
    })
  );

  let glow = null;
  if (enableGlow) {
    glow = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 3.0, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff66ff, transparent: true, opacity: 0.3, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    group.add(glow);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.5, 40),
    new THREE.MeshBasicMaterial({
      color: 0xff2fd5, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;

  const particleRing = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.8, 40),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    })
  );
  particleRing.rotation.x = -Math.PI / 2;
  particleRing.position.y = 0.1;

  group.add(column, ring, particleRing);
  const labelSprite = createMissionLabel(missionKey);
  labelSprite.position.set(0, 7, 0);
  group.add(labelSprite);
  missionStops.push({ 
    group, column, glow, ring, particleRing, baseY: y, key: missionKey, label: labelSprite
  });
}

createMissionStop(0, 0, 130, "events");
createMissionStop(-10, 0, 140, "sponsors");
createMissionStop(-18, 0, 130, "glimpses");
createMissionStop(-10, 0, 120, "about");

function changeCharacterPosition(btnId) {
  if (btnId === "eventBtn") {
    character.position.set(0, 0, 130);
  } 
  else if (btnId === "sponsorBtn") {
    character.position.set(-10, 0, 140);
  } 
  else if (btnId === "glimpseBtn") {
    character.position.set(-18, 0, 130);
  } 
  else if (btnId === "aboutBtn") {
    character.position.set(-10, 0, 120);
  }
}

/* =========================
   UI
========================= */
const interactPrompt = document.getElementById("interactPrompt");
const popupOverlay = document.getElementById("missionPopupOverlay");
const popupTitle = document.getElementById("missionTitle");
const popupContent = document.getElementById("missionContent");
const closePopupBtn = document.getElementById("closePopup");

const INTERACT_DISTANCE = 4.0;
let activeMission = null;

const missionContentData = {
  events: "Welcome to Ahouba Events!<br>Check out our latest tournaments below.",
  glimpses: "Relive memories from past Ahouba editions.",
  sponsors: "Our proud sponsors:<br>CubeTen Technologies<br>Times of Manipur",
  about: "Ahouba is a cultural-tech fest celebrating creativity and innovation.",
};

function checkMissionProximity() {
  activeMission = null;
  for (let i = 0; i < missionStops.length; i++) {
    const stop = missionStops[i];
    const dist = stop.group.position.distanceTo(character.position);
    if (dist < INTERACT_DISTANCE) {
      activeMission = i;
      break;
    }
  }
  if (interactPrompt) {
    interactPrompt.style.display = activeMission !== null ? "block" : "none";
    if (activeMission !== null) {
      const isMobile = window.innerWidth < 920;
      interactPrompt.innerHTML = isMobile ? "Tap to Interact" : "Press <b>E</b> to Interact";
    }
  }
}

function openMissionPopup() {
  if (activeMission === null) return;
  document.exitPointerLock();
  const missionKey = missionStops[activeMission].key;
  if (popupTitle) popupTitle.textContent = missionKey.toUpperCase();
  if (popupContent) popupContent.innerHTML = missionContentData[missionKey] || "No content found.";
  if (popupOverlay) popupOverlay.style.display = "flex";
  setupGallery(missionKey);
}
function closeMissionPopup() {
  if (popupOverlay) popupOverlay.style.display = "none";
}
window.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "e" && activeMission !== null) openMissionPopup();
});
if (interactPrompt) interactPrompt.addEventListener("click", () => {
  if (activeMission !== null) openMissionPopup();
});
if (closePopupBtn) closePopupBtn.addEventListener("click", closeMissionPopup);
if (popupOverlay) popupOverlay.addEventListener("click", e => {
  if (e.target === popupOverlay) closeMissionPopup();
});

/* =========================
   GALLERY
========================= */
const galleryBox = document.getElementById("missionGallery");
const galleryTrack = document.getElementById("galleryTrack");
const galleryPrev = document.getElementById("galleryPrev");
const galleryNext = document.getElementById("galleryNext");
const missionGalleryData = {
  events: [ "public/models/1.jpg", "public/models/2.jpg", "public/models/3.jpg", "4.jpg" ],
  glimpses: [ "public/models/A3.jpg", "public/models/Logo_Cubeten2.png" ],
  sponsors: [],
  about: []
};
let galleryIndex = 0;
let activeGallery = [];
function setupGallery(missionKey) {
    if (missionGalleryData[missionKey] && missionGalleryData[missionKey].length > 0) {
        if (galleryBox) galleryBox.style.display = "block";
        activeGallery = missionGalleryData[missionKey];
        galleryIndex = 0;
        renderGallery();
    } else {
        if (galleryBox) galleryBox.style.display = "none";
    }
}
function renderGallery() {
  if (!galleryTrack) return;
  galleryTrack.innerHTML = "";
  if (activeGallery.length === 0) return;
  const leftIndex = (galleryIndex - 1 + activeGallery.length) % activeGallery.length;
  const heroIndex = galleryIndex;
  const rightIndex = (galleryIndex + 1) % activeGallery.length;
  const items = [
    { src: activeGallery[leftIndex], type: "small" },
    { src: activeGallery[heroIndex], type: "hero" },
    { src: activeGallery[rightIndex], type: "small" }
  ];
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = `gallery-item ${item.type}`;
    const img = document.createElement("img");
    img.src = item.src;
    div.appendChild(img);
    galleryTrack.appendChild(div);
  });
}
if (galleryPrev) galleryPrev.addEventListener("click", () => {
  galleryIndex = (galleryIndex - 1 + activeGallery.length) % activeGallery.length;
  renderGallery();
});
if (galleryNext) galleryNext.addEventListener("click", () => {
  galleryIndex = (galleryIndex + 1) % activeGallery.length;
  renderGallery();
});

const closeMapBtn = document.getElementById('closeMapBtn');
const fullmapContainer = document.getElementById('fullmap');
let isFullMapOpen = false;

if (minimapContainer && fullmapContainer && closeMapBtn) {
    minimapContainer.addEventListener('click', () => {
        isFullMapOpen = true;
        document.exitPointerLock();
        
        // --- CRITICAL FIX: MOVE ELEMENTS TO BODY ---
        document.body.appendChild(fullmapContainer);
        document.body.appendChild(closeMapBtn);
        // -------------------------------------------

        fullmapContainer.style.display = 'flex';
        closeMapBtn.style.display = 'block'; // Make button visible
        fullmapContainer.appendChild(minimapRenderer.domElement);
        minimapRenderer.setSize(window.innerWidth, window.innerHeight);
        const zoom = 100;
        minimapCamera.left = -zoom; minimapCamera.right = zoom;
        minimapCamera.top = zoom; minimapCamera.bottom = -zoom;
        minimapCamera.updateProjectionMatrix();
    });
    
    closeMapBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop click passing through to game
        isFullMapOpen = false;
        fullmapContainer.style.display = 'none';
        closeMapBtn.style.display = 'none'; // Hide button
        
        // Return renderer to small minimap
        minimapContainer.appendChild(minimapRenderer.domElement);
        minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
        minimapCamera.left = -20; minimapCamera.right = 20;
        minimapCamera.top = 20; minimapCamera.bottom = -20;
        minimapCamera.updateProjectionMatrix();

/* ===== NAVBAR UI ===== */

(function () {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.querySelector(".nav-links");

  if (!hamburger || !navLinks) return;

  window.addEventListener("scroll", () => {
    document.body.classList.toggle("nav-scrolled", window.scrollY > 20);
  });

  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navLinks.classList.toggle("active");
  });

  document.querySelectorAll(".nav-links button").forEach(btn => {
    btn.addEventListener("click", () => {
      navLinks.classList.remove("active");
      hamburger.classList.remove("active");
    });
  });
})();




/* =========================
   MAIN LOOP
========================= */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (isFullMapOpen) {
      renderer.render(scene, camera);
      minimapRenderer.render(scene, minimapCamera);
      return;
  }
  measureFPS();
  updateKeyVisuals();
  const delta = Math.min(clock.getDelta(), 0.033);
  
  if (mixer) mixer.update(delta);
  updatePlayerMovement(delta);
  updateCamera(delta);
  checkMissionProximity();
  
  const pulseScale = 1 + Math.sin(performance.now() * 0.003) * 0.08;
  followCircle.position.set(character.position.x, 49, character.position.z);
  followCircle.scale.set(pulseScale, pulseScale, pulseScale);
  glowRing.position.copy(followCircle.position);
  glowRing.rotation.z += delta * 0.5;
  glowRing.scale.set(pulseScale * 1.1, pulseScale * 1.1, pulseScale * 1.1);

  minimapCamera.position.x = character.position.x;
  minimapCamera.position.z = character.position.z;
  minimapCamera.lookAt(character.position.x, 0, character.position.z);

  const t = performance.now() * 0.003;
  missionStops.forEach((ms, idx) => {
    const offset = idx * 0.5;
    ms.group.position.y = ms.baseY + Math.sin(t + offset) * 0.35;
    if (QUALITY !== "low") {
      ms.group.rotation.y += delta * 0.7;
      if (ms.glow) {
        ms.glow.rotation.y -= delta * 1.2;
        ms.glow.material.opacity = 0.15 + Math.sin(t * 2 + offset) * 0.1;
      }
      if (ms.ring) ms.ring.rotation.z += delta * 0.3;
      if (ms.particleRing) {
        ms.particleRing.rotation.z -= delta * 0.8;
        ms.particleRing.material.opacity = 0.3 + Math.sin(t * 3 + offset) * 0.15;
      }
    }
  });

  if (csm) csm.update();
  renderer.render(scene, camera);
  minimapRenderer.render(scene, minimapCamera);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (minimapContainer && minimapRenderer) {
    minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
  }
});


applyQualitySettings();


document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.querySelector(".nav-links");
  const navButtons = document.querySelectorAll(".nav-links button");

  if (!hamburger || !navLinks) return;

  // Toggle Menu
  hamburger.addEventListener("click", (e) => {
    e.stopPropagation(); // Stop clicking through to game
    e.preventDefault();  // Stop default touches
    
    // Toggle active classes
    if(navLinks.classList.contains("active")) {
        closeMenu();
    } else {
        openMenu();
    }
  });

  // Handle Menu Buttons (Teleport)
  navButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent immediate closing if logic conflicts
      changeCharacterPosition(btn.id); 
      closeMenu();
      document.exitPointerLock(); // Unlock cursor so user sees they clicked
    });
  });

  // Close if clicking outside
  document.addEventListener("click", (e) => {
      // If the click is NOT inside the navbar and NOT inside the hamburger
      if (!e.target.closest('.navbar') && !e.target.closest('.hamburger')) {
          closeMenu();
      }
  });

  function openMenu() {
      hamburger.classList.add("active");
      navLinks.classList.add("active");
      // Safety: Unlock pointer so user can actually click the links
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
  }

  function closeMenu() {
      hamburger.classList.remove("active");
      navLinks.classList.remove("active");
  }
});
/* =========================
   FORCE DEVICE DETECTION
/* =========================
   STRICT DEVICE DETECTION
function detectDevice() {
  const joystick = document.getElementById('joystick');
  const hud = document.getElementById('hud');
  const mobileControls = document.getElementById('mobile-controls');

  // Check 1: Does the device primarily use a touch interface? (Finger)
  const isTouchInterface = window.matchMedia("(pointer: coarse)").matches;

  // Check 2: Is the screen actually mobile/tablet sized?
  // (Prevents joystick on huge touch monitors or smart TVs)
  const isSmallScreen = window.innerWidth < 1024;

  if (isTouchInterface && isSmallScreen) {
    // --- MOBILE/TABLET MODE ---
    if (joystick) joystick.style.display = 'block';
    if (mobileControls) mobileControls.style.display = 'block';
    if (hud) hud.style.display = 'none';
  } else {
    // --- DESKTOP/LAPTOP MODE ---
    // Even if the window is resized to 500px, if the pointer is 'fine' (mouse),
    // we keep the desktop UI.
    if (joystick) joystick.style.display = 'none';
    if (mobileControls) mobileControls.style.display = 'none';
    if (hud) hud.style.display = 'flex';
  }
}

// Run on load and resize
detectDevice();
window.addEventListener('resize', detectDevice);
//button settings
