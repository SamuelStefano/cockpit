# App Review readiness of Deck (iOS)

Gate table of `app-store-review` section 2 (plan `deck-ios`, rows S1 to S6).
Each line is **pass** (with evidence), **gap** (with the route) or **owner** (a person holds it).
A claim not checked says "not verified".

## 0. Verdict (2026-11-14)

**Not ready to submit.** The shell (#1137) and the web side (#1138: privacy, support and terms pages,
in-app account deletion, AI consent, shell gates) are merged. App Store Connect holds version 0.1.0 with
the listing pushed on 2026-11-03 and build 7 attached; build 8 (`production-bundle`, 2026-11-08) is
uploaded but not attached. These block a submission:

1. No build was opened on a device yet (iPhone or iPad), so 2.1 and the bundled-origin spike are open.
2. The demo account and its box do not exist: `ASC_REVIEW_DEMO_USER`/`ASC_REVIEW_DEMO_PASSWORD` are unset.
3. No screenshots (spec in `store/screenshots/README.md`).
4. App Privacy label and content rights: UI only, not answered.
5. The privacy manifest gained crash and diagnostic data and the icon is now 1024 px: both need a new
   `production-bundle` build after this lands.

## 1. Binary (2.1, 2.5)

| Item | State | Evidence or route |
|---|---|---|
| The attached build opens and stays open | **gap** | No build. Route: EAS `production-bundle` to TestFlight, open on an iPhone on the current iOS. Owner: Samuel (device date). Evidence file via `mobile-device-evidence`. |
| Main flow on the device | **gap** | Sign in with the demo account, open a chat, send a message, get the agent reply. Depends on the demo account (S2). |
| No dead screen, placeholder or "coming soon" | **gap** | The new-account screen ("requires your own server") is S2. Sweep every route with the student demo account after S5. |
| Permission strings say what for | **pass** | `app.json` `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` (voice input in the chat) and `NSPhotoLibraryUsageDescription` (the optional screenshot offer, read-only). `assert-native-config.mjs` builds Info.plist with `expo prebuild` and compares; it also fails on a camera, photo-add, Face ID or location string. Not run on a build yet. |
| Photos access is optional and opt-in (5.1.1) | **gap (device)** | Nothing reads Photos, and no prompt shows, until the user taps "Ativar prints automáticos" (web sends `screenshots-enable`). Then iOS asks for read access. Denied: the offer stays off. Limited ("Selected Photos"): the web is told, the offer may miss new prints. Only the user's own latest screenshot (last 10 minutes) is looked at; the full image goes to the page only after "Colar". Unit tests cover the decision and the flow (`screenshotOffer.test.ts`, `screenshotController.test.ts`); the prompt, the limited-access behaviour and the in-app screenshot event are not run on a device. |
| Denying a permission does not trap the app | **gap** | Not run. The web owns the voice button and the screenshot opt-in; the shell has no permission screen. Check on device, including Photos denied and Selected Photos. |
| Store build does not load the live site (2.5.2) | **gap** | Profile `production-bundle` serves the bundled web on `deck://localhost` (`app.config.js`, `eas.json`). Not built. The device spike for Ed25519/X25519 `crypto.subtle` on a custom scheme (plan S0.5) is not run. If it fails, the live origin needs Tainan's written acceptance. Profile `production` is TestFlight only. |
| OTA (2.5.2) | **pass** | `updates.checkAutomatically` is `NEVER`; no update URL is configured. |
| iPad | **gap** | `supportsTablet: false`. App Review tests an iPhone app on an iPad in compatibility mode. Not run. |
| IPv6 and the reviewer's network | **gap** | Not verified. The relay and Supabase must answer from outside Brazil and without a VPN or tailnet. |
| Scene life cycle on the iOS 27 SDK | **pass (config), gap (device)** | `plugins/withSceneLifecycle.js`, asserted by `assert-native-config.mjs`. Not proven on a device. |
| Navigation stays in the allow-list | **pass** | `src/origin.ts`: app origin, `deck-relay.devfellowship.com`, `ikxtdssxmcgipyfpwmar.supabase.co`; everything else opens outside. Unit tests in `src/origin.test.ts`. |

