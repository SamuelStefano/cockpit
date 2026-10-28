# Crons and private drops

## Crons

Scheduled prompts that start an autonomous turn. Page **Equipe › Rotinas** (`/equipe/rotinas`). Stored in
`~/.cockpit/crons.json` on the machine, so the machine must be on and the agent running.

Three schedules:
- every N minutes (`interval`),
- every day at a time (`daily`) — the time is Brasília time (America/Sao_Paulo), not the
  machine's timezone,
- once at a date and time (`once`).

Write the prompt as a complete task: the run has no one to ask. After editing, check the
next-run label on the card.

## Drops (private delivery of a secret or script)

Pasting a secret in chat stores it in the transcript and resends it to the model on every
turn. A drop writes it only to the machine's disk (`~/.deck-drop`, directory 0700, files
0600), not to chat history, attachments or the shared bucket.

- Create from the drop button in the header: a name (letters, digits, `.`, `_`, `-`, up to
  64 chars), the content (up to 1 MB) and an optional expiry (up to 30 days).
- The Deck returns only a reference, not the content. Tell the agent the drop name; it
  reads the file from the machine.
- Limit: the content still crosses the WebSocket, and if the agent reads the file its text
  enters that turn's context. A drop keeps the secret out of the transcript by default; it
  is not end-to-end encryption.
- Remove it from the drop list when no longer needed.
