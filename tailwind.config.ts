import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Orange accent palette matching wavefnx.com
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Light theme surface colors
        surface: {
          50: '#ffffff',
          100: '#fafafa',
          200: '#f0f0f0',
          300: '#e0e0e0',
          400: '#c8c8c8',
          500: '#a0a0a0',
          600: '#787878',
          700: '#505050',
          800: '#383838',
          900: '#282828',
          950: '#181818',
        },
        // Segment colors for gear profiles
        segment: {
          ab: '#dc2626',      // Red - convex arc AB
          bc: '#e35000',      // Orange - tangent line BC
          cd: '#16a34a',      // Green - concave arc CD
          conjugate: '#ea580c', // Orange - conjugate profile
        },
        // Reference line colors
        reference: {
          addendum: '#db2777',  // Pink
          pitch: '#7c3aed',     // Violet
          dedendum: '#ea580c',  // Orange
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      spacing: {
        '0.5': '0.125rem',
        '1.5': '0.375rem',
      },
    },
  },
  plugins: [],
}

export default config
