// Self-test of the App Store Connect kit (no network, no key). The store-asc workflow runs it before it
// writes the key file: node --test scripts/asc-store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  SubmitRefused, blockingChecklist, checkScreenshotPng, collectStatus, createApi, createTokenSource, es256Signer,
  jwtClaims, loadMetadata, parseArgs, pngInfo, readScreenshots, renderStatus, reviewDetailAttrs, runPush,
  runSubmit, signJwt, validateMetadata, ageRatingAttrs, versionLocalizationAttrs, contactSourceApp, fetchReviewContact,
} from './asc-store.mjs';

const meta = loadMetadata();
const APP = meta.ascAppId ?? '1000000001';
const SECRET_PASSWORD = 'demo-password-must-never-print';

// ---- PNG helpers: a valid PNG of any size and colour type, built in memory.
function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function png(width, height, colorType = 2) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const row = Buffer.alloc(1 + width * channels);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- JWT

test('jwt claims: issuer, audience, 15 minute lifetime', () => {
  assert.deepEqual(jwtClaims({ issuer: 'iss-1', nowMs: 1_700_000_123_999 }), { iss: 'iss-1', iat: 1_700_000_123, exp: 1_700_001_023, aud: 'appstoreconnect-v1' });
});

test('signJwt encodes header, payload and the injected signature as base64url', () => {
  const token = signJwt({ keyId: 'KID1', issuer: 'iss-1', nowMs: 1_000_000, sign: (d) => Buffer.from(`sig:${d.length}`) });
  const [h, p, s] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'ES256', kid: 'KID1', typ: 'JWT' });
  assert.equal(JSON.parse(Buffer.from(p, 'base64url')).exp - JSON.parse(Buffer.from(p, 'base64url')).iat, 900);
  assert.equal(Buffer.from(s, 'base64url').toString(), `sig:${h.length + 1 + p.length}`);
  assert.ok(!token.includes('='), 'base64url has no padding');
});

test('es256Signer makes a raw r||s signature that verifies with the public key', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const token = signJwt({ keyId: 'K', issuer: 'I', nowMs: Date.now(), sign: es256Signer(pem) });
  const [h, p, s] = token.split('.');
  const sig = Buffer.from(s, 'base64url');
  assert.equal(sig.length, 64);
  assert.equal(createVerify('SHA256').update(`${h}.${p}`).verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, sig), true);
});

test('the token source reuses a token for 10 minutes, then mints a new one', () => {
  let now = 1_000_000;
  const next = createTokenSource({ keyId: 'K', issuer: 'I', sign: () => Buffer.from('s'), now: () => now });
  const first = next();
  now += 599_000;
  assert.equal(next(), first);
  now += 2_000;
  assert.notEqual(next(), first);
});

// ---- PNG

test('pngInfo reads size and alpha from the IHDR bytes', () => {
  assert.deepEqual(pngInfo(png(1290, 2796, 2)), { width: 1290, height: 2796, colorType: 2, hasAlpha: false });
  assert.equal(pngInfo(png(8, 8, 6)).hasAlpha, true);
  assert.throws(() => pngInfo(Buffer.from('not a png at all, just text, long enough to pass the length check')), /not a PNG/);
});

test('checkScreenshotPng accepts 1290x2796 without alpha and names every other problem', () => {
  assert.deepEqual(checkScreenshotPng(png(1290, 2796), 'APP_IPHONE_67'), []);
  assert.match(checkScreenshotPng(png(1170, 2532), 'APP_IPHONE_67')[0], /1170x2532 is not one of 1290x2796/);
  assert.match(checkScreenshotPng(png(1290, 2796, 6), 'APP_IPHONE_67').join(), /alpha/);
  assert.match(checkScreenshotPng(png(1290, 2796), 'APP_TV')[0], /unknown display type/);
});

// ---- metadata

test('the committed metadata.json is valid', () => assert.deepEqual(validateMetadata(meta), []));

const withLocale = (loc, field, value) => ({ ...meta, locales: { ...meta.locales, [loc]: { ...meta.locales[loc], [field]: value } } });

test('metadata validation: length limits', () => {
  assert.match(validateMetadata(withLocale('en-US', 'name', 'x'.repeat(31))).join(), /en-US\.name is 31 characters, the limit is 30/);
  assert.match(validateMetadata(withLocale('pt-BR', 'subtitle', 'x'.repeat(31))).join(), /pt-BR\.subtitle/);
  assert.match(validateMetadata(withLocale('en-US', 'promotionalText', 'x'.repeat(171))).join(), /promotionalText is 171/);
  assert.match(validateMetadata(withLocale('en-US', 'description', 'x'.repeat(4001))).join(), /description is 4001/);
  assert.match(validateMetadata(withLocale('en-US', 'keywords', 'a,'.repeat(51) + 'b')).join(), /keywords is 103/);
  assert.match(validateMetadata(withLocale('en-US', 'name', '')).join(), /name is empty/);
});

