import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const CONTENT_TYPES = ['anime', 'donghua', 'komik'];
export const CONTENT_TYPE_LABELS = { anime: 'Anime', donghua: 'Donghua', komik: 'Komik' };

/** Group a flat bookmark list into { anime: [...], donghua: [...], komik: [...] }, each sorted newest first. */
export const groupByType = (items) => {
  const groups = { anime: [], donghua: [], komik: [] };
  (items || []).forEach((b) => {
    const t = groups[b.type] ? b.type : 'anime';
    groups[t].push(b);
  });
  return groups;
};

// A content item can live in both the "favorite" and "watchlist" lists at
// once, so the list type is part of the doc id. The Firestore query for a
// user's bookmarks only filters on `uid` (matching firestore.rules exactly,
// so list reads can be statically verified) — the favorite/watchlist split
// happens client-side.
const bookmarkId = (uid, listType, type, contentId) => `${uid}_${listType}_${type || 'anime'}_${contentId}`;

/**
 * Add or update a bookmark for the given user.
 * item: { contentId, title, poster, type: 'anime' | 'donghua' | 'komik', slug, provider, listType: 'favorite' | 'watchlist' }
 */
export const addBookmark = async (uid, item) => {
  if (!uid || !item?.contentId) return;
  const type = item.type || 'anime';
  const listType = item.listType === 'favorite' ? 'favorite' : 'watchlist';
  const ref = doc(db, 'bookmarks', bookmarkId(uid, listType, type, item.contentId));
  await setDoc(ref, {
    uid,
    listType,
    contentId: item.contentId,
    title: item.title || 'Tanpa Judul',
    poster: item.poster || '',
    type,
    slug: item.slug || item.contentId,
    provider: item.provider || null,
    createdAt: serverTimestamp(),
  });
};

export const removeBookmark = async (uid, listType, type, contentId) => {
  if (!uid || !contentId) return;
  await deleteDoc(doc(db, 'bookmarks', bookmarkId(uid, listType, type, contentId)));
};

/** Subscribe to whether a single content item is bookmarked (for a given list) by this user. */
export const watchIsBookmarked = (uid, listType, type, contentId, callback) => {
  if (!uid || !contentId) {
    callback(false);
    return () => {};
  }
  const ref = doc(db, 'bookmarks', bookmarkId(uid, listType, type, contentId));
  return onSnapshot(ref, (snap) => callback(snap.exists()), () => callback(false));
};

/** Subscribe to a user's bookmarks for one list ('favorite' | 'watchlist'), newest first. */
export const watchUserBookmarks = (uid, listType, callback) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'bookmarks'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.listType === listType);
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(items);
    },
    () => callback([]),
  );
};
