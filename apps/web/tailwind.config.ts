import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#f8fafc',
          dark: '#0b0f1a',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
