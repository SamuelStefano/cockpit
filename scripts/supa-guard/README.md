# supa-guard

Deterministic (no LLM) security watchdog for Supabase projects. Every run it snapshots each
`ACTIVE_HEALTHY` project through the Management API (read-only SQL, exposed schemas, security
advisors), diffs against the previous snapshot and raises alerts.

## Watches

New/dropped schemas, new tables in exposed schemas, RLS turned off, new anon/public write grants,
anon SELECT on tables without RLS, open (`true`) write policies for anon/public, anon-executable
SECURITY DEFINER functions, CREATE on a schema for anon/authenticated/public, event trigger
changes, new or escalated roles, new advisor ERROR lints. The first run of a project reports
standing issues instead of a diff. Three failed snapshots in a row raise `guard_blind`.

## Delivery

- Every alert is appended to `~/.cockpit/security-alerts.jsonl` (mode 0600).
- high/critical alerts become ONE Deck card per project per run (`deckctl card add`).
- The same fingerprint is not re-alerted within 24h.
- Names from the database are sanitized (`sanitize.ts`) before reaching cards, jsonl or stdout.

## Install

```
*/5 * * * * cd /home/samuel/cockpit && flock -n /tmp/supa-guard.lock nice -n 10 /usr/bin/npx tsx scripts/supa-guard/guard.mts >> /home/samuel/.cache/supa-guard.log 2>&1 # supa-guard
```

Flags: `--dry-run` (print only, no card, no state write), `--project <ref>`.
Env: `SUPA_GUARD_PROJECTS=ref1,ref2`, `SUPA_GUARD_DIR`, `SUPA_GUARD_ALERTS`.

## State

`~/.cockpit/supa-guard/<ref>.json` (last snapshot) and `state.json` (alerted fingerprints, failure
counters). The token comes from `~/bin/supa-pat` and is only held in memory.
