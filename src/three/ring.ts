import * as THREE from "three";
import { themeColors } from "../theme";

const NAVY = "#182848";
const NAVY_DARK = "#0a1020";
const WHITE = "#eef1f6";
const SILVER = "#a8b4c4";

function cropTex(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const c = document.createElement("canvas");
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  c.width = Math.round(W * w);
  c.height = Math.round(H * h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, W * x, H * y, W * w, H * h, 0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/**
 * 3D Boxing Center ring — official design, scroll fly-through.
 */
export async function initRing(section: HTMLElement, host: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.innerWidth < 768;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: mobile ? "default" : "high-performance",
    });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 2 : 1.75));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const getThemeColorsForDarkScene = () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
      return {
        accent: "#aebccf",
        accent2: "#7f8ca3",
        energy: "#c3cdda",
        bg: "#0a1020",
      };
    }
    return themeColors();
  };
  let cols = getThemeColorsForDarkScene();
  const C = (h: string) => new THREE.Color(h);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C("#0a1020"), 0.045);
  const camera = new THREE.PerspectiveCamera(mobile ? 58 : 50, 1, 0.1, 100);

  const ring = new THREE.Group();
  scene.add(ring);

  const S = 3;
  const POST_H = 2.0;
  const ropeYs = [0.55, 1.0, 1.45, 1.9];
  const corners = [
    new THREE.Vector3(-S, 0, -S),
    new THREE.Vector3(S, 0, -S),
    new THREE.Vector3(S, 0, S),
    new THREE.Vector3(-S, 0, S),
  ];

  let canvasTex: THREE.Texture;
  let apronTex: THREE.Texture;
  try {
    const ref = await loadImg("/img/ring-reference.png");
    canvasTex = cropTex(ref, 0.52, 0.52, 0.46, 0.46);
    apronTex = cropTex(ref, 0.02, 0.52, 0.46, 0.46);
  } catch {
    canvasTex = new THREE.CanvasTexture(solidCanvas(NAVY));
    apronTex = new THREE.CanvasTexture(solidCanvas(WHITE));
  }
  [canvasTex, apronTex].forEach((tex) => {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = mobile ? 2 : 4;
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(S * 2, S * 2),
    new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.9, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  ring.add(floor);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(S * 2.1, 0.12, S * 2.1),
    new THREE.MeshStandardMaterial({ color: C(NAVY_DARK), roughness: 0.85 })
  );
  platform.position.y = -0.04;
  ring.add(platform);

  const apronH = 0.55;
  const apronMat = new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.75, side: THREE.DoubleSide });
  [
    [0, 0, S + 0.06],
    [0, Math.PI, -S - 0.06],
    [S + 0.06, Math.PI / 2, 0],
    [-S - 0.06, -Math.PI / 2, 0],
  ].forEach(([x, ry, z]) => {
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, apronH), apronMat);
    apron.position.set(x as number, apronH / 2, z as number);
    apron.rotation.y = ry as number;
    ring.add(apron);
  });

  const postMat = new THREE.MeshStandardMaterial({ color: C(SILVER), roughness: 0.25, metalness: 0.85 });
  corners.forEach((c) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, POST_H, mobile ? 12 : 16), postMat);
    post.position.set(c.x, POST_H / 2, c.z);
    ring.add(post);
  });

  const padNavy = new THREE.MeshStandardMaterial({ color: C(NAVY), roughness: 0.7 });
  const padWhite = new THREE.MeshStandardMaterial({ color: C(WHITE), roughness: 0.75 });
  corners.forEach((c, i) => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.12), i === 0 ? padNavy : padWhite);
    const ox = c.x > 0 ? -0.2 : 0.2;
    const oz = c.z > 0 ? -0.2 : 0.2;
    pad.position.set(c.x + ox, 1.1, c.z + oz);
    pad.lookAt(0, 1.1, 0);
    ring.add(pad);
  });

  const ropeColors = [NAVY, WHITE, NAVY, WHITE];
  const up = new THREE.Vector3(0, 1, 0);
  const ropeBaseY: number[] = [];
  ropeYs.forEach((y, ri) => {
    const mat = new THREE.MeshStandardMaterial({
      color: C(ropeColors[ri]),
      roughness: 0.45,
      emissive: C(ropeColors[ri]),
      emissiveIntensity: ri % 2 === 0 ? 0.1 : 0.03,
    });
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const va = a.clone().setY(y);
      const vb = b.clone().setY(y);
      const len = va.distanceTo(vb);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 8), mat);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, vb.clone().sub(va).normalize());
      ring.add(m);
      ropeBaseY.push(y);
    }
  });

  const stairMat = new THREE.MeshStandardMaterial({ color: C(NAVY), roughness: 0.8 });
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.35), stairMat);
    step.position.set(S + 0.7, 0.06 + s * 0.12, 0.5 - s * 0.35);
    ring.add(step);
  }

  const E = mobile ? 120 : 200;
  const ep = new Float32Array(E * 3);
  for (let i = 0; i < E; i++) {
    ep[i * 3] = (Math.random() - 0.5) * 10;
    ep[i * 3 + 1] = Math.random() * 5;
    ep[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(
    eg,
    new THREE.PointsMaterial({ color: C(cols.accent2), size: 0.03, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scene.add(embers);

  const key = new THREE.SpotLight(C(cols.accent), mobile ? 100 : 130, 32, 0.55, 0.45, 1.0);
  key.position.set(0, 10, 0);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target, new THREE.AmbientLight(0x8899bb, 0.14));

  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const onTheme = () => {
    cols = getThemeColorsForDarkScene();
    key.color.set(cols.accent);
    (embers.material as THREE.PointsMaterial).color.set(cols.accent2);
  };
  window.addEventListener("themechange", onTheme);

  const A = { p: new THREE.Vector3(8, 4.5, 10), t: new THREE.Vector3(0, 1, 0) };
  const B = { p: new THREE.Vector3(3.5, 2.2, 5), t: new THREE.Vector3(0, 1.1, 0) };
  
  // Calculate exact starting and ending points of the orbit phase to avoid camera jump glitches
  const angStart = -Math.PI * 0.3;
  const CcStart = {
    p: new THREE.Vector3(Math.sin(angStart) * 0.45, 1.2, Math.cos(angStart) * 0.45),
    t: new THREE.Vector3(Math.sin(angStart + Math.PI) * S, 1.45, Math.cos(angStart + Math.PI) * S)
  };
  
  const angEnd = -Math.PI * 0.3 + Math.PI * 1.1;
  const CcEnd = {
    p: new THREE.Vector3(Math.sin(angEnd) * 0.45, 1.2, Math.cos(angEnd) * 0.45),
    t: new THREE.Vector3(Math.sin(angEnd + Math.PI) * S, 1.45, Math.cos(angEnd + Math.PI) * S)
  };

  const D = mobile
    ? { p: new THREE.Vector3(0, 11.5, 0.05), t: new THREE.Vector3(0, 0, 0) }
    : { p: new THREE.Vector3(0, 9.5, 0.2), t: new THREE.Vector3(0, 0, 0) };
  const ss = (t: number) => t * t * (3 - 2 * t);
  const lerpV = (a: THREE.Vector3, b: THREE.Vector3, t: number, o: THREE.Vector3) => o.copy(a).lerp(b, t);
  const camP = new THREE.Vector3();
  const camT = new THREE.Vector3();

  const blocks = Array.from(section.querySelectorAll<HTMLElement>(".ring__txt"));
  const fade = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const windows: ((p: number) => number)[] = [
    (p) => 1 - fade(p, 0.16, 0.28),
    (p) => fade(p, 0.3, 0.37) * (1 - fade(p, 0.45, 0.5)),
    (p) => fade(p, 0.5, 0.55) * (1 - fade(p, 0.62, 0.66)),
    (p) => fade(p, 0.66, 0.72) * (1 - fade(p, 0.93, 0.99)),
  ];

  let visible = false;
  const io = new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 });
  io.observe(section);

  const epArr = eg.getAttribute("position").array as Float32Array;
  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    if (!section.isConnected) {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("themechange", onTheme);
      
      // Traverse and dispose geometries and materials to avoid memory leaks
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      eg.dispose();
      (embers.material as THREE.Material).dispose();
      canvasTex.dispose();
      apronTex.dispose();
      renderer.dispose();
      return;
    }
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;

    const total = section.offsetHeight - window.innerHeight;
    let p = total > 0 ? -section.getBoundingClientRect().top / total : 0;
    p = Math.min(1, Math.max(0, p));
    if (reduced) p = 0;

    if (p < 0.28) {
      const k = ss(p / 0.28);
      if (k < 0.5) {
        lerpV(A.p, B.p, k * 2, camP);
        lerpV(A.t, B.t, k * 2, camT);
      } else {
        lerpV(B.p, CcStart.p, (k - 0.5) * 2, camP);
        lerpV(B.t, CcStart.t, (k - 0.5) * 2, camT);
      }
    } else if (p < 0.72) {
      const k = (p - 0.28) / 0.44;
      const ang = -Math.PI * 0.3 + k * Math.PI * 1.1;
      camP.set(Math.sin(ang) * 0.45, 1.2 + Math.sin(k * Math.PI) * 0.15, Math.cos(ang) * 0.45);
      camT.set(Math.sin(ang + Math.PI) * S, 1.45, Math.cos(ang + Math.PI) * S);
    } else {
      const k = ss((p - 0.72) / 0.28);
      lerpV(CcEnd.p, D.p, k, camP);
      lerpV(CcEnd.t, D.t, k, camT);
    }
    camera.position.copy(camP);
    camera.lookAt(camT);

    blocks.forEach((b, i) => {
      b.style.opacity = (windows[i] ? windows[i](p) : 0).toFixed(2);
    });

    if (mobile) section.classList.toggle("is-topdown", p > 0.68);

    if (!reduced) {
      const t = clock.getElapsedTime();
      ring.rotation.y = p * 0.35;
      for (let i = 0; i < E; i++) {
        epArr[i * 3 + 1] += 0.005;
        if (epArr[i * 3 + 1] > 5) epArr[i * 3 + 1] = 0;
      }
      eg.getAttribute("position").needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  frame();
}

function solidCanvas(hex: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 4;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 4, 4);
  return c;
}
