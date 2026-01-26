import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSM } from 'three/addons/csm/CSM.js';
//import stars from "./public/models/stars.jpeg";
/* =========================
   SCENE
========================= */
const scene = new THREE.Scene();

/* =========================
   RENDERERS
========================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
//renderer.setClearColor(0x000000);
const textureloader = new THREE.TextureLoader();
//scene.background = textureloader.load("public/models/ai_Ahouba.jpeg");
//onst cubeTexturloader = new THREE.CubeTextureLoader();
const axeshelper = new THREE.AxesHelper();
scene.add(axeshelper);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const minimapContainer = document.getElementById('minimap');
const minimapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
minimapRenderer.setSize(minimapContainer.clientWidth, minimapContainer.clientHeight);
minimapRenderer.setPixelRatio(window.devicePixelRatio);
minimapContainer.appendChild(minimapRenderer.domElement);

/* =========================
   DYNAMIC QUALITY (FPS BASED)
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
   FPS MEASUREMENT
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

/* =========================
   FPS DISPLAY
========================= */
const hud = document.createElement("div");
hud.style.position = "fixed";
hud.style.top = "10px";
hud.style.left = "10px";
hud.style.padding = "6px 10px";
hud.style.background = "rgba(0,0,0,0.6)";
hud.style.color = "#0f0";
hud.style.font = "12px monospace";
hud.style.zIndex = "9999";
document.body.appendChild(hud);

setInterval(() => {
  hud.innerHTML = `FPS: ${avgFPS.toFixed(1)}<br>Quality: ${QUALITY}`;
}, 500);

/* =========================
   AUTO QUALITY CONTROLLER
========================= */
setInterval(() => {
  if (qualityLocked) return;

  console.log("Avg FPS:", avgFPS.toFixed(1), "Quality:", QUALITY);

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

  if (avgFPS > 45 && avgFPS < 55) {
    qualityLocked = true;
    console.log("Quality locked at:", QUALITY);
  }
}, 3000);

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
const light = new THREE.AmbientLight(0xfff2cc, 1.2);
scene.add(light);

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
    lightDirection: new THREE.Vector3(-10, -10, 1),
    camera
  });

  csm.lights.forEach(l => {
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
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
  () => loadingContainer.style.display = 'none',
  (url, loaded, total) => progressBar.value = (loaded / total) * 100
);

const loader = new GLTFLoader(loadingManager);
/* =========================
   START SCREEN / USER READY
========================= */
const startInstructions = document.createElement('p');
startInstructions.innerHTML = `
    Use W/A/S/D to move<br>
    Mouse to look around<br>
    Press ENTER or tap to start
`;
startInstructions.style.color = 'white';
startInstructions.style.textAlign = 'center';
startInstructions.style.fontFamily = 'sans-serif';
startInstructions.style.marginTop = '10px';
loadingContainer.appendChild(startInstructions);

let assetsLoaded = false;
let userReady = false;

// Event listeners for input
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    userReady = true;
    tryStartGame();
  }
});
document.addEventListener('click', () => { userReady = true; tryStartGame(); });
document.addEventListener('touchstart', () => { userReady = true; tryStartGame(); });

// Mark assets as loaded when the loading manager completes
loadingManager.onLoad = () => {
  assetsLoaded = true;
  tryStartGame();
};

// Only start game if both user pressed and assets loaded
function tryStartGame() {
  if (assetsLoaded && userReady) {
    loadingContainer.style.display = 'none';
    initGame();  // your game initialization (Three.js scene is already mostly setup)
    animate();   // start render loop
  }
}

/* =========================
   WORLD
========================= */
const skyGeo = new THREE.SphereGeometry(4,60,40);
const skyMat = new THREE.MeshBasicMaterial({
  map: textureloader.load("public/models/nightsky1.jpg"),
  side: THREE.BackSide
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);
sky.position.set(0,-1,0);
sky.scale.set(100,100,100);
sky.rotation.x = Math.PI/3;
sky.rotation.z = Math.PI/3;
sky.rotation.y = Math.PI/2;
const BLOCKED_NAMES = new Set([
  
  "Object_35",
  "Object_43",
  "Object_47",
  "Object_15",
  
  
  "Object_79",
  
]);

const blockedBoxes = []; // { box: THREE.Box3, name: string }
/*function showBlockedDebug() {
  blockedBoxes.forEach(b => {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    b.box.getSize(size);
    b.box.getCenter(center);

    const helper = new THREE.Box3Helper(b.box, 0xff0000);
    scene.add(helper);
  });
}*/

// call after basemodel loads


loader.load('public/models/basemodel.glb', gltf => {
  scene.add(gltf.scene);
  gltf.scene.position.set(0, 2.83, 0);
  gltf.scene.updateMatrixWorld(true); // 🔥 IMPORTANT

  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (csm) csm.setupMaterial(o.material);

      if (BLOCKED_NAMES.has(o.name)) {
        const box = new THREE.Box3().setFromObject(o);
        blockedBoxes.push({ box, name: o.name });
        console.log("Blocked collider added:", o.name);
      }
    }
  });

  //showBlockedDebug(); // ✅ move this HERE
});



