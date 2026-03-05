import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("No se encontro #app en el DOM");
}

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 0, 0.1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.rotateSpeed = -0.3;
controls.target.set(0, 0, -1);
controls.update();

const gyroButton = document.createElement("button");
gyroButton.className = "gyro-button";
gyroButton.textContent = "Activar giroscopio";
document.body.appendChild(gyroButton);

const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const deviceQuaternion = new THREE.Quaternion();

let isGyroActive = false;
let alpha = 0;
let beta = 0;
let gamma = 0;
let screenOrientation = window.orientation ? THREE.MathUtils.degToRad(window.orientation as number) : 0;

function updateDeviceQuaternion(): void {
  euler.set(beta, alpha, -gamma, "YXZ");
  deviceQuaternion.setFromEuler(euler);
  deviceQuaternion.multiply(q1);
  deviceQuaternion.multiply(q0.setFromAxisAngle(zee, -screenOrientation));
}

function onDeviceOrientation(event: DeviceOrientationEvent): void {
  if (event.alpha === null || event.beta === null || event.gamma === null) {
    return;
  }

  alpha = THREE.MathUtils.degToRad(event.alpha);
  beta = THREE.MathUtils.degToRad(event.beta);
  gamma = THREE.MathUtils.degToRad(event.gamma);
  updateDeviceQuaternion();
}

function onScreenOrientationChange(): void {
  const orientationValue =
    typeof window.orientation === "number" ? window.orientation : 0;
  screenOrientation = THREE.MathUtils.degToRad(orientationValue);
  updateDeviceQuaternion();
}

type IOSDeviceOrientationPermission = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

async function activateGyro(): Promise<void> {
  const deviceOrientation =
    DeviceOrientationEvent as unknown as IOSDeviceOrientationPermission;

  if (typeof deviceOrientation.requestPermission === "function") {
    const response = await deviceOrientation.requestPermission();
    if (response !== "granted") {
      throw new Error("Permiso denegado para giroscopio");
    }
  }

  window.addEventListener("deviceorientation", onDeviceOrientation);
  window.addEventListener("orientationchange", onScreenOrientationChange);
  isGyroActive = true;
  gyroButton.textContent = "Giroscopio activo";
  gyroButton.disabled = true;
}

gyroButton.addEventListener("click", async () => {
  try {
    await activateGyro();
  } catch (error) {
    console.error(error);
    gyroButton.textContent = "No se pudo activar";
  }
});

const panoramaUrl = new URL("../PuenteSalleVR.png", import.meta.url).href;

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  panoramaUrl,
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;

    // Sphere geometry is rendered from the inside using BackSide.
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(500, 60, 40),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
    );

    // Flip X so the panorama orientation is natural for equirectangular maps.
    sphere.scale.set(-1, 1, 1);
    scene.add(sphere);
  },
  undefined,
  (err) => {
    console.error("Error al cargar la imagen 360:", err);
  }
);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  if (!renderer.xr.isPresenting) {
    if (isGyroActive) {
      camera.quaternion.slerp(deviceQuaternion, 0.18);
    } else {
      controls.update();
    }
  }

  renderer.render(scene, camera);
});
