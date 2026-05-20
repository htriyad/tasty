import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface ThemeToggleProps {
  size?: "sm" | "md";
}

export function ThemeToggle({ size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  if (size === "sm") {
    return (
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all
          bg-white/8 hover:bg-white/14 border border-white/10 hover:border-white/20
          shadow-sm"
        title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      >
        {isLight
          ? <Moon className="w-3.5 h-3.5 text-indigo-500" />
          : <Sun className="w-3.5 h-3.5 text-amber-400" />
        }
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all
        bg-white/6 hover:bg-white/12 border border-white/10 hover:border-white/20
        shadow-sm"
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-white/60 text-xs">Dark</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-white/60 text-xs">Light</span>
        </>
      )}
    </button>
  );
}
