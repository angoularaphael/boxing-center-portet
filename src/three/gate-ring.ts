import * as THREE from "three";

/**
 * Mini animated ring for the entry gate — loops until the user enters.
 * Lightweight preview of the official Boxing Center ring design.
 */
export function initGateRing(host: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(5.5, 3.8, 6.5);
  camera.lookAt(0, 0.8, 0);

  const C = (h: string) => new THREE.Color(h);
  const NAVY = "#0c1f5c";
  const WHITE = "#eef1f6";
  const SILVER = "#a8b4c4";
  const S = 1.6;

  const ring = new THREE.Group();
  scene.add(ring);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(S * 2, S * 2),
    new THREE.MeshStandardMaterial({ color: C(NAVY), roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  ring.add(floor);

  const apronMat = new THREE.MeshStandardMaterial({ color: C(WHITE), roughness: 0.8 });
  [[0, 0, S + 0.04], [0, Math.PI, -S - 0.04]].forEach(([x, ry, z]) => {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, 0.35), apronMat);
    a.position.set(x as number, 0.18, z as number);
    a.rotation.y = ry as number;
    ring.add(a);
  });

  const postMat = new THREE.MeshStandardMaterial({ color: C(SILVER), metalness: 0.8, roughness: 0.3 });
  const corners = [[-S, -S], [S, -S], [S, S], [-S, S]];
  corners.forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 12), postMat);
    p.position.set(x, 0.7, z);
    ring.add(p);
  });

  const ropeColors = [NAVY, WHITE, NAVY, WHITE];
  const ropeYs = [0.4, 0.65, 0.9, 1.15];
  const up = new THREE.Vector3(0, 1, 0);
  ropeYs.forEach((y, ri) => {
    const mat = new THREE.MeshStandardMaterial({ color: C(ropeColors[ri]), roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      const va = new THREE.Vector3(ax, y, az);
      const vb = new THREE.Vector3(bx, y, bz);
      const len = va.distanceTo(vb);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), mat);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, vb.clone().sub(va).normalize());
      ring.add(m);
    }
  });

  const spot = new THREE.SpotLight(C("#4a8fe8"), 80, 20, 0.5, 0.5);
  spot.position.set(0, 6, 0);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target, new THREE.AmbientLight(0x8899bb, 0.15));

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const clock = new THREE.Clock();
  let raf = 0;
  let alive = true;

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    ring.rotation.y = t * 0.35;
    camera.position.x = 5.5 + Math.sin(t * 0.4) * 0.3;
    camera.position.z = 6.5 + Math.cos(t * 0.3) * 0.2;
    camera.lookAt(0, 0.8, 0);
    renderer.render(scene, camera);
  }
  frame();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.dispose();
    host.innerHTML = "";
  };
}
