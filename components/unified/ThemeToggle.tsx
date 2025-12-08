'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * ThemeToggle Component
 *
 * A toggle button that switches between light and dark themes.
 * Uses next-themes for theme management.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-md bg-gray-100 dark:bg-gray-800 transition-colors"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Moon className="w-5 h-5 text-gray-300" />
      ) : (
        <Sun className="w-5 h-5 text-yellow-500" />
      )}
    </button>
  );
}
