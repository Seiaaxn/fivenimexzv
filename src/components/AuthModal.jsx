import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.5-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3c-7.4 0-13.8 4.1-17.7 10.2z" />
    <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 36.4 26.9 37.5 24 37.5c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 40.6 16.4 45 24 45z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.6 5.4C41.5 35.9 45 30.5 45 24c0-1.4-.1-2.5-.4-3.5z" />
  </svg>
);

const AuthModal = ({ open, onClose }) => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setError('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleGoogle = async () => {
    setError(''); setBusy(true);
    try {
      await loginWithGoogle();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Masuk">
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Tutup">×</button>

        <h2 className="auth-google-title">Masuk</h2>
        <p className="auth-google-desc">Masuk dengan akun Google kamu untuk melanjutkan.</p>

        {error && <p className="auth-error">{error}</p>}

        <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={busy}>
          <GoogleIcon /> {busy ? 'Memproses...' : 'Lanjutkan dengan Google'}
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
