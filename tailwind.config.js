/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // Tapa no visual: a escala `neutral` vira um carvão LEVEMENTE quente (hue ~35°,
      // baixa saturação). Mesma luminosidade dos passos originais — contraste e layout
      // não mudam, só o tom esquenta e passa a conversar com o acento laranja em vez do
      // cinza plano. Override central = repinta todo `*-neutral-*` do app de forma coesa.
      colors: {
        neutral: {
          50: '#faf9f8',
          100: '#f2f0ee',
          200: '#e4e1dd',
          300: '#c6c1bb',
          400: '#a09a92',
          500: '#7a746c',
          600: '#5a544d',
          700: '#403b35',
          800: '#2a2724',
          900: '#1a1816',
          950: '#100e0d',
        },
      },
    },
  },
  plugins: [],
};
