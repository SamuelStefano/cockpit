import { Hero } from './sections/Hero';
import { Overview } from './sections/Overview';
import { Features } from './sections/Features';
import { Queue } from './sections/Queue';
import { Realtime } from './sections/Realtime';
import { Connect } from './sections/Connect';
import { Resources } from './sections/Resources';
import { Modes } from './sections/Modes';
import { Profile } from './sections/Profile';
import { Search } from './sections/Search';
import { Commands } from './sections/Commands';
import { Models } from './sections/Models';
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
      <Connect />
      <Resources />
      <Modes />
      <Profile />
      <Search />
      <Commands />
      <Models />
      <Admin />
      <Internals />
      <RepoMap />
      <div className="border-t border-neutral-800/80 pt-6 text-center text-[11px] text-neutral-600">
        Deck · manual interno · {year}
      </div>
    </>
  );
}
