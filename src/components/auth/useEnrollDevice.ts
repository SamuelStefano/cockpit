import { useState, useSyncExternalStore } from 'react';
import { boxLabel } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { enrollThisDevice, sealState } from '../../cockpit/sealed-socket';

function defaultLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, browser].filter(Boolean).join(' · ');
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
  const [label, setLabel] = useState(defaultLabel);
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
  return { state, boxName, code, setCode, label, setLabel, busy, err, submit, ready };
}
