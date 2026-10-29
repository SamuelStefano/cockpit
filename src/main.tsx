import './cockpit/enroll-link-boot';
import { capturePromptFromLocation } from './cockpit/prompt-link';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './index.css';
import { CockpitApp } from './App';
import { ChunkErrorBoundary, reloadOnStaleChunk } from './app/ChunkErrorBoundary';
import { parseSharePath } from './lib/share';

const SharedConversationView = lazy(() => import('./components/share/SharedConversationView'));

window.addEventListener('vite:preloadError', (e) => { if (reloadOnStaleChunk()) e.preventDefault(); });

// Public share links render outside the auth gate: no login, no socket.
const sharePath = parseSharePath(window.location.pathname) ? window.location.pathname : null;

capturePromptFromLocation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChunkErrorBoundary>
      {sharePath ? (
        <Suspense fallback={null}>
          <SharedConversationView pathname={sharePath} />
        </Suspense>
      ) : (
        <CockpitApp />
      )}
    </ChunkErrorBoundary>
  </StrictMode>
);
