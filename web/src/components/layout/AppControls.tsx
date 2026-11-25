import { Languages, Moon, Palette, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { localeLabels, locales } from '@/core/i18n/locales';
import { colorModes, themeNames } from '@/core/theme/theme';
import { getNextValue } from '@/core/utils/cycle';
import { useCartStore } from '@/features/store';
import { useAppPreferences } from '@/providers/appPreferencesContext';

const colorModeIcons = { light: Sun, dark: Moon } as const;

/** 语言 / 主题色 / 深浅色切换（每次切换均有即时提示反馈）。 */
export function AppControls() {
  const { t } = useTranslation();
  const { locale, theme, colorMode, changeLocale, changeTheme, changeColorMode } =
    useAppPreferences();
  const showToast = useCartStore((state) => state.showToast);
  const ModeIcon = colorModeIcons[colorMode];

  const handleLocaleChange = () => {
    const next = getNextValue(locales, locale);
    changeLocale(next);
    showToast(t('feedback.localeChanged', { value: localeLabels[next] }));
  };

  const handleThemeChange = () => {
    const next = getNextValue(themeNames, theme);
    changeTheme(next);
    showToast(t('feedback.themeChanged', { value: t(`settings.themeNames.${next}`) }));
  };

  const handleColorModeChange = () => {
    const next = getNextValue(colorModes, colorMode);
    changeColorMode(next);
    showToast(t('feedback.colorModeChanged', { value: t(`settings.colorModeNames.${next}`) }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('settings.language')}
        onClick={handleLocaleChange}
      >
        <Languages />
        {localeLabels[locale]}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('settings.theme')}
        onClick={handleThemeChange}
      >
        <Palette className="text-primary" />
        {t(`settings.themeNames.${theme}`)}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('settings.colorMode')}
        onClick={handleColorModeChange}
      >
        <ModeIcon />
        {t(`settings.colorModeNames.${colorMode}`)}
      </Button>
    </div>
  );
}
