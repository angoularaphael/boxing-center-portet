import * as THREE from "three";

/**
 * Displacement "living image" — the technique behind Lusion / Immersive Garden /
 * Resn. The showcase photo becomes a GLSL plane: the cursor pushes a liquid
 * ripple through it, with chromatic aberration on the displacement and a duotone
 * (navy → bronze) grade. Degrades to the plain <img> if WebGL is unavailable.
 */
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uTime, uHover;
  uniform vec2 uMouse, uRes, uImg;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  vec2 cover(vec2 uv){
    float ca = uRes.x / uRes.y, ia = uImg.x / uImg.y;
    vec2 st = uv;
    // keep the subjects centred on a wide crop (legible, not cropped to limbs)
    if (ca > ia) st.y = (uv.y - 0.5) * (ia / ca) + 0.5;
    else         st.x = (uv.x - 0.5) * (ca / ia) + 0.5;
    return st;
  }
  void main(){
    float dist = distance(vUv, uMouse);
    float ripple = sin(dist * 22.0 - uTime * 2.5) * exp(-dist * 5.0) * uHover;
    float flow = (noise(vUv * 3.0 + uTime * 0.12) - 0.5) * 0.012;
    vec2 dir = normalize(vUv - uMouse + 0.0001);
    vec2 disp = dir * ripple * 0.05 + vec2(flow);
    float ca = (abs(ripple) * 0.02 + 0.0035) * (0.4 + uHover);

    vec3 col = vec3(
      texture2D(uTex, cover(vUv + disp + dir * ca)).r,
      texture2D(uTex, cover(vUv + disp)).g,
      texture2D(uTex, cover(vUv + disp - dir * ca)).b
    );

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 shadow = vec3(0.08, 0.10, 0.16);    // lifted shadow (keeps detail readable)
    vec3 mid = vec3(0.80, 0.18, 0.14);       // combat red midtone
    vec3 hi = vec3(0.98, 0.88, 0.80);        // warm highlight
    vec3 duo = mix(shadow, mid, smoothstep(0.1, 0.55, lum));
    duo = mix(duo, hi, smoothstep(0.62, 0.97, lum));
    col = mix(col, duo, 0.32);               // lighter grade so the photo stays legible

    float vig = smoothstep(1.2, 0.4, distance(vUv, vec2(0.5)));
    col *= 0.7 + 0.3 * vig;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export async function initShowcaseGL(frame: HTMLElement) {
  const img = frame.querySelector<HTMLImageElement>("img");
  if (!img) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    return; // keep the plain <img>
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  let tex: THREE.Texture;
  try {
    tex = await new THREE.TextureLoader().loadAsync(img.currentSrc || img.src);
  } catch {
    renderer.dispose();
    return;
  }
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const canvas = renderer.domElement;
  canvas.className = "showcase__gl";
  frame.appendChild(canvas);
  img.style.opacity = "0"; // kept in DOM for SEO/alt, hidden visually

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTex: { value: tex },
    uTime: { value: 0 },
    uHover: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uImg: { value: new THREE.Vector2((tex.image as HTMLImageElement).width, (tex.image as HTMLImageElement).height) },
  };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag })));

  const resize = () => {
    const w = frame.clientWidth || window.innerWidth;
    const h = frame.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  };
  resize();
  window.addEventListener("resize", resize);

  const targetMouse = new THREE.Vector2(0.5, 0.5);
  let targetHover = 0;
  frame.addEventListener("pointermove", (e) => {
    const r = frame.getBoundingClientRect();
    targetMouse.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    targetHover = 1;
  });
  frame.addEventListener("pointerleave", () => (targetHover = 0));

  let visible = true;
  new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 }).observe(frame);

  const clock = new THREE.Clock();
  const loop = () => {
    if (!frame.isConnected) { renderer.dispose(); return; } // stop after a soft-nav swap
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uMouse.value.lerp(targetMouse, 0.08);
    uniforms.uHover.value += (targetHover - uniforms.uHover.value) * 0.06;
    renderer.render(scene, cam);
  };
  loop();
}
