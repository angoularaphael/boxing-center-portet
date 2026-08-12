import * as THREE from "three";
import { themeColors } from "../theme";

/**
 * LES BRAISES — la poussière qui monte, seule.
 *
 * Elles vivaient enfermées dans le hero de l'accueil (three/hero.ts), mêlées
 * au sigle en particules et à un rendu de floraison coûteux. Le patron veut
 * les braises PARTOUT, et le sigle nulle part ailleurs : c'est lui qui donne
 * son souffle à la page, pas la marque écrite une deuxième fois.
 *
 * Ce module ne fait donc QUE les braises, et il est taillé pour être posé sur
 * les dix en-têtes de page sans les alourdir :
 *
 *  · pas de floraison (UnrealBloomPass) — c'est elle qui coûte cher, et sur
 *    un en-tête de page l'effet ne se voit pas ; la fusion additive suffit ;
 *  · la densité suit la LARGEUR de l'écran : 280 particules sur l'accueil,
 *    à peine plus de cent sur un téléphone. Une belle animation qui fait
 *    chauffer le téléphone n'est pas une belle animation ;
 *  · l'animation s'arrête dès que l'en-tête sort de l'écran, et le contexte
 *    WebGL est rendu quand l'élément quitte le document — la navigation
 *    douce échange `#page` à chaque changement de page, et dix contextes
 *    abandonnés font tomber l'onglet ;
 *  · « mouvement réduit » : les braises sont posées, immobiles. On garde le
 *    grain, on retire le mouvement.
 */
export function initEmbers(container: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Sur un très petit écran, on ne monte rien du tout : le gain visuel ne
     paie pas le contexte WebGL sur un téléphone d'entrée de gamme. */
  if (window.innerWidth < 420) return;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  /* En thème clair, les couleurs du thème deviennent illisibles sur une
     scène sombre : on garde la palette froide du hero, déjà éprouvée. */
  const couleurs = () => {
    const clair = document.documentElement.getAttribute("data-theme") === "light";
    return clair ? "#7f8ca3" : themeColors().accent2;
  };

  const N = window.innerWidth < 760 ? 110 : window.innerWidth < 1200 ? 190 : 280;
  const pos = new Float32Array(N * 3);
  const vit = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 13;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    vit[i] = 0.004 + Math.random() * 0.012;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(couleurs()),
    size: 0.04,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const braises = new THREE.Points(geo, mat);
  scene.add(braises);

  function resize() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const surTheme = () => mat.color.set(couleurs());
  window.addEventListener("themechange", surTheme);

  /* Le regard suit la souris, très légèrement — c'est ce qui fait que le fond
     paraît avoir de la profondeur au lieu d'être une image qui bouge. */
  const cible = { x: 0, y: 0 };
  const surSouris = (e: MouseEvent) => {
    cible.x = (e.clientX / window.innerWidth - 0.5) * 2;
    cible.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!reduced) window.addEventListener("pointermove", surSouris);

  let visible = true;
  const io = new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 });
  io.observe(container);

  let raf = 0;
  function ranger() {
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener("resize", resize);
    window.removeEventListener("themechange", surTheme);
    window.removeEventListener("pointermove", surSouris);
    geo.dispose();
    mat.dispose();
    renderer.dispose();
  }

  function image() {
    /* L'élément a quitté le document (navigation douce) : on rend le
       contexte WebGL. Sans ça, chaque page visitée en laisse un derrière
       elle et le navigateur finit par les tuer — écran noir garanti. */
    if (!container.isConnected) { ranger(); return; }
    raf = requestAnimationFrame(image);
    if (!visible || document.hidden) return;

    if (!reduced) {
      const p = (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] += vit[i];
        if (p[i * 3 + 1] > 6.5) p[i * 3 + 1] = -6.5;   // la braise repart d'en bas
      }
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

      camera.position.x += (cible.x * 0.5 - camera.position.x) * 0.04;
      camera.position.y += (-cible.y * 0.3 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  }
  image();

  return ranger;
}

/**
 * Pose les braises sur l'en-tête de la page courante.
 * Appelé à chaque changement de page : la couche est créée si elle manque,
 * et l'ancienne se range toute seule quand son élément quitte le document.
 */
export function mountEmbersOnPageHead() {
  const tete = document.querySelector<HTMLElement>(".page-head");
  if (!tete || tete.querySelector(".page-head__embers")) return;
  /* La couche se glisse SOUS le texte : c'est un fond, il ne doit jamais
     capter un clic ni passer devant un titre. */
  const couche = document.createElement("div");
  couche.className = "page-head__embers";
  couche.setAttribute("aria-hidden", "true");
  tete.prepend(couche);
  initEmbers(couche);
}
