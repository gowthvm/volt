import { useThemeContext } from '@/components/ThemeProvider';

export const useTheme = () => {
  const themeContext = useThemeContext();
  return themeContext;
};
