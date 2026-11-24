import { Badge, tokens } from '../../components/primitives';

export function PublicOnlyHint() {
  return (
    <p className={`mb-3 flex flex-wrap items-center gap-2 text-[13px] ${tokens.text.muted}`}>
      <Badge>só públicas</Badge>
      Sem sessão DFL neste Deck. Rode <code>dfl-auth login</code> pra ver as skills internas.
    </p>
  );
}
