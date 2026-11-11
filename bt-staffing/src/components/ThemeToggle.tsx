"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Switch between light and dark"
      title="Light / dark"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-sunken hover:text-ink ${className}`}
      onClick={() => {
        const root = document.documentElement;
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <Sun size={17} className="hidden dark:block" />
      <Moon size={17} className="block dark:hidden" />
    </button>
  );
}
