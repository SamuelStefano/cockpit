# Machines and devices

## Add a machine

A "machine" (box) is any Linux server/VPS/WSL where the agent runs. One account can pair
up to 10 (`DECK_MAX_BOXES_PER_ACCOUNT`).

1. In the Deck, open the sessions panel and choose **Adicionar máquina**. It shows a pairing
   code (single use, valid 10 minutes). **gerar novo código** makes another.
2. On the machine, run the install line shown there. It has this shape:
   `curl -fsSL https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh | DECK_PAIR_CODE=CODE bash`
   The code goes in an environment variable, never in arguments (arguments show up in `ps`).
3. The script clones the repo into `~/.deck-src`, installs dependencies in the home
   directory, pairs, and installs a systemd unit `deck-agent` (falls back to nohup without
   systemd). It refuses to run as root unless `DECK_ALLOW_ROOT=1`.
4. The key pair is created ON the machine (`~/.deck-agent/identity.json`, mode 0600). The
   private key never leaves it.
5. The machine needs `claude` logged in. If it never was: run `claude` once on the machine,
   then restart the service (`sudo systemctl restart deck-agent`).

Useful install variables: `DECK_BOX_LABEL` (name shown in the Deck, renamable later),
`DECK_AGENT_ROLE=admin` (owner of the box: terminals and admin tools; default `student`
is restricted), `DECK_DRY_RUN=1` (print the plan, install nothing), `DECK_SELF_UPDATE=off`.
Optional and off by default: `DECK_VPS_GUARD=1` (watchdog that kills runaway processes),
`DECK_AUTO_REDEPLOY=1`, `DECK_EXTRAS=1`.

On Windows, the agent runs inside WSL; the Deck shows a WSL guide when adding a machine.

## Several machines

Each machine has its own slot. A browser tab talks to one machine at a time; pick it in the
box switcher. With no choice made, the tab follows the primary (the machine online longest).
Machines can be renamed or revoked from the Deck; revoking cuts that machine at once.

## Pairing other devices (phone, second laptop)

Open the Deck URL and sign in on the new device. Access to a machine goes through a
trusted-device list that lives ON the machine (`~/.deck-agent/devices.json`):

- Easiest: in a device already trusted, turn on the passkey; the new browser enters next.
- With shell access to the machine: `deck-agent enroll-device` prints a one-time code;
  type it in the new device.
- List trusted devices: `deck-agent devices`.
- Revoke one: `deck-agent revoke-device <first 6+ chars of its key>` (needs exactly one
  match).

`deck-agent` is a wrapper the setup script installs; it runs as the service user with the
service's environment. Without it, the same flags exist on `npx tsx server/agent.ts`
(`--enroll-device`, `--devices`, `--revoke-device=`) from the clone.

These commands only touch the local trust list; the relay cannot add a device.

## Updates

The agent updates itself: about 1 minute after boot and every ~10 minutes it fetches
`origin/main` of its own clone and fast-forwards, waiting for running turns to finish. A
build that fails to boot 3 times is rolled back automatically. `DECK_SELF_UPDATE=off`
disables it. Manual: `npm run update` (updates the Claude CLI and restarts).
