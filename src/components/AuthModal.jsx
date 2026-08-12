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

// Mode: 'login' | 'register' | 'forgot'
const AuthModal = ({ open, onClose }) => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setError('');
      setInfo('');
      setMode('login');
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  // ─── Google ──────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError(''); setBusy(true);
    try {
      await loginWithGoogle();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  // ─── Login email/password ────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Isi email dan password.'); return; }
    setError(''); setBusy(true);
    try {
      await loginWithEmail(email.trim(), password);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  // ─── Daftar ──────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!name.trim()) { setError('Isi nama kamu.'); return; }
    if (!email.trim()) { setError('Isi email.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    if (password !== confirmPassword) { setError('Konfirmasi password tidak cocok.'); return; }
    setError(''); setBusy(true);
    try {
      await registerWithEmail(name.trim(), email.trim(), password);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  // ─── Lupa password ───────────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (!email.trim()) { setError('Isi email kamu.'); return; }
    setError(''); setInfo(''); setBusy(true);
    try {
      await resetPassword(email.trim());
      setInfo('Link reset password sudah dikirim ke email kamu.');
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const title = mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar' : 'Reset Password';

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Tutup">×</button>

        <h2 className="auth-google-title">{title}</h2>

        {error && <p className="auth-error">{error}</p>}
        {info  && <p className="auth-info">{info}</p>}

        {/* ── FORM ── */}
        <div className="auth-form">

          {/* Nama — hanya di mode register */}
          {mode === 'register' && (
            <input
              className="auth-input"
              type="text"
              placeholder="Nama Pengguna"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="name"
            />
          )}

          {/* Email — semua mode */}
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          {/* Password — login + register */}
          {mode !== 'forgot' && (
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          )}

          {/* Konfirmasi password — register saja */}
          {mode === 'register' && (
            <input
              className="auth-input"
              type="password"
              placeholder="Konfirmasi Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}

          {/* Lupa password link — hanya di login */}
          {mode === 'login' && (
            <button type="button" className="auth-link-btn" onClick={() => switchMode('forgot')}>
              Lupa password?
            </button>
          )}

          {/* Tombol aksi utama */}
          {mode === 'login' && (
            <button type="button" className="auth-submit-btn" onClick={handleLogin} disabled={busy}>
              {busy ? 'Memproses...' : 'Masuk'}
            </button>
          )}
          {mode === 'register' && (
            <button type="button" className="auth-submit-btn" onClick={handleRegister} disabled={busy}>
              {busy ? 'Mendaftar...' : 'Daftar'}
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="auth-submit-btn" onClick={handleForgot} disabled={busy}>
              {busy ? 'Mengirim...' : 'Kirim Link Reset'}
            </button>
          )}
        </div>

        {/* Divider Google — hanya login & register */}
        {mode !== 'forgot' && (
          <>
            <div className="auth-divider"><span>atau</span></div>
            <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon /> {busy ? 'Memproses...' : 'Lanjutkan dengan Google'}
            </button>
          </>
        )}

        {/* Switch mode */}
        <p className="auth-switch">
          {mode === 'login' && (
            <>Belum punya akun?<button type="button" onClick={() => switchMode('register')}>Daftar</button></>
          )}
          {mode === 'register' && (
            <>Sudah punya akun?<button type="button" onClick={() => switchMode('login')}>Masuk</button></>
          )}
          {mode === 'forgot' && (
            <>Ingat password?<button type="button" onClick={() => switchMode('login')}>Masuk</button></>
          )}
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
