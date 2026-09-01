import { McpAppDemo } from './ds/McpAppDemo';
import { Section } from './ds/Section';
import { Row } from './ds/Row';
import { PrimitivesGallery } from './ds/PrimitivesGallery';
import { CompositesGallery } from './ds/CompositesGallery';
import { StudioGallery } from './ds/StudioGallery';

export function DesignSystem() {
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-neutral-950 px-8 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header>
          <h2 className="text-[20px] font-semibold text-neutral-100">Design System</h2>
          <p className="mt-1 text-[13px] text-neutral-500">Primitivos do Deck — Button, Input, Badge, Stat, ProgressBar, Tabs, Toast, EmptyState e tokens.</p>
        </header>

        <Section title="MCP App (SEP-1865)">
          <Row label="widget"><div className="w-full"><McpAppDemo /></div></Row>
        </Section>

        <PrimitivesGallery />
        <CompositesGallery />
        <StudioGallery />
      </div>
    </div>
  );
}
