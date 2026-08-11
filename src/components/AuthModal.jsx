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

// mode: 'login' | 'register' | 'forgot'
const AuthModal = ({ open, onClose }) => {
  const { loginWithGoogle, loginWithPassword, registerWithPassword, resetPassword } = useAuth();
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

  const handleGoogle = async () => {
    setError(''); setInfo(''); setBusy(true);
    try {
      const result = await loginWithGoogle();
      // Kalau result undefined berarti sedang redirect ke Google — halaman akan
      // berpindah sendiri, jadi tidak perlu tutup modal atau tampilkan error.
      if (result !== undefined) {
        onClose?.();
      }
      // Kalau redirect: biarkan busy=true, halaman akan reload setelah kembali
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Masukkan email kamu terlebih dahulu.'); return; }
      setBusy(true);
      try {
        await resetPassword(email.trim());
        setInfo('Link reset password sudah dikirim ke email kamu.');
      } catch (err) {
        setError(err.message);
      } finally { setBusy(false); }
      return;
    }

    if (!email.trim() || !password) { setError('Email dan password wajib diisi.'); return; }

    if (mode === 'register') {
      if (!name.trim()) { setError('Nama tampilan wajib diisi.'); return; }
      if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
      if (password !== confirmPassword) { setError('Konfirmasi password tidak sama.'); return; }

      setBusy(true);
      try {
        await registerWithPassword(email.trim(), password, name.trim());
        onClose?.();
      } catch (err) {
        setError(err.message);
      } finally { setBusy(false); }
      return;
    }

    // mode === 'login'
    setBusy(true);
    try {
      await loginWithPassword(email.trim(), password);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const titleMap = {
    login: 'Masuk',
    register: 'Daftar Akun',
    forgot: 'Lupa Password',
  };
  const descMap = {
    login: 'Masuk dengan email & password, atau pakai Google.',
    register: 'Buat akun baru dengan email & password.',
    forgot: 'Masukkan email kamu, kami kirimkan link reset password.',
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titleMap[mode]}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Tutup">×</button>

        <h2 className="auth-google-title">{titleMap[mode]}</h2>
        <p className="auth-google-desc">{descMap[mode]}</p>

        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              type="text"
              className="auth-input"
              placeholder="Nama tampilan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}

          <input
            type="email"
            className="auth-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          {mode !== 'forgot' && (
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          )}

          {mode === 'register' && (
            <input
              type="password"
              className="auth-input"
              placeholder="Konfirmasi password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}

          {mode === 'login' && (
            <button type="button" className="auth-link-btn" onClick={() => { setError(''); setInfo(''); setMode('forgot'); }}>
              Lupa password?
            </button>
          )}

          <button type="submit" className="auth-submit-btn" disabled={busy}>
            {busy
              ? 'Memproses...'
              : mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar' : 'Kirim Link Reset'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <>
            <div className="auth-divider"><span>atau</span></div>
            <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon /> {busy ? 'Mengarahkan ke Google...' : 'Lanjutkan dengan Google'}
            </button>
          </>
        )}

        <p className="auth-switch">
          {mode === 'login' && (
            <>Belum punya akun? <button type="button" onClick={() => { setError(''); setInfo(''); setMode('register'); }}>Daftar</button></>
          )}
          {mode === 'register' && (
            <>Sudah punya akun? <button type="button" onClick={() => { setError(''); setInfo(''); setMode('login'); }}>Masuk</button></>
          )}
          {mode === 'forgot' && (
            <>Ingat password? <button type="button" onClick={() => { setError(''); setInfo(''); setMode('login'); }}>Kembali masuk</button></>
          )}
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
