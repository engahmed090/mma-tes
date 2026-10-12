import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { demoState, DURATION, advanceDemo, type Sample } from "./demo";
import { createSampleRig } from "./sampleRig";
export type { Sample } from "./demo";
export type View =
  | "Overview"
  | "Screen"
  | "RF Sensor"
  | "Electronics"
  | "Cartridge"
  | "Power";
export type Snapshot = {
  time: number;
  playing: boolean;
  stage: string;
  screen: string;
  cartridge: number;
};
export type Viewer = {
  play(): void;
  reset(): void;
  sample(value: Sample): void;
  open(value: boolean): void;
  view(value: View): void;
  dispose(): void;
};
const MAIN_URL = "/models/mma-test/mma-test_R04_Interactive.glb";
const PORTABLE_URL = "/models/mma-test/portable-nitrate_R04.glb";
// Cache source bytes, not GPU resources. Revisiting the panel never downloads twice.
const byteCache = new Map<string, Promise<ArrayBuffer>>();
function loadBytes(url: string) {
  let bytes = byteCache.get(url);
  if (!bytes) {
    bytes = fetch(url)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Model request failed (${response.status})`);
        return response.arrayBuffer();
      })
      .catch((error) => {
        byteCache.delete(url);
        throw error;
      });
    byteCache.set(url, bytes);
  }
  return bytes;
}

function clipTime(t: number) {
  // Preserve the original clip's loading motion, then hold its sensing pose.
  return t < 2 ? 0 : t < 5 ? 1.5 + (t - 2) * .5 : 3;
}

export async function createViewer(
  host: HTMLElement,
  signal: AbortSignal,
  onProgress: (n: number) => void,
  onState: (s: Snapshot) => void,
  onError: () => void,
  portable = false,
): Promise<Viewer | null> {
  onProgress(0);
  const data = await loadBytes(portable ? PORTABLE_URL : MAIN_URL);
  if (signal.aborted) return null;
  const gltf = await new GLTFLoader().parseAsync(data, "");
  if (portable) {
    // Fit the exported assembly as a whole; never alter individual hardware geometry.
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 0.22 / Math.max(size.x, size.y, size.z);
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.copy(center.multiplyScalar(-scale));
    gltf.scene.position.y += 0.07;
  }
  const disposeModel = () => {
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    });
    materials.forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v instanceof THREE.Texture) textures.add(v);
      });
      m.dispose();
    });
    textures.forEach((t) => {
      t.dispose();
      if (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap)
        t.image.close();
    });
  };
  if (signal.aborted) {
    disposeModel();
    return null;
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    disposeModel();
    throw error;
  }
  const mobile = matchMedia("(max-width: 700px)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0xe8ecec, 0);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive mma-test model. Drag to rotate, pinch or scroll to zoom.",
  );
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(gltf.scene);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf4fbff, 0x59686d, 1.1));
  const light = new THREE.DirectionalLight(0xfff6e9, 2);
  light.position.set(0.4, 0.8, 0.3);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.005, 10);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.07;
  controls.maxDistance = 1;
  controls.maxPolarAngle = Math.PI * 0.94;
  const positions: Record<View, [number[], number[]]> = {
    Overview: [
      [0.29, 0.21, 0.32],
      [0.035, 0.065, 0],
    ],
    Screen: [
      [-0.025, 0.075, 0.25],
      [-0.032, 0.063, 0.085],
    ],
    "RF Sensor": [
      [0.21, 0.2, 0.22],
      [0.057, 0.092, 0.035],
    ],
    Electronics: [
      [-0.22, 0.2, 0.28],
      [-0.025, 0.045, 0],
    ],
    Cartridge: [
      [0.3, 0.16, 0.29],
      [0.1, 0.075, 0],
    ],
    Power: [
      [-0.26, 0.13, -0.2],
      [-0.025, 0.045, 0],
    ],
  };
  camera.position.fromArray(positions.Overview[0]);
  controls.target.fromArray(positions.Overview[1]);
  controls.update();
  controls.saveState();
  const desiredPosition = camera.position.clone(),
    desiredTarget = controls.target.clone();
  const shell = gltf.scene.getObjectByName("Enclosure");
  const shellY = shell?.position.y || 0;
  const screens: Record<string, THREE.Object3D> = {};
  gltf.scene.traverse((o) => {
    if (o.name.startsWith("Screen_")) screens[o.name.slice(7)] = o;
  });
  const sampleRig = createSampleRig(gltf.scene, scene, portable);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  if (gltf.animations[0]) {
    const action = mixer.clipAction(gltf.animations[0]);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }
  let time = 0,
    playing = false,
    opened = false,
    sample: Sample = portable ? "JuiceReference" : "Reference",
    screen = "Ready";
  let dirty = true,
    moving = false,
    visible = true,
    disposed = false,
    raf = 0,
    last = performance.now(),
    lastRender = 0,
    lastReport = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Replace only runtime display artwork. Original GLB bytes and geometry stay intact.
  const displayCanvas = document.createElement("canvas");
  displayCanvas.width = 1024; displayCanvas.height = 512;
  const displayContext = displayCanvas.getContext("2d");
  const displayTexture = new THREE.CanvasTexture(displayCanvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  displayTexture.flipY = false;
  const displayMaterial = new THREE.MeshBasicMaterial({ map: displayTexture });
  const retiredMaterials = new Set<THREE.Material>();
  screens.Ready?.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => retiredMaterials.add(m));
      node.material = displayMaterial;
    }
  });
  if (portable) {
    const optical = gltf.scene.getObjectByName("Mini | optical screen [web snapshot]");
    if (optical instanceof THREE.Mesh) {
      optical.geometry.computeBoundingBox();
      const bounds = optical.geometry.boundingBox!;
      const size = bounds.getSize(new THREE.Vector3());
      const overlay = new THREE.Mesh(new THREE.PlaneGeometry(size.x * .98, size.z * .98), displayMaterial);
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.y = bounds.max.y + .003;
      optical.add(overlay);
    }
    gltf.scene.traverse(node => { if (node.name.startsWith("R03 MINI UI |")) node.visible = false; });
  }
  const cradle = gltf.scene.getObjectByName("Mini sample | detachable loading cradle [web snapshot]");
  const cradlePosition = cradle?.position.clone();
  const pulse = new THREE.PointLight(0x22d3ee, 0, 0.6, 2);
  pulse.position.set(0.06, 0.13, 0.06); scene.add(pulse);
  let lastScreen = "";
  function updateScreen() {
    const state = demoState(time, portable, sample);
    screen = state.screen;
    Object.values(screens).forEach((o) => o.scale.setScalar(0));
    screens.Ready?.scale.setScalar(1);
    if (screen === lastScreen || !displayContext) return;
    lastScreen = screen;
    const c = displayContext;
    c.fillStyle = "#071421"; c.fillRect(0, 0, 1024, 512);
    c.fillStyle = "#67e8f9"; c.font = "bold 36px sans-serif";
    c.fillText("mma-test / RESEARCH DEMO", 40, 70);
    c.fillStyle = "#ffffff"; c.font = "32px sans-serif";
    const words = screen.split(" "); let line = "", y = 175;
    for (const word of words) {
      if (c.measureText(line + word).width > 930) { c.fillText(line, 40, y); line = ""; y += 48; }
      line += word + " ";
    }
    c.fillText(line, 40, y);
    c.fillStyle = "#94a3b8"; c.font = "26px sans-serif";
    c.fillText("ILLUSTRATIVE / NOT A MEASUREMENT", 40, 395);
    c.fillText("No diagnostic or concentration result", 40, 445);
    displayTexture.needsUpdate = true;
  }
  let cameraStage = -1;
  function guideCamera() {
    const step = demoState(time, portable, sample).step;
    if (step === cameraStage) return;
    cameraStage = step;
    const pose = opened ? [[0.4, 0.34, 0.45], [0.035, 0.12, 0]] : step === 0 ? positions.Overview
      : portable ? [[0.24, 0.24, 0.28], [0, 0.07, 0]]
      : step === 1 ? positions.Cartridge : [[0.4, 0.34, 0.45], [0.035, 0.12, 0]];
    desiredPosition.fromArray(pose[0]); desiredTarget.fromArray(pose[1]); moving = true;
  }
  function report() {
    host.dataset.screen = screen;
    host.dataset.time = time.toFixed(2);
    host.dataset.playing = String(playing);
    host.dataset.cartridge = String(
      gltf.scene.getObjectByName("Sample_Cartridge")?.position.x || 0,
    );
    onState({
      time,
      playing,
      stage: demoState(time, portable, sample).stage,
      screen,
      cartridge:
        gltf.scene.getObjectByName("Sample_Cartridge")?.position.x || 0,
    });
  }
  function reset() {
    controls.reset();
    camera.position.fromArray(positions.Overview[0]);
    controls.target.fromArray(positions.Overview[1]);
    controls.update();
    desiredPosition.copy(camera.position);
    desiredTarget.copy(controls.target);
    moving = false;
    time = 0;
    cameraStage = -1;
    if (cradle && cradlePosition) cradle.position.copy(cradlePosition);
    pulse.intensity = 0;
    sampleRig.reset();
    if (shell) shell.position.y = shellY;
    playing = false;
    opened = false;
    mixer.setTime(0);
    updateScreen();
    dirty = true;
    report();
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 48 : 35;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const visibility = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    dirty = true;
  });
  visibility.observe(host);
  const changed = () => {
    dirty = true;
    host.dataset.camera = camera.position
      .toArray()
      .map((n) => n.toFixed(5))
      .join(",");
  };
  const started = () => {
    moving = false;
  };
  controls.addEventListener("change", changed);
  controls.addEventListener("start", started);
  const contextLost = (event: Event) => {
    event.preventDefault();
    onError();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    if (document.hidden) return;
    if (playing) {
      const next = advanceDemo(time, dt);
      time = next.time; playing = next.playing;
      mixer.setTime(clipTime(time));
      guideCamera();
      pulse.intensity = time >= 5 && time < 12 ? 0.015 + Math.sin(time * 5) * 0.008 : time >= 15 ? .01 : 0;
      updateScreen(); dirty = true;
      if (!playing) report();
    }
    if (playing && now - lastReport > 150) {
      report();
      lastReport = now;
    }
    if (!visible) return;
    if (moving) {
      const a = reduced ? 1 : 1 - Math.exp(-dt * 7);
      camera.position.lerp(desiredPosition, a);
      controls.target.lerp(desiredTarget, a);
      dirty = true;
      if (camera.position.distanceTo(desiredPosition) < 0.0001) moving = false;
    }
    if (sampleRig.update(time, sample, opened, dt)) dirty = true;
    if (opened || time > 0) dirty = true;
    if (shell) {
      const target = shellY + (opened || (time >= 5) ? 0.11 : 0);
      if (Math.abs(shell.position.y - target) > 0.00001) {
        shell.position.y = THREE.MathUtils.lerp(
          shell.position.y,
          target,
          reduced ? 1 : 1 - Math.exp(-dt * 9),
        );
        dirty = true;
      }
    }
    controls.update();
    if (dirty && now - lastRender >= (mobile ? 1000 / 30 : 1000 / 60)) {
      renderer.render(scene, camera);
      dirty = false;
      lastRender = now;
    }
  }
  const viewer: Viewer = {
    play() {
      if (time >= DURATION) return;
      playing = !playing;
      dirty = true;
      report();
    },
    reset,
    sample(value) {
      sample = value;
      reset();
      updateScreen();
      dirty = true;
      report();
    },
    open(value) {
      opened = value;
      desiredPosition.fromArray(
        value ? [0.4, 0.34, 0.45] : positions.Overview[0],
      );
      desiredTarget.fromArray(value ? [0.035, 0.12, 0] : positions.Overview[1]);
      moving = true;
      dirty = true;
    },
    view(value) {
      desiredPosition.fromArray(positions[value][0]);
      desiredTarget.fromArray(positions[value][1]);
      moving = true;
      if (["RF Sensor", "Electronics", "Power"].includes(value)) opened = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility.disconnect();
      controls.dispose();
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
      sampleRig.dispose();
      disposeModel();
      retiredMaterials.forEach(m => {
        Object.values(m).forEach(v => { if (v instanceof THREE.Texture) v.dispose(); });
        m.dispose();
      });
      displayMaterial.dispose();
      displayTexture.dispose();
      environment.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  signal.addEventListener("abort", viewer.dispose, { once: true });
  reset();
  onProgress(100);
  raf = requestAnimationFrame(frame);
  return viewer;
}
