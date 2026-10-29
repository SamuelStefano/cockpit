---
name: deck-panel
description: Visual summary in the Deck chat — what was done, what is in progress, what is pending and what is blocked — as a ```deck-panel``` block (columns of cards; clicking a card opens a modal). Use when someone asks for a summary of the day, "what was done and what is left", "give me everything", "panel", "/panel", or says there were too many tasks to follow. Skip for a single task's status.
---

# Deck panel

Output is **one** ` ```deck-panel ` fence with JSON. The Deck draws columns and cards; a click opens a modal.
No long text outside the block: at most one line before it and one line after it (what needs the person).
Write the card text in the language the person writes in.

## 1. Collect facts, never memory

```bash
deckctl sessions --limit 40     # today's sessions (filter by today's date)
deckctl pending                 # questions waiting for the person → Blocked
deckctl board                   # kanban cards
gh search prs --author @me --updated ">=$(date -u +%F)" --json title,url,state,repository --limit 30
```

Unclear session? `deckctl read <id> --chars 1500` (tail only). Skip this session itself and empty ones.
No `deckctl`/`gh` on the box? Use what is available and say what was missing.

## 2. Classify

| Column | tone | Goes in |
|---|---|---|
| Done | `green` | merged PR, confirmed delivery, session finished with a result |
| In progress | `orange` | running session, open PR with no blocker |
| Pending | `yellow` | left for later, a step is missing |
| Blocked | `red` | needs the person's OK/answer, error with no way out |

Same subject across several sessions = one card. Empty column is fine (shows "—").

## 3. Format

```deck-panel
{
  "title": "Today · Oct 29",
  "subtitle": "12 sessions",
  "columns": [
    { "label": "Done", "tone": "green", "items": [
      { "title": "Google login", "tag": "app · PR #12",
        "detail": "What changed, in 1–3 sentences.", "link": "https://github.com/..." },
      "A plain string also works"
    ]},
    { "label": "Blocked", "tone": "red", "items": [
      { "title": "Production deploy", "detail": "Needs your OK: ..." }
    ]}
  ]
}
```

- Card `title`: up to 6 words, no jargon. `tag`: project · PR/session.
- `detail`: shown only in the modal — what happened or what is missing, and what is needed.
- `link`: real http(s) URLs only (PR, deploy). Never invent one.
- Valid JSON, no comments. Tones: green, orange, yellow, red, neutral, purple.
