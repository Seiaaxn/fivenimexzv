// Firebase initialization for SeivyNime
// Works in both SSR (TanStack Start) and browser contexts.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBiws_zGwg82XfIfp7_vjiiVyfxTjetOtU',
  authDomain: 'fivenimexc.firebaseapp.com',
  projectId: 'fivenimexc',
  storageBucket: 'fivenimexc.firebasestorage.app',
  messagingSenderId: '565652315470',
  appId: '1:565652315470:web:b306ca1bb3644052ae121f',
  measurementId: 'G-R7GPJVXWB1',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
// Dipakai untuk upload file video episode (lihat utils/customAnime.js).
// Poster & foto profil tetap base64 di Firestore seperti sebelumnya —
// hanya video yang lewat Storage karena ukurannya jauh lebih besar.
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

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