test('metadata validation: price, plan and sign-up words are forbidden in every locale', () => {
  for (const bad of ['Free to use', 'Only $4.99', 'Grátis por 7 dias', 'Premium plan', 'Subscribe today', 'Assinatura mensal', 'Sign up now', 'Create your account', 'Crie sua conta', 'Cadastre-se']) {
    assert.ok(validateMetadata(withLocale('en-US', 'promotionalText', bad)).length > 0, `${bad} must be refused`);
    assert.ok(validateMetadata(withLocale('pt-BR', 'description', bad)).length > 0, `${bad} must be refused`);
  }
  assert.deepEqual(validateMetadata(withLocale('en-US', 'promotionalText', 'Sign in and record')), []);
});

test('metadata validation: keywords, age rating and locales', () => {
  assert.match(validateMetadata(withLocale('en-US', 'keywords', 'a, b')).join(), /space after a comma/);
  assert.match(validateMetadata(withLocale('en-US', 'keywords', 'a,A')).join(), /repeats a word/);
  assert.match(validateMetadata({ ...meta, ageRating: { ...meta.ageRating, gambling: 'NONE' } }).join(), /ageRating\.gambling/);
  assert.match(validateMetadata({ ...meta, ageRating: { ...meta.ageRating, contests: 'SOME' } }).join(), /ageRating\.contests/);
  const { 'pt-BR': _gone, ...rest } = meta.locales;
  assert.match(validateMetadata({ ...meta, locales: rest }).join(), /locales\.pt-BR is missing/);
  assert.match(validateMetadata({ ...meta, privacyPolicyUrl: 'http://x' }).join(), /privacyPolicyUrl must be an https URL/);
});

test('the age rating answers user-generated content as not shown to others', () => {
  assert.equal(meta.ageRating.userGeneratedContent, false);
  assert.equal(meta.ageRating.messagingAndChat, false);
  assert.equal(meta.ageRating.unrestrictedWebAccess, false);
});

// ---- payload builders

test('payload builders carry the file values', () => {
  assert.equal(versionLocalizationAttrs(meta, 'en-US').supportUrl, meta.supportUrl);
  assert.equal(ageRatingAttrs(meta).violenceRealistic, 'NONE');
});

test('review detail: contact and demo account come from the environment, absent values warn', () => {
  const none = reviewDetailAttrs(meta, {});
  assert.equal(none.attrs.notes, meta.review.notes);
  assert.equal(none.attrs.contactEmail, undefined);
  assert.equal(none.attrs.demoAccountName, undefined);
  assert.equal(none.warnings.length, 2);
  const full = reviewDetailAttrs(meta, {
    ASC_REVIEW_CONTACT_FIRST_NAME: 'A', ASC_REVIEW_CONTACT_LAST_NAME: 'B', ASC_REVIEW_CONTACT_EMAIL: 'a@example.invalid',
    ASC_REVIEW_CONTACT_PHONE: '+10000000000', ASC_REVIEW_DEMO_USER: 'demo@example.invalid', ASC_REVIEW_DEMO_PASSWORD: SECRET_PASSWORD,
  });
  assert.equal(full.warnings.length, 0);
  assert.equal(full.attrs.demoAccountName, 'demo@example.invalid');
  assert.equal(full.attrs.demoAccountPassword, SECRET_PASSWORD);
});

// ---- the fake App Store Connect

/** A router of `METHOD path` (query ignored) to a body or a function. Records every call. */
function fakeAsc(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const path = new URL(url).pathname.replace(/^\/v1/, '');
    calls.push({ method, path, query: new URL(url).search, body: typeof init.body === 'string' ? JSON.parse(init.body) : null, auth: init.headers?.authorization });
    const hit = routes[`${method} ${path}`];
    const out = typeof hit === 'function' ? hit(init) : hit;
    if (out === undefined) return new Response(JSON.stringify({ errors: [{ code: 'NOT_FOUND', detail: `no route ${method} ${path}` }] }), { status: 404 });
    return new Response(JSON.stringify(out), { status: 200 });
  };
  return { fetchImpl, calls };
}
const token = () => 'test-token';
const apiOf = (routes, opts = {}) => {
  const fake = fakeAsc(routes);
  return { ...fake, api: createApi({ fetchImpl: fake.fetchImpl, token, ...opts }) };
};

