import {
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ────────────────────────────────────────────────────────────────
// FOLLOW SYSTEM (Twitter/TikTok style — asymmetric)
// ────────────────────────────────────────────────────────────────

const followDocId = (followerUid, targetUid) => `${followerUid}_${targetUid}`;

/** Mulai mengikuti pengguna lain. */
export const followUser = async (follower, target) => {
  if (!follower?.uid || !target?.uid || follower.uid === target.uid) return;
  await setDoc(doc(db, 'follows', followDocId(follower.uid, target.uid)), {
    followerUid: follower.uid,
    followerName: follower.displayName || '',
    followerPhoto: follower.photoURL || '',
    followingUid: target.uid,
    followingName: target.displayName || '',
    followingPhoto: target.photoURL || '',
    createdAt: serverTimestamp(),
  });
};

/** Berhenti mengikuti (Unfollow). */
export const unfollowUser = async (followerUid, targetUid) => {
  if (!followerUid || !targetUid) return;
  await deleteDoc(doc(db, 'follows', followDocId(followerUid, targetUid)));
};

/** Pantau realtime apakah `followerUid` sedang mengikuti `targetUid`. */
export const watchIsFollowing = (followerUid, targetUid, callback) => {
  if (!followerUid || !targetUid) { callback(false); return () => {}; }
  return onSnapshot(
    doc(db, 'follows', followDocId(followerUid, targetUid)),
    (snap) => callback(snap.exists()),
    () => callback(false),
  );
};

/** Daftar pengikut (followers) seorang pengguna. */
export const watchFollowers = (uid, callback) => {
  if (!uid) { callback([]); return () => {}; }
  const q = query(collection(db, 'follows'), where('followingUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([]),
  );
};

/** Daftar pengguna yang diikuti (following) oleh seorang pengguna. */
export const watchFollowing = (uid, callback) => {
  if (!uid) { callback([]); return () => {}; }
  const q = query(collection(db, 'follows'), where('followerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([]),
  );
};

// ────────────────────────────────────────────────────────────────
// FRIEND REQUEST SYSTEM (bidirectional — must be accepted)
// ────────────────────────────────────────────────────────────────

const friendRequestId = (fromUid, toUid) => `${fromUid}_${toUid}`;

/** Kirim permintaan pertemanan. */
export const sendFriendRequest = async (from, toUid) => {
  if (!from?.uid || !toUid || from.uid === toUid) return;
  const id = friendRequestId(from.uid, toUid);
  await setDoc(doc(db, 'friendRequests', id), {
    fromUid: from.uid,
    fromName: from.displayName || '',
    fromPhoto: from.photoURL || '',
    toUid,
    status: 'pending', // 'pending' | 'accepted'
    createdAt: serverTimestamp(),
  });
};

/** Batalkan / hapus permintaan pertemanan. */
export const cancelFriendRequest = async (fromUid, toUid) => {
  if (!fromUid || !toUid) return;
  await deleteDoc(doc(db, 'friendRequests', friendRequestId(fromUid, toUid)));
};

/** Terima permintaan pertemanan. */
export const acceptFriendRequest = async (fromUid, toUid) => {
  const id = friendRequestId(fromUid, toUid);
  await updateDoc(doc(db, 'friendRequests', id), { status: 'accepted' });
};

/** Tolak / hapus permintaan pertemanan. */
export const rejectFriendRequest = async (fromUid, toUid) => {
  await deleteDoc(doc(db, 'friendRequests', friendRequestId(fromUid, toUid)));
};

/**
 * Pantau status permintaan pertemanan antara dua user (kedua arah).
 * callback({ status, fromUid, toUid } | null)
 */
export const watchFriendRequestStatus = (myUid, otherUid, callback) => {
  if (!myUid || !otherUid) { callback(null); return () => {}; }
  let snap1 = null;
  let snap2 = null;
  const emit = () => callback(snap1 || snap2 || null);
  const u1 = onSnapshot(
    doc(db, 'friendRequests', friendRequestId(myUid, otherUid)),
    (s) => { snap1 = s.exists() ? { ...s.data(), _direction: 'sent' } : null; emit(); },
    () => {},
  );
  const u2 = onSnapshot(
    doc(db, 'friendRequests', friendRequestId(otherUid, myUid)),
    (s) => { snap2 = s.exists() ? { ...s.data(), _direction: 'received' } : null; emit(); },
    () => {},
  );
  return () => { u1(); u2(); };
};

/** Permintaan masuk yang diterima oleh toUid (status: pending). */
export const watchIncomingFriendRequests = (toUid, callback) => {
  if (!toUid) { callback([]); return () => {}; }
  const q = query(
    collection(db, 'friendRequests'),
    where('toUid', '==', toUid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([]),
  );
};
