import { useCallback, useEffect, useState } from 'react';
import { deviceFrames, type DeviceFrame } from './sealed-socket';

// Devices enrolled on the box this browser is sealed to. The list and the revoke
// travel only inside the sealed channel (server/e2e/manage.ts).

export interface DeviceItem { pub: string; label: string; addedAt: string; lastSeen?: string; current: boolean }

export function parseDevices(m: DeviceFrame): DeviceItem[] | null {
  if (m.t !== 'devices' || !Array.isArray(m.items)) return null;
  return m.items
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && typeof (d as { pub?: unknown }).pub === 'string')
    .map((d) => ({
      pub: d.pub as string,
      label: typeof d.label === 'string' ? d.label : 'device',
      addedAt: typeof d.addedAt === 'string' ? d.addedAt : '',
      lastSeen: typeof d.lastSeen === 'string' ? d.lastSeen : undefined,
      current: d.current === true,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
}

export function fmtDay(iso: string | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
}

export function useDevices(enabled: boolean) {
  const [items, setItems] = useState<DeviceItem[] | null>(null);
  const refresh = useCallback(() => { deviceFrames.send({ t: 'devices-list' }); }, []);

  useEffect(() => {
    if (!enabled) return;
    const off = deviceFrames.subscribe((m) => {
      const list = parseDevices(m);
      if (list) setItems(list);
      if (m.t === 'device-passkey-added') refresh();
    });
    refresh();
    return off;
  }, [enabled, refresh]);

  const revoke = useCallback((pub: string) => { deviceFrames.send({ t: 'device-revoke', pub }); }, []);
  return { items, revoke, refresh };
}
