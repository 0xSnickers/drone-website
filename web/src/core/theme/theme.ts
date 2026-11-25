import { safeStorage, storageKey } from '../utils/storage';

/**
 * 品牌主题色。新增主题只需要在这里加一项，并在语言包 settings.themeNames 中补充名称。
 * 颜色通过 CSS 变量覆盖 tokens.css 中的默认值，业务组件不要硬编码主色。
 */
export const themes = {
  apex: {
    primary: '#00e5ff',
    primaryForeground: '#001f24',
    secondary: '#ff5e00',
    secondaryForeground: '#ffffff',
  },
  blue: {
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    secondary: '#0f766e',
    secondaryForeground: '#ffffff',
  },
  violet: {
    primary: '#7c3aed',
    primaryForeground: '#ffffff',
    secondary: '#0891b2',
    secondaryForeground: '#ffffff',
  },
  emerald: {
    primary: '#059669',
    primaryForeground: '#ffffff',
    secondary: '#4f46e5',
    secondaryForeground: '#ffffff',
  },
} as const;

export type AppTheme = keyof typeof themes;

export const themeNames = Object.keys(themes) as AppTheme[];

export const defaultTheme: AppTheme = 'apex';

export const colorModes = ['light', 'dark'] as const;

export type ColorMode = (typeof colorModes)[number];

export const defaultColorMode: ColorMode = 'dark';

export const THEME_STORAGE_KEY = storageKey('theme');
export const COLOR_MODE_STORAGE_KEY = storageKey('color-mode');

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && value in themes;
}

export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === 'string' && (colorModes as readonly string[]).includes(value);
}

export function getStoredTheme(): AppTheme {
  const stored = safeStorage.get(THEME_STORAGE_KEY);
  return isAppTheme(stored) ? stored : defaultTheme;
}

export function storeTheme(theme: AppTheme): void {
  safeStorage.set(THEME_STORAGE_KEY, theme);
}

export function getStoredColorMode(): ColorMode {
  const stored = safeStorage.get(COLOR_MODE_STORAGE_KEY);
  return isColorMode(stored) ? stored : defaultColorMode;
}

export function storeColorMode(mode: ColorMode): void {
  safeStorage.set(COLOR_MODE_STORAGE_KEY, mode);
}

export function resolveColorMode(mode: ColorMode): 'light' | 'dark' {
  return mode;
}

/** 把品牌主题色写入根节点 CSS 变量。 */
export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;

  const colors = themes[theme];
  const root = document.documentElement;

  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--ring', colors.primary);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.dataset.theme = theme;
}

/** 切换浅色 / 深色。 */
export function applyColorMode(mode: ColorMode): void {
  if (typeof document === 'undefined') return;

  const resolved = resolveColorMode(mode);
  const root = document.documentElement;

  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.dataset.colorMode = mode;
}

/**
 * 首屏防闪烁脚本：在页面渲染前同步应用已保存的主题和深浅色。
 */
export const themeInitScript = `(function(){try{var t=${JSON.stringify(themes)};var s=localStorage;var n=s.getItem('${THEME_STORAGE_KEY}')||'${defaultTheme}';var m=s.getItem('${COLOR_MODE_STORAGE_KEY}');if(m!=='light'&&m!=='dark'){m='${defaultColorMode}';}var r=document.documentElement;if(t[n]){r.style.setProperty('--primary',t[n].primary);r.style.setProperty('--primary-foreground',t[n].primaryForeground);r.style.setProperty('--ring',t[n].primary);r.style.setProperty('--secondary',t[n].secondary);r.style.setProperty('--secondary-foreground',t[n].secondaryForeground);r.dataset.theme=n;}var d=m==='dark';r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
