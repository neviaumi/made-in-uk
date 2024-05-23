import tailwindCssConfig from '@busybox/tailwindcss-config';
import { withColors } from '@busybox/tailwindcss-config/themes/colors';
import { withSpacing } from '@busybox/tailwindcss-config/themes/spacing';

/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./app/**/*.{ts,tsx}'],
  presets: [withSpacing(withColors(tailwindCssConfig))],
};

export default config;
