#!/usr/bin/env node
// App Store Connect store kit CLI (ported from the Lesson Studio shell). Zero dependency: the ES256 JWT is signed with node:crypto
// and the HTTP layer takes an injectable fetch, so the tests drive every action with a fake.
//
// The listing lives in apps/ios/store/metadata.json and the screenshots in
// apps/ios/store/screenshots/<locale>/<DISPLAY_TYPE>/NN-<slug>.png. The App Store Connect key exists only as
// secrets of the GitHub environment `Production`, so the real run is .github/workflows/store-asc.yml.
//
// Usage (from apps/ios):
//   node scripts/asc-store.mjs status
//   node scripts/asc-store.mjs push --version 0.6.0 [--build-number 14] [--review-contact-from <ascAppId>] [--dry-run]
//   node scripts/asc-store.mjs submit --confirm com.tainanfidelis.deck
//
// Environment (the names ios-eas.yml already exports):
//   ASC_API_KEY_PATH, ASC_API_KEY_ID, ASC_API_ISSUER_ID   the team key (never printed)
//   ASC_APP_ID                                            the App Store Connect app id (metadata.ascAppId is optional and absent until the app record exists)
// Review detail (push only; absent values are skipped with a warning, status needs none of them):
//   ASC_REVIEW_CONTACT_FIRST_NAME, ASC_REVIEW_CONTACT_LAST_NAME, ASC_REVIEW_CONTACT_EMAIL, ASC_REVIEW_CONTACT_PHONE
//   ASC_REVIEW_DEMO_USER, ASC_REVIEW_DEMO_PASSWORD
// Review contact reuse (push, and one status line): when the four ASC_REVIEW_CONTACT_* values are absent, push copies
// them (and only them, never the demo account or the notes) from the App Review detail of an already published app.
// The source app id, first match wins:  --review-contact-from <ascAppId>  >  ASC_REVIEW_CONTACT_FROM_APP  >
// metadata.review.contactFromAscAppId. Per field, an explicit ASC_REVIEW_CONTACT_* value beats the copied one.
// The copied values are never printed: the logs and the step summary name the app id and a field count only.
//
// Exit codes: 0 ok, 2 App Store Connect or config failure, 3 submit refused, 64 usage.
//
// What the API cannot do, and a person does in the App Store Connect UI: the App Privacy answers (the label),
// the price (free), the content rights answer and the demo account itself. `status` lists them.

import { createHash, createSign } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1';
const here = dirname(fileURLToPath(import.meta.url));
const STORE_DIR = resolve(here, '../store');

// ---------------------------------------------------------------- JWT

export const b64u = (b) => Buffer.from(b).toString('base64url');

/** The claims App Store Connect wants: aud `appstoreconnect-v1`, a lifetime of at most 20 minutes (we use 15). */
export function jwtClaims({ issuer, nowMs, ttlSeconds = 900 }) {
  const iat = Math.floor(nowMs / 1000);
  return { iss: issuer, iat, exp: iat + ttlSeconds, aud: 'appstoreconnect-v1' };
}

/** `sign(data: string) => Buffer` is injected: the real one is `es256Signer`, the tests pass a stub. */
export function signJwt({ keyId, issuer, nowMs, sign, ttlSeconds }) {
  const header = b64u(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64u(JSON.stringify(jwtClaims({ issuer, nowMs, ttlSeconds })));
  return `${header}.${payload}.${b64u(sign(`${header}.${payload}`))}`;
}

/** ES256 over a PEM private key. `ieee-p1363` is the raw r||s form that JWT needs (not DER). */
export function es256Signer(pem) {
  return (data) => createSign('SHA256').update(data).sign({ key: pem, dsaEncoding: 'ieee-p1363' });
}

/** A token source that mints a new 15-minute token after 10 minutes, so a long upload never sends an expired one. */
export function createTokenSource({ keyId, issuer, sign, now = Date.now }) {
  let token = null;
  let mintedAt = 0;
  return () => {
    const t = now();
    if (!token || t - mintedAt > 600_000) {
      token = signJwt({ keyId, issuer, nowMs: t, sign });
      mintedAt = t;
    }
    return token;
  };
}

// ---------------------------------------------------------------- PNG

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width, height and alpha of a PNG from its bytes. Throws when it is not a PNG. */
export function pngInfo(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG (bad signature)');
  if (buf.toString('latin1', 12, 16) !== 'IHDR') throw new Error('not a PNG (no IHDR first)');
  const colorType = buf[25];
  let hasAlpha = colorType === 4 || colorType === 6;
  // A palette or grayscale PNG can carry transparency in a tRNS chunk.
  for (let off = 8; !hasAlpha && off + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'tRNS') hasAlpha = true;
    if (type === 'IDAT' || type === 'IEND') break;
    off += 12 + len;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType, hasAlpha };
}

/** The App Store Connect display types this kit pushes, with the exact sizes they accept. */
export const DISPLAY_TYPES = { APP_IPHONE_67: [{ width: 1290, height: 2796 }] };

export function checkScreenshotPng(buf, displayType) {
  const sizes = DISPLAY_TYPES[displayType];
  if (!sizes) return [`unknown display type ${displayType}`];
  const problems = [];
  let info;
  try {
    info = pngInfo(buf);
  } catch (e) {
    return [e.message];
  }
  if (!sizes.some((s) => s.width === info.width && s.height === info.height)) {
    problems.push(`${info.width}x${info.height} is not one of ${sizes.map((s) => `${s.width}x${s.height}`).join(', ')}`);
  }
  if (info.hasAlpha) problems.push('has an alpha channel (App Store Connect rejects it)');
  return problems;
}

// ---------------------------------------------------------------- metadata

export const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, description: 4000, keywords: 100 };
const LOCALE_FIELDS = Object.keys(LIMITS);

