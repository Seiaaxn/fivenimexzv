/**
 * Overlay shown when switching server/quality in Watch page.
 * Shows a spinner + message over the video player area.
 */
const WatchLoading = ({ message = 'Mengganti server...', serverName }) => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(10, 10, 15, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      zIndex: 10,
      borderRadius: 'inherit',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      {/* Spinner */}
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />

      {/* Message */}
      <div style={{ textAlign: 'center' }}>
        <p style={{
          color: 'var(--color-text)',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          marginBottom: '4px',
        }}>
          {message}
        </p>
        {serverName && (
          <p style={{
            color: 'var(--color-primary)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
          }}>
            → {serverName}
          </p>
        )}
      </div>

      {/* Progress bar animation */}
      <div style={{
        width: '120px',
        height: '3px',
        background: 'var(--color-border)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '4px',
      }}>
        <div style={{
          height: '100%',
          background: 'var(--color-primary)',
          borderRadius: '4px',
          animation: 'shimmer 1.2s ease-in-out infinite',
          width: '60%',
        }} />
      </div>
    </div>
  );
};

export default WatchLoading;
