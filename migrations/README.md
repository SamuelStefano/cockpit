# Migrations

Só o **relay** tem migrations versionadas aqui. O banco local do Deck (SQLite,
`server/db.ts` e `server/harness/store.ts`) cria e evolui o schema no boot com
`CREATE TABLE IF NOT EXISTS` + `addColumn()`; não há arquivo a rodar na mão.

## `relay/` — projeto Supabase `deck-relay`

Alvo: o projeto Supabase **dedicado ao relay** (`ikxtdssxmcgipyfpwmar`), NUNCA a
stack do DFL prod. Aplicar em ordem numérica, uma vez cada, pelo SQL Editor do
dashboard (Samuel é o único com acesso ao projeto).

| Arquivo | O que faz |
|---|---|
| `0001_init.sql` | Tabelas `account`, `agent`, `pairing_code`; RLS + policies; trigger de auto-provisionamento no signup; `guard_privileged_columns` (bloqueia `is_admin`/`used_at`/`revoked_at` fora do caminho service-role). |
| `0002_profile.sql` | Perfil (`display_name`, `avatar_url`, `ai_avatar`) na `account` + policy de self-update. Aditivo. |
| `0003_session_prefs.sql` | `pinned_sessions` e `session_tags` na `account`. Aditivo. |

Todo arquivo é idempotente (`if not exists` / `create or replace` / `drop trigger
if exists`), então rerodar é seguro — é assim que se confere o estado, já que não
existe tabela de controle de versão nem CLI de migration neste repo.

Conferir se está tudo aplicado:

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'account';
-- 0001: id, email, is_admin, created_at   0002: display_name, avatar_url, ai_avatar
-- 0003: pinned_sessions, session_tags
```

Migration nova: numerar em sequência, manter aditiva (o relay em produção fala com
o schema antigo até o deploy seguinte) e acrescentar a linha na tabela acima.
