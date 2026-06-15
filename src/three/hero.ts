import * as THREE from "three";
import { themeColors } from "../theme";

/**
 * « Entrer dans l'arène » hero.
 * A storm of bronze dust ignites under a spotlight and coalesces into the
 * Boxing Center crest (particles sampled from the real logo), then shimmers
 * while embers drift upward. Colour tracks the active theme. Bloom = glow.
 * Pauses when off-screen / tab hidden; static under reduced-motion.
 */
export async function initHero(container: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  let cols = themeColors();
  const C = (h: string) => new THREE.Color(h);
  scene.fog = new THREE.FogExp2(C("#08090c"), 0.04);

  // ---------- sample the crest into target points ----------
  const targets = await sampleLogo("/logo.png", 6000, 6.2);
  const N = targets.length / 3;

  const pos = new Float32Array(N * 3);
  const origin = new Float32Array(N * 3);
  const delay = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // scatter origin in a wide shell
    const r = 7 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    origin[i * 3] = r * Math.sin(b) * Math.cos(a);
    origin[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
    origin[i * 3 + 2] = r * Math.cos(b) - 3;
    pos[i * 3] = origin[i * 3];
    pos[i * 3 + 1] = origin[i * 3 + 1];
    pos[i * 3 + 2] = origin[i * 3 + 2];
    delay[i] = Math.random() * 0.35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const crestMat = new THREE.PointsMaterial({
    color: C(cols.accent),
    size: 0.05,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const crest = new THREE.Points(geo, crestMat);
  scene.add(crest);

  // ---------- embers (spread across the full-bleed hero canvas) ----------
  const E = 600;
  const ePos = new Float32Array(E * 3);
  const eVel = new Float32Array(E);
  for (let i = 0; i < E; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 20;
    ePos[i * 3 + 1] = (Math.random() - 0.5) * 13;
    ePos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    eVel[i] = 0.004 + Math.random() * 0.012;
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  const eMat = new THREE.PointsMaterial({
    color: C(cols.energy), size: 0.05, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const embers = new THREE.Points(eGeo, eMat);
  scene.add(embers);

  // ---------- bloom ----------
  let composer: any = null;
  try {
    const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
    const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
    const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // softer bloom on phones so the wordmark stays crisp (not a glow blob)
    const bloomStrength = window.innerWidth < 760 ? 0.5 : 1.25;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, 0.75, 0.08));
  } catch { composer = null; }

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // fit the crest to the viewport width (so it never overflows on mobile)
    const visH = 2 * 9 * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    // full-bleed canvas: wordmark upper, slightly smaller + lower so the top clears the nav
    const aspect = w / h;
    const isMobile = w < 760;
    let s: number, py: number;
    if (isMobile) {
      s = Math.min(0.7, (visW * 0.54) / 7.0);
      py = 0.24 * visH;
    } else {
      s = Math.min(0.82, (visW * 0.46) / 7.0);
      if (aspect > 1.95) s *= 0.86;           // wide/short desktops: leave clear room for the hook
      py = (aspect > 1.95 ? 0.31 : 0.26) * visH; // sit higher so PORTET never meets the copy
    }
    crest.scale.setScalar(s);
    crest.position.y = py;
    // KEY: point sprite size must track the crest scale, else a small crest packs
    // fixed-size points into a bloomed blob. 0.0575*s ≈ 0.05 at desktop scale.
    crestMat.size = 0.0575 * s;
  }
  resize();
  window.addEventListener("resize", resize);

  const tgt = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    tgt.x = (e.clientX / window.innerWidth - 0.5) * 2;
    tgt.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener("themechange", () => {
    cols = themeColors();
    crestMat.color.set(cols.accent);
    eMat.color.set(cols.energy);
  });

  let visible = true;
  new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 }).observe(container);

  const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const clock = new THREE.Clock();
  const FORM = reduced ? 0.001 : 2.6; // seconds to assemble the crest
  const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

  function frame() {
    if (!container.isConnected) { renderer.dispose(); return; } // stop after a soft-nav swap
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();

    // assemble
    const arr = posAttr.array as Float32Array;
    let dirty = false;
    if (t < FORM + 0.5) {
      for (let i = 0; i < N; i++) {
        const p = ease((t - delay[i]) / FORM);
        const j = i * 3;
        arr[j] = origin[j] + (targets[j] - origin[j]) * p;
        arr[j + 1] = origin[j + 1] + (targets[j + 1] - origin[j + 1]) * p;
        arr[j + 2] = origin[j + 2] + (targets[j + 2] - origin[j + 2]) * p;
      }
      dirty = true;
    } else if (!reduced) {
      // gentle shimmer once formed
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        arr[j + 2] = targets[j + 2] + Math.sin(t * 1.5 + targets[j] * 2) * 0.04;
      }
      dirty = true;
    }
    if (dirty) posAttr.needsUpdate = true;

    if (!reduced) {
      const e = (eGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < E; i++) {
        e[i * 3 + 1] += eVel[i];
        if (e[i * 3 + 1] > 6.5) e[i * 3 + 1] = -6.5;
      }
      (eGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      crest.rotation.y = Math.sin(t * 0.18) * 0.08;
    }

    camera.position.x += (tgt.x * 0.7 - camera.position.x) * 0.04;
    camera.position.y += (-tgt.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, crest.position.y * 0.4, 0);

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  frame();
}

/** Rasterise the logo and return centred 3D point targets from opaque pixels. */
async function sampleLogo(url: string, want: number, worldW: number): Promise<Float32Array> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  try {
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
  } catch {}
  // compose the full wordmark: the "BOXING CENTER" logo + "PORTET" beneath it
  const W = 440;
  const logoH = Math.round((img.height / img.width) * W);
  const gap = Math.round(W * 0.045);
  const portetH = Math.round(W * 0.16);
  const H = logoH + gap + portetH;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, W, logoH);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  try {
    (ctx as any).letterSpacing = Math.round(portetH * 0.3) + "px";
  } catch {}
  ctx.font = `700 ${portetH}px "Oswald", "Arial Narrow", sans-serif`;
  ctx.fillText("PORTET", W / 2 + Math.round(portetH * 0.15), logoH + gap);
  const data = ctx.getImageData(0, 0, W, H).data;

  const pts: number[] = [];
  const worldH = (H / W) * worldW;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 130) {
        pts.push(((x / W) - 0.5) * worldW, -((y / H) - 0.5) * worldH, (Math.random() - 0.5) * 0.3);
      }
    }
  }
  // thin down to ~want points
  const total = pts.length / 3;
  const step = Math.max(1, Math.floor(total / want));
  const out: number[] = [];
  for (let i = 0; i < total; i += step) out.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
  return new Float32Array(out);
}
