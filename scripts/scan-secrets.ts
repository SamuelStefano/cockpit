// Varredura de segredo no bundle publicado e nas variáveis expostas ao cliente.
//
// Existe por causa de um incidente real (30/06/2026): um token do GitHub com escopo
// de organização inteira foi parar no bundle público de um front porque estava numa
// variável `VITE_*`. Tudo que é `VITE_*`/`NEXT_PUBLIC_*` é embutido no JavaScript
// entregue ao navegador — é público por construção, não por descuido.
//
// Os padrões abaixo são de ALTA precisão de propósito: varredura que grita à toa
// treina todo mundo a ignorar o vermelho do CI.

export interface Finding { file: string; rule: string; excerpt: string }

interface Rule { name: string; re: RegExp }

const RULES: Rule[] = [
  { name: 'github-pat', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'github-pat-fine-grained', re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9]{40,}\b/ },
  { name: 'aws-access-key', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: 'slack-token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  // JWT do Supabase com papel service_role: o payload é base64 e carrega
  // "service_role" em claro. É a chave que ignora RLS — nunca pode sair do servidor.
  { name: 'supabase-service-role', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\./ },
];

export function scanText(file: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const { name, re } of RULES) {
    const m = re.exec(text);
    if (m) out.push({ file, rule: name, excerpt: `${m[0].slice(0, 12)}…` });
  }
  return out;
}

// Nome de variável exposta ao cliente que CHEIRA a segredo. Não olha o valor: a
// intenção já está no nome, e pegar na revisão é mais barato que pegar no bundle.
const SUSPECT = /\b(?:VITE|NEXT_PUBLIC|REACT_APP)_[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY)[A-Z0-9_]*\b/g;

// `VITE_SUPABASE_ANON_KEY` é anon key: pública por desenho, protegida por RLS.
const ALLOWED = new Set(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY']);

export function scanClientEnvNames(file: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const m of text.matchAll(SUSPECT)) {
    if (ALLOWED.has(m[0])) continue;
    out.push({ file, rule: 'segredo em variável exposta ao cliente', excerpt: m[0] });
  }
  return out;
}
