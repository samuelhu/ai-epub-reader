export interface ThemeColors {
  bg: string;
  fg: string;
  link: string;
}

type ThemeKey = 'light' | 'dark' | 'sepia';

export const READER_THEMES: Record<ThemeKey, ThemeColors> = {
  light: { bg: '#fafaf8', fg: '#171717', link: '#2563eb' },
  dark: { bg: '#09090b', fg: '#e4e4e7', link: '#3b82f6' },
  sepia: { bg: '#f3eed9', fg: '#3d2e1f', link: '#b85c00' },
};

export function getThemeColors(theme: string): ThemeColors {
  return READER_THEMES[theme as ThemeKey] || READER_THEMES.light;
}

export function generateTheme({ bg, fg, link }: ThemeColors) {
  return {
    "body":       { "background": bg + " !important", "color": fg + " !important" },
    "p":          { "color": fg + " !important", "background": "transparent !important" },
    "span":       { "color": fg + " !important", "background": "transparent !important" },
    "div":        { "color": fg + " !important", "background": "transparent !important" },
    "h1":         { "color": fg + " !important", "background": "transparent !important" },
    "h2":         { "color": fg + " !important", "background": "transparent !important" },
    "h3":         { "color": fg + " !important", "background": "transparent !important" },
    "h4":         { "color": fg + " !important", "background": "transparent !important" },
    "h5":         { "color": fg + " !important", "background": "transparent !important" },
    "h6":         { "color": fg + " !important", "background": "transparent !important" },
    "li":         { "color": fg + " !important", "background": "transparent !important" },
    "blockquote": { "color": fg + " !important", "background": "transparent !important" },
    "a":          { "color": link + " !important" },
  };
}
