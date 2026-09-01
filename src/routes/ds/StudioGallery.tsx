import { LivePreview, Icon } from '../../components/primitives';
import { ThemePlayground } from './ThemePlayground';
import { Section } from './Section';
import { DEMO_PREVIEW, DEMO_PREVIEW_NATIVE, DEMO_PREVIEW_SVG, DEMO_PREVIEW_TEST } from './demo-sources';

export function StudioGallery() {
  return (
    <>
      <Section title="Theme playground — acento ao vivo">
        <p className="mb-3 text-[12px] text-neutral-600">
          Ajuste matiz, saturação, raio e densidade e veja os tokens (<code className="text-orange-300">--accent</code>,{' '}
          <code className="text-orange-300">--ring</code>) mudarem no app inteiro em tempo real. Sai da rota → restaura o tema.
        </p>
        <ThemePlayground />
      </Section>

      <Section title="Studio — código editável ao vivo">
        <p className="mb-3 text-[12px] text-neutral-600">
          Bloco <code className="text-orange-300">```preview</code> (React/TSX) ou{' '}
          <code className="text-orange-300">```preview-html</code> vira tela viva num iframe sandbox. Abra a aba{' '}
          <span className="text-orange-300">código</span> e <strong className="text-neutral-400">digite</strong> — a tela
          re-renderiza ao vivo. Barra: switcher de <span className="text-orange-300">viewport</span> (desktop/tablet/mobile),{' '}
          <span className="text-orange-300">console</span> capturado do sandbox, <span className="text-orange-300">tela cheia</span>{' '}
          (studio split editor↔preview) e copiar/baixar o código.
        </p>
        <LivePreview lang="preview" code={DEMO_PREVIEW} />
      </Section>

      <Section title="Studio nativo — iPhone editável (react-native-web)">
        <p className="mb-3 text-[12px] text-neutral-600">
          Bloco <code className="text-orange-300">```preview-native</code> roda react-native de verdade
          (View, Text, Pressable, StyleSheet) via react-native-web numa moldura de iPhone — sem macOS. Também editável ao
          vivo: digite na aba código e veja o app mudar na tela do telefone.
        </p>
        <LivePreview lang="preview-native" code={DEMO_PREVIEW_NATIVE} />
      </Section>

      <Section title="Studio SVG — vetor animado editável">
        <p className="mb-3 text-[12px] text-neutral-600">
          Bloco <code className="text-orange-300">```preview-svg</code> renderiza SVG cru (com <code className="text-orange-300">&lt;animate&gt;</code>,
          SMIL ou CSS) centralizado sobre um xadrez de transparência. Edite os atributos e veja a animação mudar na hora.
        </p>
        <LivePreview lang="preview-svg" code={DEMO_PREVIEW_SVG} />
      </Section>

      <Section title="Juiz de código — testes verde/vermelho no sandbox">
        <p className="mb-3 text-[12px] text-neutral-600">
          Bloco <code className="text-orange-300">```preview-test</code> roda <code className="text-orange-300">test()</code> +{' '}
          <code className="text-orange-300">expect()</code> (globais) dentro do sandbox e mostra cada asserção passando ou falhando,
          com resumo <span className="text-neutral-400">N/N</span>. O terceiro test abaixo falha de propósito.
        </p>
        <LivePreview lang="preview-test" code={DEMO_PREVIEW_TEST} />
      </Section>

      <Section title="Playground — bancada completa em /play">
        <p className="text-[12px] text-neutral-600">
          Uma página inteira (<code className="text-orange-300">/play</code>) com editor ↔ preview lado a lado, seletor de linguagem
          (React, HTML, iPhone, SVG, testes), templates prontos, switcher de dispositivo e console — construída com estes mesmos primitivos.
          O botão <Icon name="link" size={11} className="inline text-orange-300" /> gera um <strong className="text-neutral-400">link compartilhável</strong>:
          serializa linguagem + código no hash da URL (base64url, client-side) — abrir o link recria o sandbox vivo.
        </p>
        <a href="/play" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-1.5 text-[12px] font-medium text-orange-300 transition hover:bg-orange-500/25">
          abrir playground →
        </a>
      </Section>
    </>
  );
}
