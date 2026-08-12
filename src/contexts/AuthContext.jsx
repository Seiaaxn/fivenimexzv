import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile as updateAuthProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { resizeImageToDataUrl } from '../utils/image';
import { isAdminRole, isPremiumRole } from '../utils/roles';

const AuthContext = createContext(null);

/**
 * Pastikan dokumen `users/{uid}` ada untuk akun yang sedang login.
 * Dipanggil dari onAuthStateChanged (semua jalur login) + tiap fungsi login.
 */
export const ensureUserDocInFirestore = async (u, extra = {}) => {
  if (!u?.uid) return;
  const userRef = doc(db, 'users', u.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    // Dokumen baru: role/exp/level HARUS persis 'user'/0/1 (lihat rule
    // `allow create` di firestore.rules), field lain bebas.
    await setDoc(userRef, {
      displayName: u.displayName || extra.displayName || 'Pengguna',
      photoURL: u.photoURL || '',
      email: u.email || '',
      role: 'user',
      level: 1,
      exp: 0,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      loginCount: 1,
    });
    return;
  }
  // User lama login lagi: catat aktivitas login TANPA menyentuh field
  // role/exp/level sama sekali — supaya tidak pernah bisa "menimpa" role
  // yang sudah diset admin (lihat firestore.rules).
  const patch = { lastLoginAt: serverTimestamp(), loginCount: increment(1) };
  const data = snap.data() || {};
  // Lengkapi field yang mungkin kosong pada dokumen lama supaya baris user
  // di admin panel tidak tampil "—" (dan sorting createdAt tetap jalan).
  if (!data.email && u.email) patch.email = u.email;
  if (!data.displayName && (u.displayName || extra.displayName)) {
    patch.displayName = u.displayName || extra.displayName;
  }
  if (!data.photoURL && u.photoURL) patch.photoURL = u.photoURL;
  if (!data.createdAt) patch.createdAt = serverTimestamp();
  await setDoc(userRef, patch, { merge: true });
};

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

  // ensureUserDoc dipindah ke scope modul (bukan useCallback) supaya bisa
  // dipakai langsung di dalam listener onAuthStateChanged di bawah — jadi
  // SETIAP jalur masuk (Google popup, Google redirect, email login, daftar,
  // atau sesi lama yang otomatis pulih saat reload) selalu memastikan
  // dokumen users/{uid} ada & lastLoginAt-nya diperbarui. Inilah kunci agar
  // admin panel ("Pengguna (n)") selalu bertambah otomatis.
  const ensureUserDoc = ensureUserDocInFirestore;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Google login lewat redirect (fallback saat popup diblokir browser /
    // di dalam iframe): hasilnya baru sampai setelah halaman dimuat ulang.
    getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        ensureUserDocInFirestore(u).catch((err) => {
          console.error('[AuthContext] ensureUserDoc (onAuthStateChanged) gagal:', err);
        });
      }
    });
    return () => unsub();
  }, []);


  // Live-sync profil Firestore — setiap perubahan (termasuk role yang diubah
  // admin) langsung masuk ke `profile` state dan memicu re-render seluruh app.
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      setProfile(null);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
      // Self-heal: kalau user sudah login (Firebase Auth) tapi dokumen
      // Firestore-nya belum/tidak ada — mis. karena penulisan awal sempat
      // gagal (permission-denied, offline, dll) — coba buat lagi di sini.
      // Ini jaring pengaman kedua supaya user tidak "hilang" selamanya
      // dari koleksi users hanya karena satu percobaan write gagal.
      if (!snap.exists()) {
        ensureUserDoc(user).catch((err) => {
          console.error('[AuthContext] Self-heal ensureUserDoc gagal:', err);
        });
      }
    });
    return () => unsub();
  }, [user, ensureUserDoc]);

  // isAdmin & isPremium dihitung reaktif dari profil Firestore + email.
  // Kalau admin ubah role user via AdminPanel → Firestore update →
  // onSnapshot trigger → profile berubah → isAdmin/isPremium langsung update
  // → semua komponen yang pakai useAuth() otomatis re-render dengan badge baru.
  const isAdmin  = useMemo(() => isAdminRole(profile, user?.email),  [profile, user?.email]);
  const isPremium = useMemo(() => isPremiumRole(profile, user?.email), [profile, user?.email]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      // ensureUserDoc TIDAK BOLEH menggagalkan login. onAuthStateChanged
      // juga sudah memanggilnya, ini hanya supaya dokumen siap lebih cepat.
      try {
        await ensureUserDoc(res.user);
      } catch (docErr) {
        console.error('[AuthContext] Gagal membuat/update dokumen users/{uid} saat login:', docErr);
      }
      return res.user;
    } catch (err) {
      // Popup diblokir browser atau dijalankan di dalam iframe (preview
      // Lovable / webview) → lanjutkan dengan redirect supaya login Google
      // tetap bisa selesai. Hasilnya diproses getRedirectResult di atas.
      const code = err?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);


  const registerWithEmail = useCallback(async (displayName, email, password) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await updateAuthProfile(res.user, { displayName: displayName.trim() || 'Pengguna' });
      try {
        await ensureUserDoc({ ...res.user, displayName: displayName.trim() || 'Pengguna' });
      } catch (docErr) {
        console.error('[AuthContext] Gagal membuat dokumen users/{uid} saat registrasi:', docErr);
      }
      return res.user;
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, [ensureUserDoc]);

  const loginWithEmail = useCallback(async (email, password) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      try {
        await ensureUserDoc(res.user);
      } catch (docErr) {
        console.error('[AuthContext] Gagal membuat/update dokumen users/{uid} saat login:', docErr);
      }
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

    // JANGAN sertakan `role` di payload — biarkan merge mempertahankan nilai
    // existing agar firestore.rules tidak reject.
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
