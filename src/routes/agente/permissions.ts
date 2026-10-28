import type { TeamProfile } from '../../../shared/protocol';

export interface Perms { read: boolean; write: boolean; net: boolean }

export const ALL_PERMS: Perms = { read: true, write: true, net: true };

const READ_TOOLS = ['Read', 'Glob', 'Grep'];
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Bash'];
const NET_TOOLS = ['WebFetch', 'WebSearch'];

export function permsFromProfile(profile: TeamProfile): Perms {
  return profile === 'full' ? ALL_PERMS : { read: true, write: false, net: true };
}

export function profileFromPerms(p: Perms): TeamProfile {
  return p.read && p.write && p.net ? 'full' : 'restricted';
}

export function disallowedTools(p: Perms): string[] {
  return [...(p.read ? [] : READ_TOOLS), ...(p.write ? [] : WRITE_TOOLS), ...(p.net ? [] : NET_TOOLS)];
}
