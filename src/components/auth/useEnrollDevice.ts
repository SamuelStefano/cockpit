import { useState, useSyncExternalStore } from 'react';
import { boxLabel } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { enrollThisDevice, sealState } from '../../cockpit/sealed-socket';
import { defaultDeviceLabel as defaultLabel } from '../../cockpit/device-label';
import { relayAgentUrl } from '../../cockpit/session';

export function enrollCommand(relayUrl: string): string {
  return `cd ~/cockpit && DECK_RELAY_URL=${relayUrl} npx tsx server/agent.ts --enroll-device`;
}

export function useSealState() {
  return useSyncExternalStore(sealState.subscribe, sealState.get);
}

export function useEnrollDevice() {
  const state = useSealState();
  const { boxes, active } = useBoxes();
  const target = boxes.find((b) => b.id === active);
  const boxName = target ? boxLabel(target) : '';
  const [code, setCode] = useState('');
  const [label, setLabel] = useState(() => defaultLabel());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await enrollThisDevice(code.trim(), label.trim() || defaultLabel());
      setCode('');
    } catch (e) {
      setErr((e as Error).message || 'não deu certo');
    } finally {
      setBusy(false);
    }
  };

  const ready = code.replace(/[\s-]/g, '').length >= 52;
  return { state, boxName, code, setCode, label, setLabel, busy, err, submit, ready, cli: enrollCommand(relayAgentUrl()) };
}
