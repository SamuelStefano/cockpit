// Erro de compilação/render cobre a tela sem derrubar o card: o código continua
// editável e a versão seguinte é uma tentativa nova.
export function ErrorOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-30 flex items-start bg-[#0c0c0c]/95 p-3">
      <pre className="scroll-thin max-h-full overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-snug text-red-400">{message}</pre>
    </div>
  );
}

export const ctrlBtn = (active: boolean) =>
  `relative rounded-sm p-1 transition ${active ? 'text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`;
