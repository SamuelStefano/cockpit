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
        neutral: {
          50: '#f0f3f6',
          100: '#e6edf3',
          200: '#cdd9e5',
          300: '#afbac5',
          400: '#8b949e',
          500: '#6e7781',
          600: '#444c56',
          700: '#30363d',
          800: '#21262d',
          900: '#161b22',
          950: '#0d1117',
        },
      },
    },
  },
  plugins: [],
};
