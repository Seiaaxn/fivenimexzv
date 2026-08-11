import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAX_ITEMS = 100;

// NOTE: pemberian EXP TIDAK lagi terjadi di sini. EXP sekarang diberikan
// per blok 5 menit menonton NYATA, dilacak & dipicu langsung dari
// Watch.jsx (lihat `awardWatchBlockExp` di utils/levels.js) karena hanya
// komponen player yang tahu apakah video benar-benar sedang diputar.
// updateWatchProgress() di bawah ini murni untuk fitur "lanjutkan
// nonton" (menyimpan posisi terakhir), tidak lagi dipakai untuk EXP.

// ───────────────────────── Firestore (logged-in) ─────────────────────────

const historyDocId = (uid, episodeId) => `${uid}_${episodeId}`;

/**
 * Add or update watch history entry.
 * Requires a logged-in user (uid). Guest users are not tracked.
 */
export const addToWatchHistory = async (uid, item) => {
  if (!item?.episodeId || !uid) return;

  try {
    const ref = doc(db, 'watchHistory', historyDocId(uid, item.episodeId));
    await setDoc(ref, {
      uid,
      animeId: item.animeId || '',
      episodeId: item.episodeId,
      animeTitle: item.animeTitle || '',
      episodeTitle: item.episodeTitle || '',
      poster: item.poster || '',
      provider: item.provider || '',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Ignore errors (offline, permissions, etc.)
  }
};

/** Update watch progress for an episode (currentTime + duration, in seconds). Requires login. */
export const updateWatchProgress = async (uid, episodeId, currentTime, duration) => {
  if (!episodeId || !currentTime || !uid) return;

  try {
    const ref = doc(db, 'watchHistory', historyDocId(uid, episodeId));
    await setDoc(ref, {
      uid,
      episodeId,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration || 0),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Ignore errors
  }
};

/** Get saved progress for an episode (returns seconds, or 0). Requires login. */
export const getWatchProgress = async (uid, episodeId) => {
  if (!episodeId || !uid) return 0;

  try {
    const snap = await getDoc(doc(db, 'watchHistory', historyDocId(uid, episodeId)));
    return snap.exists() ? (snap.data().currentTime || 0) : 0;
  } catch {
    return 0;
  }
};

/** Subscribe to the full watch history for a user (newest first). Guests get empty list. */
export const watchUserHistory = (uid, callback) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'watchHistory'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      callback(items);
    },
    () => callback([]),
  );
};

/** Format seconds to mm:ss or hh:mm:ss */
export const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export const clearWatchHistory = async (uid) => {
  if (!uid) return;
  try {
    const q = query(collection(db, 'watchHistory'), where('uid', '==', uid));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    // Ignore errors
  }
};

/**
 * Remove a single episode from watch history.
 */
export const removeFromWatchHistory = async (uid, episodeId) => {
  if (!episodeId || !uid) return;

  try {
    await deleteDoc(doc(db, 'watchHistory', historyDocId(uid, episodeId)));
  } catch {
    // Ignore errors
  }
};
