import { describe, expect, it, vi } from 'vitest';
import { boxSwitchCommands } from './palette-boxes';

const vps = { id: 'a', label: 'VPS', online: true, lastSeen: null };
const pc = { id: 'b', label: 'PC', online: true, lastSeen: null };
const off = { id: 'c', label: 'Notebook', online: false, lastSeen: null };

describe('boxSwitchCommands', () => {
  it('skips the current box and lists nothing with a single machine', () => {
    expect(boxSwitchCommands([vps], 'a', vi.fn(), vi.fn())).toEqual([]);
  });

  it('offers "Trocar de máquina" for every other box and runs the switch', () => {
    const open = vi.fn();
    const cmds = boxSwitchCommands([vps, pc], 'a', open, vi.fn());
    const sw = cmds.find((c) => c.label === 'Trocar de máquina: PC')!;
    expect(sw.group).toBe('Máquinas');
    sw.run();
    expect(open).toHaveBeenCalledWith('b');
  });

  it('starts a chat only on online boxes', () => {
    const newOn = vi.fn();
    const cmds = boxSwitchCommands([vps, pc, off], 'a', vi.fn(), newOn);
    expect(cmds.map((c) => c.label)).toEqual(['Trocar de máquina: PC', 'Nova conversa em PC', 'Trocar de máquina: Notebook']);
    cmds[1].run();
    expect(newOn).toHaveBeenCalledWith('b');
  });
});
