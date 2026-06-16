import type { ThemeId } from "./data";

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");

export function systemTheme(): ThemeId {
  try {
    return mq().matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

export function applyTheme(id: ThemeId, animate = false) {
  const root = document.documentElement;
  root.style.removeProperty("--accent");
  root.style.removeProperty("--glow");
  if (animate) {
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 650);
  }
  root.setAttribute("data-theme", id);
  window.dispatchEvent(new CustomEvent("themechange", { detail: id }));
}

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

/** Thème automatique selon la préférence système (clair / sombre). */
export function initThemeSwitch() {
  const apply = () => applyTheme(systemTheme(), false);
  apply();
  try {
    mq().addEventListener("change", apply);
  } catch {
    mq().addListener(apply);
  }
}
