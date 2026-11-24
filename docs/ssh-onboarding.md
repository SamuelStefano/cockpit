# SSH onboarding — install the Deck on a server from the user's own computer

Status: behind a flag, default off. Task: Deck #19.

## Goal

The user has SSH access to a server and wants the Deck agent on it without
opening a terminal there by hand. The Deck shows a one-liner with a fresh
pairing code; the user runs it on **their own computer**; it SSHes to the server
and runs the existing `scripts/agent-setup.sh`.

## Threat model

| Asset | Threat |
|---|---|
| User's SSH private key | Theft by the relay, a DFL server, the browser page, or a log |
| Pairing code | Leak lets another agent pair to the user's account until it expires |
| Target server | MITM at first connect hands the installer (and the code) to an attacker |
| Installer script | A tampered script runs as the user on their server |

Out of scope: a compromised user computer (it already holds the key) and a
compromised target server (it receives the pairing code by design).

## Options

**A. Local helper (chosen).** The Deck only displays a command. The user runs it
locally; `ssh` on their machine uses their own key or agent. The key never leaves
that machine, and the relay, the browser and every DFL server see only a
short-lived pairing code, which they already see today.

**B. Browser → box directly.** Browsers cannot open raw SSH; a WebSocket-SSH
proxy is needed. Either the key is pasted into the page (it then lives in a JS
heap that any XSS, extension or the proxy can read) or the proxy holds it. Rejected
unless the proxy is the user's own machine, which collapses into A.

**C. Paste the private key into the Deck.** Rejected: the key would transit and
rest on a server we operate. Never.

## Design (A)

- `scripts/deck-ssh-install.mjs user@host [-i keyfile] [-p port] [--trust-new-host]`
- Gated by `DECK_SSH_ONBOARDING=1`; exits otherwise.
- The pairing code comes from `DECK_PAIR_CODE` (env), never argv, so it is not in
  the local `ps`. It is sent to the server over **ssh stdin** (one line, read by
  `read -r` in the remote command), so it is not in the remote `ps` or in shell
  history either.
- The remote command is a constant string; no user input is interpolated into it.
- `user@host` is validated against a strict pattern; a leading `-` is rejected
  (option injection into `ssh`). `ssh` runs through `spawn` with an argv array,
  `shell:false`, and `--` before the target.
- Host key: `StrictHostKeyChecking=yes` against the user's `known_hosts`. An
  unknown host fails with instructions to verify the fingerprint out of band.
  `--trust-new-host` (explicit opt-in) maps to `accept-new` (trust on first use).
  `no` is never emitted; a test pins that.
- Key handling: `-i` is passed to ssh as a path with `IdentitiesOnly=yes`. The
  helper never reads, copies, logs or prints key contents; only the path is echoed.
- Installer fetched from the pinned raw URL over HTTPS by the server
  (`curl -fsSL`), same trust as the manual one-liner. Default mode is the
  isolated install (`DECK_ISOLATED=1` with sudo) already supported by the script.
- `--dry-run` prints the exact ssh argv (code redacted) and runs nothing.
- UI: the "Adicionar máquina" modal shows an extra section only when
  `cockpit:flag.sshOnboarding` is true. It renders the local one-liner with the
  code filled in; nothing is sent anywhere by the UI.

## `app-security` checklist

- [x] §0.1 No secret in the client: UI only shows the pairing code the relay already returns; no `VITE_*` secret.
- [x] §0.3 Least privilege: the key is the user's, used locally; the code is short-lived and single-purpose.
- [x] §0.5 Nothing bound to 0.0.0.0; no new listener.
- [x] §4 Command injection: argv array, `shell:false`, constant remote command, strict target regex, `--` before target, leading `-` rejected.
- [x] §4 Secrets not in argv: code via env locally and stdin over ssh.
- [x] Host verification: no `StrictHostKeyChecking=no`, ever.
- [x] No logging of key material; code redacted in dry-run and errors.
- [x] Default off behind a flag.
- Residual: the one-liner pipes a script from GitHub into `node`; same trust level as the existing `curl | bash`. Pinning to a commit SHA is a follow-up.
- Residual: the code appears in the remote `sudo` argv for the install's duration (same as the manual one-liner). Needs root login or passwordless sudo (no tty is allocated).
- Residual: the server learns the pairing code (required to pair).

## Not in this slice

- Windows without OpenSSH in PATH (needs `ssh.exe`; documented only).
- Commit-SHA pinning of the helper and installer URLs.
- Jump hosts / `ProxyJump` options.
