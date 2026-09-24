# Migrations

Só o **relay** tem migrations versionadas aqui. O banco local do Deck (SQLite,
`server/db.ts` e `server/harness/store.ts`) cria e evolui o schema no boot com
`CREATE TABLE IF NOT EXISTS` + `ensureColumn()`; não há arquivo a rodar na mão.

## `relay/` — projeto Supabase `deck-relay`

Alvo: o projeto Supabase **dedicado ao relay** (`ikxtdssxmcgipyfpwmar`), NUNCA a
stack do DFL prod. Aplicar em ordem numérica, uma vez cada, pelo SQL Editor do
dashboard (Samuel é o único com acesso ao projeto).

| Arquivo | O que faz |
|---|---|
| `0001_init.sql` | Tabelas `account`, `agent`, `pairing_code`; RLS + policies; trigger de auto-provisionamento no signup; `guard_privileged_columns` (bloqueia `is_admin`/`used_at` fora do caminho service-role). **Não existe guarda de `revoked_at`**: a tabela `agent` não tem trigger, e a policy `agent_self_all` deixa o dono alterar qualquer coluna das próprias linhas (achado F-033 da auditoria). |
| `0002_profile.sql` | Perfil (`display_name`, `avatar_url`, `ai_avatar`) na `account` + policy de self-update. Aditivo. |
| `0003_session_prefs.sql` | `pinned_sessions` e `session_tags` na `account`. Aditivo. |
| `0004_account_prefs.sql` | `prefs jsonb` na `account` (modo, modelo, esforço, toggles de UI), com teto de 16 KB e checagem de objeto. Aditivo. **Ainda não aplicado.** |

Cada arquivo é idempotente sozinho (`if not exists` / `create or replace` / `drop
trigger if exists`), mas **rerodar um arquivo antigo depois de um mais novo não é
seguro**: `0001_init.sql` recria `guard_privileged_columns` com o corpo antigo e
apaga a guarda de `email` que a `0002` adicionou, enquanto a policy de self-update da
`0002` continua valendo. Rerode só o arquivo mais recente, ou todos em ordem. Não
existe tabela de controle de versão nem CLI de migration neste repo.

Conferir se está tudo aplicado:

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'account';
-- 0001: id, email, is_admin, created_at   0002: display_name, avatar_url, ai_avatar
-- 0003: pinned_sessions, session_tags   0004: prefs
```

Migration nova: numerar em sequência, manter aditiva (o relay em produção fala com
o schema antigo até o deploy seguinte) e acrescentar a linha na tabela acima.
