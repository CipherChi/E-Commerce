import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-text-primary)',
        paper: 'var(--color-surface)',
        accent: 'var(--color-accent)',
        surface: 'var(--color-surface)',
        'surface-strong': 'var(--color-surface-strong)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
      },
    },
  },
  plugins: [],
} satisfies Config;
