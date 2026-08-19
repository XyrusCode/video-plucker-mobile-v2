import { vars } from 'nativewind';

// V1 dark palette (#0F1115 bg, blue accent). Dark-only — light tokens kept as a mirror
// so nativewind's `dark:` variants still resolve, but the app always renders dark.
export const colors = {
  light: {
    '--primary': '59 130 246',
    '--primary-foreground': '255 255 255',
    '--card': '24 27 34',
    '--secondary': '31 35 44',
    '--secondary-foreground': '232 234 240',
    '--background': '15 17 21',
    '--popover': '24 27 34',
    '--popover-foreground': '232 234 240',
    '--muted': '31 35 44',
    '--muted-foreground': '154 161 175',
    '--destructive': '240 180 41',
    '--foreground': '232 234 240',
    '--border': '42 47 58',
    '--input': '42 47 58',
    '--ring': '29 78 216',
    '--accent': '31 35 44',
    '--accent-foreground': '232 234 240',
    '--ok': '62 207 110',
    '--warn': '240 180 41',
  },
  dark: {
    '--primary-foreground': '255 255 255',
    '--primary': '59 130 246',
    '--card': '24 27 34',
    '--secondary': '31 35 44',
    '--secondary-foreground': '232 234 240',
    '--background': '15 17 21',
    '--popover': '24 27 34',
    '--popover-foreground': '232 234 240',
    '--muted': '31 35 44',
    '--muted-foreground': '154 161 175',
    '--destructive': '240 180 41',
    '--foreground': '232 234 240',
    '--border': '42 47 58',
    '--input': '42 47 58',
    '--ring': '29 78 216',
    '--accent': '31 35 44',
    '--accent-foreground': '232 234 240',
    '--ok': '62 207 110',
    '--warn': '240 180 41',
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};