const PLACAR_URL = 'https://placar-jade-kappa.vercel.app';

export function Placar() {
  return <iframe src={PLACAR_URL} title="Placar" className="h-full w-full flex-1 border-0" />;
}
