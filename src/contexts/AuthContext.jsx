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
import { resolveRole, isAdminRole, isPremiumRole, ROLE_USER } from '../utils/roles';
import { setViewerAccess } from '../utils/accessTier';

const AuthContext = createContext(null);

const mapAuthError = (err) => {
  const code = err?.code || '';
  const map = {
    'auth/popup-closed-by-user': 'Popup login ditutup sebelum selesai.',
    'auth/network-request-failed': 'Koneksi bermasalah, coba lagi.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
    'auth/email-already-in-use': 'Email ini sudah terdaftar. Coba masuk saja.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/weak-password': 'Password terlalu lemah, minimal 6 karakter.',
    'auth/user-not-found': 'Akun dengan email ini tidak ditemukan.',
    'auth/wrong-password': 'Email atau password salah.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/missing-password': 'Password wajib diisi.',
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

  // Live-sync the Firestore profile document for the current user.
  // This is also where the (base64) profile photo lives — no Firebase
  // Storage involved, everything is a plain Firestore document field,
  // governed only by firestore.rules.
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

  const ensureUserDoc = useCallback(async (u, extra = {}) => {
    const userRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      // Pertama kali: buat dokumen baru dengan semua field default
      await setDoc(userRef, {
        displayName: u.displayName || extra.displayName || 'Pengguna',
        photoURL: u.photoURL || '',
        email: u.email || '',
        role: ROLE_USER,
        level: 1,
        exp: 0,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        loginCount: 1,
      });
    } else {
      // Sudah ada: update lastLoginAt + sinkronkan nama/email terbaru dari Auth
      // (mis. user ganti nama Google, atau email yang baru diverifikasi)
      const patch = {
        lastLoginAt: serverTimestamp(),
        loginCount: (snap.data().loginCount || 0) + 1,
      };
      const freshName = u.displayName || extra.displayName;
      const freshEmail = u.email;
      // Hanya timpa kalau Auth punya data lebih segar (tidak override edit manual di profil)
      if (freshEmail && !snap.data().email) patch.email = freshEmail;
      if (freshName && !snap.data().displayName) patch.displayName = freshName;
      // Selalu sinkronkan email supaya admin panel tidak tampil kosong
      if (freshEmail) patch.email = freshEmail;
      await setDoc(userRef, patch, { merge: true });
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

  /**
   * Register a new account with email + password, then set the display
   * name on the Firebase Auth profile before creating the Firestore doc
   * so `ensureUserDoc` picks up the right name right away.
   */
  const registerWithPassword = useCallback(async (email, password, displayName) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName?.trim()) {
        await updateAuthProfile(res.user, { displayName: displayName.trim() });
      }
      await ensureUserDoc(res.user, { displayName });
      setUser({ ...res.user });
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  const loginWithPassword = useCallback(async (email, password) => {
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

  /**
   * Toggle whether this user's aggregate stats (episodes watched, hours,
   * favorite/watchlist counts) are visible on their public profile page.
   */
  const updateStatsPrivacy = useCallback(async (statsPublic) => {
    if (!auth.currentUser) throw new Error('Kamu belum masuk.');
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { statsPublic: !!statsPublic, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, []);

  /**
   * Update display name and/or profile photo.
   * The photo is resized client-side into a small base64 JPEG and saved
   * directly as a field on the user's Firestore document (`users/{uid}`)
   * — protected purely by firestore.rules, no Firebase Storage needed.
   */
  const updateUserProfile = useCallback(async ({ displayName, photoFile } = {}) => {
    if (!auth.currentUser) throw new Error('Kamu belum masuk.');
    const updates = {};

    if (typeof displayName === 'string' && displayName.trim()) {
      updates.displayName = displayName.trim();
    }

    if (photoFile) {
      updates.photoURL = await resizeImageToDataUrl(photoFile, 256, 0.72);
    }

    if (Object.keys(updates).length === 0) return;

    // Firebase Auth's photoURL field has a strict length limit and can't
    // hold a base64 image, so only sync displayName there. The photo
    // itself only ever lives in Firestore.
    const authUpdates = {};
    if (updates.displayName) authUpdates.displayName = updates.displayName;
    if (Object.keys(authUpdates).length > 0) {
      await updateAuthProfile(auth.currentUser, authUpdates);
    }

    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true },
    );
    // Reflect changes immediately in local state
    setUser({ ...auth.currentUser });
    return updates;
  }, []);

  const role = resolveRole(profile, user?.email);
  const isAdmin = isAdminRole(profile, user?.email);
  const isPremium = isPremiumRole(profile, user?.email);

  // Sinkronkan tier penonton ke module state yang dipakai util anime custom,
  // supaya fetcher di luar React (Home/Ongoing/Completed/Search) langsung tahu
  // apakah konten premium boleh ikut ditampilkan.
  setViewerAccess({ role, canPremium: isPremium, isAdmin });

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    role,
    isAdmin,
    isPremium,
    isLoggedIn: !!user,
    loginWithGoogle,
    registerWithPassword,
    loginWithPassword,
    resetPassword,
    logout,
    updateUserProfile,
    updateStatsPrivacy,
  }), [
    user, profile, loading, role, isAdmin, isPremium, loginWithGoogle, registerWithPassword, loginWithPassword,
    resetPassword, logout, updateUserProfile, updateStatsPrivacy,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
};
