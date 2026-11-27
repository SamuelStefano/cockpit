import type { BoxInfo } from '../../shared/boxes';
import { overallLevel, type BoxHealth, type HealthItem, type SmokeResult } from '../../shared/box-health';
import type { SealState } from './sealed-socket';

// Pairing a machine, step by step, so nobody has to guess whether it worked.
// Starts when the setup command is copied and follows the new box from "nothing
// yet" to "a real prompt answered". Kept in sessionStorage: the first machine's
// Dashboard unmounts the moment the box comes online, and the app picks it up.

export interface SetupWatch {
  startedAt: number;
  // Boxes the account already had when the command was copied: the new one is
  // the first id outside this list.
  known: string[];
  label: string;
  boxId: string | null;
  smokeAsked: boolean;
}

export type StepState = 'pending' | 'active' | 'ok' | 'warn' | 'error';

export interface SetupStep {
  id: 'box' | 'relay' | 'sealed' | 'health' | 'smoke';
  label: string;
  state: StepState;
  hint?: string;
}

export type SetupPhase = 'waiting' | 'progress' | 'switch' | 'ready' | 'failed';

export interface SetupChecklist {
  phase: SetupPhase;
  title: string;
  steps: SetupStep[];
  box: BoxInfo | null;
  problems: HealthItem[];
  needsSmoke: boolean;
}

export interface ChecklistInput {
  watch: SetupWatch;
  boxes: BoxInfo[] | null;
  active: string | null;
  seal: SealState;
  health: BoxHealth | null;
  smoke: SmokeResult | null;
  now: number;
}

// The installer downloads Node and the claude CLI: a few minutes is normal.
export const SLOW_PAIR_MS = 6 * 60_000;
export const WATCH_TTL_MS = 60 * 60_000;

export function findNewBox(watch: SetupWatch, boxes: BoxInfo[] | null): BoxInfo | null {
  if (!boxes) return null;
  if (watch.boxId) return boxes.find((b) => b.id === watch.boxId) ?? null;
  return boxes.find((b) => !watch.known.includes(b.id)) ?? null;
}

const SEAL_HINT: Partial<Record<SealState, string>> = {
  enroll: 'Cadastre este navegador: rode `deck-agent enroll-device` na máquina e cole o código na tela do Deck.',
  'enroll-failed': 'O código de cadastro não foi aceito. Gere outro com `deck-agent enroll-device` na máquina.',
  rejected: 'A chave da máquina não confere com a que este navegador conhece. Siga a tela "a chave mudou".',
  unsupported: 'Este navegador não tem a criptografia que o Deck usa. Use um Chrome, Edge, Firefox ou Safari atualizado.',
};

function label(box: BoxInfo | null, watch: SetupWatch): string {
  return box?.label || watch.label || 'a máquina';
}

