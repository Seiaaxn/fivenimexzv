import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { levelFromExp } from '../utils/levels';

/**
 * Banyak dokumen di app ini (komentar, pesan chat, daftar pengikut, dst)
 * menyimpan salinan `displayName`/`photoURL`/`level` seorang user pada saat
 * dokumen itu dibuat. Itu bagus untuk kecepatan render, tapi kalau user
 * ganti nama/foto profil, semua salinan lama itu tidak pernah ikut berubah.
 *
 * Hook ini men-subscribe dokumen `users/{uid}` secara realtime untuk
 * sekumpulan uid, lalu dipakai untuk menimpa field yang tersimpan (stale)
 * dengan data terbaru saat render — supaya nama/foto/level selalu sinkron
 * di mana pun ditampilkan.
 *
 * Subscription di-cache di level modul (bukan per komponen) supaya kalau
 * uid yang sama dipakai di banyak tempat sekaligus (mis. komentar +
 * chat global yang tampil bersamaan), Firestore hanya di-listen sekali.
 */
const cache = new Map(); // uid -> { data: object|null, listeners: Set<fn>, unsub: fn }

const getEntry = (uid) => {
  let entry = cache.get(uid);
  if (!entry) {
    entry = { data: null, listeners: new Set(), unsub: null };
    entry.unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        entry.data = snap.exists() ? snap.data() : null;
        entry.listeners.forEach((fn) => fn());
      },
      () => {
        entry.data = null;
        entry.listeners.forEach((fn) => fn());
      },
    );
    cache.set(uid, entry);
  }
  return entry;
};

/**
 * @param {string[]} uids
 * @returns {Record<string, { displayName: string, photoURL: string, email: string, exp: number, level: number }>}
 *          Hanya berisi entri untuk uid yang datanya sudah tersedia (live).
 */
export const useLiveUsers = (uids) => {
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean))).sort();
  const key = uniqueUids.join(',');
  const [, forceRender] = useState(0);
  const keyRef = useRef('');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    const onChange = () => forceRender((n) => n + 1);
    list.forEach((uid) => {
      const entry = getEntry(uid);
      entry.listeners.add(onChange);
    });
    keyRef.current = key;

    return () => {
      list.forEach((uid) => {
        const entry = cache.get(uid);
        if (!entry) return;
        entry.listeners.delete(onChange);
        if (entry.listeners.size === 0) {
          entry.unsub?.();
          cache.delete(uid);
        }
      });
    };
  }, [key]);

  const result = {};
  uniqueUids.forEach((uid) => {
    const entry = cache.get(uid);
    const data = entry?.data;
    if (data) {
      result[uid] = {
        displayName: data.displayName || '',
        photoURL: data.photoURL || '',
        email: data.email || '',
        exp: data.exp || 0,
        level: levelFromExp(data.exp || 0),
        role: data.role || 'user',
      };
    }
  });
  return result;
};

/** Versi untuk satu uid saja. */
export const useLiveUser = (uid) => {
  const map = useLiveUsers(uid ? [uid] : []);
  return uid ? map[uid] : undefined;
};

/**
 * Gabungkan field live (nama/foto/level/email) di atas sebuah item yang
 * punya salinan lama (comment, pesan chat, entri follow, dst). Kalau data
 * live belum tersedia (baru mount / user sudah dihapus), field lama tetap
 * dipakai sebagai fallback supaya UI tidak "berkedip" kosong.
 */
export const withLiveUser = (item, liveMap) => {
  const live = liveMap?.[item?.uid];
  if (!live) return item;
  return {
    ...item,
    displayName: live.displayName || item.displayName,
    photoURL: live.photoURL || item.photoURL,
    email: live.email || item.email,
    level: live.level || item.level,
    role: live.role || item.role || 'user',
  };
};
