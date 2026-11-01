# Deck iOS shell

An Expo app whose only screen is one WebView on the Deck web app. The web app does the work; the shell
draws what exists before the web document does (loading veil, offline card), keeps the navigation
inside an allow-list and gives the page three native things through a message bridge.

This folder is **outside the root npm workspaces** on purpose: it has its own `package-lock.json` and pins the
React that its Expo SDK bundles. The root `tsc`, `vitest`, Docker image and Vercel build ignore it
(`vite.config.ts` excludes `apps/**`; `.dockerignore` and `.vercelignore` list `apps/ios`).

| Item | Value |
|---|---|
| Name, slug, scheme | Deck, `deck`, `deck` |
| Bundle id | `com.tainanfidelis.deck` |
| Expo owner | `devfellowship` |
| Version | 0.1.0 (`app.json`, `package.json`) |
| iPad | `supportsTablet: false` (iPhone app; App Review still tests it on an iPad in compatibility mode) |
| Encryption | `usesNonExemptEncryption: false` |
| OTA updates | `checkAutomatically: NEVER` |

## Origins and build profiles

| EAS profile | Web origin | Use |
|---|---|---|
| `production` | `https://deck.devfellowship.com` (live site) | TestFlight only |
| `production-bundle` | `deck://localhost`, the web build copied into the app (`DECK_WEB_BUNDLE=1`) | **the store build** (guideline 2.5.2: the store build does not load a live website) |
| `development` | live site, separate app `com.tainanfidelis.deck.dev`, dev client | local work |
| `simulator` | live site, simulator binary | local work |

The bundle variant needs the native module `modules/dfl-web-bundle` (a `WKURLSchemeHandler`). If the module is
missing or reports a problem, the shell falls back to the https origin (`src/origin.ts`, tested).

`npm run bundle:web` builds the web app at the repo root and copies it into the module. It refuses to run
without `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_WS_URL`, and refuses a service-role key.
These three values are public by design (they are bundled into the web app); on EAS they are plain-text EAS
environment variables, never repo files. **Open work for the bundle:** the web app must use the WebSocket URL
from `VITE_WS_URL`, build canonical https links for share/reset/enroll (not `location.origin`), and add a meta CSP;
and the device spike for `crypto.subtle` Ed25519/X25519 on a custom scheme is not run (plan row S0.5).

## What is native

| Message | Effect |
|---|---|
| `{ "v": 1, "type": "notify", "title", "body" }` | local notification (`expo-notifications`), at most one per second |
| `{ "v": 1, "type": "share", "message"?, "url"? }` | iOS share sheet (https URL only) |
| `{ "v": 1, "type": "haptic", "style" }` | haptic feedback |

The web sends `window.ReactNativeWebView.postMessage(JSON.stringify(message))`. `src/bridge.ts` parses it
(strict, size-limited, tested) and drops anything else; messages from any page that is not the app origin are
ignored. Navigation: the app origin, `deck-relay.devfellowship.com` and `ikxtdssxmcgipyfpwmar.supabase.co` load inside;
every other URL opens outside the app (`src/origin.ts`, tested).

Permissions: microphone and speech recognition, for voice input in the chat. Nothing else.

## Checks that run without a build

```bash
cd apps/ios
npx vitest run --config vitest.config.ts   # pure tests: origin, navigation, bridge parser, chrome reducer
node --test scripts/asc-store.test.mjs     # store kit, no network, no key
npm run typecheck                          # needs npm ci
npm run check:native-config                # expo prebuild + Info.plist and privacy manifest asserts, needs npm ci
```

The lockfile is generated with npm 11: `npx --yes npm@11 install --package-lock-only --ignore-scripts`.

## Store release

The listing is `store/metadata.json` (pt-BR primary, en-US). The audit against App Review is
`APP_REVIEW.md`. `.github/workflows/ios-store.yml` is manual (`workflow_dispatch`), runs on `ubuntu-latest`
and reads every secret from the `ios-release` environment.

### Steps still open (nothing here is done by this PR)

1. **ASC app id** (placeholder step). Tainan creates the app record in App Store Connect (bundle id
   `com.tainanfidelis.deck`, name Deck, primary language pt-BR). Then add `ASC_APP_ID` to the `ios-release`
   environment secrets. Do not put `ascAppId` in `eas.json` or `metadata.json` until the record exists:
   `asc-store.mjs` refuses to run without `ASC_APP_ID`.
2. **Environment `ios-release`** with a required reviewer and a deployment branch policy of `main`. Secrets:
   `ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, `ASC_APP_ID`, `EXPO_TOKEN`,
   `ASC_REVIEW_DEMO_USER`, `ASC_REVIEW_DEMO_PASSWORD`, `ASC_REVIEW_CONTACT_*` (optional).
3. **EAS project**: `eas init` under owner `devfellowship` (adds `extra.eas.projectId`); store credentials through
   `eas credentials`; EAS environment variables for the three `VITE_*` values.
4. **1024 px icon master** (`assets/icon.png` is the 512 px web icon, a placeholder).
5. **Screenshots** from a real iPhone build (`store/screenshots/<locale>/APP_IPHONE_67/`).
6. **Privacy label** in App Store Connect and the `/support` and `/privacy` pages (another PR).
7. Demo account on a box we operate; device evidence on a TestFlight build; then `submit` only with the
   written OK of the account owner (`approval_ref`).
