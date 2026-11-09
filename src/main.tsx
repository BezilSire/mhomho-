import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the PWA service worker in production. The worker caches the app
// shell and static assets, but never API responses or the admin console.
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works online if registration is blocked.
    });
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error('Error mounting Mhomho App:', err);
    // Build the fallback with DOM APIs. Never interpolate an exception message
    // into innerHTML: thrown values can contain attacker-controlled text.
    rootEl.textContent = '';
    const panel = document.createElement('div');
    panel.style.cssText =
      'padding: 24px; color: white; background: #0B0A09; font-family: sans-serif;';

    const heading = document.createElement('h2');
    heading.textContent = 'Loading Application...';

    const detail = document.createElement('p');
    detail.textContent = `Error mounting app: ${String(err)}`;

    const reload = document.createElement('button');
    reload.textContent = 'Reload';
    reload.type = 'button';
    reload.style.cssText =
      'padding: 8px 16px; background: #FF9F0A; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;';
    reload.addEventListener('click', () => window.location.reload());

    panel.append(heading, detail, reload);
    rootEl.append(panel);
  }
}
