import {
  addDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const buildRoomId = (contentType, contentId) => `${contentType || 'anime'}:${contentId}`;

export const watchComments = (contentType, contentId, callback) => {
  if (!contentId) {
    callback([]);
    return () => {};
  }
  const roomId = buildRoomId(contentType, contentId);
  const q = query(collection(db, 'comments'), where('roomId', '==', roomId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(items);
    },
    () => callback([]),
  );
};

export const addComment = async ({
  contentType,
  contentId,
  contentTitle,
  uid,
  displayName,
  photoURL,
  email,
  level = 1,
  role,
  text,
  parentId = null,
  replyToName = null,
  replyToUid = null,
}) => {
  if (!contentId || !uid || !text?.trim()) return;
  await addDoc(collection(db, 'comments'), {
    roomId: buildRoomId(contentType, contentId),
    contentType: contentType || 'anime',
    contentId,
    contentTitle: contentTitle || '',
    uid,
    displayName: displayName || 'Pengguna',
    photoURL: photoURL || '',
    email: email || '',
    level: level || 1,
    role: role || 'user',
    parentId: parentId || null,
    replyToName: replyToName || null,
    replyToUid: replyToUid || null,
    text: text.trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
};

export const deleteComment = async (commentId) => {
  if (!commentId) return;
  await deleteDoc(doc(db, 'comments', commentId));
};
