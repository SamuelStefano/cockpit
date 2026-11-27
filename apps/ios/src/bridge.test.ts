import { describe, expect, it } from 'vitest';
import { isTrustedSender, MAX_BODY, MAX_RAW_BYTES, MAX_TITLE, parseBridgeMessage } from './bridge';

const msg = (o: unknown) => JSON.stringify(o);

describe('parseBridgeMessage', () => {
  it('parses notify', () => {
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: ' Done ', body: 'Reply ready' }))).toEqual({ type: 'notify', title: 'Done', body: 'Reply ready' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: 'Done' }))).toEqual({ type: 'notify', title: 'Done', body: '' });
  });
  it('refuses a bad notify', () => {
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: '' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: 3 }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: 'x'.repeat(MAX_TITLE + 1) }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: 'a', body: 'x'.repeat(MAX_BODY + 1) }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'notify', title: 'a\u0000b' }))).toBeNull();
  });
  it('parses share with text, url or both', () => {
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', message: 'hi' }))).toEqual({ type: 'share', message: 'hi' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', url: 'https://deck.devfellowship.com/s/1' }))).toEqual({ type: 'share', url: 'https://deck.devfellowship.com/s/1' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', message: 'a\nb', url: 'https://x.y' }))).toEqual({ type: 'share', message: 'a\nb', url: 'https://x.y' });
  });
  it('refuses a bad share', () => {
    expect(parseBridgeMessage(msg({ v: 1, type: 'share' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', url: 'http://x.y' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', url: 'file:///etc/passwd' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', message: 'ok', url: 'javascript:1' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', message: 5 }))).toBeNull();
  });
  it('parses haptic and refuses an unknown style', () => {
    expect(parseBridgeMessage(msg({ v: 1, type: 'haptic', style: 'success' }))).toEqual({ type: 'haptic', style: 'success' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'haptic', style: 'bzzt' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'haptic' }))).toBeNull();
  });
  it('refuses wrong version, unknown type, non-objects, non-strings and oversize input', () => {
    expect(parseBridgeMessage(msg({ v: 2, type: 'haptic', style: 'light' }))).toBeNull();
    expect(parseBridgeMessage(msg({ type: 'haptic', style: 'light' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'openUrl', url: 'https://x.y' }))).toBeNull();
    expect(parseBridgeMessage(msg([1]))).toBeNull();
    expect(parseBridgeMessage('null')).toBeNull();
    expect(parseBridgeMessage('{nope')).toBeNull();
    expect(parseBridgeMessage('')).toBeNull();
    expect(parseBridgeMessage({ v: 1 })).toBeNull();
    expect(parseBridgeMessage(undefined)).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'share', message: 'x'.repeat(MAX_RAW_BYTES) }))).toBeNull();
  });
  it('parses the screenshot messages strictly', () => {
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshots-enable' }))).toEqual({ type: 'screenshots-enable' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshots-disable', extra: 1 }))).toEqual({ type: 'screenshots-disable' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept', id: 'AB12-CD/L0/001' }))).toEqual({ type: 'screenshot-accept', id: 'AB12-CD/L0/001' });
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept', id: 5 }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept', id: '' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept', id: 'a b' }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept', id: "x');alert(1);('" }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 1, type: 'screenshot-accept', id: 'a'.repeat(201) }))).toBeNull();
    expect(parseBridgeMessage(msg({ v: 2, type: 'screenshots-enable' }))).toBeNull();
  });
  it('ignores prototype keys', () => {
    expect(parseBridgeMessage('{"v":1,"type":"haptic","style":"light","__proto__":{"x":1}}')).toEqual({ type: 'haptic', style: 'light' });
  });
});

describe('isTrustedSender', () => {
  const app = 'https://deck.devfellowship.com';
  it('accepts only the app origin', () => {
    expect(isTrustedSender('https://deck.devfellowship.com/chat', app)).toBe(true);
    expect(isTrustedSender('https://deck-relay.devfellowship.com/', app)).toBe(false);
    expect(isTrustedSender('https://evil.com/', app)).toBe(false);
    expect(isTrustedSender(undefined, app)).toBe(false);
    expect(isTrustedSender('deck://localhost/x', 'deck://localhost')).toBe(true);
  });
});