const playerBox = new THREE.Box3();
const PLAYER_RADIUS = 0.6;
const PLAYER_HEIGHT = 2.0;

function wouldCollide(nextPos) {
  playerBox.min.set(
    nextPos.x - PLAYER_RADIUS,
    nextPos.y,
    nextPos.z - PLAYER_RADIUS
  );
  playerBox.max.set(
    nextPos.x + PLAYER_RADIUS,
    nextPos.y + PLAYER_HEIGHT,
    nextPos.z + PLAYER_RADIUS
  );

  for (let i = 0; i < blockedBoxes.length; i++) {
    if (playerBox.intersectsBox(blockedBoxes[i].box)) {
      return true;
    }
  }
  return false;
}




/* =========================
   MAP BOUNDARIES (ZERO FPS)
========================= */
const MAP_BOUNDS = {
  minX: -145,
  maxX:  180,
  minZ: -80,
  maxZ:  240,
};


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
   INPUT (KEYBOARD)
========================= */
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

/* =========================
   CAMERA ROTATION (MOUSE)
========================= */
/* =========================
   CAMERA ROTATION (SMOOTH)
========================= */
let yaw = Math.PI, pitch = 0;
let targetYaw = Math.PI, targetPitch = 0;
let yawVel = 0, pitchVel = 0;
let mouseDown = false;

const cameraPos = new THREE.Vector3();
const cameraVel = new THREE.Vector3();

window.addEventListener('mousedown', () => mouseDown = true);
window.addEventListener('mouseup', () => mouseDown = false);
window.addEventListener('mousemove', e => {
  if (!mouseDown) return;
  targetYaw   -= e.movementX * 0.008;
  targetPitch -= e.movementY * 0.002;
  targetPitch = THREE.MathUtils.clamp(targetPitch, -0.6, 0.4);
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

  targetYaw   -= (t.clientX - lastTouch.x) * 0.005;
  targetPitch -= (t.clientY - lastTouch.y) * 0.003;
  targetPitch = THREE.MathUtils.clamp(targetPitch, -0.6, 0.4);

  lastTouch.set(t.clientX, t.clientY);
});

window.addEventListener('touchend', () => {
  touchLook = false;
});

/* =========================
   CAMERA FOLLOW
========================= */
/* =========================
   CAMERA FOLLOW (SMOOTH)
========================= */
function updateCamera(delta) {
  // Smooth yaw / pitch
  const ROT_DAMP = 10;

  yawVel   += (targetYaw - yaw) * ROT_DAMP * delta;
  pitchVel += (targetPitch - pitch) * ROT_DAMP * delta;

  yawVel   *= 0.85;
  pitchVel *= 0.85;

  yaw   += yawVel;
  pitch += pitchVel;

  // Desired camera position
const CAMERA_DISTANCE = 5.5;   // ⬅ lower = closer
const CAMERA_HEIGHT   = 2.2;   // ⬅ lower = lower camera

const desiredOffset = new THREE.Vector3(
  Math.sin(yaw) * CAMERA_DISTANCE,
  CAMERA_HEIGHT + pitch * 1.5,
  Math.cos(yaw) * CAMERA_DISTANCE
);


  const desiredPos = character.position.clone().add(desiredOffset);

  // Smooth follow (spring motion)
  const POS_DAMP = 15;

  cameraVel.addScaledVector(
    desiredPos.clone().sub(cameraPos),
    POS_DAMP * delta
  );

  cameraVel.multiplyScalar(0.8);
  cameraPos.addScaledVector(cameraVel, delta);

  camera.position.copy(cameraPos);
  camera.lookAt(
    character.position.x,
    character.position.y + 1.5,
    character.position.z
  );
}

/* =========================
   MISSION STOPS
========================= */
const missionStops = [];

function createMissionStop(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  const enableGlow = QUALITY !== "low";

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff2fd5,
      transparent: enableGlow,
      opacity: enableGlow ? 0.35 : 1,
      side: THREE.DoubleSide,
      blending: enableGlow ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    })
  );

  let glow = null;
  if (enableGlow) {
    glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 2.3, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff66ff,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(glow);
  }

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

  group.add(column, ring);
  missionStops.push({ group, column, glow, baseY: y });
}