const complete = (locale) => ({ locale, name: 'n', subtitle: 's', privacyPolicyUrl: 'https://x', description: 'd', keywords: 'k', promotionalText: 'p', supportUrl: 'https://x', marketingUrl: 'https://x' });

/** A listing that is ready to submit. `over` replaces routes. */
function readyRoutes(over = {}) {
  return {
    [`GET /apps/${APP}`]: { data: { id: APP, type: 'apps', attributes: { name: 'Deck', bundleId: meta.bundleId, contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } } },
    [`GET /apps/${APP}/appStoreVersions`]: {
      data: [{ id: 'v1', type: 'appStoreVersions', attributes: { versionString: '0.6.0', appStoreState: 'PREPARE_FOR_SUBMISSION', copyright: '2026 X' }, relationships: { build: { data: { type: 'builds', id: 'b1' } } } }],
      included: [{ id: 'b1', type: 'builds', attributes: { version: '14', processingState: 'VALID' } }],
    },
    'GET /builds': { data: [{ id: 'b1', attributes: { version: '14', processingState: 'VALID', uploadedDate: '2026-10-07T00:00:00Z' }, relationships: { preReleaseVersion: { data: { id: 'p1' } } } }], included: [{ id: 'p1', type: 'preReleaseVersions', attributes: { version: '0.6.0' } }] },
    [`GET /apps/${APP}/appInfos`]: { data: [{ id: 'i1', type: 'appInfos', attributes: { appStoreState: 'PREPARE_FOR_SUBMISSION' }, relationships: { primaryCategory: { data: { id: 'DEVELOPER_TOOLS' } }, secondaryCategory: { data: { id: 'PRODUCTIVITY' } } } }] },
    'GET /appInfos/i1/appInfoLocalizations': { data: ['pt-BR', 'en-US'].map((l) => ({ id: `il-${l}`, attributes: complete(l) })) },
    'GET /appStoreVersions/v1/appStoreVersionLocalizations': { data: ['pt-BR', 'en-US'].map((l) => ({ id: `vl-${l}`, attributes: complete(l) })) },
    'GET /appStoreVersionLocalizations/vl-pt-BR/appScreenshotSets': { data: [{ id: 's-pt', attributes: { screenshotDisplayType: 'APP_IPHONE_67' }, relationships: { appScreenshots: { data: [{ id: 'a' }, { id: 'b' }] } } }] },
    'GET /appStoreVersionLocalizations/vl-en-US/appScreenshotSets': { data: [{ id: 's-en', attributes: { screenshotDisplayType: 'APP_IPHONE_67' }, relationships: { appScreenshots: { data: [{ id: 'a' }] } } }] },
    'GET /appInfos/i1/ageRatingDeclaration': { data: { id: 'ar1', attributes: ageRatingAttrs(meta) } },
    'GET /appStoreVersions/v1/appStoreReviewDetail': { data: { id: 'rd1', attributes: { notes: 'n', contactFirstName: 'a', contactLastName: 'b', contactEmail: 'a@x', contactPhone: '1', demoAccountRequired: true, demoAccountName: 'demo', demoAccountPassword: SECRET_PASSWORD } } },
    [`GET /apps/${APP}/appPriceSchedule`]: { data: { id: 'ps1' } },
    ...over,
  };
}

const writes = (calls) => calls.filter((c) => c.method !== 'GET');

// ---- status

test('status reads a ready listing, prints no demo credential and sends only GETs', async () => {
  const { api, calls } = apiOf(readyRoutes());
  const s = await collectStatus({ api, meta, appId: APP });
  const check = blockingChecklist(s, meta);
  assert.deepEqual(check.blockers, []);
  const md = renderStatus(s, check, meta);
  assert.ok(!md.includes(SECRET_PASSWORD));
  assert.ok(!md.includes('demo@') && !md.includes('test-token'));
  assert.match(md, /\| 0\.6\.0 \| PREPARE_FOR_SUBMISSION \| 14 \(VALID\) \| set \|/);
  assert.match(md, /APP_IPHONE_67: 2/);
  assert.match(md, /Blocking a submission \(0\)/);
  assert.deepEqual(writes(calls), []);
  assert.ok(calls.every((c) => c.auth === 'Bearer test-token'));
});

