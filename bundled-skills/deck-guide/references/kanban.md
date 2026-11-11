# The personal Kanban

A planner for the person's own tasks, opened by the **Kanban** button in the chat header. It is
separate from the sessions canvas (`deckctl board` / `deckctl card`, agent-run cards): the Kanban
holds what the PERSON wants done, and agents keep it current. Stored in `~/.cockpit/planner.json`
on the box.

## Columns

| Column | Label | Meaning |
|---|---|---|
| `today` | Hoje | being done today |
| `week` | Semana | planned for this week |
| `backlog` | Pendentes | someday / follow-ups |
| `done` | Feito | finished; the board shows the last 7 days |

Each task has a title (max 140 chars), a one-line description, up to 10 links, a difficulty
(1 Fácil, 2 Média, 3 Difícil — a plain label, no points), an optional `ref` (external id such as
`DFL-01498` or `placar:<uuid>`; letters, digits and `: _ . -`, max 80) and an optional `tag`
(short source label such as `DFL`, `Itera`, `Tainan`, `Deck`; max 24). The board can be searched
and filtered by tag. Tasks created by an agent carry a small "agente" label.

## `deckctl task`

Ids accept unambiguous prefixes (the short id shown by `list`). `--link` is repeatable and takes
`URL` or `"URL|label"` (http/https only).

```
deckctl task list [--col today|week|backlog|done] [--all] [--json]
deckctl task add "<title>" [--col today|week|backlog] [--desc D] [--diff 1|2|3] [--ref R] [--tag T] [--link URL]... [--force]
deckctl task move <id> <today|week|backlog|done>
deckctl task done <id> [--link URL]...
deckctl task edit <id> [--title T] [--desc D] [--diff N] [--ref R] [--tag T] [--link URL]... [--clear-links] [--col C]
deckctl task rm <id>
```

- `list` groups by column in board order; `done` shows only the last 7 days unless `--all`.
- `add` defaults to `--col backlog --diff 1`, puts the task at the top of the column and prints
  the new id. It refuses (exit 1, naming the existing id) when a non-done task has the same
  title ignoring case and extra spaces; `--force` overrides. It always refuses a `--ref` that any
  task (done included) already has — edit that task instead.
- `done` moves to Feito and appends links such as the PR; `edit --link` also appends (no
  duplicates), `--clear-links` empties first.

```
deckctl task list --col today
deckctl task add "Fix login redirect" --col today --diff 2 --desc "Loop after OAuth callback"
deckctl task done 3f9a1c2e --link "https://github.com/acme/app/pull/12|PR #12"
deckctl task edit 3f9a1c2e --desc "Blocked: waiting for the staging key"
```

## Agent etiquette

- Starting work beyond a quick answer: `task list`, reuse the matching task or add one in `today`.
  One task per deliverable, title in the person's language, no duplicates.
- Finishing: `task done <id> --link <PR or result URL>`. Unfinished or blocked: leave it out of
  done and say why with `task edit <id> --desc`.
- Follow-ups the person mentions for later go to `week` or `backlog`.
- Never delete or reorder tasks the person created unless asked. Never put secrets in a task.
