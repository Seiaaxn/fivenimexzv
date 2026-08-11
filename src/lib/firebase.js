// Firebase initialization for SeivyNime
// Works in both SSR (TanStack Start) and browser contexts.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyB_i-doBTatUCIgZ4TNA5h2vkxN7_ZnO-8',
  authDomain: 'fivenimexv.firebaseapp.com',
  projectId: 'fivenimexv',
  storageBucket: 'fivenimexv.firebasestorage.app',
  messagingSenderId: '1093657778517',
  appId: '1:1093657778517:web:33130cf7f68b8d45b637dc',
  measurementId: 'G-51YCWLFWJL',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
// Dipakai untuk upload file video episode (lihat utils/customAnime.js).
// Poster & foto profil tetap base64 di Firestore seperti sebelumnya —
// hanya video yang lewat Storage karena ukurannya jauh lebih besar.
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
// Paksa Google selalu tampilkan pemilih akun (tidak auto-login akun terakhir)
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Analytics only works in the browser (needs `window`/`document`).
 * Call this from a client-only effect if you want to enable it.
 */
export const initAnalytics = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) return getAnalytics(firebaseApp);
  } catch {
    // Analytics not supported in this environment — ignore.
  }
  return null;
};

export default firebaseApp;
