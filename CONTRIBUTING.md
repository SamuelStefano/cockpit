# Contribuindo com o Deck

Guia para quem tem acesso de escrita no repositório. Convenções de código estão em
[`CLAUDE.md`](./CLAUDE.md); aqui está o que é regra de projeto, não de estilo.

## Ambiente

```bash
npm ci
npm run dev            # front (Vite) + backend (:7777, loopback)
npm test               # vitest
npm run build          # tsc dos 4 projetos + vite build
npm run scan:secrets   # varredura de segredo (roda depois do build)
```

Backend escuta **apenas** em `127.0.0.1`. Se você precisou trocar isso para testar
algo, você está resolvendo o problema errado — use túnel, não bind aberto.

## Fluxo

1. Branch a partir da `main` atualizada: `feat/`, `fix/` ou `chore/`.
2. Um assunto por branch.
3. Commit `tipo: descrição` em português, sem corpo e sem rodapé de autoria.
4. PR por tarefa. O CI precisa passar: build, testes, smoke e varredura de segredo.
5. Caminhos listados em [`CODEOWNERS`](./CODEOWNERS) exigem revisão do dono.

Nunca commitar direto na `main`.

## Linhas invioláveis

Estas não são preferências. Cada uma protege contra uma classe inteira de falha, e
algumas têm teste automatizado que quebra o CI se forem violadas.

**1. O relay nunca executa nada.**
Ele roteia mensagens. Não importa `child_process`, não abre banco de aplicação, não
interpreta o conteúdo que transporta. `relay/boundary.test.ts` falha se alguém
importar biblioteca de execução ali dentro. Se uma funcionalidade parece exigir que o
relay execute algo, ela vai no agente.

**2. A identidade da conta é derivada no servidor.**
`accountId` sai do JWT verificado ou do par de chaves do agente. Nunca de campo do
frame. Aceitar identidade vinda do cliente é o bug que deixa a conta A ler a conta B.

**3. Roteamento é por conta, nunca em difusão global.**
Frame vai para os sockets daquela conta. Se você escreveu um laço sobre todos os
clientes, pare.

**4. Negação por padrão nas permissões.**
Papel não privilegiado tem lista explícita do que pode. O que não está na lista é
negado. Ao adicionar tipo de mensagem novo, ele começa negado — decida
conscientemente se entra na lista.

**5. Segredo nunca vai para o cliente.**
`VITE_*` é embutido no JavaScript que o navegador baixa. Token, chave de serviço e
chave privada só existem em `process.env` do lado servidor. Isto já causou um
incidente real; a varredura do CI existe por causa dele.

**6. Chave privada de agente não transita.**
Ela nasce na máquina do usuário e morre lá. Nenhum código pode enviá-la para o relay,
para log ou para telemetria.

**7. Vazou, rotaciona.**
Apagar a linha do código não invalida a credencial exposta. Rotacione primeiro,
corrija o código depois.

## Testes

- Teste ao lado do arquivo testado (`x.ts` + `x.test.ts`), nunca em `__tests__/`.
- Lógica nova sem teste não entra. Correção de bug entra com o teste que reproduz o bug.
- Testes não acessam rede externa nem o `$HOME` real (ver `vitest.setup.ts`).

## Migrations

Alteração em `migrations/` mexe em RLS e em guard de coluna. Toda tabela nova de
schema exposto nasce com RLS habilitado e política explícita. Coluna privilegiada
(papel, consumo de código de pareamento) só é escrita por `service_role`.

## Operação

Como reiniciar, como fazer deploy e o que checar quando "o Deck caiu" estão em
[`docs/RUNBOOK.md`](./docs/RUNBOOK.md).
