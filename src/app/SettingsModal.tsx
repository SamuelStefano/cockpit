import { Suspense, type ComponentProps } from 'react';
import { Modal } from '../components/primitives';
import { Configuracoes } from './lazyRoutes';
import { RouteFallback } from './RouteFallback';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';
import { requestTerminal } from '../lib/terminal-request';
import { navigateTo } from '../lib/route-nav';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { sectionOf, settingsSections } from '../routes/configuracoes/sections';

type SettingsProps = Omit<ComponentProps<typeof Configuracoes>, 'onOpenTerminal'>;

export function SettingsModal({ open, onClose, ...props }: SettingsProps & { open: boolean; onClose: () => void }) {
  const label = settingsSections(props.role, SUPABASE_ENABLED).find((s) => s.id === sectionOf(props.route))?.label;
  return (
    <Modal open={open} onClose={onClose} fill maxWidth="max-w-[980px]" icon="sliders" label="Configurações"
      title={label ? `Configurações · ${label}` : 'Configurações'}>
      <ChunkErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Configuracoes {...props} onOpenTerminal={() => { requestTerminal(); navigateTo('/'); }} />
        </Suspense>
      </ChunkErrorBoundary>
    </Modal>
  );
}