export function setupChecklist(i: ChecklistInput): SetupChecklist {
  const box = findNewBox(i.watch, i.boxes);
  const name = label(box, i.watch);
  const steps: SetupStep[] = [];
  const out = (phase: SetupPhase, title: string, problems: HealthItem[] = [], needsSmoke = false): SetupChecklist => {
    const rest: SetupStep[] = [
      { id: 'box', label: 'Aguardando a máquina', state: 'pending' },
      { id: 'relay', label: 'Máquina conectada ao relay', state: 'pending' },
      { id: 'sealed', label: 'Canal cifrado com este navegador', state: 'pending' },
      { id: 'health', label: 'Checagem da máquina', state: 'pending' },
      { id: 'smoke', label: 'Prompt de teste', state: 'pending' },
    ].slice(steps.length) as SetupStep[];
    return { phase, title, steps: [...steps, ...rest], box, problems, needsSmoke };
  };

  if (!box) {
    const slow = i.now - i.watch.startedAt > SLOW_PAIR_MS;
    steps.push({
      id: 'box', label: 'Aguardando a máquina', state: slow ? 'warn' : 'active',
      hint: slow
        ? 'Já passou do normal. Na máquina: `systemctl status deck-agent --no-pager` e `journalctl -u deck-agent -n 50 --no-pager`.'
        : 'Cole o comando na máquina. A instalação leva de 1 a 5 minutos.',
    });
    return out('waiting', 'Aguardando a máquina rodar o comando…');
  }
  steps.push({ id: 'box', label: `Máquina pareada: ${name}`, state: 'ok' });

  if (!box.online) {
    steps.push({ id: 'relay', label: 'Máquina conectada ao relay', state: 'error', hint: 'Pareou, mas o agente não está de pé. Na máquina: `systemctl status deck-agent --no-pager`.' });
    return out('failed', `${name} pareou mas está offline`);
  }
  steps.push({ id: 'relay', label: 'Máquina conectada ao relay', state: 'ok' });

  if (i.active !== box.id) {
    steps.push({ id: 'sealed', label: 'Canal cifrado com este navegador', state: 'active', hint: 'Abra esta máquina para cifrar o canal e testar.' });
    return out('switch', `${name} está online — abra para concluir o teste`);
  }
  const sealHint = SEAL_HINT[i.seal];
  if (sealHint) {
    steps.push({ id: 'sealed', label: 'Canal cifrado com este navegador', state: 'error', hint: sealHint });
    return out('failed', 'Falta cadastrar este navegador na máquina');
  }
  if (i.seal !== 'sealed') {
    steps.push({ id: 'sealed', label: 'Canal cifrado com este navegador', state: 'active' });
    return out('progress', 'Abrindo o canal cifrado…');
  }
  steps.push({ id: 'sealed', label: 'Canal cifrado com este navegador', state: 'ok' });

  if (!i.health) {
    steps.push({ id: 'health', label: 'Checagem da máquina', state: 'active' });
    return out('progress', 'Checando a máquina…');
  }
  const level = overallLevel(i.health.items);
  const problems = i.health.items.filter((it) => it.level !== 'ok');
  const blocking = i.health.items.filter((it) => it.level === 'error');
  steps.push({ id: 'health', label: 'Checagem da máquina', state: level });
  if (blocking.length) return out('failed', `${name} tem ${blocking.length === 1 ? 'um problema' : `${blocking.length} problemas`} a resolver`, problems);

  if (!i.smoke || i.smoke.state === 'running') {
    steps.push({ id: 'smoke', label: 'Prompt de teste', state: 'active' });
    return out('progress', 'Mandando um prompt de teste…', problems, !i.smoke && !i.watch.smokeAsked);
  }
  if (!i.smoke.ok) {
    steps.push({ id: 'smoke', label: 'Prompt de teste', state: 'error', hint: [i.smoke.error, i.smoke.hint].filter(Boolean).join(' — ') });
    return out('failed', `O prompt de teste falhou em ${name}`, problems);
  }
  steps.push({ id: 'smoke', label: `Prompt de teste respondeu${i.smoke.ms ? ` em ${(i.smoke.ms / 1000).toFixed(1)}s` : ''}`, state: 'ok' });
  return out('ready', `${name} está pronta para usar`, problems);
}

const KEY = 'deck.setup-watch';

function load(): SetupWatch | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as SetupWatch;
    if (typeof w?.startedAt !== 'number' || !Array.isArray(w.known)) return null;
    return Date.now() - w.startedAt > WATCH_TTL_MS ? null : w;
  } catch { return null; }
}

function save(w: SetupWatch | null): void {
  try {
    if (w) sessionStorage.setItem(KEY, JSON.stringify(w));
    else sessionStorage.removeItem(KEY);
  } catch { /* private mode: the watch lives in memory only */ }
}

let watch: SetupWatch | null = load();
const listeners = new Set<() => void>();

function set(next: SetupWatch | null): void {
  watch = next;
  save(next);
  for (const fn of listeners) fn();
}

export const setupWatch = {
  get: () => watch,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  start(known: string[], name: string, now = Date.now()): void {
    // Copying again for the same pairing keeps the progress already made.
    if (watch && !watch.boxId && now - watch.startedAt < WATCH_TTL_MS) { set({ ...watch, label: name || watch.label }); return; }
    set({ startedAt: now, known, label: name, boxId: null, smokeAsked: false });
  },
  bind(boxId: string): void {
    if (watch && watch.boxId !== boxId) set({ ...watch, boxId });
  },
  markSmokeAsked(): void {
    if (watch && !watch.smokeAsked) set({ ...watch, smokeAsked: true });
  },
  stop: () => set(null),
};
