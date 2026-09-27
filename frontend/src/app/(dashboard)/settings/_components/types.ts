export interface ThemeSwatch {
  id: string;
  name: string;
  bgColor: string;
  dotColor?: string;
  borderColor?: string;
  palette?: string;
  mode?: 'dark' | 'light';
  isAuto?: boolean;
}
