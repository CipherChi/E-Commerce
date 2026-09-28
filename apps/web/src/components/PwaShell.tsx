'use client';

import { useEffect, useState } from 'react';

export function PwaShell() {
  const [install, setInstall] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event);
    };
    let hadController = Boolean(navigator.serviceWorker?.controller);
    const onControllerChange = () => {
      if (hadController) window.location.reload();
      hadController = true;
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (registration.waiting) setUpdate(registration);
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdate(registration);
              }
            });
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  return (
    <>
      <div aria-live="polite" className="fixed left-3 right-3 top-3 z-50 flex flex-col items-center gap-2">
        {!online && (
          <p className="rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-950 shadow">
            You’re offline — some features may not work.
          </p>
        )}
        {update && (
          <button
            className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow"
            onClick={() => {
              update.waiting?.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }}
          >
            An update is ready · Refresh
          </button>
        )}
      </div>
      {install && (
        <button
          onClick={async () => {
            await install.prompt();
            setInstall(null);
          }}
          className="fixed bottom-20 right-4 z-40 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg sm:bottom-5"
        >
          Install app
        </button>
      )}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] text-center text-[10px] sm:hidden"
      >
        {[
          ['/', 'Home'],
          ['/sales', 'Sales'],
          ['/products', 'Products'],
          ['/inventory', 'Stock'],
          ['/expenses', 'Expenses'],
          ['/receipts', 'Receipts'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="px-1 py-3 text-ink/75">
            {label}
          </a>
        ))}
      </nav>
    </>
  );
}
