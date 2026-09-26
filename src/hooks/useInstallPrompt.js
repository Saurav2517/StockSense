import { useCallback, useEffect, useState } from 'react';

/** Captures the browser's PWA install prompt so the app can offer "Install". */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === 'accepted';
  }, [deferred]);

  return { canInstall: Boolean(deferred), installed, install };
}
