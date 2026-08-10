import {
  doc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/** ID chat 1-ke-1 yang konsisten terlepas urutan siapa yang membuka duluan. */
export const dmChatId = (uidA, uidB) => [uidA, uidB].sort().join('_');

/** Pantau daftar percakapan milik pengguna (inbox), terbaru di atas. */
export const watchMyChats = (uid, callback) => {
  if (!uid) { callback([]); return () => {}; }
  const q = query(collection(db, 'dmChats'), where('participants', 'array-contains', uid));
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

/** Pantau pesan-pesan dalam satu percakapan (urut lama -> baru). */
export const watchDmMessages = (chatId, callback) => {
  if (!chatId) { callback([]); return () => {}; }
  const q = query(collection(db, 'dmChats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([]),
  );
};

/** Kirim pesan ke teman. Otomatis membuat/memperbarui dokumen percakapan. */
export const sendDmMessage = async ({ from, to, text }) => {
  const body = (text || '').trim();
  if (!from?.uid || !to?.uid || !body) return;
  const chatId = dmChatId(from.uid, to.uid);
  const chatRef = doc(db, 'dmChats', chatId);

  await setDoc(chatRef, {
    participants: [from.uid, to.uid],
    participantInfo: {
      [from.uid]: { displayName: from.displayName || '', photoURL: from.photoURL || '' },
      [to.uid]: { displayName: to.displayName || '', photoURL: to.photoURL || '' },
    },
    lastMessage: body.slice(0, 120),
    lastSenderUid: from.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await addDoc(collection(db, 'dmChats', chatId, 'messages'), {
    uid: from.uid,
    text: body.slice(0, 1000),
    createdAt: serverTimestamp(),
  });
};
