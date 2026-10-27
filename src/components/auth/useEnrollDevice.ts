import { useState, useSyncExternalStore } from 'react';
import { boxLabel } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { enrollThisDevice, sealState } from '../../cockpit/sealed-socket';
import { defaultDeviceLabel as defaultLabel } from '../../cockpit/device-label';
import { relayAgentUrl } from '../../cockpit/session';
import { enrollCommand } from './pairing';

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
  const [other, setOther] = useState(false);

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
  // The code typed from the box's terminal is a fallback (no PRF), behind "outro
  // método"; a refused agent key can only be fixed with it, so it opens there.
  const showCode = other || state === 'rejected' || state === 'enroll-failed';
  return {
    state, boxName, code, setCode, label, setLabel, busy, err, submit, ready, cli: enrollCommand(relayAgentUrl()),
    showCode, showOther: () => setOther(true),
  };
}
