'use client';
import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[SW] Registered:', reg.scope);

            // Check for updates every 60 seconds
            setInterval(() => reg.update(), 60000);

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              newWorker?.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New version available — reload to update');
                }
              });
            });
          })
          .catch((err) => console.warn('[SW] Registration failed:', err));
      });
    }
  }, []);

  return null; // no UI
}