// Guideline 3.1.1 and the no-account-creation rule: the listing copy names no price, no plan and no sign-up.
const BILLING_WORDS = [
  /\bfree\b/i, /gr[aá]tis/i, /gratuit/i, /\bprices?\b/i, /pre[cç]o/i, /subscri/i, /assinatura/i, /assine/i,
  /premium/i, /\btrial\b/i, /\bbuy\b/i, /\bcompre\b/i, /purchase/i, /\bpay\b/i, /\bpague\b/i, /[$€£]/,
];
const SIGNUP_WORDS = [/sign[ -]?up/i, /create (an |your |a )?account/i, /register/i, /crie sua conta/i, /criar (uma )?conta/i, /cadastr/i, /inscreva/i];

/** Every age rating key of AgeRatingDeclaration.Attributes that this kit sets, with its kind. */
export const AGE_RATING_KEYS = {
  advertising: 'bool', alcoholTobaccoOrDrugUseOrReferences: 'level', contests: 'level', gambling: 'bool',
  gamblingSimulated: 'level', gunsOrOtherWeapons: 'level', healthOrWellnessTopics: 'bool', horrorOrFearThemes: 'level',
  lootBox: 'bool', matureOrSuggestiveThemes: 'level', medicalOrTreatmentInformation: 'level', messagingAndChat: 'bool',
  parentalControls: 'bool', ageAssurance: 'bool', profanityOrCrudeHumor: 'level', sexualContentGraphicAndNudity: 'level',
  sexualContentOrNudity: 'level', socialMedia: 'bool', unrestrictedWebAccess: 'bool', userGeneratedContent: 'bool',
  violenceCartoonOrFantasy: 'level', violenceRealistic: 'level', violenceRealisticProlongedGraphicOrSadistic: 'level',
};
const LEVELS = ['NONE', 'INFREQUENT_OR_MILD', 'FREQUENT_OR_INTENSE', 'INFREQUENT', 'FREQUENT'];

