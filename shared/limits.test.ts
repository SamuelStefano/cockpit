import { describe, it, expect } from 'vitest';
import { MAX_UPLOAD_BYTES, uploadWatchdogMs } from './limits';

describe('upload limits', () => {
  it('fits a typical 3D model export', () => {
    expect(MAX_UPLOAD_BYTES).toBeGreaterThanOrEqual(65_000_000);
  });

  it('keeps the 75s floor for small files', () => {
    expect(uploadWatchdogMs(0)).toBe(75_000);
    expect(uploadWatchdogMs(5_000_000)).toBe(75_000);
  });

  it('grows the watchdog with the file size', () => {
    expect(uploadWatchdogMs(MAX_UPLOAD_BYTES)).toBe(MAX_UPLOAD_BYTES / 200);
    expect(uploadWatchdogMs(MAX_UPLOAD_BYTES)).toBeGreaterThan(75_000);
  });
});
