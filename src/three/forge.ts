import * as THREE from "three";
import { whoosh, soundOn } from "../audio";

/**
 * « La Forge » — the team showcase. Each fighter/coach is a clean, background-
 * removed cut-out shown as a 3D image-plane that tilts/parallaxes with the
 * cursor; scrolling the sticky section slides one person to the next (crossfade
 * + slide). Just them — no dots, no background. Boxers full figure, coaches a
 * tighter passport framing.
 */
export type ForgeMember = { name: string; role: string; kind: string; img: string; desc?: string };
type Handle = { dispose: () => void };

function loadTex(url: string, fallback?: string): Promise<THREE.Texture> {
  return new Promise((res) => {
    const l = new THREE.TextureLoader();
    l.load(url,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); },
      undefined,
      () => { if (fallback) l.load(fallback, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(new THREE.Texture())); else res(new THREE.Texture()); }
    );
  });
}
/** /img/coaches/x.webp → /img/coaches/cutouts/x.png (transparent cut-out) */
const cutoutUrl = (img: string) => img.replace(/\/([^/]+)\.\w+$/, "/cutouts/$1.png");

/** soft radial ground shadow texture */
function shadowTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!; const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

function initForge(section: HTMLElement, members: ForgeMember[], crop: "face" | "body"): Handle | null {
  const host = section.querySelector<HTMLElement>(".forge__canvas");
  if (!host || !members.length) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = <T extends HTMLElement>(s: string) => section.querySelector<T>(s);
  const nameEl = $(".forge__name"), roleEl = $(".forge__role"), kindEl = $(".forge__kind"),
    descEl = $(".forge__desc"), idxEl = $(".forge__idx"), dotsEl = $(".forge__dots"), toggleEl = $(".forge__toggle");
  const M = members.length;
  if (toggleEl) toggleEl.style.display = "none"; // no colour modes for real images
  if (dotsEl) dotsEl.innerHTML = members.map(() => `<li></li>`).join("");

  const fillCard = (i: number) => {
    const m = members[i];
    if (nameEl) nameEl.textContent = m.name;
    if (roleEl) roleEl.textContent = m.role;
    if (kindEl) kindEl.textContent = m.kind;
    if (descEl) descEl.textContent = m.desc || "";
    if (idxEl) idxEl.textContent = `${String(i + 1).padStart(2, "0")} / ${String(M).padStart(2, "0")}`;
    dotsEl?.querySelectorAll("li").forEach((d, di) => d.classList.toggle("on", di === i));
  };

  // reduced-motion: clean static stack of cut-outs
  if (reduced) {
    host.innerHTML = members
      .map((m) => `<figure class="forge__static"><img src="${cutoutUrl(m.img)}" onerror="this.src='${m.img}'" alt="${m.name}" loading="lazy"/><figcaption>${m.name} — ${m.role}</figcaption></figure>`)
      .join("");
    fillCard(0);
    return { dispose() {} };
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 12;
  const group = new THREE.Group();
  scene.add(group);
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  group.position.set(mobile ? 0 : 1.3, mobile ? -0.9 : -0.6, 0); // desktop: bias right of text; mobile: centred + lower

  // capped height so tall (narrow) cut-outs don't reach the header (smaller on mobile)
  const targetH = crop === "face" ? (mobile ? 5.2 : 6.0) : (mobile ? 6.0 : 7.0);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const planes: THREE.Mesh[] = [];
  const shadows: THREE.Mesh[] = [];
  const shadowTex = shadowTexture();

  members.forEach((m) => {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.scale.set(targetH * 0.7, targetH, 1); // until the texture aspect is known
    group.add(mesh); planes.push(mesh);
    const sh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    sh.scale.set(targetH * 0.7, targetH * 0.16, 1);
    sh.position.y = -targetH * 0.52;
    group.add(sh); shadows.push(sh);
    loadTex(cutoutUrl(m.img), m.img).then((tex) => {
      const im = tex.image as HTMLImageElement; const a = im && im.width ? im.width / im.height : 0.7;
      mesh.userData.aw = targetH * a;            // base width for the scale animation
      mesh.scale.set(targetH * a, targetH, 1);
      sh.scale.set(targetH * a * 0.92, targetH * 0.16, 1);
      mat.map = tex; mat.needsUpdate = true;
    });
  });

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);
  let visible = true;
  const io = new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 });
  io.observe(section);
  const tgt = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => { tgt.x = (e.clientX / innerWidth - 0.5) * 2; tgt.y = (e.clientY / innerHeight - 0.5) * 2; };
  window.addEventListener("pointermove", onMove);

  let activeIdx = -1, alive = true, raf = 0;
  fillCard(0);
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  function frame() {
    if (!alive) return;
    if (!section.isConnected) { dispose(); return; }
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const total = section.offsetHeight - window.innerHeight;
    let p = total > 0 ? -section.getBoundingClientRect().top / total : 0;
    p = clamp(p, 0, 1);
    const memberPos = p * M; // 0..M ; member i centred at i+0.5

    planes.forEach((mesh, i) => {
      const d = memberPos - (i + 0.5);           // 0 = centred, +past, -upcoming
      const ad = Math.abs(d);
      const op = clamp(1 - ad * 1.7, 0, 1);      // crossfade
      (mesh.material as THREE.MeshBasicMaterial).opacity = op;
      mesh.position.x = -clamp(d, -1.3, 1.3) * 5.0;  // slide
      mesh.position.z = -ad * 0.6;
      const s = 1 - ad * 0.07;
      if (mesh.userData.aw) { mesh.scale.x = mesh.userData.aw * s; mesh.scale.y = targetH * s; }
      mesh.renderOrder = -ad;
      const sh = shadows[i];
      (sh.material as THREE.MeshBasicMaterial).opacity = op * 0.7;
      sh.position.x = mesh.position.x; sh.renderOrder = -ad - 0.01;
    });

    const idx = clamp(Math.round(memberPos - 0.5), 0, M - 1);
    if (idx !== activeIdx) { activeIdx = idx; fillCard(idx); if (soundOn()) whoosh(); }

    group.rotation.y += (tgt.x * 0.18 - group.rotation.y) * 0.05; // 3D tilt / parallax
    group.rotation.x += (-tgt.y * 0.1 - group.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  function dispose() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    io.disconnect();
    planeGeo.dispose(); shadowTex.dispose();
    planes.forEach((m) => { (m.material as THREE.MeshBasicMaterial).map?.dispose(); (m.material as THREE.Material).dispose(); });
    shadows.forEach((m) => (m.material as THREE.Material).dispose());
    renderer.dispose(); renderer.domElement.remove();
  }

  frame();
  return { dispose };
}

/** Lazily build a forge sequence while near the viewport; dispose when far. */
export function mountForge(section: HTMLElement, members: ForgeMember[], crop: "face" | "body") {
  let active: Handle | null = null;
  const io = new IntersectionObserver(
    (es) => {
      const near = es[0].isIntersecting;
      if (near && !active) active = initForge(section, members, crop);
      else if (!near && active) { active.dispose(); active = null; }
    },
    { rootMargin: "120% 0px 120% 0px" }
  );
  io.observe(section);
}
