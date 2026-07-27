import type { ComponentType } from 'react';

export type EvalResult = { Component: ComponentType } | { error: string };

// Avalia o módulo já transpilado com o escopo injetado como parâmetros nomeados.
// Diferente do preview em iframe, isto roda NO DOCUMENTO DO APP: é o que permite
// usar os componentes reais, e também o motivo de o modo App nunca aceitar código
// vindo de link compartilhado (ver appSandboxShare).
export function evalComponent(js: string, scope: Record<string, unknown>): EvalResult {
  const names = Object.keys(scope);
  const values = names.map((n) => scope[n]);
  const exports: Record<string, unknown> = {};
  const module = { exports };
  const require = (name: string) => {
    if (name === 'react') return scope.React;
    if (name === 'deck') return scope;
    throw new Error(`módulo indisponível: ${name}`);
  };

  try {
    const fn = new Function(...names, 'require', 'exports', 'module', js);
    fn(...values, require, exports, module);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  const exported = module.exports as { default?: unknown };
  const C = typeof exported.default === 'function' ? exported.default : module.exports;
  if (typeof C !== 'function') {
    return { error: 'O código precisa de um export default (função componente).' };
  }
  return { Component: C as ComponentType };
}