test('status of an empty listing lists every blocker and needs no review env', async () => {
  const { api } = apiOf({
    [`GET /apps/${APP}`]: { data: { id: APP, attributes: { name: 'Deck', bundleId: meta.bundleId } } },
    [`GET /apps/${APP}/appStoreVersions`]: { data: [] },
    'GET /builds': { data: [] },
    [`GET /apps/${APP}/appInfos`]: { data: [{ id: 'i1', attributes: { appStoreState: 'PREPARE_FOR_SUBMISSION' }, relationships: {} }] },
    'GET /appInfos/i1/appInfoLocalizations': { data: [] },
  });
  const s = await collectStatus({ api, meta, appId: APP });
  const { blockers, manual } = blockingChecklist(s, meta);
  const text = blockers.join('\n');
  for (const needle of ['no editable App Store version', 'no primary category', 'pt-BR: no app info localization', 'en-US: no version localization', 'no iPhone 6.7"/6.9" screenshots', 'no age rating declaration', 'no review detail', 'no price schedule', 'content rights']) {
    assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.ok(manual.some((m) => /App Privacy/.test(m)));
});

test('checklist: unprocessed build, missing demo account and unanswered age rating block', async () => {
  const routes = readyRoutes({
    [`GET /apps/${APP}/appStoreVersions`]: { data: [{ id: 'v1', attributes: { versionString: '0.6.0', appStoreState: 'PREPARE_FOR_SUBMISSION', copyright: 'c' }, relationships: { build: { data: { id: 'b1' } } } }], included: [{ id: 'b1', type: 'builds', attributes: { version: '14', processingState: 'PROCESSING' } }] },
    'GET /appStoreVersions/v1/appStoreReviewDetail': { data: { id: 'rd1', attributes: { notes: 'n', contactFirstName: 'a', contactLastName: 'b', contactEmail: 'a@x', contactPhone: '1', demoAccountRequired: true } } },
    'GET /appInfos/i1/ageRatingDeclaration': { data: { id: 'ar1', attributes: { ...ageRatingAttrs(meta), gambling: null } } },
  });
  const { api } = apiOf(routes);
  const { blockers } = blockingChecklist(await collectStatus({ api, meta, appId: APP }), meta);
  assert.equal(blockers.length, 3, blockers.join('\n'));
});

// ---- push

const shots = (dir) => {
  mkdirSync(join(dir, 'en-US', 'APP_IPHONE_67'), { recursive: true });
  writeFileSync(join(dir, 'en-US', 'APP_IPHONE_67', '01-a.png'), png(1290, 2796));
  writeFileSync(join(dir, 'en-US', 'APP_IPHONE_67', '02-b.png'), png(1290, 2796));
  return readScreenshots(dir, Object.keys(meta.locales));
};
const freshDir = () => mkdtempSync(join(tmpdir(), 'asc-shots-'));

test('readScreenshots: pt-BR reuses en-US when it has no folder, a wrong size is a problem', () => {
  const dir = freshDir();
  const r = shots(dir);
  assert.deepEqual(r.problems, []);
  assert.equal(r.sets['pt-BR'].APP_IPHONE_67.length, 2);
  assert.equal(r.sets['en-US'].APP_IPHONE_67[0].md5, createHash('md5').update(png(1290, 2796)).digest('hex'));
  writeFileSync(join(dir, 'en-US', 'APP_IPHONE_67', '03-wrong.png'), png(1170, 2532));
  assert.match(readScreenshots(dir, ['en-US']).problems[0], /03-wrong\.png: 1170x2532/);
});

/** Routes of an app with nothing created yet, in the shape of a brand-new App Store Connect record. */
function emptyRoutes() {
  return {
    [`GET /apps/${APP}`]: { data: { id: APP, attributes: { bundleId: meta.bundleId } } },
    [`GET /apps/${APP}/appStoreVersions`]: { data: [] },
    [`GET /apps/${APP}/appInfos`]: { data: [{ id: 'i1', attributes: { appStoreState: 'PREPARE_FOR_SUBMISSION' }, relationships: {} }] },
    'GET /appInfos/i1/appInfoLocalizations': { data: [] },
    'GET /appInfos/i1/ageRatingDeclaration': { data: { id: 'ar1', attributes: {} } },
  };
}

test('push --dry-run sends only GETs and lists the planned writes', async () => {
  const { api, calls } = apiOf(emptyRoutes(), { dryRun: true });
  const planned = await runPush({ api, meta, appId: APP, version: '0.6.0', buildNumber: undefined, screenshots: shots(freshDir()), env: {}, log: () => {} });
  assert.deepEqual(writes(calls), []);
  const lines = planned.map((p) => `${p.method} ${p.path}`);
  for (const expected of ['POST /appStoreVersions', 'PATCH /appInfos/i1', 'POST /appInfoLocalizations', 'PATCH /ageRatingDeclarations/ar1', 'POST /appStoreVersionLocalizations', 'POST /appScreenshotSets', 'POST /appScreenshots', 'POST /appStoreReviewDetails']) {
    assert.ok(lines.includes(expected), `${expected} is planned, got ${lines.join(' | ')}`);
  }
  assert.equal(planned.filter((p) => p.path === '/appScreenshots').length, 4, 'two files in each of two locales');
});

test('push refuses an app whose bundle id differs from metadata.json, before any write', async () => {
  const routes = { ...emptyRoutes(), [`GET /apps/${APP}`]: { data: { id: APP, attributes: { bundleId: 'com.other.app' } } } };
  const { api, calls } = apiOf(routes);
  await assert.rejects(runPush({ api, meta, appId: APP, version: '0.6.0', screenshots: shots(freshDir()), env: {} }), /com\.other\.app/);
  assert.deepEqual(writes(calls), []);
});

test('push refuses invalid metadata and invalid screenshots before the first call', async () => {
  const { api, calls } = apiOf({});
  await assert.rejects(runPush({ api, meta: withLocale('en-US', 'name', 'x'.repeat(31)), appId: APP, version: '1', screenshots: { sets: {}, problems: [] }, env: {} }), /metadata\.json is not valid/);
  await assert.rejects(runPush({ api, meta, appId: APP, version: '1', screenshots: { sets: {}, problems: ['x.png: bad'] }, env: {} }), /screenshots are not valid/);
  assert.equal(calls.length, 0);
});

test('push is idempotent: a listing that already matches sends no write', async () => {
  const dir = freshDir();
  const s = shots(dir);
  const routes = readyRoutes({
    [`GET /apps/${APP}/appStoreVersions`]: { data: [{ id: 'v1', attributes: { versionString: '0.6.0', appStoreState: 'PREPARE_FOR_SUBMISSION', copyright: meta.copyright } }] },
    'GET /appInfos/i1/appInfoLocalizations': { data: Object.keys(meta.locales).map((l) => ({ id: `il-${l}`, attributes: { locale: l, ...Object.fromEntries(Object.entries(complete(l)).filter(([k]) => ['name', 'subtitle', 'privacyPolicyUrl'].includes(k))), name: meta.locales[l].name, subtitle: meta.locales[l].subtitle, privacyPolicyUrl: meta.privacyPolicyUrl } })) },
    'GET /appStoreVersions/v1/appStoreVersionLocalizations': { data: Object.keys(meta.locales).map((l) => ({ id: `vl-${l}`, attributes: { locale: l, ...versionLocalizationAttrs(meta, l) } })) },
    ...Object.fromEntries(['pt-BR', 'en-US'].map((l) => [`GET /appStoreVersionLocalizations/vl-${l}/appScreenshotSets`, { data: [{ id: `s-${l}`, attributes: { screenshotDisplayType: 'APP_IPHONE_67' } }] }])),
    ...Object.fromEntries(['pt-BR', 'en-US'].map((l) => [`GET /appScreenshotSets/s-${l}/appScreenshots`, { data: s.sets[l].APP_IPHONE_67.map((f) => ({ id: f.name, attributes: { fileName: f.name, sourceFileChecksum: f.md5 } })) }])),
    'GET /appStoreVersions/v1/appStoreReviewDetail': { data: { id: 'rd1', attributes: { ...reviewDetailAttrs(meta, {}).attrs } } },
  });
  const { api, calls } = apiOf(routes);
  await runPush({ api, meta, appId: APP, version: '0.6.0', screenshots: s, env: {}, log: () => {} });
  assert.deepEqual(writes(calls), []);
});

test('push uploads a screenshot: reserve, PUT the parts with the given headers, commit with the MD5', async () => {
  const dir = freshDir();
  const s = shots(dir);
  const put = [];
  const routes = {
    ...emptyRoutes(),
    [`GET /apps/${APP}/appStoreVersions`]: { data: [{ id: 'v1', attributes: { versionString: '0.6.0', appStoreState: 'PREPARE_FOR_SUBMISSION', copyright: meta.copyright } }] },
    'GET /appStoreVersions/v1/appStoreVersionLocalizations': { data: Object.keys(meta.locales).map((l) => ({ id: `vl-${l}`, attributes: { locale: l, ...versionLocalizationAttrs(meta, l) } })) },
    'GET /appStoreVersionLocalizations/vl-pt-BR/appScreenshotSets': { data: [] },
    'GET /appStoreVersionLocalizations/vl-en-US/appScreenshotSets': { data: [] },
    'POST /appScreenshotSets': () => ({ data: { id: 'set-new', attributes: {} } }),
    'POST /appScreenshots': () => ({ data: { id: `shot-${put.length}`, attributes: { uploadOperations: [{ method: 'PUT', url: 'https://upload.example.invalid/part', offset: 0, length: 5, requestHeaders: [{ name: 'Content-Type', value: 'image/png' }] }] } } }),
    'PATCH /appScreenshots/shot-0': { data: {} },
    'PATCH /appScreenshots/shot-1': { data: {} },
    'PATCH /appScreenshots/shot-2': { data: {} },
    'PATCH /appScreenshots/shot-3': { data: {} },
    'POST /appInfoLocalizations': { data: { id: 'x' } },
    'PATCH /appInfos/i1': { data: {} },
    'PATCH /ageRatingDeclarations/ar1': { data: {} },
    'POST /appStoreReviewDetails': { data: {} },
    'PUT /part': (init) => {
      put.push({ headers: init.headers, size: init.body.length });
      return {};
    },
  };
  const fake = fakeAsc(routes);
  const base = fake.fetchImpl;
  const fetchImpl = (url, init) => (String(url).startsWith('https://upload.example.invalid') ? base(`https://api.appstoreconnect.apple.com/v1/part`, init) : base(url, init));
  const api = createApi({ fetchImpl, token });
  await runPush({ api, meta, appId: APP, version: '0.6.0', screenshots: s, env: {}, log: () => {} });
  assert.equal(put.length, 4);
  assert.deepEqual(put[0].headers, { 'Content-Type': 'image/png' });
  assert.equal(put[0].size, 5);
  const commit = fake.calls.find((c) => c.method === 'PATCH' && c.path === '/appScreenshots/shot-0');
  assert.deepEqual(commit.body.data.attributes, { uploaded: true, sourceFileChecksum: s.sets['pt-BR'].APP_IPHONE_67[0].md5 });
});

// ---- submit

test('submit refuses a wrong --confirm before it reads anything', async () => {
  const { api, calls } = apiOf(readyRoutes());
  await assert.rejects(runSubmit({ api, meta, appId: APP, confirm: 'nope' }), SubmitRefused);
  await assert.rejects(runSubmit({ api, meta, appId: APP, confirm: undefined }), /--confirm must equal the bundle id/);
  assert.equal(calls.length, 0);
});

test('submit refuses while the checklist has a blocker, with no write', async () => {
  const { api, calls } = apiOf(readyRoutes({ [`GET /apps/${APP}/appPriceSchedule`]: undefined }));
  await assert.rejects(runSubmit({ api, meta, appId: APP, confirm: meta.bundleId }), /no price schedule/);
  assert.deepEqual(writes(calls), []);
});

test('submit with a clean checklist creates the submission, adds the version and submits', async () => {
  const { api, calls } = apiOf(readyRoutes({
    [`GET /apps/${APP}/reviewSubmissions`]: { data: [] },
    'POST /reviewSubmissions': { data: { id: 'rs1', attributes: {} } },
    'GET /reviewSubmissions/rs1/items': { data: [] },
    'POST /reviewSubmissionItems': { data: { id: 'it1' } },
    'PATCH /reviewSubmissions/rs1': { data: {} },
  }));
  const r = await runSubmit({ api, meta, appId: APP, confirm: meta.bundleId });
  assert.equal(r.versionString, '0.6.0');
  assert.deepEqual(writes(calls).map((c) => `${c.method} ${c.path}`), ['POST /reviewSubmissions', 'POST /reviewSubmissionItems', 'PATCH /reviewSubmissions/rs1']);
  assert.deepEqual(writes(calls)[2].body.data.attributes, { submitted: true });
  assert.equal(writes(calls)[1].body.data.relationships.appStoreVersion.data.id, 'v1');
});

test('submit refuses when a review is already waiting', async () => {
  const { api, calls } = apiOf(readyRoutes({ [`GET /apps/${APP}/reviewSubmissions`]: { data: [{ id: 'rs0', attributes: { state: 'WAITING_FOR_REVIEW' } }] } }));
  await assert.rejects(runSubmit({ api, meta, appId: APP, confirm: meta.bundleId }), /already WAITING_FOR_REVIEW/);
  assert.deepEqual(writes(calls), []);
});

// ---- plumbing

test('an API error names the status and Apple detail, never the token', async () => {
  const { api } = apiOf({ [`GET /apps/${APP}`]: undefined });
  await assert.rejects(api.get(`/apps/${APP}`), (e) => /HTTP 404/.test(e.message) && !e.message.includes('test-token'));
});

test('parseArgs', () => {
  assert.deepEqual(parseArgs(['push', '--version', '0.6.0', '--build-number', '14', '--dry-run']), { action: 'push', dryRun: true, version: '0.6.0', buildNumber: '14' });
  assert.throws(() => parseArgs(['push', '--bogus']), /unknown argument/);
});

// ---- review contact reuse

const SRC = '6756785447';
const FAKE_CONTACT = { contactFirstName: 'Zelda-fake', contactLastName: 'Quux-fake', contactEmail: 'zq-fake@example.invalid', contactPhone: '+15550001234' };
const FAKE_DEMO = { demoAccountName: 'src-demo-user-fake', demoAccountPassword: 'src-demo-pass-fake', notes: 'src-notes-fake' };
const sourceRoutes = (over = {}) => ({
  [`GET /apps/${SRC}/appStoreVersions`]: { data: [
    { id: 'old', attributes: { createdDate: '2026-01-01T00:00:00Z' } },
    { id: 'new', attributes: { createdDate: '2026-02-01T00:00:00Z' } },
  ] },
  'GET /appStoreVersions/new/appStoreReviewDetail': { data: { id: 'srd', attributes: { ...FAKE_CONTACT, ...FAKE_DEMO } } },
  ...over,
});
const everyValue = [...Object.values(FAKE_CONTACT), ...Object.values(FAKE_DEMO)];
const leaks = (text) => everyValue.filter((v) => text.includes(v));

test('contactSourceApp: flag, then env, then metadata', () => {
  const m = { review: { contactFromAscAppId: 'M' } };
  assert.equal(contactSourceApp({ reviewContactFrom: 'F' }, { ASC_REVIEW_CONTACT_FROM_APP: 'E' }, m), 'F');
  assert.equal(contactSourceApp({}, { ASC_REVIEW_CONTACT_FROM_APP: 'E' }, m), 'E');
  assert.equal(contactSourceApp({}, { ASC_REVIEW_CONTACT_FROM_APP: ' ' }, m), 'M');
  assert.equal(contactSourceApp({}, {}, { review: {} }), '');
  assert.equal(meta.review.contactFromAscAppId, SRC);
  assert.deepEqual(parseArgs(['push', '--review-contact-from', SRC]), { action: 'push', dryRun: false, reviewContactFrom: SRC });
});

test('fetchReviewContact picks the newest version with a review detail and asks for the four contact fields only', async () => {
  const { api, calls } = apiOf(sourceRoutes({ 'GET /appStoreVersions/new/appStoreReviewDetail': undefined, 'GET /appStoreVersions/old/appStoreReviewDetail': { data: { attributes: FAKE_CONTACT } } }));
  const c = await fetchReviewContact(api, SRC);
  assert.deepEqual(c, { found: true, values: FAKE_CONTACT });
  const detailGets = calls.filter((x) => x.path.endsWith('/appStoreReviewDetail'));
  assert.deepEqual(detailGets.map((x) => x.path), ['/appStoreVersions/new/appStoreReviewDetail', '/appStoreVersions/old/appStoreReviewDetail']);
  assert.ok(detailGets.every((x) => x.query.includes('fields%5BappStoreReviewDetails%5D=contactFirstName,contactLastName,contactEmail,contactPhone') || x.query.includes('fields[appStoreReviewDetails]=contactFirstName,contactLastName,contactEmail,contactPhone')));
});

function pushWith({ env = {}, contactFrom = SRC, routes = {}, dryRun = false } = {}) {
  const writeRoutes = {
    'POST /appStoreVersions': { data: { id: 'v1', attributes: {} } },
    'GET /appStoreVersions/v1/appStoreVersionLocalizations': { data: [] },
    'POST /appStoreVersionLocalizations': { data: { id: 'vl', attributes: {} } },
    'POST /appInfoLocalizations': { data: { id: 'il' } },
    'PATCH /appInfos/i1': { data: {} },
    'PATCH /ageRatingDeclarations/ar1': { data: {} },
    'POST /appStoreReviewDetails': { data: {} },
  };
  const fake = apiOf({ ...emptyRoutes(), ...writeRoutes, ...sourceRoutes(), ...routes }, { dryRun });
  const logs = [];
  const run = runPush({ api: fake.api, meta, appId: APP, version: '0.6.0', screenshots: { sets: {}, problems: [] }, env, contactFrom, log: (m) => logs.push(m) });
  return { ...fake, logs, run };
}

test('push copies the four contact fields from the source app and never the demo account or notes', async () => {
  const { calls, logs, run } = pushWith();
  await run;
  const post = calls.find((c) => c.method === 'POST' && c.path === '/appStoreReviewDetails');
  for (const [k, v] of Object.entries(FAKE_CONTACT)) assert.equal(post.body.data.attributes[k], v);
  const body = JSON.stringify(post.body);
  assert.deepEqual([FAKE_DEMO.demoAccountName, FAKE_DEMO.demoAccountPassword, FAKE_DEMO.notes].filter((v) => body.includes(v)), []);
  assert.equal(post.body.data.attributes.notes, meta.review.notes);
  assert.equal(post.body.data.attributes.demoAccountName, undefined);
  assert.ok(logs.includes(`review contact: copied from app ${SRC} (4 fields)`));
});

test('an explicit ASC_REVIEW_CONTACT_* value wins over the copied one, per field', async () => {
  const { calls, logs, run } = pushWith({ env: { ASC_REVIEW_CONTACT_EMAIL: 'override@example.invalid', ASC_REVIEW_CONTACT_PHONE: '+19990000000' } });
  await run;
  const a = calls.find((c) => c.method === 'POST' && c.path === '/appStoreReviewDetails').body.data.attributes;
  assert.equal(a.contactEmail, 'override@example.invalid');
  assert.equal(a.contactPhone, '+19990000000');
  assert.equal(a.contactFirstName, FAKE_CONTACT.contactFirstName);
  assert.ok(logs.includes(`review contact: copied from app ${SRC} (2 fields)`));
});

test('with all four env values the source app is not read at all', async () => {
  const env = { ASC_REVIEW_CONTACT_FIRST_NAME: 'A', ASC_REVIEW_CONTACT_LAST_NAME: 'B', ASC_REVIEW_CONTACT_EMAIL: 'a@example.invalid', ASC_REVIEW_CONTACT_PHONE: '+1' };
  const { calls, run } = pushWith({ env });
  await run;
  assert.equal(calls.filter((c) => c.path.includes(SRC)).length, 0);
});

test('nothing of the contact or the source demo account reaches a log line', async () => {
  const { logs, run } = pushWith();
  await run;
  assert.ok(logs.length > 0);
  for (const line of logs) assert.deepEqual(leaks(line), [], `leak in: ${line}`);
  const partial = pushWith({ routes: { 'GET /appStoreVersions/new/appStoreReviewDetail': { data: { attributes: { ...FAKE_CONTACT, contactPhone: '' } } } } });
  await partial.run;
  assert.ok(partial.logs.some((l) => /WARNING review contact skipped: contactPhone not set/.test(l)));
  assert.deepEqual(leaks(partial.logs.join('\n')), []);
});

test('push --dry-run reads the source with GETs, sends no write and prints the same line', async () => {
  const { calls, logs, api, run } = pushWith({ dryRun: true });
  const planned = await run;
  assert.deepEqual(writes(calls), []);
  assert.ok(calls.some((c) => c.path === '/appStoreVersions/new/appStoreReviewDetail'));
  assert.ok(logs.includes(`review contact: copied from app ${SRC} (4 fields)`));
  assert.deepEqual(leaks(JSON.stringify(planned) + logs.join('\n')), []);
  assert.ok(api.dryRun);
});

test('a source app without a review detail warns and push goes on without a contact', async () => {
  const { calls, logs, run } = pushWith({ routes: { 'GET /appStoreVersions/new/appStoreReviewDetail': undefined } });
  await run;
  assert.ok(logs.some((l) => l.includes(`WARNING review contact: app ${SRC} has no review detail`)));
  const a = calls.find((c) => c.method === 'POST' && c.path === '/appStoreReviewDetails').body.data.attributes;
  assert.equal(a.contactEmail, undefined);
  const none = pushWith({ routes: { [`GET /apps/${SRC}/appStoreVersions`]: { data: [] } } });
  await none.run;
  assert.ok(none.logs.some((l) => /has no review detail/.test(l)));
});

test('reviewDetailAttrs without a source behaves as before', () => {
  const r = reviewDetailAttrs(meta, {});
  assert.equal(r.contactNote, null);
  assert.equal(r.warnings.length, 2);
});

test('status reports yes/no per contact field for the source app and no value', async () => {
  const { api } = apiOf(readyRoutes(sourceRoutes({ 'GET /appStoreVersions/new/appStoreReviewDetail': { data: { attributes: { ...FAKE_CONTACT, ...FAKE_DEMO, contactPhone: '' } } } })));
  const s = await collectStatus({ api, meta, appId: APP, contactFrom: SRC });
  const md = renderStatus(s, blockingChecklist(s, meta), meta);
  assert.match(md, new RegExp(`Review contact source \\(app ${SRC}\\): FirstName yes, LastName yes, Email yes, Phone no`));
  assert.deepEqual(leaks(md), []);
  const { api: api2 } = apiOf(readyRoutes());
  const s2 = await collectStatus({ api: api2, meta, appId: APP });
  assert.ok(!renderStatus(s2, blockingChecklist(s2, meta), meta).includes('Review contact source'));
});
