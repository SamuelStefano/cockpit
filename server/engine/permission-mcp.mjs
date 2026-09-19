#!/usr/bin/env node
// Permission-prompt tool for `claude -p`. It exists so the CLI enables
// AskUserQuestion: in headless mode the tool's isEnabled() is
// `!isInteractive() && permissionPromptToolName() in (undefined, 'none') -> false`,
// so without --permission-prompt-tool the tool is never registered and the model
// cannot emit it at all. Pointing the flag at a name with no server behind it
// also unlocks it, but every permission request then fails with an "MCP tool not
// found" protocol error instead of a readable denial.
//
// The answer is always deny: the Deck's real gate is --allowedTools, and a
// request reaching here is by definition a tool outside it. Allowing anything
// would turn this process into a bypass of that allow-list.
//
// Zero dependencies and no imports on purpose: it is spawned once per turn, so
// loading the MCP SDK would cost memory the box does not have.

const DENY = 'Negado: tool fora da allow-list do Deck. Peça ao Samuel pra liberar.';
// AskUserQuestion always lands here — the allow-list does not auto-approve it, the
// CLI routes every question through the permission tool. The Deck answers it out of
// band: translate.ts sees the tool_use, ends the turn and renders the card, and the
// choice comes back as the next user message. Say so, in case the kill loses the
// race and the model reads this result.
const ASK_DENY = 'A pergunta foi entregue ao usuário como card no Deck. A resposta dele chega como a próxima mensagem — encerre o turno aqui, sem reformular nem seguir com suposição.';

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

const TOOL = {
  name: 'prompt',
  description: 'Deck permission gate. Always denies: the allow-list is decided before the run starts.',
  inputSchema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string' },
      input: { type: 'object' },
      tool_use_id: { type: 'string' },
    },
    required: ['tool_name', 'input'],
  },
};

function onMessage(msg) {
  if (typeof msg.id === 'undefined') return;
  switch (msg.method) {
    case 'initialize':
      return reply(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'deck-permission', version: '1.0.0' },
      });
    case 'tools/list':
      return reply(msg.id, { tools: [TOOL] });
    case 'tools/call': {
      const asked = msg.params?.arguments?.tool_name === 'AskUserQuestion';
      return reply(msg.id, {
        content: [{ type: 'text', text: JSON.stringify({ behavior: 'deny', message: asked ? ASK_DENY : DENY }) }],
      });
    }
    default:
      return reply(msg.id, {});
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { onMessage(JSON.parse(line)); } catch { /* a malformed frame must not kill the gate */ }
  }
});
process.stdin.on('end', () => process.exit(0));
