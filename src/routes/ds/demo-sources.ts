// Fontes de exemplo dos blocos ```preview* da galeria. Ficam fora do componente
// porque são texto de dado, não JSX — e o `preview-test` depende de um teste que
// falha DE PROPÓSITO pra provar o vermelho do juiz.
export const DEMO_PREVIEW = `import { useState } from 'react';

export default function Contador() {
  const [n, setN] = useState(0);
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="text-4xl font-bold text-orange-500">{n}</div>
      <button onClick={() => setN(n + 1)}
        className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600">
        somar +1
      </button>
    </div>
  );
}`;

export const DEMO_PREVIEW_NATIVE = `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [n, setN] = useState(0);
  return (
    <View style={s.wrap}>
      <Text style={s.num}>{n}</Text>
      <Pressable style={s.btn} onPress={() => setN(n + 1)}>
        <Text style={s.btnTxt}>somar +1</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#0c0c0c' },
  num: { fontSize: 48, fontWeight: '700', color: '#f97316' },
  btn: { backgroundColor: '#f97316', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { color: '#fff', fontWeight: '600' },
});`;

export const DEMO_PREVIEW_SVG = `<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="120" height="120" rx="24" fill="#f97316">
    <animate attributeName="rx" values="24;60;24" dur="2s" repeatCount="indefinite" />
  </rect>
  <circle cx="90" cy="90" r="26" fill="#0c0c0c" />
</svg>`;

export const DEMO_PREVIEW_TEST = `function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

test('fib base', () => {
  expect(fib(0)).toBe(0);
  expect(fib(1)).toBe(1);
});

test('fib(10) = 55', () => {
  expect(fib(10)).toBe(55);
});

test('isso falha de propósito', () => {
  expect(fib(5)).toBe(999);
});`;
