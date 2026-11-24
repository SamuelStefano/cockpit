import { describe, expect, it } from 'vitest';
import { appMenuTemplate } from './menu';

const roles = (packaged: boolean) => JSON.stringify(appMenuTemplate(packaged));

describe('appMenuTemplate', () => {
  it('has zoom but no reload or DevTools in a release', () => {
    expect(roles(true)).toContain('zoomIn');
    expect(roles(true)).not.toContain('reload');
    expect(roles(true)).not.toContain('toggleDevTools');
  });

  it('keeps them in development', () => {
    expect(roles(false)).toContain('toggleDevTools');
  });
});
