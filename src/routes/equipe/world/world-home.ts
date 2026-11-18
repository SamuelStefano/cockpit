import { HOUSES } from './world-map';

type HouseRef = { id: string; kind?: string };
type HomeBot = { home?: string; project?: string; sector?: string };

const OFFICE = 'escritorio';
// Buildings of the design doc that the 16 px map does not have yet.
const ALIASES: Readonly<Record<string, string>> = {
  prefeitura: OFFICE, banco: OFFICE, seguranca: OFFICE, servidores: OFFICE, estudio: 'corte-radar',
};
const DEPARTMENT_HOME: Readonly<Record<string, string>> = {
  direction: 'prefeitura', finance: 'banco', growth: 'estudio', operations: 'servidores', engineering: OFFICE,
};

// The building a bot lives in: its home, the alias of a missing building, its project house,
// its department's building, then the office.
export function homeOf(bot: HomeBot, houses: readonly HouseRef[] = HOUSES): string {
  const known = (id: string | undefined): id is string => !!id && houses.some((h) => h.id === id && (h.kind ?? 'house') === 'house');
  const resolve = (id: string | undefined): string | null => (known(id) ? id : id && known(ALIASES[id]) ? ALIASES[id]! : null);
  if (known(bot.home)) return bot.home;
  const homeAlias = bot.home ? ALIASES[bot.home] : undefined;
  if (known(homeAlias)) return homeAlias;
  if (known(bot.project)) return bot.project;
  return resolve(bot.sector ? DEPARTMENT_HOME[bot.sector] : undefined) ?? OFFICE;
}
