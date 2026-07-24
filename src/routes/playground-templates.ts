import type { IconName } from '../components/primitives/Icon';

// Linguagens do playground e seus starters. `lang` casa com PREVIEW_LANGS do
// CodeBlock (modeOf mapeia pro runtime certo do iframe).
export interface Lang { id: string; label: string; icon: IconName }
export const LANGS: Lang[] = [
  { id: 'preview', label: 'React', icon: 'zap' },
  { id: 'preview-html', label: 'HTML', icon: 'code' },
  { id: 'preview-native', label: 'iPhone', icon: 'smartphone' },
  { id: 'preview-svg', label: 'SVG', icon: 'code' },
  { id: 'preview-test', label: 'Testes', icon: 'terminal' },
];

export interface Template { id: string; label: string; lang: string; code: string }

const REACT_COUNTER = `export default function App() {
  const [n, setN] = React.useState(0);
  return (
    <div style={{ fontFamily: 'system-ui', padding: 32, textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, margin: 0, color: '#f97316' }}>{n}</h1>
      <p style={{ color: '#64748b' }}>clique pra contar</p>
      <button onClick={() => setN(n + 1)}
        style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, border: 0,
          background: '#f97316', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
        + adicionar
      </button>
    </div>
  );
}`;

const REACT_CARD = `export default function App() {
  return (
    <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500" />
        <h2 className="mt-4 text-lg font-semibold text-slate-800">Card com Tailwind</h2>
        <p className="mt-1 text-sm text-slate-500">Classes utilitárias funcionam ao vivo no sandbox.</p>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Ação
        </button>
      </div>
    </div>
  );
}`;

const HTML_LANDING = `<div style="font-family:system-ui;background:linear-gradient(135deg,#f97316,#db2777);color:#fff;padding:48px;text-align:center;border-radius:12px">
  <h1 style="font-size:34px;margin:0">Sua landing em HTML puro</h1>
  <p style="opacity:.9;margin-top:8px">Sem build, sem framework — só markup ao vivo.</p>
  <a href="#" style="display:inline-block;margin-top:20px;background:#fff;color:#db2777;padding:12px 24px;border-radius:999px;font-weight:700;text-decoration:none">Começar agora</a>
</div>`;

const NATIVE_APP = `import { View, Text, Pressable, StyleSheet } from 'react-native';
export default function App() {
  const [likes, setLikes] = React.useState(0);
  return (
    <View style={s.wrap}>
      <Text style={s.title}>App nativo</Text>
      <Text style={s.count}>{likes} curtidas</Text>
      <Pressable style={s.btn} onPress={() => setLikes(likes + 1)}>
        <Text style={s.btnText}>curtir</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  title: { color: '#f97316', fontSize: 24, fontWeight: '700' },
  count: { color: '#e2e8f0', fontSize: 16, marginTop: 8 },
  btn: { marginTop: 20, backgroundColor: '#f97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '600' },
});`;

const SVG_LOGO = `<svg width="220" height="220" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f97316" />
      <stop offset="1" stop-color="#db2777" />
    </linearGradient>
  </defs>
  <circle cx="110" cy="110" r="80" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round"
    stroke-dasharray="380 120">
    <animateTransform attributeName="transform" type="rotate" from="0 110 110" to="360 110 110"
      dur="2.4s" repeatCount="indefinite" />
  </circle>
  <circle cx="110" cy="110" r="30" fill="url(#g)">
    <animate attributeName="r" values="24;34;24" dur="1.6s" repeatCount="indefinite" />
  </circle>
</svg>`;

const TEST_SUITE = `// Escreva asserções — test() e expect() são globais.
function soma(a, b) { return a + b; }
function reverse(s) { return s.split('').reverse().join(''); }

test('soma dois números', () => {
  expect(soma(2, 3)).toBe(5);
});

test('reverte string', () => {
  expect(reverse('deck')).toBe('kced');
});

test('objeto deep equal', () => {
  expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
});

test('array contém', () => {
  expect([10, 20, 30]).toContain(20);
});`;

export const TEMPLATES: Template[] = [
  { id: 'react-counter', label: 'contador', lang: 'preview', code: REACT_COUNTER },
  { id: 'react-card', label: 'card tailwind', lang: 'preview', code: REACT_CARD },
  { id: 'html-landing', label: 'landing', lang: 'preview-html', code: HTML_LANDING },
  { id: 'native-app', label: 'app nativo', lang: 'preview-native', code: NATIVE_APP },
  { id: 'svg-logo', label: 'logo animada', lang: 'preview-svg', code: SVG_LOGO },
  { id: 'test-suite', label: 'suíte exemplo', lang: 'preview-test', code: TEST_SUITE },
];
