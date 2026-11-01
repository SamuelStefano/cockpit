# Deck Desktop — plan v2
Commit: cockpit@406af9f3. Sources: sources/CONTEXT.md, review.md. Not read: sources/NOT-READ.md minus what B read. Tracker: this file, copied to cockpit docs/desktop-plan.md in PR-0. Personal project: not published to DFL Plans.

## Goal
Installable Deck for Windows that behaves like Discord: own window, tray, native notifications that open the right chat on any box, server rail of boxes, channel list of sessions, two-level unread, self-update. Same account and relay. Web and phone keep working.

## MVP
Floor: PR-0 to PR-7. Quality word: "app de verdade": it must stay alive and correct for days in the tray.
If time, in order: mute/DND · drag reorder rail · categories by project · Linux (own gate, answer AppImage sandbox first) · local box plan · macOS. Fallback for each: not shipped, web unaffected.

## Decisions
- ADR-1 Electron, not Tauri: own Chromium, xterm/three/WebAuthn tested in one engine. Cost ~100 MB, more RAM. Voice is NOT assumed to work (see P4).
- ADR-2 Thin shell loading the prod HTTPS origin in a top-level BrowserWindow. Keeps rpId, relay allowlist, CSP. No webview or parent frame (X-Frame-Options DENY). Not "instant updates" until PR-0b, since update detection is dead on Vercel today. T5 or passkey trouble falls back to code enrollment and does NOT reopen this ADR; app:// would be worse.
- ADR-3 `desktop/` package with own lockfile, no workspace. Root vitest excludes desktop/**. Path-filtered CI job for desktop. Modules: window.ts, updater.ts, tray.ts, bridge.ts, links.ts.
- ADR-4 Security. sandbox, contextIsolation, no nodeIntegration, nodeIntegrationInSubFrames off. Fuses: RunAsNode off, NodeCliInspect off, OnlyLoadAppFromAsar on. Navigation allowlist on will-navigate, will-redirect, will-frame-navigate. openExternal only http/https/mailto parsed by new URL, others dropped and logged, table test. IPC only from mainFrame at prod origin; every arg validated; no URL in notification payload. Permission request AND check handlers: main frame only, mic+notifications. Bridge has no shell, file, autostart or hotkey method: those live in the native menu. deck:// parser strict, only selects a session, never carries enroll codes.
- ADR-5 One web codebase. `src/lib/desktop.ts` adapter, no-op in browser. `deckDesktop.apiVersion` + per-feature checks, type in shared/. Web tolerates any older shell, tested. Rail and unread reach wide web too; phone unchanged.
- ADR-6 v1 = Windows x64 only. Linux has no user or gate yet.
- ADR-7 electron-updater + GitHub Releases, tag `desktop-v*` (repo is public, no releases). Build job read-only token; publish job contents:write with no install. Unsigned update trust root = GitHub repo, same as self-update.
- ADR-8 Local box is out of v1, own plan. It conflicts with the narrow bridge and needs a logged-in CLI.
- ADR-9 Multi-box truth. Peeks stay lean: summary peers no longer count in hasClients; hidden shell lowers full-scope loops. New sealed `turn-summary` in SUMMARY_OUT gives done/error from other boxes. Client tolerates old boxes by deriving from busy true→false, so rollout never locks anyone. Link: `deck://b/<box>/c/<id>`. Locked box shows a lock, never a false "no unread". B proposed the frame; A added the old-box fallback.
- ADR-10 Unread extends computeUpdated, no parallel store. Per-box seen, explicit first-sight baseline without dot flood. Level white = finished, red count = waiting or error; badge counts red only. Cross-device sync out of v1, phone read does not clear desktop: accepted.
- ADR-11 Rail = new leftmost ~64 px, active and unread pills, status, tooltip, context menu with rename/revoke/health, "+" tile, shown even with one box. BoxGroups others removed where rail shows. BoxSwitcher stays on mobile.

## Questions for Samuel (default applies, no block)
- Q-1 Signing: default unsigned, SmartScreen warning, his PC only. Certificate before sharing with others.
- Q-2 macOS: default out.
- Q-3 If dictation/call fail in Electron: default hide them in the shell with capability check; own STT later.

## Phase 0 measurements (in PR-1, on PC; report to logs/phase0.md)
P1 launch into interactive desktop session from SSH. P2 passkey/Windows Hello + PRF, clean profile. P3 first launch T5: enroll each online box. Note TOFU closes 2026-11-10. P4 dictation and call end to end. P5 RAM idle vs Chrome tab. P6 WS alive after 1 h hidden with backgroundThrottling false. P7 unsigned NSIS update with `desktop-v*` prefix (in PR-3).

## Phases and acceptance
Each gate: agent verifies / Samuel verifies. Samuel's checklist goes to `Desktop\claude VPS\Deck\desktop-app\` with LEIA-ME. Samuel gate date: 2026-11-02, or next time he is at the PC.
- F0 Agent: both test files pass; build.json fetched from prod is JSON; running tab offers reload after a deploy, never during a live turn or with a draft.
- F1 Agent: windows-latest smoke launches, zero console errors, link table test. Samuel: clean profile, login, Hello, reach chat on each online box, terminal works, restart keeps session, GitHub install and password reset paths behave.
- F2 Agent: unit tests of bridge and links. Samuel: turn ends on active AND non-active box with window hidden → toast → click opens that session; overlay count; two sessions give two toasts; close hides to tray; deck link opens; second launch focuses first; autostart starts minimized.
- F3 Agent: old version updates to new tag on PC.
- F4 Agent: screenshots 1100/1440/1920 prod web and app; mobile unchanged; smoke:ui passes; VPS CPU before/after with hidden shell and peeks recorded; box switch time measured, draft and scroll survive. Samuel: approves look.

## Tasks
| PR | Phase | What | Done when | Depends | Owner |
|---|---|---|---|---|---|
| 0 | F0 | Fix sidebar-nav.test.ts and Sidebar.test.tsx for Base (intended, #1120); add docs/desktop-plan.md | both pass | - | A |
| 0b | F0 | Static dist/build.json with no-store; both backends; non-JSON test; check on show | F0 reload | 0 | A |
| 1 | F1 | desktop/ scaffold, ADR-4 complete, splash, single instance, window state, min width 1024, context menu, "Deck Desktop" device label, windows-latest smoke, copy-code enrollment; Phase 0 | F1 | 0b | A |
| 3r | F3 | electron-builder NSIS, split release workflow, updater, version in profile, download link | F3, P7 | 1 | B |
| 2 | F2 | Bridge, adapter, apiVersion, notify.ts: hasFocus in shell, tag per session, show from tray, setOverlayIcon, AppUserModelId, backgroundThrottling false | F2 toast, badge | 3r | A |
| 3 | F2 | Tray, close-to-tray, autostart and hotkey in native menu (default off), deck:// | F2 tray, link | 2 | A |
| 4 | F4 | Agent: summary gate, hidden loops, turn-summary frame + client fallback; app-security | CPU recorded, other-box toast | 2 | B |
| 5 | F4 | Rail per ADR-11, last session per box, measured layout at 1100 | F4 rail | 0 | B |
| 6 | F4 | Unread per ADR-10 on peek data, wired to overlay | F4 unread | 4, 5 | B |
| 7 | F4 | Custom titlebar, Ctrl+1..9 box (desktop only), Ctrl+K across boxes, next unread, zoom, no reload/DevTools in release | Screenshots, keys | 5, 3 | B |

## Merge policy
Author never merges; the other agent reviews and merges. app-security on PR-1,2,3,3r,4,5,6. PR-4 reaches boxes by self-update; web PRs reach prod at merge, so tolerate old agents. Main unprotected, no required checks. Never wait for CI; verify touched files locally, read the result later. Vitest touched files only on VPS, no full build chained. Electron runs only on PC or Actions. Worktree per agent under ~/cockpit-wt/<pr>. Commits `tipo: descrição` in Portuguese, no trailers (repo CLAUDE.md). Code in English. No force on someone else's branch. Progress in EXECUTION-LOG.md, not here.

## Secrets
GITHUB_TOKEN only, publish job. No certificate in v1.

## Residual risks (max 3)
- Dictation may be lost in the shell: Samuel, Q-3.
- Unsigned install warning and repo as update root: Samuel, Q-1.
- Prod origin XSS reaches the narrow bridge: A, ADR-4.
