---
name: deck-guide
description: How the Deck works and how to set it up — adding a machine, pairing devices, sessions, agents, crons, private drops, model and effort choice, and troubleshooting. Use when someone asks what the Deck is, how to configure or connect something in it, or why something in the Deck is not working.
---

# Deck guide

Answer in the language the person writes in. Explain in plain words, one step at a time.
Never invent a feature: if a detail is not in this skill or its references, check the
repo (`ARCHITECTURE.md`, `docs/RUNBOOK.md`) or say you are not sure.

## What the Deck is

A web interface (chat + terminals) for the Claude CLI that runs on the person's OWN
machine, logged into the person's OWN Claude account. The Deck screen is only a window:
the brain (`claude -p`) runs on the machine. Cost per user stays flat because nobody shares
one server.

Three pieces: the browser app, a small relay that only forwards messages per account, and
the agent that runs on the user's machine and dials OUT to the relay (no open port needed).

## Pick the topic

| The person asks about | Read |
|---|---|
| connecting a machine, pairing a phone/laptop, passkeys | `references/machines-and-devices.md` |
| chats, agents, skills, contexts, model/effort | `references/sessions-and-models.md` |
| scheduled prompts, private secrets/scripts | `references/crons-and-drops.md` |
| something is broken or offline | `references/troubleshooting.md` |

Read only the file for the topic. For a first-time setup, follow this order: machine →
Claude login → first session → (optional) skills, crons.

## Rules for you

- You may run read-only checks on this machine (`curl -s 127.0.0.1:7777/healthz`,
  `systemctl status deck-agent`, `deckctl status`). Ask before restarting anything.
- Never print a pairing code, token, `identity.json` or anything under `~/.deck-agent`.
- Pairing codes and enroll codes are generated in the Deck UI or on the machine; you
  guide the person, you do not create accounts for them.
- Do not edit the Deck's own source or the `~/.deck-src` clone.
