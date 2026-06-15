import * as THREE from "three";
import { themeColors } from "../theme";

/**
 * Persistent ambient "world" — a fixed, transparent ember/dust field drifting
 * over the whole site so nothing ever feels static (the single continuous layer
 * award sites use for cohesion). One context, theme-reactive, paused when the
 * tab is hidden, disabled under reduced-motion.
 */
export function initWorld() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.id = "world";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas); // full-bleed sparkles over the whole page incl. the hero

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 10;

  const N = 520;
  const pos = new Float32Array(N * 3);
  const spd = new Float32Array(N);
  const SPAN = 16;
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * SPAN * 1.6;
    pos[i * 3 + 1] = (Math.random() - 0.5) * SPAN;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    spd[i] = 0.004 + Math.random() * 0.014;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(themeColors().accent),
    size: 0.045,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const embers = new THREE.Points(geo, mat);
  scene.add(embers);

  window.addEventListener("themechange", () => mat.color.set(themeColors().accent));

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const target = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.6;
  });

  const arr = geo.getAttribute("position").array as Float32Array;
  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += spd[i];
      if (arr[i * 3 + 1] > SPAN / 2) arr[i * 3 + 1] = -SPAN / 2;
    }
    geo.getAttribute("position").needsUpdate = true;
    camera.position.x += (target.x - camera.position.x) * 0.03;
    camera.position.y += (-target.y - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  loop();
}
