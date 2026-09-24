import { describe, it, expect } from 'vitest';
import { insecureWsUrl } from './vps-url';

describe('insecureWsUrl', () => {
  it('flags ws:// to a public host', () => {
    expect(insecureWsUrl('ws://203.0.113.9:7777/ws')).toBe(true);
    expect(insecureWsUrl('ws://deck.example.com/ws')).toBe(true);
  });

  it('accepts wss, loopback and Tailscale', () => {
    expect(insecureWsUrl('wss://deck.example.com/ws')).toBe(false);
    expect(insecureWsUrl('ws://127.0.0.1:7777/ws')).toBe(false);
    expect(insecureWsUrl('ws://localhost:7777/ws')).toBe(false);
    expect(insecureWsUrl('ws://[::1]:7777/ws')).toBe(false);
    expect(insecureWsUrl('ws://vps.tailnet.ts.net/ws')).toBe(false);
    expect(insecureWsUrl('ws://100.101.2.3:7777/ws')).toBe(false);
    expect(insecureWsUrl('')).toBe(false);
  });
});
