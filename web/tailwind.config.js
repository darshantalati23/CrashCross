import typography from '@tailwindcss/typography';
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#1c2430', soft: '#4a5565', faint: '#7b8595' },
        paper: { DEFAULT: '#fbfaf7', card: '#ffffff', line: '#e4e1da' },
        accent: { DEFAULT: '#1f5f8b', soft: '#e7f0f7', dark: '#164766' },
        warn: { DEFAULT: '#9a4b12', soft: '#fbefe4' },
      },
      maxWidth: { prose: '72ch' },
    },
  },
  plugins: [typography],
};
