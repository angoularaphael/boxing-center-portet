import * as THREE from "three";
import { themeColors } from "../theme";
import { boom, whoosh, soundOn } from "../audio";

/** Curated real Portet imagery that lines the vortex (action + arena). */
const POOL = [
  "/img/gym-13.jpg", "/img/gym-12.jpg", "/img/gym-16.jpg", "/img/gym-20.jpg",
  "/img/gym-15.jpg", "/img/gym-09.jpg", "/img/gym-24.jpg", "/img/gym-21.jpg",
];

type Handle = { dispose: () => void };

/**
 * In-portal — a slow, ONE-WAY dive THROUGH a vortex lined with real boxing
 * photographs (sparring, the cage, the ring, the champions). As you scroll the
 * camera flies forward down a swirling tunnel of images that rush past and
 * change — never an empty void, never a single hard zoom — then breaks through
 * into the section's own scene. Theme-reactive (red), lazy per-portal, disposes
 * when scrolled far away or on a soft-nav swap.
 */
function initPortal(section: HTMLElement): Handle | null {
  const host = section.querySelector<HTMLElement>(".portal__canvas");
  const lineEl = section.querySelector<HTMLElement>(".portal__line");
  if (!host) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  let cols = themeColors();
  const C = (h: string) => new THREE.Color(h);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C("#0a0608"), 0.045);
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 120);

  const loader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  const loadTex = (src: string) => {
    const t = loader.load(src, (tx) => (tx.colorSpace = THREE.SRGBColorSpace));
    t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    return t;
  };

  // per-section image pool (coaches vortex shows coaches, not boxers) + "stay-in" mode
  const pool = section.dataset.pool ? section.dataset.pool.split(",").map((s) => s.trim()).filter(Boolean) : POOL;
  const noExit = section.hasAttribute("data-noexit"); // no arrival picture — flow straight into the next section

  // ---- vortex of image planes (the boxing tunnel you fly through) ----
  const group = new THREE.Group();
  scene.add(group);
  const planes: THREE.Mesh[] = [];
  const RINGS = 7, K = 4, SPACING = 5, RADIUS = 4.6;
  const planeGeo = new THREE.PlaneGeometry(3.8, 2.5);
  let poolI = 0;
  for (let r = 0; r < RINGS; r++) {
    const z = 2 - r * SPACING;
    const baseAng = r * 0.62; // twist each ring → vortex swirl
    for (let k = 0; k < K; k++) {
      const a = baseAng + (k / K) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        map: loadTex(pool[poolI++ % pool.length]),
        color: C("#9c4f46"), side: THREE.DoubleSide, transparent: true, opacity: 0.9,
      });
      const m = new THREE.Mesh(planeGeo, mat);
      m.position.set(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, z);
      m.lookAt(0, 0, z + 9); // tilt the photo to face the approaching camera
      m.rotation.z += (Math.random() - 0.5) * 0.3;
      group.add(m);
      planes.push(m);
    }
  }

  // ---- destination "new world" the tunnel opens into (skipped in no-exit mode) ----
  const DEST_Z = -36;
  const DEST_H = 21; // height in world units; width follows the photo's aspect (no stretch)
  let dest: THREE.Mesh | null = null;
  if (!noExit && section.dataset.img) {
    dest = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: C("#2a0a0a"), transparent: true, opacity: 0 })
    );
    dest.position.z = DEST_Z;
    dest.scale.set(DEST_H * 1.6, DEST_H, 1); // placeholder until the photo loads
    scene.add(dest);
    loader.load(section.dataset.img, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const im = tex.image as HTMLImageElement;
      const aspect = im && im.width ? im.width / im.height : 1.6;
      dest!.scale.set(DEST_H * aspect, DEST_H, 1); // aspect-correct → never stretched
      const mm = dest!.material as THREE.MeshBasicMaterial;
      mm.map = tex; mm.color = C("#bd6a5d"); mm.needsUpdate = true;
      textures.push(tex);
    });
  }

  // ---- glowing ring-rope hoops (the boxing context) ----
  const ropeMat = new THREE.MeshStandardMaterial({
    color: C(cols.accent), emissive: C(cols.accent), emissiveIntensity: 0.85, metalness: 0.5, roughness: 0.4,
  });
  const hoopGeo = new THREE.TorusGeometry(RADIUS + 0.4, 0.035, 8, 40);
  for (let i = 0; i < 7; i++) {
    const hoop = new THREE.Mesh(hoopGeo, ropeMat);
    hoop.position.z = 0 - i * SPACING;
    group.add(hoop);
  }

  // ---- embers / dust ----
  const E = 360;
  const ep = new Float32Array(E * 3);
  for (let i = 0; i < E; i++) {
    ep[i * 3] = (Math.random() - 0.5) * 17;
    ep[i * 3 + 1] = (Math.random() - 0.5) * 17;
    ep[i * 3 + 2] = Math.random() * 46 - 42;
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  const emat = new THREE.PointsMaterial({
    color: C(cols.energy), size: 0.06, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const embers = new THREE.Points(eg, emat);
  scene.add(embers);

  const key = new THREE.PointLight(C(cols.energy), 30, 70);
  key.position.set(0, 0, 4);
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(key, amb);

  // ---- listeners (tracked so dispose can detach them) ----
  const onTheme = () => {
    cols = themeColors();
    ropeMat.color.set(cols.accent); ropeMat.emissive.set(cols.accent);
    emat.color.set(cols.energy); key.color.set(cols.energy);
  };
  window.addEventListener("themechange", onTheme);
  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  let visible = true;
  const io = new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 });
  io.observe(section);

  const fade = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  let whooshed = false, boomed = false, alive = true, raf = 0;

  function frame() {
    if (!alive) return;
    if (!section.isConnected) { dispose(); return; } // soft-nav swap
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const total = section.offsetHeight - window.innerHeight;
    let p = total > 0 ? -section.getBoundingClientRect().top / total : 0;
    p = Math.min(1, Math.max(0, p));
    if (reduced) p = 0.5;

    // one-way dive forward through the vortex
    camera.position.z = 6 - p * 38; // 6 → -32
    camera.lookAt(0, 0, -100);
    group.rotation.z = p * 0.9 + performance.now() * 0.00004; // swirl
    if (dest) (dest.material as THREE.MeshBasicMaterial).opacity = fade(p, 0.5, 0.92);

    // each photo brightens as you approach it, dims once you've flown past
    for (const m of planes) {
      const ahead = camera.position.z - m.position.z; // >0 = still ahead
      (m.material as THREE.MeshBasicMaterial).opacity =
        0.14 + 0.86 * fade(ahead, -2, 6) * (1 - fade(ahead, 26, 40));
    }

    if (lineEl) lineEl.style.opacity = (fade(p, 0.26, 0.4) * (1 - fade(p, 0.66, 0.82))).toFixed(2);
    if (!whooshed && p > 0.12) { whooshed = true; if (soundOn()) whoosh(); }
    if (!boomed && p > 0.58) { boomed = true; if (soundOn()) boom(); }

    renderer.render(scene, camera);
  }

  function dispose() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("themechange", onTheme);
    window.removeEventListener("resize", resize);
    io.disconnect();
    planeGeo.dispose();
    hoopGeo.dispose();
    if (dest) { (dest.geometry as THREE.BufferGeometry).dispose(); (dest.material as THREE.Material).dispose(); }
    planes.forEach((m) => (m.material as THREE.Material).dispose());
    ropeMat.dispose();
    eg.dispose(); emat.dispose();
    textures.forEach((t) => t.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  frame();
  return { dispose };
}

/** Lazily build each portal only while it's near the viewport (≈1 active WebGL
 *  context at a time), and tear it down once it's far away. */
export function initPortals() {
  document.querySelectorAll<HTMLElement>(".portal").forEach((s) => {
    let active: Handle | null = null;
    const io = new IntersectionObserver(
      (es) => {
        const near = es[0].isIntersecting;
        if (near && !active) active = initPortal(s);
        else if (!near && active) { active.dispose(); active = null; }
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    io.observe(s);
  });
}
