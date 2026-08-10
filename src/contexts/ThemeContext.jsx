import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'funknime-theme';
const VALID_THEMES = ['dark', 'light', 'minimal', 'neobrutalism'];
const DEFAULT_THEME = 'dark';

const readInitialTheme = () => {
  try {
    const saved = typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
    if (saved && VALID_THEMES.includes(saved)) return saved;
  } catch {
    // localStorage may be unavailable (private mode)
  }
  return DEFAULT_THEME;
};

// Set <html data-theme> as early as possible to avoid flash
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', readInitialTheme());
}

export const ThemeProvider = ({ children }) => {
  // Always start from the default so SSR and first client render match,
  // then adopt the stored theme after hydration.
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThemeState(readInitialTheme());
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage may be unavailable (private mode)
    }
  }, [theme, hydrated]);

  const setTheme = (next) => {
    if (VALID_THEMES.includes(next)) setThemeState(next);
  };

  const value = { theme, setTheme, themes: VALID_THEMES };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
