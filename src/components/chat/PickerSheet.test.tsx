// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PickerSheet } from './PickerSheet';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function stubMedia(narrow: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') ? true : q.includes('max-width') ? narrow : false, addEventListener() {}, removeEventListener() {} }));
}

const sheet = () => (
  <div data-testid="host">
    <PickerSheet label="MCP" query="" setQuery={() => {}} placeholder="" onClear={() => {}} onClose={() => {}} footer={null}>x</PickerSheet>
  </div>
);

describe('PickerSheet portal', () => {
  it('portals to <body> on a narrow touch screen (bottom sheet)', () => {
    stubMedia(true);
    const { getByTestId } = render(sheet());
    expect(getByTestId('host').querySelector('[role="dialog"]')).toBeNull();
  });

  it('stays anchored as a popover on a wide touch screen (iPad)', () => {
    stubMedia(false);
    const { getByTestId } = render(sheet());
    expect(getByTestId('host').querySelector('[role="dialog"]')).not.toBeNull();
  });
});
