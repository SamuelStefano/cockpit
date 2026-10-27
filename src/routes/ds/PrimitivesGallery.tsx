import { useState } from 'react';
import { Button, Badge, BrandMark, IconButton, Input, Popover, Switch, ToggleChip, Tooltip, UsageRing, toast } from '../../components/primitives';
import { Section } from './Section';
import { Row } from './Row';

export function PrimitivesGallery() {
  const [pop, setPop] = useState(false);
  return (
    <>
      <Section title="Tooltip, IconButton, Popover, UsageRing">
        <Row label="Tooltip"><Tooltip label="Aparece no hover ou foco"><Button variant="secondary">passe o mouse</Button></Tooltip><Tooltip label="À direita" side="right"><Button variant="secondary">direita</Button></Tooltip></Row>
        <Row label="IconButton"><IconButton icon="plus" label="Nova conversa" /><IconButton icon="search" label="Buscar" tip="Buscar ⌘K" /><IconButton icon="x" label="Fechar" variant="secondary" /></Row>
        <Row label="Popover"><Popover open={pop} onClose={() => setPop(false)} label="Exemplo" side="bottom" content={<p className="w-56 p-3 text-[13px] text-neutral-300">Fecha com Esc ou clique fora.</p>}><Button variant="outline" onClick={() => setPop((o) => !o)}>abrir</Button></Popover></Row>
        <Row label="UsageRing"><Tooltip label="Uso do plano 25%"><span><UsageRing value={25} size={28} label="Uso do plano: 25%" /></span></Tooltip><UsageRing value={75} size={28} /><UsageRing value={95} size={28} /><UsageRing value={null} size={28} /></Row>
      </Section>

      <Section title="Button — variantes">
        <Row label="primary"><Button>Enviar</Button><Button icon="play">Rodar</Button><Button iconRight icon="arrowUp">Próximo</Button></Row>
        <Row label="secondary"><Button variant="secondary">Cancelar</Button><Button variant="secondary" icon="copy">Copiar</Button></Row>
        <Row label="outline"><Button variant="outline" icon="plus">Nova sessão</Button><Button variant="outline">Conectar</Button></Row>
        <Row label="ghost"><Button variant="ghost" icon="pencil">Editar</Button><Button variant="ghost">Ignorar</Button></Row>
        <Row label="danger"><Button variant="danger" icon="trash">Excluir</Button></Row>
      </Section>

      <Section title="Button — tamanhos & estados">
        <Row label="sm"><Button size="sm">Pequeno</Button><Button size="sm" variant="secondary" icon="plus">Novo</Button></Row>
        <Row label="md"><Button size="md">Médio</Button></Row>
        <Row label="square">
          <Button square icon="plus" title="Novo" />
          <Button variant="secondary" square icon="copy" title="Copiar" />
          <Button variant="outline" square icon="terminal" title="Terminal" />
          <Button variant="ghost" square icon="x" title="Fechar" />
          <Button variant="ghost" size="sm" square icon="x" title="Fechar (sm)" />
        </Row>
        <Row label="loading"><Button loading>Salvando</Button><Button variant="secondary" loading>Carregando</Button></Row>
        <Row label="disabled"><Button disabled>Indisponível</Button><Button variant="danger" disabled>Excluir</Button></Row>
      </Section>

      <Section title="Input">
        <Row label="md"><Input placeholder="voce@exemplo.com" /></Row>
        <Row label="sm"><Input size="sm" placeholder="NOME_DO_TOKEN" /></Row>
        <Row label="error"><Input error defaultValue="http://errado" aria-label="URL inválida (exemplo)" /></Row>
        <Row label="mono"><Input mono placeholder="wss://deck.exemplo.com" /></Row>
        <Row label="password"><Input type="password" placeholder="••••••••" /></Row>
        <Row label="icon"><Input icon="search" placeholder="buscar…" /></Row>
        <Row label="suffix"><Input icon="search" mono size="sm" placeholder="buscar nó…" suffix={<span className="font-mono text-[12px] text-orange-300">58</span>} /></Row>
      </Section>

      <Section title="Switch">
        <Row label="on"><div className="w-64"><Switch checked onChange={() => {}} icon="terminal" label="Mostrar ferramentas" hint="Bash, Read, Grep… no chat" /></div></Row>
        <Row label="off"><div className="w-64"><Switch checked={false} onChange={() => {}} icon="sparkles" label="Agrupar notas do agente" /></div></Row>
      </Section>

      <Section title="Button — destrutivo">
        <Row label="danger"><Button variant="danger" icon="trash">remover</Button></Row>
        <Row label="dangerSolid"><Button variant="dangerSolid" icon="trash">Remover token</Button></Row>
      </Section>

      <Section title="ToggleChip">
        <Row label="accent"><ToggleChip on icon="sparkles">skills</ToggleChip></Row>
        <Row label="off"><ToggleChip on={false} icon="command">MCP</ToggleChip></Row>
        <Row label="danger"><ToggleChip on tone="danger" icon="shield-off">bypass</ToggleChip></Row>
      </Section>

      <Section title="BrandMark">
        <Row label="md"><BrandMark title="deck" subtitle="acesso restrito" /></Row>
        <Row label="lg"><BrandMark title="deck" subtitle="o Claude Code da sua VPS" size="lg" /></Row>
        <Row label="connecting"><BrandMark title="conectar sua VPS" bitState="connecting" /></Row>
      </Section>

      <Section title="Badge">
        <Row label="tones">
          <Badge>neutral</Badge>
          <Badge tone="orange">orange</Badge>
          <Badge tone="green" dot>online</Badge>
          <Badge tone="red" dot>erro</Badge>
          <Badge tone="yellow">aviso</Badge>
          <Badge tone="purple">orchestrator</Badge>
        </Row>
        <Row label="clicável">
          <Badge tone="green" dot onClick={() => toast('foco no primeiro item')}>2 rodando</Badge>
        </Row>
      </Section>

      <Section title="Toast">
        <Row label="ok"><Button onClick={() => toast('Notas salvas')}>Disparar ok</Button></Row>
        <Row label="error"><Button variant="danger" onClick={() => toast('Falha ao salvar', { tone: 'error' })}>Disparar erro</Button></Row>
        <Row label="ação">
          <Button variant="secondary" onClick={() => toast('Notas limpas', { action: { label: 'Desfazer', onClick: () => toast('Restaurado') }, durationMs: 8000 })}>
            Com desfazer
          </Button>
        </Row>
      </Section>
    </>
  );
}