## 2. Account and access (2.1, 4.8, 5.1.1(v))

| Item | State | Evidence or route |
|---|---|---|
| Demo account signs in today | **owner: Samuel + Tainan** | A student account on a box we operate, `DECK_ACCOUNT_TRUST` on (plan S2). Credentials go to the `ios-release` environment (`ASC_REVIEW_DEMO_USER`, `ASC_REVIEW_DEMO_PASSWORD`), never the repo. Sign in on the attached build the day of submission. |
| Demo account does not expire in review | **gap** | No trial, no magic link, no 2FA, no confirmation email. Not verified. Test a clean install and a reinstall. |
| Third-party login (4.8) | **pass, not verified on device** | `grep` of `src/` finds no `signInWithOAuth`. Sign-in is email and password. If a social login is ever added, Sign in with Apple becomes mandatory. |
| Account creation needs in-app deletion (5.1.1(v)) | **gap** | Signup is free, in the app, by email. Deletion (Dashboard and EnrollDevice, relay POST, auth admin delete, purge of `shares/<uid>/`) is plan row S3, an unsafe class that Samuel approves. The review notes already name `Settings > Delete account`: **re-check the exact path against S3 before submitting**. |
| App only for people with an account | **pass (notes)** | The notes say who the users are and that a new account needs its own server. A new account sees an honest screen (S2) with Sign out and Delete account. |

## 3. Business model and the standard questions (2.1 "Information Needed")

All answers are in `store/metadata.json` `review.notes` (English, 2439 characters).

| Apple asks | The notes say | State |
|---|---|---|
| Who are the users | developers and students who run their own Deck server | **pass (text)** |
| Where is a subscription bought | there is no subscription or plan | **owner: Tainan confirms** |
| What paid content is unlocked without IAP | none; everything is free and identical for every account | **owner: Tainan confirms**. `grep` of `src/` finds no checkout; the points ledger (`/pontos`) is a work tracker, hidden from students (S5). |
| How an account is obtained, is it paid | free signup in the app, by email | **pass (text)** |
| Widgets or extensions | no Widgets, no app extension, no Live Activity | **pass**: no extension target in the project, none configured. |
| What the app is | a chat client for the user's own server, where the agent runs; new accounts need their own server; the demo box is ours | **pass (text)** |

## 4. Minimum functionality (4.2)

| Item | State | Evidence or route |
|---|---|---|
| What is native is on in production | **gap** | Four bridge capabilities exist in the shell: local notification, share sheet, haptics, and the optional screenshot offer (Photos). The web must call them (S0). There is no remote kill-switch config in Deck, so "the flag is on" cannot be read live. Decision for Tainan: add one, or accept that the capability is on when the web calls it. |
| The native part is in the first three steps of the notes | **pass (text)** | Steps 4 to 7 of the notes: dictation, share sheet, optional screenshot offer, notification. Step 3 sends the first message. |
| The notes promise only what the build has | **gap** | Every frame of the notes must be walked against the attached build. Not run. |
| Positioned as a client for the user's own server | **pass (text)** | Notes and description say so, and name the demo box as ours. They do not compare the app to another product. |

## 5. Listing (2.3, 1.5)

