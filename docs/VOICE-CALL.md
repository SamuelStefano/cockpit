# Voice call mode

The phone button ("Ligar") in the composer toolbar opens a hands-free conversation with the session.

Flow: continuous recognition (ElevenLabs Scribe realtime when the box has a key, see below; else `SpeechRecognition`) → silence timer decides the end of an utterance → `onSend` →
when the turn goes idle, the final text (after the last tool call, markdown/code stripped, ≤ ~420 chars)
is spoken with `speechSynthesis` in short chunks → back to listening.

States: `listening` / `thinking` / `speaking` (+ mute, hang up). Logic lives in `src/components/chat/call/`:
`call-machine.ts` (reducer), `utterance.ts` (silence delay, echo/barge-in, spoken summary), `pick-reply.ts`,
`useCall.ts` (orchestration).

`useCall` lives in `App`, not in `ChatPanel`: the panel is keyed by session id and remounts when a new chat's
`new-…` key migrates to the real id at the end of its first turn — exactly when the reply should be spoken. That
migration keeps the call (`session-switch.ts`); opening another session hangs up.

Barge-in: while speaking, the mic keeps listening. Heard text that is a substring of what is being spoken is
treated as echo and dropped; anything else with ≥ 2 words stops the TTS and becomes the next utterance.
Headphones give the best result — speakers can still leak echo through noise-cancelling heuristics.

## ElevenLabs

With `COCKPIT_ELEVENLABS_API_KEY` (process env or `~/.deck-agent/env.json`) the box mints a single-use token (`stt-token`
frame) and the browser streams 16 kHz PCM straight to Scribe realtime, so transcription works in an iOS home-screen
app and any webview with a microphone. The account key never reaches the client. Replies use the same key plus
`COCKPIT_ELEVENLABS_VOICE_ID`. Billing runs while the mic is open, including while the agent thinks.

## Browser limits (fallback engine)

- iOS Safari: `webkitSpeechRecognition` works only in Safari itself (not in a home-screen PWA/webview) and needs
  a user gesture + mic permission; `speechSynthesis` is unlocked by a silent utterance queued inside the tap.
  The screen must stay on (Wake Lock is requested; iOS < 16.4 ignores it). Locking the phone ends the call.
- Chrome/Android: the engine ends on every pause; the recognizer restarts itself. Android WebViews may lack the API
  (the button is hidden when unsupported).
- Firefox: no `SpeechRecognition` → no phone button in the composer toolbar.
- Recognition is cloud-based in Chrome/Safari (audio leaves the device); no local models run.

## Not in this slice

- Per-device voice/speed settings; summarising long answers with a model instead of the first sentences.
