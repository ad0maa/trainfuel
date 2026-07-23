/** @type {import('tailwindcss').Config} */
// TrainFuel — Cyan Steel tokens for the Expo / NativeWind app.
// Replace trainfuel-mobile/tailwind.config.js with this.
//
// darkMode 'class' lets NativeWind switch on the OS color scheme (it maps
// the system setting to the `dark` variant automatically in RN). Use the
// semantic class names below (bg-surface, text-muted, border-line, bg-accent…)
// instead of raw palette classes like bg-blue-600 / bg-white dark:bg-black.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // light values are the defaults; dark values live under the `dark` key
        // and are applied via the dark: variant (see MAPPING.md).
        bg: { DEFAULT: '#f4f6f8', dark: '#08111a' },
        surface: { DEFAULT: '#ffffff', dark: '#101d29' },
        surface2: { DEFAULT: '#eef2f6', dark: '#16283a' },
        line: { DEFAULT: '#e0e6ec', dark: '#1c2f3d' },
        ink: { DEFAULT: '#0c1826', dark: '#eaf2f8' },
        muted: { DEFAULT: '#5b6b7b', dark: '#7d94a6' },
        accent: { DEFAULT: '#0891b2', dark: '#22b8d9' },
        accent2: { DEFAULT: '#06b6d4', dark: '#38e0e0' },
        onAccent: { DEFAULT: '#ffffff', dark: '#04141a' },
        track: { DEFAULT: '#e0e6ec', dark: '#1c2f3d' },
        success: { DEFAULT: '#0f9d76', dark: '#34d399' },
        warning: { DEFAULT: '#d98a1f', dark: '#f0b23e' },
        danger: { DEFAULT: '#d1495b', dark: '#f76d7f' },
      },
      borderRadius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },
      spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 },
      fontFamily: {
        sans: ['IBMPlexSans', 'System'],
        mono: ['IBMPlexMono', 'monospace'],
      },
      fontSize: {
        display: [40, { lineHeight: 44, fontWeight: '600' }],
        h1: [30, { lineHeight: 34, fontWeight: '600' }],
        h2: [22, { lineHeight: 28, fontWeight: '600' }],
        h3: [18, { lineHeight: 24, fontWeight: '600' }],
        body: [15, { lineHeight: 24 }],
        small: [13, { lineHeight: 18 }],
        caption: [11, { lineHeight: 14, fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
