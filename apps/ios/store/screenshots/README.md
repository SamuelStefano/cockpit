# App Store screenshots

`scripts/asc-store.mjs push` uploads every PNG under `<locale>/<DISPLAY_TYPE>/` and replaces the set in
App Store Connect. A locale with no folder reuses `en-US` (so `pt-BR` can be left out when the frames are
the same app in Portuguese, which they are: the UI is pt-BR).

## Spec

| Rule | Value |
|---|---|
| Folder | `en-US/APP_IPHONE_67/` (add `pt-BR/APP_IPHONE_67/` only for different frames) |
| Size | exactly 1290x2796 px, portrait |
| Format | PNG, RGB, no alpha channel (`checkScreenshotPng` refuses alpha) |
| Count | 3 to 10 per folder; ordered by file name `NN-slug.png` (`01-chat.png`, `02-dictation.png`, ...) |
| Source | frames of the build that will be attached, captured on an iPhone (or the iOS Simulator) with the status bar. Never a desktop-browser or Playwright render of the web app: that is a 2.3.3 rejection. |
| Content | only data the demo account really shows; no real person's name, email or private repo |

## Frames to capture (demo account, attached build)

1. `01-chat.png`: a chat with the agent's reply on screen.
2. `02-dictation.png`: the microphone active in the composer, dictated text in the input.
3. `03-share.png`: the iOS share sheet opened from a reply (long-press > Compartilhar).
4. `04-notification.png`: the local notification of a finished reply (lock screen or banner).
5. `05-screenshot-offer.png`: the "Colar o print no chat?" prompt with its thumbnail.
6. `06-dashboard.png`: the dashboard with the connected box.

## From an iPhone 15 / 15 Pro / 16 frame (1179x2556) to 1290x2796

Same aspect ratio within 0.03 %, so a plain resize keeps the frame undistorted:

```bash
python3 -c "import sys; from PIL import Image; [Image.open(f).convert('RGB').resize((1290, 2796), Image.LANCZOS).save(f) for f in sys.argv[1:]]" en-US/APP_IPHONE_67/*.png
```

A 6.7"/6.9" device (iPhone 15 Plus / Pro Max, 16 Plus) already captures 1290x2796; only `.convert('RGB')` is needed.

## Upload

Commit the PNGs, merge to `main`, then run the `ios-store` workflow with `action=push-dry-run` and
`action=push` (same `version`). `action=status` must then list screenshots for both locales.
