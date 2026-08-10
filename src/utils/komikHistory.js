import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const STORAGE_KEY = 'seivynime_komik_history';
const MAX_ITEMS = 100;

// ───────────────────────── Guest (local) fallback ─────────────────────────

const _getLocal = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const _saveLocal = (history) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore localStorage errors (quota, privacy mode)
  }
};

// ───────────────────────── Firestore (logged-in) ─────────────────────────

const historyDocId = (uid, komikId) => `${uid}_${komikId}`;

/**
 * Add or update komik reading history entry (one entry per comic; the
 * last-read chapter is updated each time). Pass `uid` = null/undefined
 * for a guest (falls back to localStorage).
 * item: { komikId, komikTitle, chapterSlug, chapterTitle, cover }
 */
export const addToKomikHistory = async (uid, item) => {
  if (!item?.komikId || !item?.chapterSlug) return;

  if (!uid) {
    if (typeof window === 'undefined') return;
    try {
      const history = _getLocal();
      const idx = history.findIndex((h) => h.komikId === item.komikId);
      const entry = { ...(idx >= 0 ? history[idx] : {}), ...item, timestamp: Date.now() };
      if (idx >= 0) history.splice(idx, 1);
      history.unshift(entry);
      _saveLocal(history.slice(0, MAX_ITEMS));
    } catch {
      // Ignore errors
    }
    return;
  }

  try {
    const ref = doc(db, 'komikHistory', historyDocId(uid, item.komikId));
    await setDoc(ref, {
      uid,
      komikId: item.komikId,
      komikTitle: item.komikTitle || '',
      chapterSlug: item.chapterSlug,
      chapterTitle: item.chapterTitle || '',
      cover: item.cover || '',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Ignore errors (offline, permissions, etc.)
  }
};

/** Subscribe to the full komik reading history for a user (newest first). */
export const watchUserKomikHistory = (uid, callback) => {
  if (!uid) {
    callback(_getLocal());
    return () => {};
  }
  const q = query(collection(db, 'komikHistory'), where('uid', '==', uid));
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

/** Remove one comic from reading history. Deleting via Firestore means it
 * disappears everywhere at once (Profile, Home, etc. all subscribe live). */
export const removeFromKomikHistory = async (uid, komikId) => {
  if (!komikId) return;

  if (!uid) {
    if (typeof window === 'undefined') return;
    try {
      _saveLocal(_getLocal().filter((h) => h.komikId !== komikId));
    } catch {
      // Ignore errors
    }
    return;
  }

  try {
    await deleteDoc(doc(db, 'komikHistory', historyDocId(uid, komikId)));
  } catch {
    // Ignore errors
  }
};

export const clearKomikHistory = async (uid) => {
  if (!uid) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  try {
    const q = query(collection(db, 'komikHistory'), where('uid', '==', uid));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    // Ignore errors
  }
};
