import { describe, it, expect } from 'vitest';
import { parseCliTooOld } from './cli-version-error';

const MATCHES: [string, string | null][] = [
  ['API Error: 400 Claude Code 2.1.197 does not support this model; version 2.1.280 or newer is required', '2.1.280'],
  ['API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Claude Code 2.1.197 does not support this model; version 2.1.280 or newer is required"},"request_id":"req_011CUX"}', '2.1.280'],
  ['claude saiu (1): API Error: 400 Claude Code 2.0.14 does not support this model; version 2.1.0 or newer is required', '2.1.0'],
  ['API Error: 400 This model requires a newer version of Claude Code. Please update to 2.2.0 or later.', '2.2.0'],
  ['Claude Code 1.0.88 is no longer supported. Please update to version 2.0.0 or newer.', '2.0.0'],
  ['This model requires Claude Code version 2.3.1 or newer.', '2.3.1'],
  ['Please upgrade Claude Code to v2.4.0 to use this model', '2.4.0'],
  ['API Error: 400 Claude Code requires an update to use this model', null],
];

const NON_MATCHES = [
  'API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"OAuth token has expired."}}',
  'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}',
  'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 215000 tokens > 200000 maximum"}}',
  'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"This model does not support tools"}}',
  'API Error: 404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-foo not found"}}',
  'API Error: 500 {"type":"error","error":{"type":"api_error","message":"Internal server error"}}',
  "claude saiu (1): error: unknown option '--restricted'",
  'Node.js version 18.0.0 or newer is required',
  'npm WARN EBADENGINE requires a newer version of npm',
  'Python 3.10 or newer is required to build this package',
  'Please update your dependencies to version 2.0.0 or newer.',
  'Claude Code is a CLI; to update it run `claude update`.',
  'Invalid API key · Please run /login',
  '',
];

describe('parseCliTooOld', () => {
  it.each(MATCHES)('matches %s', (text, required) => {
    expect(parseCliTooOld(text)).toEqual({ required });
  });

  it.each(NON_MATCHES)('ignores %s', (text) => {
    expect(parseCliTooOld(text)).toBeNull();
  });

  it('ignores a long answer that only quotes the error', () => {
    const answer = `${'The agent kept failing. '.repeat(80)}It said: Claude Code 2.1.197 does not support this model; version 2.1.280 or newer is required.`;
    expect(parseCliTooOld(answer)).toBeNull();
  });

  it('has full precision and recall on the samples', () => {
    const tp = MATCHES.filter(([t]) => parseCliTooOld(t)).length;
    const fp = NON_MATCHES.filter((t) => parseCliTooOld(t)).length;
    expect({ tp, fp }).toEqual({ tp: MATCHES.length, fp: 0 });
  });
});
