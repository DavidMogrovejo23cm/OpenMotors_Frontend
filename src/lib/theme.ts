export type Theme = 'dark' | 'light';

export function getTheme(): Theme {
  return 'light';
}

export function useTheme(): [Theme] {
  return [getTheme()];
}
