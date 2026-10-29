# Sessions, agents, skills, models

## Sessions

A session is one conversation with Claude on the selected machine. The history is the
CLI's own JSONL under `~/.claude/projects/` (source of truth). Create one with **Criar
sessão** / **+**. Sessions can be renamed, tagged, hidden (archived) and searched.
A heavy session can be handed off to a fresh chat with a summary ("handoff").
Messages sent while a turn runs are queued.

Default permission mode is `acceptEdits` (the agent edits files, asks for the rest).
Bypass of permissions exists only for admin on a local connection and is off by default.

## From the terminal: `deckctl`

On the machine: `deckctl sessions`, `new "<text>"`, `send <id> "<text>"`, `read <id>`,
`wait <id>`, `stop <id>`, `pending`, `answer`, `handoff`, `ctx`, `status`. Ids accept
unambiguous prefixes; `--json` for raw output. Needs the local backend (port 7777) token
from `~/.cockpit-local.env`.

## Other agents (ACP)

The **Agentes** page (`/agentes`) connects other AI agents to the Deck in 3 steps each; the Deck
runs the terminal commands and tests them. Connected agents appear in the model picker
under a separate group from Claude models.

## Skills

Folders in `~/.claude/skills/<name>/SKILL.md` with a `name` and `description` in the
frontmatter. The **skills** page lists installed ones, a registry to discover and install
more (installs never overwrite an existing folder), and packs. Select a subset per chat to
deny the others. This guide is installed automatically as `deck-guide`.

## Model and effort

Per chat, the composer has a model picker and an effort picker.

- Models come from the Anthropic account's model list (refresh button fetches new ones);
  offline it falls back to Fable, Opus, Sonnet, Haiku.
- Effort: Baixo (default, cheapest and fastest), Médio, Alto, Muito alto, Máximo. Higher
  means more thinking and more cost; start low and raise only for hard tasks.
- Rule of thumb: a smaller/faster model for volume work, the strongest for planning and
  hard bugs.
- The usage page (**uso**) shows plan limits and estimated cost per model.

## Other pages

The sidebar footer opens Equipe (team bots, with Rotinas = crons and Memória under it),
Skills, Conexões (providers, keys, tools and devices) and Configurações. Also: canvas
(kanban of tasks run by sessions), docs.
