// Formatadores que aparecem em MAIS DE UMA tela. Vivem em shared/ porque o rótulo de
// tempo é produzido no servidor (`SessionMeta.relative`) e também no front (pontos, uso,
// harness): com uma cópia de cada lado o mesmo instante saía como "ontem" na sidebar,
// "há 2d" em /pontos e "1d" em /uso. Antes disso eram 4 relTime e 4 fmtCost divergentes.

// Tempo decorrido: "agora" / "42min" / "3h" / "2d" / "5sem".
// Sem "há"/"atrás": o sufixo repetido em toda linha roubava largura do título (era o que
// `shortRel` recortava com regex depois). Sem "ontem" também — o rótulo afirma um dia do
// calendário a partir de tempo DECORRIDO, e 47h atrás cai em anteontem.
export function relPast(then: number, now: number = Date.now()): string {
  // floor em toda a escala: com round, 59min30s virava "60min" em vez de "1h".
  const min = Math.floor((now - then) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}sem`;
}

// Data/hora absoluta curta: "12/08 14:30" (ano só quando não é o corrente).
// Serve o caso em que o relativo NÃO desempata — duas sessões de título parecido
// marcadas "3d" são indistinguíveis; o horário decide qual é qual.
export function fmtStamp(then: number, now: number = Date.now()): string {
  const d = new Date(then);
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : `/${d.getFullYear()}`;
  return `${day}${year} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Custo em USD, precisão decrescente conforme o valor cresce.
export function fmtCost(usd: number): string {
  if (!(usd > 0)) return '$0';
  // Sub-centavo precisa da 4ª casa (sessão de $0.0042 não é "$0.00"), mas o zero à
  // direita de "$0.0050" anuncia uma precisão que o número não tem.
  if (usd < 0.01) return '$' + usd.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (usd < 1) return `$${usd.toFixed(3)}`;
  if (usd < 100) return `$${usd.toFixed(2)}`;
  // 999.5 já compacta: senão o Math.round imprimiria "$1000", mais largo que "$1.0k".
  if (usd < 999.5) return `$${Math.round(usd)}`;
  return `$${(usd / 1000).toFixed(1)}k`;
}
