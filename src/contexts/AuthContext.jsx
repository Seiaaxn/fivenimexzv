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
import { isAdminRole, isPremiumRole } from '../utils/roles';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

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

  // isAdmin & isPremium dihitung dari profil Firestore + email.
  // Email ryu694602@gmail.com selalu dianggap admin (lihat utils/roles.js).
  const isAdmin = useMemo(() => isAdminRole(profile, user?.email), [profile, user?.email]);
  const isPremium = useMemo(() => isPremiumRole(profile, user?.email), [profile, user?.email]);

  /**
   * Buat dokumen user di Firestore jika belum ada.
   * Field `role` WAJIB ada saat create — sesuai firestore.rules.
   */
  const ensureUserDoc = useCallback(async (u, extra = {}) => {
    const userRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: u.displayName || extra.displayName || 'Pengguna',
        photoURL: u.photoURL || '',
        email: u.email || '',
        role: 'user',
        level: 1,
        exp: 0,
        createdAt: serverTimestamp(),
      });
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(res.user);
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  const registerWithEmail = useCallback(async (displayName, email, password) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await updateAuthProfile(res.user, { displayName: displayName.trim() || 'Pengguna' });
      await ensureUserDoc({ ...res.user, displayName: displayName.trim() || 'Pengguna' });
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  const loginWithEmail = useCallback(async (email, password) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(res.user);
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const updateStatsPrivacy = useCallback(async (statsPublic) => {
    if (!auth.currentUser) throw new Error('Kamu belum masuk.');
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { statsPublic: !!statsPublic, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, []);

  const updateUserProfile = useCallback(async ({ displayName, photoFile } = {}) => {
    if (!auth.currentUser) throw new Error('Kamu belum masuk.');
    await ensureUserDoc(auth.currentUser);

    const updates = {};
    if (typeof displayName === 'string' && displayName.trim()) {
      updates.displayName = displayName.trim();
    }
    if (photoFile) {
      updates.photoURL = await resizeImageToDataUrl(photoFile, 256, 0.72);
    }
    if (Object.keys(updates).length === 0) return;

    if (updates.displayName) {
      await updateAuthProfile(auth.currentUser, { displayName: updates.displayName });
    }

    // JANGAN sertakan `role` di sini — biarkan merge mempertahankan nilai
    // existing agar firestore.rules tidak reject update.
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true },
    );
    setUser({ ...auth.currentUser });
    return updates;
  }, [ensureUserDoc]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isLoggedIn: !!user,
    isAdmin,
    isPremium,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    updateUserProfile,
    updateStatsPrivacy,
  }), [
    user, profile, loading, isAdmin, isPremium,
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
