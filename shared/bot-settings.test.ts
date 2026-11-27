import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSettingsText, settingsDeniedForStudent, STUDENT_SETTINGS_ERROR } from './bot-settings';

describe('bot-settings', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports the line from a V8 position and from a Firefox line', () => {
    expect(parseSettingsText('{\n  "a": 1,\n  oops\n}')).toMatchObject({ ok: false, line: 3 });
    vi.spyOn(JSON, 'parse').mockImplementation(() => { throw new SyntaxError('JSON.parse: expected property name at line 4 column 3 of the JSON data'); });
    expect(parseSettingsText('x')).toMatchObject({ ok: false, line: 4 });
  });

  it('a student may only write deny/ask rules', () => {
    expect(settingsDeniedForStudent('{"permissions":{"allow":["Read(//**)"]}}')).toBe(STUDENT_SETTINGS_ERROR);
    expect(settingsDeniedForStudent('{"permissions":{"additionalDirectories":["/"]}}')).toBe(STUDENT_SETTINGS_ERROR);
    expect(settingsDeniedForStudent('{"permissions":{"deny":["Bash"],"ask":[]}}')).toBeNull();
    expect(settingsDeniedForStudent('{}')).toBeNull();
  });
});
