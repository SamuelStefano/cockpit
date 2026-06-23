/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // Alinhamento DFL: a escala `neutral` vira um azul-frio escuro (hue ~215, baixa
      // saturação) espelhando o tema shadcn dos apps DFL (plans/learn/payments —
      // background 216°28%7%, card 215°21%11%, border 215°15%15%). Mesma cara
      // "GitHub-dark + laranja". Override central repinta todo `*-neutral-*` coeso.
      // Cantos mais macios, igual ao learn (--radius 0.75rem, lg 1rem). Override
      // central: `rounded-lg/xl` do app inteiro fica com o arredondado do learn.
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      colors: {
        // Black moderno alaranjado (estética learn / Linear-Vercel dark): cool-neutral
        // bem escuro, quase preto no fundo, com o acento laranja. Menos azulado que o
        // GitHub-navy anterior — mais "black moderno" como o Samuel pediu.
        neutral: {
          50: '#f5f5f6',
          100: '#e9e9ec',
          200: '#d2d2d8',
          300: '#a9a9b2',
          400: '#82828c',
          500: '#5b5b64',
          600: '#3d3d44',
          700: '#27272c',
          800: '#19191d',
          900: '#101013',
          950: '#080809',
        },
      },
    },
  },
  plugins: [],
};
