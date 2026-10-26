import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely clear any legacy service worker in background without blocking rendering
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name).catch(() => {});
      }
    }).catch(() => {});
  }
} catch {
  // Ignore any security or sandbox access exceptions in iframes
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
