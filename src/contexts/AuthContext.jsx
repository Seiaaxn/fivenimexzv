import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile as updateAuthProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { resizeImageToDataUrl } from '../utils/image';

const AuthContext = createContext(null);

const mapAuthError = (err) => {
  const code = err?.code || '';
  const map = {
    'auth/popup-closed-by-user': 'Popup login ditutup sebelum selesai.',
    'auth/network-request-failed': 'Koneksi bermasalah, coba lagi.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
    'auth/email-already-in-use': 'Email sudah terdaftar. Silakan login.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/weak-password': 'Password minimal 6 karakter.',
    'auth/user-not-found': 'Email tidak terdaftar.',
    'auth/wrong-password': 'Password salah.',
    'auth/invalid-credential': 'Email atau password salah.',
  };
  return map[code] || err?.message || 'Terjadi kesalahan. Coba lagi.';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Track auth state (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Live-sync profil Firestore user yang sedang login.
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      setProfile(null);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [user]);

  /**
   * Buat dokumen user di Firestore jika belum ada.
   * PENTING: field `role` HARUS disertakan saat create agar sesuai firestore.rules.
   */
  const ensureUserDoc = useCallback(async (u, extra = {}) => {
    const userRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: u.displayName || extra.displayName || 'Pengguna',
        photoURL: u.photoURL || '',
        email: u.email || '',
        role: 'user',      // ← WAJIB ada sesuai firestore.rules allow create
        level: 1,
        exp: 0,
        createdAt: serverTimestamp(),
      });
    }
  }, []);

  // ─── LOGIN GOOGLE ────────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(res.user);
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  // ─── DAFTAR EMAIL/PASSWORD ───────────────────────────────────────────────────
  const registerWithEmail = useCallback(async (displayName, email, password) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      // Set displayName di Firebase Auth
      await updateAuthProfile(res.user, { displayName: displayName.trim() || 'Pengguna' });
      // Buat dokumen Firestore (dengan role: 'user' agar rules tidak tolak)
      await ensureUserDoc({ ...res.user, displayName: displayName.trim() || 'Pengguna' });
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  // ─── LOGIN EMAIL/PASSWORD ────────────────────────────────────────────────────
  const loginWithEmail = useCallback(async (email, password) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(res.user);
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  // ─── RESET PASSWORD ──────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, []);

  // ─── LOGOUT ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => signOut(auth), []);

  // ─── PRIVACY STATS ───────────────────────────────────────────────────────────
  const updateStatsPrivacy = useCallback(async (statsPublic) => {
    if (!auth.currentUser) throw new Error('Kamu belum masuk.');
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { statsPublic: !!statsPublic, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, []);

  /**
   * Update display name dan/atau foto profil.
   *
   * Foto di-resize client-side → base64 JPEG kecil → disimpan di field
   * `photoURL` dokumen Firestore `users/{uid}`.
   *
   * FIX: rules mensyaratkan `role` tidak berubah saat update biasa.
   * Kita TIDAK menyertakan `role` sama sekali di payload (merge: true),
   * jadi rules membaca role dari resource.data (dokumen existing) dan
   * request.resource.data.role == resource.data.role tetap terpenuhi.
   */
  const updateUserProfile = useCallback(async ({ displayName, photoFile } = {}) => {
    if (!auth.currentUser) throw new Error('Kamu belum masuk.');

    // Pastikan dokumen user sudah ada (bisa terjadi pada user lama)
    await ensureUserDoc(auth.currentUser);

    const updates = {};

    if (typeof displayName === 'string' && displayName.trim()) {
      updates.displayName = displayName.trim();
    }

    if (photoFile) {
      updates.photoURL = await resizeImageToDataUrl(photoFile, 256, 0.72);
    }

    if (Object.keys(updates).length === 0) return;

    // Sync displayName ke Firebase Auth (photoURL base64 terlalu panjang untuk Auth)
    if (updates.displayName) {
      await updateAuthProfile(auth.currentUser, { displayName: updates.displayName });
    }

    // Simpan ke Firestore — JANGAN sertakan `role` di sini, biarkan merge
    // mempertahankan nilai yang sudah ada agar rules tidak reject.
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true },
    );

    // Refresh state lokal
    setUser({ ...auth.currentUser });
    return updates;
  }, [ensureUserDoc]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isLoggedIn: !!user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    updateUserProfile,
    updateStatsPrivacy,
  }), [
    user, profile, loading,
    loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword,
    logout, updateUserProfile, updateStatsPrivacy,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
};