/** Returns a list of problems; empty means the file is ready to push. */
export function validateMetadata(meta) {
  const p = [];
  for (const k of ['bundleId', 'primaryCategory', 'copyright', 'supportUrl', 'marketingUrl', 'privacyPolicyUrl']) {
    if (typeof meta?.[k] !== 'string' || !meta[k].trim()) p.push(`${k} is missing`);
  }
  for (const k of ['supportUrl', 'marketingUrl', 'privacyPolicyUrl']) {
    if (typeof meta?.[k] === 'string' && !/^https:\/\//.test(meta[k])) p.push(`${k} must be an https URL`);
  }
  if (meta?.ascAppId !== undefined && !/^\d+$/.test(String(meta.ascAppId))) p.push('ascAppId must be digits when present (leave it out until the app record exists)');
  const locales = meta?.locales && typeof meta.locales === 'object' ? meta.locales : {};
  for (const need of ['pt-BR', 'en-US']) if (!locales[need]) p.push(`locales.${need} is missing`);
  for (const [loc, fields] of Object.entries(locales)) {
    for (const f of LOCALE_FIELDS) {
      const v = fields?.[f];
      if (typeof v !== 'string' || !v.trim()) p.push(`${loc}.${f} is empty`);
      else if ([...v].length > LIMITS[f]) p.push(`${loc}.${f} is ${[...v].length} characters, the limit is ${LIMITS[f]}`);
      else {
        for (const re of [...BILLING_WORDS, ...SIGNUP_WORDS]) if (re.test(v)) p.push(`${loc}.${f} matches the forbidden pattern ${re}`);
      }
    }
    const kw = (fields?.keywords ?? '').split(',').map((s) => s.trim());
    if (kw.some((s) => s === '')) p.push(`${loc}.keywords has an empty item`);
    if (new Set(kw.map((s) => s.toLowerCase())).size !== kw.length) p.push(`${loc}.keywords repeats a word`);
    if ((fields?.keywords ?? '') !== (fields?.keywords ?? '').replace(/,\s+/g, ',')) p.push(`${loc}.keywords has a space after a comma (it costs a character)`);
  }
  const age = meta?.ageRating ?? {};
  for (const [k, kind] of Object.entries(AGE_RATING_KEYS)) {
    const v = age[k];
    if (kind === 'bool' && typeof v !== 'boolean') p.push(`ageRating.${k} must be true or false`);
    if (kind === 'level' && !LEVELS.includes(v)) p.push(`ageRating.${k} must be one of ${LEVELS.join(', ')}`);
  }
  if (typeof meta?.review?.notes !== 'string' || !meta.review.notes.trim()) p.push('review.notes is empty');
  else if (meta.review.notes.length > 4000) p.push('review.notes is longer than 4000 characters');
  return p;
}

export function loadMetadata(path = join(STORE_DIR, 'metadata.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ---------------------------------------------------------------- payload builders

export const appInfoLocalizationAttrs = (meta, locale) => ({
  name: meta.locales[locale].name,
  subtitle: meta.locales[locale].subtitle,
  privacyPolicyUrl: meta.privacyPolicyUrl,
});

export const versionLocalizationAttrs = (meta, locale) => ({
  description: meta.locales[locale].description,
  keywords: meta.locales[locale].keywords,
  promotionalText: meta.locales[locale].promotionalText,
  supportUrl: meta.supportUrl,
  marketingUrl: meta.marketingUrl,
});

export const ageRatingAttrs = (meta) => Object.fromEntries(Object.keys(AGE_RATING_KEYS).map((k) => [k, meta.ageRating[k]]));

export const CONTACT_ENV = {
  contactFirstName: 'ASC_REVIEW_CONTACT_FIRST_NAME', contactLastName: 'ASC_REVIEW_CONTACT_LAST_NAME',
  contactEmail: 'ASC_REVIEW_CONTACT_EMAIL', contactPhone: 'ASC_REVIEW_CONTACT_PHONE',
};
export const CONTACT_KEYS = Object.keys(CONTACT_ENV);

/** Where the review contact is copied from: the flag, then the environment, then the file. Empty string when none. */
export const contactSourceApp = (opts, env, meta) =>
  [opts?.reviewContactFrom, env?.ASC_REVIEW_CONTACT_FROM_APP, meta?.review?.contactFromAscAppId].map((v) => String(v ?? '').trim()).find(Boolean) ?? '';

/**
 * Review detail attributes from the file (notes), the environment (contact, demo account) and `copied`, the four
 * contact values of another app (an explicit environment value wins per field). `contactNote` says where the contact
 * came from without carrying any value.
 */
export function reviewDetailAttrs(meta, env, copied = {}, copiedFromAppId = '') {
  const warnings = [];
  const attrs = { notes: meta.review.notes, demoAccountRequired: meta.review.demoAccountRequired !== false };
  const fromEnv = Object.fromEntries(CONTACT_KEYS.map((k) => [k, env[CONTACT_ENV[k]]]));
  const contact = {};
  let copiedCount = 0;
  for (const k of CONTACT_KEYS) {
    if (fromEnv[k]?.trim()) contact[k] = fromEnv[k].trim();
    else if (copied[k]?.trim()) {
      contact[k] = copied[k].trim();
      copiedCount++;
    }
  }
  const missing = CONTACT_KEYS.filter((k) => !contact[k]);
  let contactNote = null;
  if (missing.length) {
    warnings.push(`review contact skipped: ${missing.join(', ')} not set (ASC_REVIEW_CONTACT_*${copiedFromAppId ? `, or empty on app ${copiedFromAppId}` : ''})`);
  } else {
    Object.assign(attrs, contact);
    if (copiedCount) contactNote = `review contact: copied from app ${copiedFromAppId} (${copiedCount} fields)`;
  }
  if (env.ASC_REVIEW_DEMO_USER?.trim() && env.ASC_REVIEW_DEMO_PASSWORD) {
    attrs.demoAccountName = env.ASC_REVIEW_DEMO_USER.trim();
    attrs.demoAccountPassword = env.ASC_REVIEW_DEMO_PASSWORD;
  } else if (attrs.demoAccountRequired) {
    warnings.push('demo account skipped: ASC_REVIEW_DEMO_USER or ASC_REVIEW_DEMO_PASSWORD not set');
  }
  return { attrs, warnings, contactNote };
}

export const jsonApi = (type, { id, attributes, relationships } = {}) => ({
  data: { type, ...(id ? { id } : {}), ...(attributes ? { attributes } : {}), ...(relationships ? { relationships } : {}) },
});
const rel = (type, id) => ({ data: { type, id } });

/** The keys whose value differs (or is unknown) in `existing`. */
export function diffAttrs(existing, desired) {
  return Object.fromEntries(Object.entries(desired).filter(([k, v]) => existing?.[k] !== v));
}

// ---------------------------------------------------------------- HTTP layer

export class AscError extends Error {
  constructor(method, path, status, errors) {
    const detail = (errors ?? []).map((e) => `${e.code ?? ''} ${e.detail ?? e.title ?? ''}`.trim()).join('; ');
    super(`ASC ${method} ${path}: HTTP ${status}${detail ? ` (${detail})` : ''}`);
    this.status = status;
    this.errors = errors ?? [];
  }
}

const isPlanned = (path) => path.includes('planned:');
const EDITABLE_VERSION_STATES = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'WAITING_FOR_EXPORT_COMPLIANCE'];

/**
 * `token()` returns the bearer. In dry-run every write is recorded in `planned` and answered with a
 * placeholder id; a read under a placeholder id answers empty. A dry-run therefore sends only GETs.
 */
export function createApi({ fetchImpl = globalThis.fetch, token, base = ASC_BASE, dryRun = false }) {
  const planned = [];
  const toUrl = (path) => (path.startsWith('http') ? path : `${base}${path}`);
  async function raw(method, path, body) {
    // App Store Connect answers intermittent 500s; only reads are retried, a write is never repeated.
    let res;
    for (let attempt = 0; ; attempt++) {
      res = await fetchImpl(toUrl(path), {
        method,
        headers: { authorization: `Bearer ${token()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (method !== 'GET' || res.status < 500 || attempt >= 4) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, json };
  }
  return {
    dryRun,
    planned,
    /** GET, null on 404 (a singular resource that does not exist yet). */
    async getOptional(path) {
      if (isPlanned(path)) return null;
      const { res, json } = await raw('GET', path);
      if (res.status === 404) return null;
      if (!res.ok) throw new AscError('GET', path, res.status, json?.errors);
      return json;
    },
    async get(path) {
      const json = await this.getOptional(path);
      if (!json) throw new AscError('GET', path, 404, []);
      return json;
    },
    /** All pages of a list. Returns { data, included }. */
    async getAll(path) {
      if (isPlanned(path)) return { data: [], included: [] };
      const out = { data: [], included: [] };
      let next = path;
      for (let guard = 0; next && guard < 50; guard++) {
        const { res, json } = await raw('GET', next);
        if (!res.ok) throw new AscError('GET', next, res.status, json?.errors);
        out.data.push(...(json.data ?? []));
        out.included.push(...(json.included ?? []));
        next = json.links?.next ?? null;
      }
      return out;
    },
    /** POST, PATCH or DELETE. In dry-run: recorded, not sent. */
    async write(method, path, body, note = '') {
      if (dryRun) {
        planned.push({ method, path, note, attributes: Object.keys(body?.data?.attributes ?? {}) });
        return { data: { id: `planned:${planned.length}`, type: body?.data?.type, attributes: body?.data?.attributes ?? {} } };
      }
      const { res, json } = await raw(method, path, body);
      if (!res.ok) throw new AscError(method, path, res.status, json?.errors);
      return json;
    },
    /** A presigned upload part: the URL carries its own authorisation, so no bearer here. */
    async putPart(op, bytes) {
      const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
      const res = await fetchImpl(op.url, { method: op.method ?? 'PUT', headers, body: bytes });
      if (!res.ok) throw new Error(`screenshot part upload: HTTP ${res.status}`);
    },
  };
}

// ---------------------------------------------------------------- review contact of another app

/**
 * The App Review contact of a published app, newest version that has an appStoreReviewDetail first.
 * Only the four contact attributes are requested (sparse fieldset), so the source's demo account and notes are never
 * even received. Read-only.
 */
export async function fetchReviewContact(api, sourceAppId) {
  const vers = (await api.getAll(`/apps/${sourceAppId}/appStoreVersions?filter[platform]=IOS&limit=50`)).data;
  const newestFirst = [...vers].sort((a, b) => String(attr(b).createdDate ?? '').localeCompare(String(attr(a).createdDate ?? '')));
  for (const v of newestFirst) {
    const rd = (await api.getOptional(`/appStoreVersions/${v.id}/appStoreReviewDetail?fields[appStoreReviewDetails]=${CONTACT_KEYS.join(',')}`))?.data;
    if (rd) return { found: true, values: Object.fromEntries(CONTACT_KEYS.map((k) => [k, String(attr(rd)[k] ?? '').trim()])) };
  }
  return { found: false, values: {} };
}

// ---------------------------------------------------------------- status

const attr = (r) => r?.attributes ?? {};
const includedById = (included, type) => new Map((included ?? []).filter((i) => i.type === type).map((i) => [i.id, i]));

/** Read everything the checklist needs. Read-only. */
export async function collectStatus({ api, meta, appId, contactFrom = '' }) {
  const app = (await api.get(`/apps/${appId}`)).data;
  const vers = await api.getAll(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&include=build&limit=50`);
  const buildsById = includedById(vers.included, 'builds');
  const versions = vers.data.map((v) => {
    const b = buildsById.get(v.relationships?.build?.data?.id);
    return {
      id: v.id,
      versionString: attr(v).versionString,
      state: attr(v).appStoreState ?? attr(v).appVersionState,
      copyright: attr(v).copyright ?? null,
      releaseType: attr(v).releaseType ?? null,
      build: b ? { id: b.id, version: attr(b).version, processingState: attr(b).processingState } : null,
    };
  });
  const editable = versions.find((v) => EDITABLE_VERSION_STATES.includes(v.state)) ?? null;
  const target = editable ?? versions[0] ?? null;

  const bl = await api.getAll(`/builds?filter[app]=${appId}&sort=-uploadedDate&limit=20&include=preReleaseVersion`);
  const pre = includedById(bl.included, 'preReleaseVersions');
  const builds = bl.data.map((b) => ({
    id: b.id,
    version: attr(b).version,
    preRelease: attr(pre.get(b.relationships?.preReleaseVersion?.data?.id)).version ?? null,
    processingState: attr(b).processingState,
    uploadedDate: attr(b).uploadedDate ?? null,
    expired: attr(b).expired ?? false,
  }));

  const infos = await api.getAll(`/apps/${appId}/appInfos?include=primaryCategory,secondaryCategory`);
  const infoRow = infos.data.find((i) => EDITABLE_VERSION_STATES.includes(attr(i).appStoreState ?? attr(i).state)) ?? infos.data[0] ?? null;
  const appInfo = infoRow && {
    id: infoRow.id,
    state: attr(infoRow).appStoreState ?? attr(infoRow).state,
    primaryCategory: infoRow.relationships?.primaryCategory?.data?.id ?? null,
    secondaryCategory: infoRow.relationships?.secondaryCategory?.data?.id ?? null,
  };

  const infoLocs = appInfo ? (await api.getAll(`/appInfos/${appInfo.id}/appInfoLocalizations`)).data : [];
  const verLocs = target ? (await api.getAll(`/appStoreVersions/${target.id}/appStoreVersionLocalizations`)).data : [];
  const screenshots = {};
  for (const l of verLocs) {
    const sets = await api.getAll(`/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=50`);
    screenshots[attr(l).locale] = Object.fromEntries(
      sets.data.map((s) => [attr(s).screenshotDisplayType, (s.relationships?.appScreenshots?.data ?? []).length]),
    );
  }

  const age = appInfo ? (await api.getOptional(`/appInfos/${appInfo.id}/ageRatingDeclaration`))?.data ?? null : null;
  const rd = target ? (await api.getOptional(`/appStoreVersions/${target.id}/appStoreReviewDetail`))?.data ?? null : null;
  const price = (await api.getOptional(`/apps/${appId}/appPriceSchedule`))?.data ?? null;

  // Booleans per field only: the copied contact never leaves fetchReviewContact.
  let contactSource = null;
  if (contactFrom) {
    try {
      const c = await fetchReviewContact(api, contactFrom);
      contactSource = { appId: contactFrom, found: c.found, fields: Object.fromEntries(CONTACT_KEYS.map((k) => [k, Boolean(c.values[k])])) };
    } catch (e) {
      contactSource = { appId: contactFrom, error: e instanceof AscError ? `HTTP ${e.status}` : 'unreadable' };
    }
  }

  return {
    app: { id: app.id, name: attr(app).name, bundleId: attr(app).bundleId, contentRightsDeclaration: attr(app).contentRightsDeclaration ?? null },
    versions, editable, target, builds, appInfo,
    infoLocs: Object.fromEntries(infoLocs.map((l) => [attr(l).locale, attr(l)])),
    verLocs: Object.fromEntries(verLocs.map((l) => [attr(l).locale, attr(l)])),
    screenshots,
    ageRating: age ? attr(age) : null,
    // Presence flags only: the demo account and the contact never leave this object.
    review: rd && {
      notes: Boolean(attr(rd).notes?.trim()),
      contact: CONTACT_KEYS.every((k) => Boolean(attr(rd)[k]?.trim())),
      demoAccountRequired: attr(rd).demoAccountRequired ?? null,
      demoAccount: Boolean(attr(rd).demoAccountName?.trim()) && Boolean(attr(rd).demoAccountPassword),
    },
    priceSchedule: Boolean(price),
    contactSource,
  };
}

const SCREENSHOT_TYPES = ['APP_IPHONE_67', 'APP_IPHONE_69'];

/** `blockers` stop a submission (the API can say so). `manual` is what only the App Store Connect UI can confirm. */
export function blockingChecklist(s, meta) {
  const blockers = [];
  if (s.app.bundleId !== meta.bundleId) blockers.push(`the app is ${s.app.bundleId}, metadata.json says ${meta.bundleId}`);
  if (!s.editable) blockers.push('no editable App Store version (run push --version X)');
  if (s.editable) {
    if (!s.editable.copyright) blockers.push('version has no copyright');
    if (!s.editable.build) blockers.push('no build attached to the version (push --build-number N)');
    else if (s.editable.build.processingState !== 'VALID') blockers.push(`attached build ${s.editable.build.version} is ${s.editable.build.processingState}, not VALID`);
  }
  if (!s.appInfo) blockers.push('no appInfo');
  else if (!s.appInfo.primaryCategory) blockers.push('no primary category');
  for (const loc of Object.keys(meta.locales)) {
    const info = s.infoLocs[loc];
    if (!info) blockers.push(`${loc}: no app info localization`);
    else for (const f of ['name', 'subtitle', 'privacyPolicyUrl']) if (!info[f]) blockers.push(`${loc}: ${f} missing`);
    const ver = s.verLocs[loc];
    if (!ver) blockers.push(`${loc}: no version localization`);
    else for (const f of ['description', 'keywords', 'promotionalText', 'supportUrl']) if (!ver[f]) blockers.push(`${loc}: ${f} missing`);
    const shots = s.screenshots[loc] ?? {};
    if (!SCREENSHOT_TYPES.some((t) => (shots[t] ?? 0) > 0)) blockers.push(`${loc}: no iPhone 6.7"/6.9" screenshots`);
  }
  if (!s.ageRating) blockers.push('no age rating declaration');
  else {
    const unset = Object.keys(AGE_RATING_KEYS).filter((k) => s.ageRating[k] === null || s.ageRating[k] === undefined);
    if (unset.length) blockers.push(`age rating not answered: ${unset.join(', ')}`);
  }
  if (!s.review) blockers.push('no review detail');
  else {
    if (!s.review.notes) blockers.push('review notes empty');
    if (!s.review.contact) blockers.push('review contact incomplete (ASC_REVIEW_CONTACT_*)');
    if (s.review.demoAccountRequired && !s.review.demoAccount) blockers.push('demo account required but not set (ASC_REVIEW_DEMO_*)');
  }
  if (!s.priceSchedule) blockers.push('no price schedule (set the price to Free in the App Store Connect UI)');
  if (!s.app.contentRightsDeclaration) blockers.push('content rights declaration not answered (UI)');
  const manual = [
    'App Privacy answers published (UI only, no API): tick the data types listed in apps/ios/APP_REVIEW.md section 5',
    'The privacy policy page (https://deck.devfellowship.com/privacy) is live and names voice input, the data sent to the relay, retention and the account deletion route',
    'The demo account signs in and reaches a chat on the box we operate',
    'A signed build of the store profile is in TestFlight and was opened once on a device',
  ];
  return { blockers, manual };
}

export function renderStatus(s, checklist, meta) {
  const L = [];
  L.push(`## App Store Connect status: ${s.app.name} (${s.app.bundleId})`, '');
  L.push('### Versions', '', '| Version | State | Build | Copyright |', '|---|---|---|---|');
  for (const v of s.versions) {
    L.push(`| ${v.versionString} | ${v.state} | ${v.build ? `${v.build.version} (${v.build.processingState})` : 'none'} | ${v.copyright ? 'set' : 'missing'} |`);
  }
  if (!s.versions.length) L.push('| none | | | |');
  L.push('', '### Builds', '', '| Version | Build | Processing | Uploaded |', '|---|---|---|---|');
  for (const b of s.builds) L.push(`| ${b.preRelease ?? '?'} | ${b.version} | ${b.processingState}${b.expired ? ' (expired)' : ''} | ${b.uploadedDate ?? ''} |`);
  if (!s.builds.length) L.push('| none | | | |');
  L.push('', '### Listing per locale', '', '| Locale | Missing fields | Screenshots |', '|---|---|---|');
  for (const loc of [...new Set([...Object.keys(meta.locales), ...Object.keys(s.screenshots), ...Object.keys(s.infoLocs)])]) {
    const missing = [
      ...['name', 'subtitle', 'privacyPolicyUrl'].filter((f) => !s.infoLocs[loc]?.[f]),
      ...['description', 'keywords', 'promotionalText', 'supportUrl', 'marketingUrl'].filter((f) => !s.verLocs[loc]?.[f]),
    ];
    const shots = Object.entries(s.screenshots[loc] ?? {}).map(([t, n]) => `${t}: ${n}`).join(', ');
    L.push(`| ${loc} | ${missing.join(', ') || 'none'} | ${shots || 'none'} |`);
  }
  L.push('', '### Other', '');
  L.push(`- Categories: ${s.appInfo ? `${s.appInfo.primaryCategory ?? 'none'} / ${s.appInfo.secondaryCategory ?? 'none'}` : 'no appInfo'}`);
  L.push(`- Age rating declaration: ${s.ageRating ? 'present' : 'absent'}`);
  L.push(`- Review detail: ${s.review ? `present (notes ${s.review.notes ? 'set' : 'empty'}, contact ${s.review.contact ? 'set' : 'incomplete'}, demo account ${s.review.demoAccount ? 'set' : 'not set'})` : 'absent'}`);
  if (s.contactSource) {
    const c = s.contactSource;
    const detail = c.error ? `unreadable (${c.error})` : !c.found ? 'no review detail' : CONTACT_KEYS.map((k) => `${k.replace('contact', '')} ${c.fields[k] ? 'yes' : 'no'}`).join(', ');
    L.push(`- Review contact source (app ${c.appId}): ${detail}`);
  }
  L.push(`- Price schedule: ${s.priceSchedule ? 'present' : 'absent'}`);
  L.push(`- Content rights declaration: ${s.app.contentRightsDeclaration ?? 'not answered'}`);
  L.push('', `### Blocking a submission (${checklist.blockers.length})`, '');
  L.push(...(checklist.blockers.length ? checklist.blockers.map((b) => `- [ ] ${b}`) : ['- none']));
  L.push('', '### A person confirms (no API)', '', ...checklist.manual.map((m) => `- [ ] ${m}`));
  return L.join('\n');
}

// ---------------------------------------------------------------- screenshots on disk

/** Locale folders hold `<DISPLAY_TYPE>/NN-slug.png`. A locale with no folder uses `fallbackLocale` (pt-BR reuses en-US). */
export function readScreenshots(dir, locales, fallbackLocale = 'en-US') {
  const out = {};
  const problems = [];
  for (const locale of locales) {
    let src = join(dir, locale);
    if (!existsSync(src)) src = join(dir, fallbackLocale);
    out[locale] = {};
    if (!existsSync(src)) continue;
    for (const displayType of readdirSync(src).sort()) {
      const files = readdirSync(join(src, displayType)).filter((f) => f.endsWith('.png')).sort();
      out[locale][displayType] = files.map((name) => {
        const bytes = readFileSync(join(src, displayType, name));
        for (const pr of checkScreenshotPng(bytes, displayType)) problems.push(`${locale}/${displayType}/${name}: ${pr}`);
        return { name, bytes, md5: createHash('md5').update(bytes).digest('hex') };
      });
      if (files.length > 10) problems.push(`${locale}/${displayType}: ${files.length} files, App Store Connect takes at most 10`);
    }
  }
  return { sets: out, problems };
}

// ---------------------------------------------------------------- push

async function upsert(api, { listPath, type, locale, attrs, createBody, log }) {
  const existing = (await api.getAll(listPath)).data.find((r) => attr(r).locale === locale);
  if (!existing) {
    log(`create ${type} ${locale}`);
    return (await api.write('POST', `/${type}`, createBody(attrs), `${type} ${locale}`)).data;
  }
  const changed = diffAttrs(attr(existing), attrs);
  if (Object.keys(changed).length) {
    log(`update ${type} ${locale}: ${Object.keys(changed).join(', ')}`);
    await api.write('PATCH', `/${type}/${existing.id}`, jsonApi(type, { id: existing.id, attributes: changed }), `${type} ${locale}`);
  } else log(`${type} ${locale}: up to date`);
  return existing;
}

async function pushScreenshots(api, locId, locale, sets, log) {
  for (const [displayType, files] of Object.entries(sets)) {
    if (!files.length) continue;
    const existingSets = (await api.getAll(`/appStoreVersionLocalizations/${locId}/appScreenshotSets`)).data;
    let set = existingSets.find((s) => attr(s).screenshotDisplayType === displayType);
    const current = set ? (await api.getAll(`/appScreenshotSets/${set.id}/appScreenshots`)).data : [];
    const same = current.length === files.length && files.every((f, i) => attr(current[i]).fileName === f.name && attr(current[i]).sourceFileChecksum === f.md5);
    if (same) {
      log(`screenshots ${locale} ${displayType}: ${files.length} up to date`);
      continue;
    }
    if (!set) {
      set = (await api.write('POST', '/appScreenshotSets', jsonApi('appScreenshotSets', {
        attributes: { screenshotDisplayType: displayType },
        relationships: { appStoreVersionLocalization: rel('appStoreVersionLocalizations', locId) },
      }), `screenshot set ${locale} ${displayType}`)).data;
    }
    for (const old of current) await api.write('DELETE', `/appScreenshots/${old.id}`, null, `old screenshot ${attr(old).fileName}`);
    for (const f of files) {
      log(`upload ${locale} ${displayType} ${f.name} (${f.bytes.length} bytes)`);
      const made = (await api.write('POST', '/appScreenshots', jsonApi('appScreenshots', {
        attributes: { fileName: f.name, fileSize: f.bytes.length },
        relationships: { appScreenshotSet: rel('appScreenshotSets', set.id) },
      }), `screenshot ${f.name}`)).data;
      if (api.dryRun) continue;
      for (const op of attr(made).uploadOperations ?? []) await api.putPart(op, f.bytes.subarray(op.offset, op.offset + op.length));
      await api.write('PATCH', `/appScreenshots/${made.id}`, jsonApi('appScreenshots', { id: made.id, attributes: { uploaded: true, sourceFileChecksum: f.md5 } }));
    }
  }
}

/**
 * Idempotent: a second run with the same inputs sends no write. Returns the list of log lines.
 * `screenshots` is the result of `readScreenshots`; it is validated before the first call.
 */
export async function runPush({ api, meta, appId, version, buildNumber, screenshots, env, contactFrom = '', log = () => {} }) {
  const bad = validateMetadata(meta);
  if (bad.length) throw new Error(`metadata.json is not valid:\n- ${bad.join('\n- ')}`);
  if (screenshots.problems.length) throw new Error(`screenshots are not valid:\n- ${screenshots.problems.join('\n- ')}`);
  if (!version) throw new Error('push needs --version');

  const app = (await api.get(`/apps/${appId}`)).data;
  if (attr(app).bundleId !== meta.bundleId) throw new Error(`app ${appId} is ${attr(app).bundleId}, metadata.json says ${meta.bundleId}: refusing to write`);

  // 1. an editable version for --version
  const versions = (await api.getAll(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=50`)).data;
  const state = (v) => attr(v).appStoreState ?? attr(v).appVersionState;
  const clash = versions.find((v) => attr(v).versionString === version && !EDITABLE_VERSION_STATES.includes(state(v)));
  if (clash) throw new Error(`version ${version} exists in state ${state(clash)}, which is not editable`);
  let ver = versions.find((v) => EDITABLE_VERSION_STATES.includes(state(v)));
  if (!ver) {
    log(`create appStoreVersion ${version}`);
    ver = (await api.write('POST', '/appStoreVersions', jsonApi('appStoreVersions', {
      attributes: { platform: 'IOS', versionString: version, copyright: meta.copyright, releaseType: 'MANUAL' },
      relationships: { app: rel('apps', appId) },
    }), `version ${version}`)).data;
  } else {
    const changed = diffAttrs(attr(ver), { versionString: version, copyright: meta.copyright });
    if (Object.keys(changed).length) {
      log(`update appStoreVersion ${ver.id}: ${Object.keys(changed).join(', ')}`);
      await api.write('PATCH', `/appStoreVersions/${ver.id}`, jsonApi('appStoreVersions', { id: ver.id, attributes: changed }), 'version');
    } else log('appStoreVersion: up to date');
  }

  // 2. categories and app info localizations
  const infos = (await api.getAll(`/apps/${appId}/appInfos?include=primaryCategory,secondaryCategory`)).data;
  const info = infos.find((i) => EDITABLE_VERSION_STATES.includes(attr(i).appStoreState ?? attr(i).state)) ?? infos[0];
  if (!info) throw new Error('the app has no appInfo');
  const cur = { primary: info.relationships?.primaryCategory?.data?.id, secondary: info.relationships?.secondaryCategory?.data?.id };
  if (cur.primary !== meta.primaryCategory || cur.secondary !== meta.secondaryCategory) {
    log(`set categories ${meta.primaryCategory} / ${meta.secondaryCategory}`);
    await api.write('PATCH', `/appInfos/${info.id}`, jsonApi('appInfos', {
      id: info.id,
      relationships: { primaryCategory: rel('appCategories', meta.primaryCategory), secondaryCategory: rel('appCategories', meta.secondaryCategory) },
    }), 'categories');
  } else log('categories: up to date');
  for (const locale of Object.keys(meta.locales)) {
    await upsert(api, {
      listPath: `/appInfos/${info.id}/appInfoLocalizations`, type: 'appInfoLocalizations', locale, log,
      attrs: appInfoLocalizationAttrs(meta, locale),
      createBody: (a) => jsonApi('appInfoLocalizations', { attributes: { locale, ...a }, relationships: { appInfo: rel('appInfos', info.id) } }),
    });
  }

  // 3. age rating declaration
  const ageDecl = (await api.getOptional(`/appInfos/${info.id}/ageRatingDeclaration`))?.data;
  if (!ageDecl) throw new Error('the appInfo has no ageRatingDeclaration to update');
  const ageChanged = diffAttrs(attr(ageDecl), ageRatingAttrs(meta));
  if (Object.keys(ageChanged).length) {
    log(`update age rating: ${Object.keys(ageChanged).join(', ')}`);
    await api.write('PATCH', `/ageRatingDeclarations/${ageDecl.id}`, jsonApi('ageRatingDeclarations', { id: ageDecl.id, attributes: ageChanged }), 'age rating');
  } else log('age rating: up to date');

  // 4. version localizations and screenshots
  for (const locale of Object.keys(meta.locales)) {
    const loc = await upsert(api, {
      listPath: `/appStoreVersions/${ver.id}/appStoreVersionLocalizations`, type: 'appStoreVersionLocalizations', locale, log,
      attrs: versionLocalizationAttrs(meta, locale),
      createBody: (a) => jsonApi('appStoreVersionLocalizations', { attributes: { locale, ...a }, relationships: { appStoreVersion: rel('appStoreVersions', ver.id) } }),
    });
    await pushScreenshots(api, loc.id, locale, screenshots.sets[locale] ?? {}, log);
  }

  // 5. review detail
  // The source is read only when the environment does not already give all four contact values.
  let copied = {};
  if (contactFrom && !CONTACT_KEYS.every((k) => env[CONTACT_ENV[k]]?.trim())) {
    const src = await fetchReviewContact(api, contactFrom);
    if (!src.found) log(`WARNING review contact: app ${contactFrom} has no review detail`);
    copied = src.values;
  }
  const { attrs: reviewAttrs, warnings, contactNote } = reviewDetailAttrs(meta, env, copied, contactFrom);
  if (contactNote) log(contactNote);
  for (const w of warnings) log(`WARNING ${w}`);
  const rd = (await api.getOptional(`/appStoreVersions/${ver.id}/appStoreReviewDetail`))?.data;
  if (!rd) {
    log('create review detail');
    await api.write('POST', '/appStoreReviewDetails', jsonApi('appStoreReviewDetails', {
      attributes: reviewAttrs, relationships: { appStoreVersion: rel('appStoreVersions', ver.id) },
    }), 'review detail');
  } else {
    const changed = diffAttrs(attr(rd), reviewAttrs);
    if (Object.keys(changed).length) {
      log(`update review detail: ${Object.keys(changed).join(', ')}`);
      await api.write('PATCH', `/appStoreReviewDetails/${rd.id}`, jsonApi('appStoreReviewDetails', { id: rd.id, attributes: changed }), 'review detail');
    } else log('review detail: up to date');
  }

  // 6. the build
  if (buildNumber) {
    const b = (await api.getAll(`/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(buildNumber)}&filter[preReleaseVersion.version]=${encodeURIComponent(version)}&limit=5`)).data[0];
    if (!b) throw new Error(`no build ${buildNumber} of version ${version} in App Store Connect`);
    if (attr(b).processingState !== 'VALID') throw new Error(`build ${buildNumber} is ${attr(b).processingState}, not VALID`);
    const attached = (await api.getOptional(`/appStoreVersions/${ver.id}/relationships/build`))?.data?.id;
    if (attached === b.id) log(`build ${buildNumber}: already attached`);
    else {
      log(`attach build ${buildNumber}`);
      await api.write('PATCH', `/appStoreVersions/${ver.id}/relationships/build`, { data: { type: 'builds', id: b.id } }, 'build');
    }
  }
  return api.planned;
}

// ---------------------------------------------------------------- submit

export class SubmitRefused extends Error {}

/** Refuses unless `confirm` equals the bundle id and the checklist has no blocker. */
export async function runSubmit({ api, meta, appId, confirm, log = () => {} }) {
  if (confirm !== meta.bundleId) throw new SubmitRefused(`--confirm must equal the bundle id ${meta.bundleId}`);
  const status = await collectStatus({ api, meta, appId });
  const { blockers } = blockingChecklist(status, meta);
  if (blockers.length) throw new SubmitRefused(`${blockers.length} blocker(s):\n- ${blockers.join('\n- ')}`);

  const subs = (await api.getAll(`/apps/${appId}/reviewSubmissions?filter[platform]=IOS&limit=50`)).data;
  const busy = subs.find((r) => ['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(attr(r).state));
  if (busy) throw new SubmitRefused(`a review submission is already ${attr(busy).state}`);
  let sub = subs.find((r) => attr(r).state === 'READY_FOR_REVIEW');
  if (!sub) {
    log('create reviewSubmission');
    sub = (await api.write('POST', '/reviewSubmissions', jsonApi('reviewSubmissions', {
      attributes: { platform: 'IOS' }, relationships: { app: rel('apps', appId) },
    }))).data;
  }
  const items = (await api.getAll(`/reviewSubmissions/${sub.id}/items`)).data;
  if (!items.some((i) => i.relationships?.appStoreVersion?.data?.id === status.editable.id)) {
    log(`add version ${status.editable.versionString} to the submission`);
    await api.write('POST', '/reviewSubmissionItems', jsonApi('reviewSubmissionItems', {
      relationships: { reviewSubmission: rel('reviewSubmissions', sub.id), appStoreVersion: rel('appStoreVersions', status.editable.id) },
    }));
  }
  log('submit for review');
  await api.write('PATCH', `/reviewSubmissions/${sub.id}`, jsonApi('reviewSubmissions', { id: sub.id, attributes: { submitted: true } }));
  return { versionString: status.editable.versionString };
}

// ---------------------------------------------------------------- CLI

export function parseArgs(argv) {
  const [action, ...rest] = argv;
  const opts = { action, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (['--version', '--build-number', '--confirm', '--metadata', '--screenshots', '--review-contact-from'].includes(a)) opts[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = rest[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

export async function main(argv, env = process.env, fetchImpl = globalThis.fetch) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (!['status', 'push', 'submit'].includes(opts.action)) throw new Error('usage: asc-store.mjs <status|push|submit> [options]');
  } catch (e) {
    console.error(e.message);
    return 64;
  }
  const meta = loadMetadata(opts.metadata);
  const appId = env.ASC_APP_ID || meta.ascAppId;
  if (!appId) {
    console.error('missing ASC_APP_ID: the App Store Connect app record does not exist yet (see apps/ios/README.md, step "ASC app id")');
    return 2;
  }
  const missing = ['ASC_API_KEY_PATH', 'ASC_API_KEY_ID', 'ASC_API_ISSUER_ID'].filter((k) => !env[k]);
  if (missing.length) {
    console.error(`missing env: ${missing.join(', ')}`);
    return 2;
  }
  const token = createTokenSource({ keyId: env.ASC_API_KEY_ID, issuer: env.ASC_API_ISSUER_ID, sign: es256Signer(readFileSync(env.ASC_API_KEY_PATH)) });
  const api = createApi({ fetchImpl, token, dryRun: opts.dryRun });
  const contactLines = [];
  const log = (m) => {
    console.log(m);
    if (/^(WARNING )?review contact/.test(m)) contactLines.push(`- ${m}`);
  };
  const contactFrom = contactSourceApp(opts, env, meta);
  try {
    if (opts.action === 'status') {
      const s = await collectStatus({ api, meta, appId, contactFrom });
      const md = renderStatus(s, blockingChecklist(s, meta), meta);
      console.log(md);
      summary(md);
      return 0;
    }
    if (opts.action === 'push') {
      const screenshots = readScreenshots(opts.screenshots ?? join(STORE_DIR, 'screenshots'), Object.keys(meta.locales));
      const planned = await runPush({ api, meta, appId, version: opts.version, buildNumber: opts.buildNumber, screenshots, env, contactFrom, log });
      if (opts.dryRun) {
        const md = ['## push --dry-run: planned writes (nothing was sent)', '', ...planned.map((p) => `- ${p.method} ${p.path} ${p.note ? `(${p.note})` : ''} [${p.attributes.join(', ')}]`), planned.length ? '' : '- none, everything is up to date', ...contactLines].join('\n');
        console.log(md);
        summary(md);
      } else if (contactLines.length) summary(['## push: review contact', '', ...contactLines].join('\n'));
      return 0;
    }
    const r = await runSubmit({ api, meta, appId, confirm: opts.confirm, log });
    const md = `## Submitted for review: ${meta.bundleId} ${r.versionString}`;
    console.log(md);
    summary(md);
    return 0;
  } catch (e) {
    console.error(e instanceof SubmitRefused ? `REFUSED: ${e.message}` : `FAILED: ${e.message}`);
    summary(`## ${e instanceof SubmitRefused ? 'Refused' : 'Failed'}\n\n\`\`\`\n${e.message}\n\`\`\``);
    return e instanceof SubmitRefused ? 3 : 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
