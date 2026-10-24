import { useState } from 'react';
import { AGENT_ID_RE } from '../../shared/agents';
import { splitArgs } from '../cockpit/agents-view';

export function useAgentCustomForm(onAdd: (a: { id: string; name: string; command: string; args: string[] }) => boolean) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const idBad = id !== '' && !AGENT_ID_RE.test(id);
  const valid = AGENT_ID_RE.test(id) && name.trim() !== '' && command.trim() !== '';
  const submit = () => {
    if (!valid) return;
    if (onAdd({ id, name: name.trim(), command: command.trim(), args: splitArgs(args) })) {
      setId(''); setName(''); setCommand(''); setArgs('');
    }
  };
  return { id, setId, name, setName, command, setCommand, args, setArgs, idBad, valid, submit };
}
