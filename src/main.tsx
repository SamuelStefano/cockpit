import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './index.css';
import { parseSharePath } from './lib/share';

const root = createRoot(document.getElementById('root')!);

// Public share links skip the authenticated app entirely: no enroll capture, no
// auth gate, no socket. The view only fetches a public storage object.
if (parseSharePath(window.location.pathname)) {
  const SharedConversationView = lazy(() => import('./components/share/SharedConversationView'));
  root.render(
    <StrictMode>
      <Suspense fallback={null}>
        <SharedConversationView pathname={window.location.pathname} />
      </Suspense>
    </StrictMode>
  );
} else {
  // Enroll capture must run before App's modules read location.
  void import('./cockpit/enroll-link-boot').then(() => Promise.all([import('./App'), import('./app/ChunkErrorBoundary')])).then(
    ([{ CockpitApp }, { ChunkErrorBoundary, reloadOnStaleChunk }]) => {
      window.addEventListener('vite:preloadError', (e) => { if (reloadOnStaleChunk()) e.preventDefault(); });
      root.render(
        <StrictMode>
          <ChunkErrorBoundary>
            <CockpitApp />
          </ChunkErrorBoundary>
        </StrictMode>
      );
    },
  );
}
