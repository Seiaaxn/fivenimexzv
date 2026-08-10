import { useState, useEffect } from 'react';

/**
 * PWA Install Banner — shows on mobile when app is not installed.
 * Captures the beforeinstallprompt event and shows a custom banner.
 */
const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem('pwa_banner_dismissed')) return;

    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show banner after 5s delay
      setTimeout(() => setShow(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', '1');
  };

  if (!show || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 998,
      padding: '12px 16px',
      background: 'var(--color-surface)',
      borderTop: '2px solid var(--color-primary)',
      boxShadow: '0 -4px 20px rgba(147, 51, 234, 0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'fadeInUp 0.4s ease-out',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Logo */}
      <img
        src="/icon-192.png"
        alt="FiveNime"
        style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }}
      />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '2px' }}>
          Install FiveNime
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
          Akses lebih cepat, nonton tanpa buka browser
        </div>
      </div>

      {/* Install button */}
      <button
        onClick={handleInstall}
        style={{
          padding: '8px 16px',
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '0.75rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Install
      </button>

      {/* Close */}
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-dim)',
          fontSize: '1.1rem',
          cursor: 'pointer',
          padding: '4px',
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Tutup"
      >
        ✕
      </button>
    </div>
  );
};

export default InstallBanner;
