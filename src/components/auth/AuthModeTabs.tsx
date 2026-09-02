import type { AuthMode } from './useAuthGateForm';

// Alternador entrar/criar conta. Em 'forgot' nenhuma aba fica acesa — o retorno é
// pelo botão "Voltar" da tela, não por uma aba que mentiria sobre o estado.
export function AuthModeTabs({ mode, onSelect }: { mode: AuthMode; onSelect: (m: AuthMode) => void }) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg bg-neutral-950 p-1">
      {(['login', 'register'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onSelect(m)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition
            ${mode === m ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          {m === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      ))}
    </div>
  );
}
