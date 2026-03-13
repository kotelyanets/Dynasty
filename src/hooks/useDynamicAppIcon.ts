/**
 * useDynamicAppIcon.ts
 * ─────────────────────────────────────────────────────────────
 * Dynamic PWA app icon selection.
 *
 * Before the user taps "Add to Home Screen", this hook lets them
 * choose between different icon themes (Dark, Light, Retro, Neon).
 *
 * The trick: we programmatically update the <link rel="apple-touch-icon">
 * and the manifest icon before the PWA install prompt fires.
 */

import { useState, useCallback, useEffect } from 'react';

export type IconTheme = 'default' | 'dark' | 'light' | 'retro' | 'neon';

const STORAGE_KEY = 'vault_icon_theme';

/**
 * SVG icon generators for each theme.
 * Returns a data: URI that can be used as an icon src.
 */
const ICON_THEMES: Record<IconTheme, { svg: string; label: string; color: string }> = {
  default: {
    label: 'Default',
    color: '#FA2D48',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23FA2D48'/><text x='50' y='68' text-anchor='middle' font-size='50' fill='white'>♪</text></svg>`,
  },
  dark: {
    label: 'Dark',
    color: '#1C1C1E',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231C1C1E'/><text x='50' y='68' text-anchor='middle' font-size='50' fill='%23FA2D48'>♪</text></svg>`,
  },
  light: {
    label: 'Light',
    color: '#F2F2F7',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23F2F2F7'/><text x='50' y='68' text-anchor='middle' font-size='50' fill='%23FA2D48'>♪</text></svg>`,
  },
  retro: {
    label: 'Retro',
    color: '#FF6B35',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23FF6B35'/><text x='50' y='68' text-anchor='middle' font-size='50' fill='%23FFF3E0'>♪</text></svg>`,
  },
  neon: {
    label: 'Neon',
    color: '#00E5FF',
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23000000'/><text x='50' y='68' text-anchor='middle' font-size='50' fill='%2300E5FF'>♪</text></svg>`,
  },
};

function getSvgDataUri(theme: IconTheme): string {
  return `data:image/svg+xml,${ICON_THEMES[theme].svg}`;
}

/**
 * Apply the icon theme to the DOM.
 * Updates <link rel="apple-touch-icon"> and the manifest link.
 */
function applyIconToDOM(theme: IconTheme): void {
  const iconUri = getSvgDataUri(theme);

  // Update apple-touch-icon
  let link = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    document.head.appendChild(link);
  }
  link.href = iconUri;

  // Update shortcut icon / favicon
  let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = iconUri;
  favicon.type = 'image/svg+xml';
}

export function useDynamicAppIcon() {
  const [theme, setThemeState] = useState<IconTheme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as IconTheme) || 'default';
    } catch {
      return 'default';
    }
  });

  // Apply icon on mount and when theme changes
  useEffect(() => {
    applyIconToDOM(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: IconTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
    applyIconToDOM(newTheme);
  }, []);

  const themes = Object.entries(ICON_THEMES).map(([key, val]) => ({
    id: key as IconTheme,
    label: val.label,
    color: val.color,
    iconUrl: getSvgDataUri(key as IconTheme),
  }));

  return { theme, setTheme, themes };
}