createMissionStop(50, 0, 49);
createMissionStop(-4, 0, -72);
createMissionStop(-55,0,110);
createMissionStop(60,0,170);
/*world boundaries*/
function clampCharacterPosition() {
  character.position.x = Math.max(
    MAP_BOUNDS.minX,
    Math.min(MAP_BOUNDS.maxX, character.position.x)
  );

  character.position.z = Math.max(
    MAP_BOUNDS.minZ,
    Math.min(MAP_BOUNDS.maxZ, character.position.z)
  );
}


/* =========================
   BOUNDARY DEBUG HELPER
========================= 
let boundaryHelper = null;

function addBoundaryHelper() {
  const width  = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const depth  = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
  const height = 5;

  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true
  });

  boundaryHelper = new THREE.Mesh(geo, mat);
  boundaryHelper.position.set(
    (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2,
    height / 2,
    (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2
  );

  scene.add(boundaryHelper);
}
*/
/* =========================
   ANIMATE
========================= */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  measureFPS();

  const delta = clock.getDelta();
  mixer?.update(delta);

  const camDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));
  const moveDir = new THREE.Vector3();

  if (keys.w) moveDir.add(camDir);
  if (keys.s) moveDir.sub(camDir);
  if (keys.a) moveDir.sub(camRight);
  if (keys.d) moveDir.add(camRight);

  if (joyVector.lengthSq() > 0.01) {
    moveDir.addScaledVector(camDir, -joyVector.y)
           .addScaledVector(camRight, joyVector.x);
  }

  let nextAction = actions.idle;

if (moveDir.lengthSq()) {
  moveDir.normalize();
const speed = 10 * delta;
const nextPos = character.position.clone().addScaledVector(moveDir, speed);

if (!wouldCollide(nextPos)) {
  character.position.copy(nextPos);
}

// 🔒 Clamp inside map
clampCharacterPosition();


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

  updateCamera(delta);

  minimapCamera.position.x = character.position.x;
  minimapCamera.position.z = character.position.z;
  minimapCamera.lookAt(character.position.x, 0, character.position.z);

  const t = performance.now() * 0.004;
  missionStops.forEach(ms => {
    ms.group.position.y = ms.baseY + Math.sin(t) * 0.25;
    const pulse = QUALITY === "low" ? 1 : (Math.sin(t * 2) * 0.15 + 1);
    ms.column.scale.set(pulse, 1, pulse);
    if (ms.glow) ms.glow.scale.set(pulse * 1.2, 1, pulse * 1.2);
    if (QUALITY !== "low") ms.group.rotation.y += 0.005;
  });

  if (csm) csm.update();

  renderer.render(scene, camera);
  minimapRenderer.render(scene, minimapCamera);
}
//addBoundaryHelper();

applyQualitySettings();
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

/* =========================
   MINIMAP FULLSCREEN PATCH (APPEND ONLY)
========================= */

const minimapContainer1 = document.getElementById('minimap');
const fullmapContainer = document.getElementById('fullmap');
const closeMapBtn = document.getElementById('closeMapBtn');

let isFullMapOpen = false;

if (minimapContainer1 && fullmapContainer && closeMapBtn) {

  minimapContainer1.addEventListener('click', () => {
    if (!minimapRenderer || !minimapCamera) return;

    isFullMapOpen = true;

    fullmapContainer.style.display = 'flex';
    closeMapBtn.style.display = 'block';

    fullmapContainer.appendChild(minimapRenderer.domElement);
    minimapRenderer.setSize(window.innerWidth, window.innerHeight);

    const zoom = 100;
    minimapCamera.left = -zoom;
    minimapCamera.right = zoom;
    minimapCamera.top = zoom;
    minimapCamera.bottom = -zoom;
    minimapCamera.updateProjectionMatrix();
  });

  closeMapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!minimapRenderer || !minimapCamera) return;

    isFullMapOpen = false;

    fullmapContainer.style.display = 'none';
    closeMapBtn.style.display = 'none';

    minimapContainer1.appendChild(minimapRenderer.domElement);
    minimapRenderer.setSize(
      minimapContainer1.clientWidth,
      minimapContainer1.clientHeight
    );

    minimapCamera.left = -20;
    minimapCamera.right = 20;
    minimapCamera.top = 20;
    minimapCamera.bottom = -20;
    minimapCamera.updateProjectionMatrix();
  });

}

/* =========================
   RENDER PAUSE WHILE MAP OPEN (SAFE HOOK)
========================= */

if (typeof animate === "function") {
  const __oldAnimate = animate;

  window.animate = function () {
    if (!isFullMapOpen) {
      __oldAnimate();
    } else {
      // still render scene + minimap without game logic
      renderer.render(scene, camera);
      minimapRenderer.render(scene, minimapCamera);
      requestAnimationFrame(window.animate);
    }
  };
}

//i want the camera to always turns where the character turns like mimics  a human eye 

