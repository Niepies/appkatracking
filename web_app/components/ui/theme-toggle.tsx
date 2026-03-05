"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle_theme } = useTheme();

  return (
    <button
      onClick={toggle_theme}
      aria-label={theme === "dark" ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
      className={cn(
        "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
        "bg-gray-100 hover:bg-gray-200 text-gray-600",
        "dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300",
        className
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
