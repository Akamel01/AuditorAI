"use client";

import { Moon, Sun } from "./icons";

const KEY = "auditorai.theme";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark theme"
      title="Toggle theme"
      className="theme-toggle inline-grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-hairline bg-surface text-subtle transition-colors duration-150 hover:border-edge hover:text-text"
    >
      <Moon size={15} className="icon-moon" />
      <Sun size={15} className="icon-sun" />
    </button>
  );
}
