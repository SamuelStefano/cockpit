import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { CockpitApp } from './App';
import { ChunkErrorBoundary, reloadOnStaleChunk } from './app/ChunkErrorBoundary';

window.addEventListener('vite:preloadError', (e) => { if (reloadOnStaleChunk()) e.preventDefault(); });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChunkErrorBoundary>
      <CockpitApp />
    </ChunkErrorBoundary>
  </StrictMode>
);
