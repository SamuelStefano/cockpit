import { Icon } from './primitives';

export type IconName = Parameters<typeof Icon>[0]['name'];

export interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  group: string;
  run: () => void;
}
