import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAX_MESSAGES = 80;

/** Pantau pesan-pesan terbaru di Chat Global (urut lama -> baru untuk ditampilkan). */
export const watchGlobalChat = (callback) => {
  const q = query(collection(db, 'globalChat'), orderBy('createdAt', 'desc'), limit(MAX_MESSAGES));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.reverse();
      callback(items);
    },
    () => callback([]),
  );
};

/** Kirim pesan ke Chat Global (halaman Home). */
export const sendGlobalChatMessage = async ({ uid, displayName, photoURL, email, level, text, replyTo = null }) => {
  const body = (text || '').trim();
  if (!uid || !body) return;
  await addDoc(collection(db, 'globalChat'), {
    uid,
    displayName: displayName || 'Pengguna',
    photoURL: photoURL || '',
    email: email || '',
    level: level || 1,
    text: body.slice(0, 300),
    replyTo: replyTo || null, // { id, displayName, text }
    createdAt: serverTimestamp(),
  });
};

/** Hapus pesan (hanya pemilik pesan, ditegakkan juga oleh firestore.rules). */
export const deleteGlobalChatMessage = async (id) => {
  if (!id) return;
  await deleteDoc(doc(db, 'globalChat', id));
};
