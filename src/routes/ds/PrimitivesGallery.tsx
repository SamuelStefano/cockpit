import { Button, Badge, BrandMark, Input, Switch, ToggleChip, toast } from '../../components/primitives';
import { Section } from './Section';
import { Row } from './Row';

export function PrimitivesGallery() {
  return (
    <>
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
        <Row label="error"><Input error defaultValue="http://errado" /></Row>
        <Row label="mono"><Input mono placeholder="wss://deck.exemplo.com" /></Row>
        <Row label="password"><Input type="password" placeholder="••••••••" /></Row>
        <Row label="icon"><Input icon="search" placeholder="buscar…" /></Row>
        <Row label="suffix"><Input icon="search" mono size="sm" placeholder="buscar nó…" suffix={<span className="font-mono text-[10.5px] text-orange-300">58</span>} /></Row>
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
      </Section>

      <Section title="Badge">
        <Row label="tones">
          <Badge>neutral</Badge>
          <Badge tone="orange">orange</Badge>
          <Badge tone="green" dot>online</Badge>
          <Badge tone="red" dot>erro</Badge>
          <Badge tone="yellow">aviso</Badge>
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