| Item | State | Evidence or route |
|---|---|---|
| Screenshots are real frames of the app | **gap** | None committed. Spec, frame list and the resize from a 6.1" iPhone: `store/screenshots/README.md`. Browser renders are a 2.3.3 rejection. |
| Screenshots show the app in use | **gap** | Needs the demo box: a chat with a real reply. |
| Same name everywhere | **pass (explained)** | Store name "Deck Multi-Agents", home-screen name "Deck" (`app.json`); the review notes say the short name is a form of the store name. |
| Description only says what exists | **pass (text)** | Chat, voice input, share sheet, local notification, delete account. Each bullet depends on the web calling the bridge (S0) and on S3. No price, plan, beta or other-platform words (`validateMetadata` rejects them). |
| Support URL has a way to reach a person | **pass** | `https://deck.devfellowship.com/support` answers 200 with a contact route (`preflight.sh`, 2026-11-14). |
| Category and age rating | **owner: Tainan** | Primary Developer Tools, secondary Productivity. Age rating answers are in `metadata.json`: no user-generated content, no unrestricted web access (allow-list), no social features. The agent can produce any text: confirm the answers with that in mind. |
| App icon | **pass (file), gap (build)** | `assets/icon.png` is 1024x1024 RGB, no alpha, rasterized from the vector mark (`scripts/gen-icons.mjs`, same mark as `public/icon-512.png`), not upscaled. Builds up to 8 carry the old 512 px file. |

## 6. Privacy (5.1.1, 5.1.2)

The privacy manifest (`app.json`), the App Privacy label (UI of App Store Connect, no API) and the policy page must say the same thing.

| Item | State | Evidence or route |
|---|---|---|
| Manifest: collected data | **pass (config)** | Email address, user ID, other user content, photos or videos (a screenshot the user chose to paste, sent to their own server), crash data and other diagnostic data (`src/app/diag/diagReport.ts` inserts reports tied to the account into `diag_reports`); linked to the user; not used for tracking; purpose App Functionality. `NSPrivacyTracking` false, no tracking domains. Asserted by `assert-native-config.mjs`. Builds up to 8 lack the two diagnostic types. |
| Manifest: required-reason APIs | **pass (not re-scanned per module)** | FileTimestamp C617.1 0A2A.1 3B52.1, UserDefaults CA92.1, DiskSpace E174.1 85F4.1, SystemBootTime 35F9.1 (React Native, expo-updates, expo-constants). App Store Connect scans the binary at upload and mails a gap (ITMS-91053): the first upload is the final check. |
| Voice | **gap** | Dictation uses iOS speech recognition through the web page. Audio is not stored by the shell. Where the audio goes (Apple servers or on device) depends on the device; the policy must say so. The label likely needs "Audio Data" only if Deck itself receives audio: **not verified**. |
| Policy page covers the app | **pass after deploy** | `public/privacy/index.html` names voice input, the relay, the AI provider and consent, sharing, diagnostics, retention, deletion and (since 2026-11-14) the Photos screenshot offer. `preflight.sh` checks the live page. |
| Analytics and traces from the web page | **gap** | `grep` of `src/` finds an analytics-like name in the points code only; not verified for an embedded script. If the page sends analytics, the manifest, label and policy must declare it, or it is turned off in the shell. |
| Label published in App Store Connect | **owner: account holder (UI)** | Tick: Email Address, User ID, Photos or Videos, Other User Content, Crash Data, Other Diagnostic Data; each linked to the user; not used for tracking; purpose App Functionality. |

## 7. Money (3.1)

| Item | State | Evidence or route |
|---|---|---|
| No mention of buying outside IAP | **gap** | No price in the shell or the listing. The web must show no price, plan, "subscribe" or checkout link inside the shell: store-surface gate (S5), forbidden-string test. |
| Paid content unlocked from outside | **pass (notes)** | None exists, per the notes. Tainan confirms (section 3). |

## 8. Who does what

| Owner | Task |
|---|---|
| Tainan | App record in App Store Connect; API key into `ios-release`; App Privacy label; free price; content rights; age rating confirmation; the written OK for `submit`. |
| Samuel | iPhone evidence on the exact build; the demo account and box; the 1024 px icon master; screenshots. |
| Other PRs | S0 web bridge calls, S2 reviewer path, S3 privacy/support/terms and account deletion, S5 store-surface gate. |
