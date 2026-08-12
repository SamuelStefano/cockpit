// Gera public/vendor/react-native-web.js — bundle IIFE que expõe
// window.ReactNativeWeb pro iframe de preview de iPhone rodar offline (mesma
// política dos outros assets vendorados: zero fetch externo em runtime).
//
// react/react-dom NÃO entram no bundle: são aliasados pros globais que o iframe
// já carrega (window.React / window.ReactDOM) — assim RNW usa a MESMA instância
// de React, sem duplicar. Rode com `node scripts/build-rnw-vendor.mjs` sempre
// que atualizar a versão do react-native-web.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const globalsPlugin = {
  name: 'globals',
  setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'g' }));
    b.onResolve({ filter: /^react-dom(\/.*)?$/ }, () => ({ path: 'react-dom', namespace: 'g' }));
    b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx-runtime', namespace: 'g' }));
    b.onLoad({ filter: /.*/, namespace: 'g' }, (args) => {
      if (args.path === 'react') return { contents: 'module.exports = window.React;', loader: 'js' };
      if (args.path === 'react-dom') return { contents: 'module.exports = window.ReactDOM;', loader: 'js' };
      // jsx-runtime: React clássico basta pro RNW compilado.
      return {
        contents:
          'var R=window.React;function j(t,p){var c=p&&p.children;var e={};for(var k in p)if(k!=="children")e[k]=p[k];' +
          'return c===undefined?R.createElement(t,e):R.createElement.apply(R,[t,e].concat(c));}' +
          'exports.jsx=j;exports.jsxs=j;exports.Fragment=R.Fragment;',
        loader: 'js',
      };
    });
  },
};

await build({
  stdin: {
    contents: "import * as RNW from 'react-native-web'; window.ReactNativeWeb = RNW;",
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"', global: 'window' },
  plugins: [globalsPlugin],
  outfile: resolve(root, 'public/vendor/react-native-web.js'),
  logLevel: 'info',
});
