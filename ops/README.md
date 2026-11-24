# deck-ops

Painel admin do dono do Deck, separado do Deck e do relay: lê os relatórios de
diagnóstico (`public.diag_reports`, migration relay 0008), mostra todas as boxes
(`public.agent`) e avisa no Telegram quando chega relatório novo. HTML renderizado no
servidor, sem JavaScript no browser, sem dependência de runtime (Node 22 com type
stripping).

Produção: Dokploy (DFL), `https://ops.178-105-2-230.sslip.io`, imagem `Dockerfile.ops`
na raiz do repo, volume montado em `/data`.

## Variáveis de ambiente

| Variável | Obrigatória | O que é |
|---|---|---|
| `SUPABASE_URL` | sim | `https://ikxtdssxmcgipyfpwmar.supabase.co` (projeto `deck-relay`) |
| `SUPABASE_ANON_KEY` | sim | chave anon do `deck-relay`; só o servidor usa, para o login por senha |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | service role do `deck-relay`; lê relatórios, boxes e emails. Nunca sai do servidor |
| `ADMIN_USER_IDS` | sim | uuids de `auth.users` que podem entrar, separados por vírgula |
| `SESSION_SECRET` | sim | ≥ 32 caracteres aleatórios (`openssl rand -base64 48`); trocar derruba todas as sessões |
| `PUBLIC_URL` | sim | `https://ops.178-105-2-230.sslip.io`; origem aceita nos POST e base do link no Telegram |
| `TELEGRAM_BOT_TOKEN` | não | bot que manda os avisos; sem ele (ou sem o chat) os avisos ficam desligados |
| `TELEGRAM_CHAT_ID` | não | chat que recebe os avisos |
| `RELAY_STATUS_URL` | não | default `https://deck-relay.devfellowship.com/status` |
| `RELAY_STATUS_TOKEN` | não | o `DECK_STATUS_TOKEN` do relay; com ele a saúde mostra boxes online e abas |
| `PORT` | não | default `3000` |
| `CURSOR_FILE` | não | default `/data/alert-cursor.json` |

## Segurança

- Login com email e senha do Deck: o servidor chama o password grant do Supabase com a
  chave anon, confere o id do usuário contra `ADMIN_USER_IDS` e revoga na hora a sessão
  Supabase que ganhou. A sessão do painel é um cookie `__Host-` HttpOnly, Secure,
  SameSite=Strict, assinado com HMAC, válido por 8 h. Tirar um id da lista derruba a
  sessão dele no próximo request.
- Login limitado a 5 tentativas por IP e 30 no total a cada 15 min; mensagem de erro
  única. POST só com `Origin` (ou `Referer`) igual a `PUBLIC_URL`.
- CSP sem script, `frame-ancestors 'none'`, HSTS, nosniff, `no-referrer`. Todo valor do
  banco é escapado: o payload é escrito pelo usuário.
- `/healthz` é o único caminho sem login e responde só `ok`.

## Avisos no Telegram

A cada 2 min lê os relatórios criados depois do cursor salvo em `CURSOR_FILE`. No
primeiro boot o cursor começa em agora (nada antigo é enviado). No máximo um aviso por
conta + tipo a cada 15 min e 20 avisos por hora; o que fica de fora entra como
"+N agrupados" no próximo aviso daquele grupo. Texto puro, sem `parse_mode`.

## Rodar local

```sh
cd ops && SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
  ADMIN_USER_IDS=… SESSION_SECRET=… PUBLIC_URL=http://localhost:3000 CURSOR_FILE=./cursor.json npm start
```

Testes: `npx vitest run ops/src` na raiz. Tipos: `npm run typecheck:ops`.
