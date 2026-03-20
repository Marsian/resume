/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: {
            primary: 'var(--dark-bg-primary)',
            secondary: 'var(--dark-bg-secondary)',
            tertiary: 'var(--dark-bg-tertiary)',
          },
          text: {
            primary: 'var(--dark-text-primary)',
            secondary: 'var(--dark-text-secondary)',
            tertiary: 'var(--dark-text-tertiary)',
          },
          border: {
            primary: 'var(--dark-border-primary)',
            secondary: 'var(--dark-border-secondary)',
          },
        },
      },
      keyframes: {
        'fade-in-down-home': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-home': {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-10px)' },
          '60%': { transform: 'translateY(-5px)' },
        },
      },
      animation: {
        'fade-in-down-home': 'fade-in-down-home 0.6s ease both',
        'bounce-home': 'bounce-home 4s 2s infinite',
      },
    },
  },
  plugins: []
}

