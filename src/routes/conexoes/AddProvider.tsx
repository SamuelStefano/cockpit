import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Modal, Segmented } from '../../components/primitives';
import { probeCapsLabel } from '../../../shared/provider-probe';
import type { ProviderProbeView } from '../../cockpit/useProviderProbe';

interface Preset { id: string; name: string; hint: string; tone: string; text: string; login: boolean; url?: string }

export const ADD_PRESETS: Preset[] = [
  { id: 'claude', name: 'Claude', hint: 'login · Claude Code', tone: 'bg-orange-950 text-orange-300', text: 'C', login: true },
  { id: 'openai', name: 'OpenAI · Codex', hint: 'login ou chave', tone: 'bg-emerald-950 text-emerald-300', text: 'O', login: true },
  { id: 'gemini', name: 'Gemini', hint: 'login Google', tone: 'bg-blue-950 text-blue-300', text: 'G', login: true },
  { id: 'grok', name: 'Grok', hint: 'login xAI', tone: 'bg-neutral-800 text-neutral-200', text: 'X', login: true },
  { id: 'zai', name: 'Z.AI · GLM', hint: 'chave', tone: 'bg-indigo-950 text-indigo-300', text: 'Z', login: false, url: 'https://api.z.ai/api/paas/v4' },
  { id: 'deepseek', name: 'DeepSeek', hint: 'chave', tone: 'bg-indigo-950 text-indigo-300', text: 'D', login: false, url: 'https://api.deepseek.com/v1' },
  { id: 'mistral', name: 'Mistral', hint: 'chave', tone: 'bg-red-950 text-red-300', text: 'M', login: false, url: 'https://api.mistral.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', hint: 'chave · centenas de modelos', tone: 'bg-neutral-800 text-neutral-200', text: 'OR', login: false, url: 'https://openrouter.ai/api/v1' },
  { id: 'opencode', name: 'OpenCode', hint: 'login', tone: 'bg-neutral-800 text-neutral-200', text: 'OC', login: true },
  { id: 'ollama', name: 'Ollama', hint: 'local', tone: 'bg-neutral-800 text-neutral-200', text: 'Ol', login: false, url: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', hint: 'local', tone: 'bg-neutral-800 text-neutral-200', text: 'LM', login: false, url: 'http://127.0.0.1:1234/v1' },
];

type Cost = 'free' | 'paid';

interface Props {
  open: boolean;
  onClose: () => void;
  probe: ProviderProbeView;
  onLogin: () => void;
}

export function AddProvider({ open, onClose, probe, onLogin }: Props) {
  const [step, setStep] = useState<'pick' | 'custom'>('pick');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [cost, setCost] = useState<Cost>('free');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const { probeResult, probeBusy, onProviderProbe, onProviderProbeReset } = probe;

  useEffect(() => {
    if (open) return;
    setStep('pick'); setName(''); setUrl(''); setKey(''); setCost('free'); setSkipped(new Set());
    onProviderProbeReset();
  }, [open, onProviderProbeReset]);

  const choose = (p: Preset) => {
    if (p.login) { onClose(); onLogin(); return; }
    setName(p.name); setUrl(p.url ?? ''); setKey(''); setSkipped(new Set());
    onProviderProbeReset();
    setStep('custom');
  };
  const custom = () => { setName(''); setUrl(''); setKey(''); onProviderProbeReset(); setStep('custom'); };
  const test = () => { setSkipped(new Set()); onProviderProbe(url.trim(), key || undefined); };
  const toggle = (id: string) => setSkipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const found = probeResult?.ok ? probeResult.models : null;

  return (
    <Modal open={open} onClose={onClose} title={step === 'pick' ? 'Adicionar modelo ou provedor' : 'Outro endereço · compatível com OpenAI'} icon="plus" maxWidth="max-w-[620px]">
      {step === 'pick' ? (
        <>
          <p className="text-[13px] leading-relaxed text-neutral-400">Escolha de onde vêm os modelos. Login quando o serviço tem, chave quando não tem. Nada sai desta máquina.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ADD_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => choose(p)}
                className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-left transition-colors hover:border-orange-500/40">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${p.tone}`}>{p.text}</span>
                <span className="min-w-0 text-[13px] text-neutral-100">{p.name}<small className="block truncate text-[11.5px] text-neutral-500">{p.hint}</small></span>
              </button>
            ))}
            <button type="button" onClick={custom}
              className="flex items-center gap-2.5 rounded-xl border border-dashed border-neutral-700 bg-neutral-900 p-2.5 text-left transition-colors hover:border-orange-500/40">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-[12px] text-neutral-200">↗</span>
              <span className="min-w-0 text-[13px] text-neutral-100">Outro endereço<small className="block truncate text-[11.5px] text-neutral-500">compatível com OpenAI</small></span>
            </button>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">Llama, Qwen e Mistral abertos chegam por Ollama, LM Studio ou OpenRouter. Chaves ficam no cofre (Conexões › Chaves) e podem ser trocadas sem reconfigurar o agente.</p>
          <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={onClose}>Cancelar</Button></div>
        </>
      ) : (
        <>
          <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Servidor da escola" aria-label="Nome" /></Field>
          <Field label="Endereço" help="Termina em /v1. Funciona com vLLM, LiteLLM, Together, Groq, Fireworks e afins.">
            <Input value={url} onChange={(e) => { setUrl(e.target.value); onProviderProbeReset(); }} placeholder="https://ia.exemplo.com/v1" inputMode="url" autoCapitalize="none" spellCheck={false} aria-label="Endereço" />
          </Field>
          <Field label="Chave" help="Deixe vazio se o servidor não pede chave. A chave só é usada neste teste e não fica guardada.">
            <Input type="password" value={key} onChange={(e) => { setKey(e.target.value); onProviderProbeReset(); }} autoComplete="off" spellCheck={false} aria-label="Chave" />
          </Field>
          <div className="mb-4"><Button variant="secondary" loading={probeBusy} disabled={!url.trim()} onClick={test}>Testar conexão</Button></div>
          {probeResult && !probeResult.ok && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-[13px] text-red-200">{probeResult.error}</p>}
          {found && (
            <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <p className="mb-2 text-[13px] text-neutral-200"><b className="font-medium">Conectou.</b> Encontrei {found.length} {found.length === 1 ? 'modelo' : 'modelos'} — escolha quais aparecem no seletor:</p>
              <ul className="scroll-thin max-h-48 space-y-1.5 overflow-y-auto">
                {found.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5 text-[13px] text-neutral-200">
                    <Checkbox label={m.id} disabled={!m.usable} checked={m.usable && !skipped.has(m.id)} onChange={() => toggle(m.id)} />
                    <span className="min-w-0 truncate">{m.id} <span className="text-neutral-500">· {probeCapsLabel(m)}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Field label="Custo" help="Só pra estimativa em Uso. O Deck não cobra nada.">
            <Segmented label="Custo" value={cost} onChange={setCost} items={[{ id: 'free', label: 'Grátis / já pago' }, { id: 'paid', label: 'Por uso (informar preço)' }]} />
          </Field>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => { onProviderProbeReset(); setStep('pick'); }}>Voltar</Button>
            <Button disabled title="em breve: o cofre de chaves ainda não está no ar" aria-label="Salvar (em breve)">Salvar · em breve</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <span className="mb-1 block text-[12.5px] font-medium text-neutral-300">{label}</span>
      {children}
      {help && <span className="mt-1 block text-[11.5px] text-neutral-500">{help}</span>}
    </div>
  );
}
