import { describe, expect, it } from 'vitest';
import type { DiagReport } from '../../ops/src/data.ts';
import { advanceCursor, emailsScript, parseEmails, parseSections, probeScript, reportsScript } from './relay.ts';

const row = (id: string, at: string) => ({ id, created_at: at }) as DiagReport;

describe('reportsScript', () => {
  it('refuses a cursor that is not a plain ISO timestamp', () => {
    expect(() => reportsScript('2026-10-28T15:00:00.000Z"; rm -rf ~; "')).toThrow();
    expect(reportsScript('2026-10-28T15:00:00.000Z')).toContain('created_at=gte.2026-10-28T15:00:00.000Z');
  });

  it('never puts the service key in argv', () => {
    expect(reportsScript('2026-10-28T15:00:00.000Z')).toContain('-H @-');
  });
});

describe('probeScript / emailsScript', () => {
  it('drops an account id that is not a uuid', () => {
    expect(probeScript("x'; reboot; '")).toContain("ACC=''");
    expect(emailsScript(['$(reboot)', '7c2477ed-dab2-457a-a5ab-0efa1cfba8c3'])).toContain('for id in 7c2477ed-dab2-457a-a5ab-0efa1cfba8c3; do');
  });
});

describe('advanceCursor', () => {
  it('moves to the newest ms and remembers ids at that instant', () => {
    const c = advanceCursor({ at: '2026-10-28T15:00:00.000Z', ids: [] }, [
      row('a', '2026-10-28T15:01:00.000100+00:00'),
      row('b', '2026-10-28T15:01:00.000900+00:00'),
    ]);
    expect(c).toEqual({ at: '2026-10-28T15:01:00.000Z', ids: ['a', 'b'] });
  });
});

describe('parseSections', () => {
  it('splits marker sections', () => {
    expect(parseSections('@@status\n200\n@@relay\nactive\n@@end\n')).toEqual({ status: '200', relay: 'active', end: '' });
  });
});

describe('parseEmails', () => {
  it('reads lowercase emails and skips failures', () => {
    const out = parseEmails('7c2477ed-dab2-457a-a5ab-0efa1cfba8c3\t{"id":"x","email":"Samuel@X.com"}\n8e12b819-2a73-4bd5-9e9f-5fdf400e03af\t\nnot-uuid\t{"email":"a@b"}\n');
    expect([...out]).toEqual([['7c2477ed-dab2-457a-a5ab-0efa1cfba8c3', 'samuel@x.com']]);
  });
});
