import { THEMES, type ThemeId } from "./data";

const KEY = "bcp-theme";
const LEGACY = new Map<string, ThemeId>([
  ["heritage", "dark"],
  ["arena", "dark"],
  ["raw", "dark"],
]);
const valid = THEMES.map((t) => t.id) as readonly string[];

export function getTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      if (valid.includes(saved)) return saved as ThemeId;
      const migrated = LEGACY.get(saved);
      if (migrated) return migrated;
    }
  } catch {}
  return "dark";
}

export function applyTheme(id: ThemeId, animate = true) {
  const root = document.documentElement;
  root.style.removeProperty("--accent");
  root.style.removeProperty("--glow");
  if (animate) {
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 650);
  }
  root.setAttribute("data-theme", id);
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  document
    .querySelectorAll<HTMLButtonElement>(".theme-switch button")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.th === id)));
  const toggle = document.getElementById("mode-toggle");
  toggle?.setAttribute("aria-pressed", String(id === "light"));
  toggle?.setAttribute("aria-label", id === "light" ? "Passer en mode sombre" : "Passer en mode clair");
  window.dispatchEvent(new CustomEvent("themechange", { detail: id }));
}

export function toggleTheme() {
  applyTheme(getTheme() === "light" ? "dark" : "light");
}

/** Read the current accent color resolved from CSS, for the 3D scene. */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string) => cs.getPropertyValue(v).trim();
  return {
    accent: get("--accent") || "#aebccf",
    accent2: get("--accent-2") || "#7f8ca3",
    energy: get("--energy") || "#c3cdda",
    bg: get("--bg") || "#0a1020",
  };
}

export function initThemeSwitch() {
  applyTheme(getTheme(), false);
  document.querySelectorAll<HTMLButtonElement>(".theme-switch button").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.th as ThemeId);
      window.dispatchEvent(new CustomEvent("ui-tick"));
    });
  });
  document.getElementById("mode-toggle")?.addEventListener("click", () => {
    toggleTheme();
    window.dispatchEvent(new CustomEvent("ui-tick"));
  });
}
