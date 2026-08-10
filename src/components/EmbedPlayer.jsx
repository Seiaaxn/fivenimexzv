import { useState, useRef, useCallback } from 'react';

const EmbedPlayer = ({ src, title, onLoad }) => {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef(null);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const toggleFullscreen = () => {
    const el = iframeRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
    }
  };

  const reloadIframe = () => {
    setLoaded(false);
    const el = iframeRef.current;
    if (el) el.src = src;
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#000',
        borderRadius: 'inherit',
        overflow: 'hidden',
      }}
    >
      {!loaded && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#0a0a0f', gap: '12px',
          }}
        >
          <div
            style={{
              width: '44px', height: '44px',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Memuat player...
          </p>
        </div>
      )}

      {/* Iframe — no sandbox (some servers like vidhide reject sandboxed iframes).
          referrerpolicy keeps our URL out of upstream logs. */}
      <iframe
        ref={iframeRef}
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer"
        title={title}
        onLoad={handleLoad}
        style={{
          width: '100%', height: '100%',
          border: 'none',
          opacity: loaded? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Top-right control buttons — always visible */}
      {loaded && (
        <div
          style={{
            position: 'absolute', top: '6px', right: '6px',
            display: 'flex', gap: '4px',
            zIndex: 3,
          }}
        >
          <ControlBtn text="Reload" label="Reload" onClick={reloadIframe} />
          <ControlBtn text="Full" label="Fullscreen" onClick={toggleFullscreen} />
        </div>
      )}
    </div>
  );
};

const ControlBtn = ({ text, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    style={{
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '6px',
      color: '#fff',
      padding: '6px 10px',
      minHeight: '32px',
      fontSize: '0.8rem',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '4px',
      backdropFilter: 'blur(4px)',
      transition: 'background 0.15s ease, transform 0.15s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}
    onFocus={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }}
    onBlur={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}
  >
    <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}>{text}</span>
  </button>
);

export default EmbedPlayer;
