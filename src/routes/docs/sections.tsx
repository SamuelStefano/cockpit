import { Hero } from './sections/Hero';
import { Overview } from './sections/Overview';
import { Features } from './sections/Features';
import { Queue } from './sections/Queue';
import { Realtime } from './sections/Realtime';
import { Context } from './sections/Context';
import { TokenEconomy } from './sections/TokenEconomy';
import { Connect } from './sections/Connect';
import { Resources } from './sections/Resources';
import { Modes } from './sections/Modes';
import { Profile } from './sections/Profile';
import { Drop } from './sections/Drop';
import { Search } from './sections/Search';
import { Commands } from './sections/Commands';
import { Models } from './sections/Models';
import { Playground } from './sections/Playground';
import { Graph } from './sections/Graph';
import { Bench } from './sections/Bench';
import { Admin } from './sections/Admin';
import { Internals } from './sections/Internals';
import { RepoMap } from './sections/RepoMap';

export function DocSections({ year }: { year: number }) {
  return (
    <>
      <Hero />
      <Overview />
      <Features />
      <Queue />
      <Realtime />
      <Context />
      <TokenEconomy />
      <Connect />
      <Resources />
      <Modes />
      <Profile />
      <Drop />
      <Search />
      <Commands />
      <Models />
      <Playground />
      <Graph />
      <Bench />
      <Admin />
      <Internals />
      <RepoMap />
      <div className="border-t border-neutral-800/80 pt-6 text-center text-[11px] text-neutral-600">
        Deck · manual interno · {year}
      </div>
    </>
  );
}
