import { THEMES, type ThemeId } from "./data";

const KEY = "bcp-theme";
const valid = THEMES.map((t) => t.id) as readonly string[];

export function getTheme(): ThemeId {
  const saved = localStorage.getItem(KEY);
  if (saved && valid.includes(saved)) return saved as ThemeId;
  return "heritage"; // navy + silver — club identity
}

export function applyTheme(id: ThemeId, animate = true) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 650);
  }
  root.setAttribute("data-theme", id);
  localStorage.setItem(KEY, id);
  document
    .querySelectorAll<HTMLButtonElement>(".theme-switch button")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.th === id)));
  window.dispatchEvent(new CustomEvent("themechange", { detail: id }));
}

/** Read the current accent color resolved from CSS, for the 3D scene. */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string) => cs.getPropertyValue(v).trim();
  return {
    accent: get("--accent") || "#2d6bff",
    accent2: get("--accent-2") || "#c8a24b",
    energy: get("--energy") || "#e8001c",
    bg: get("--bg") || "#06080d",
  };
}

export function initThemeSwitch() {
  applyTheme(getTheme(), false);
  document.querySelectorAll<HTMLButtonElement>(".theme-switch button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.th as ThemeId;
      applyTheme(id);
      window.dispatchEvent(new CustomEvent("ui-tick"));
    });
  });
}
