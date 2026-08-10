import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// EXP diberikan setiap kali 1 episode (anime/donghua) selesai ditonton.
export const EXP_PER_EPISODE = 40;

// EXP diberikan setiap kali 1 chapter komik selesai dibaca.
export const EXP_PER_CHAPTER = 25;

/** Total EXP kumulatif yang dibutuhkan untuk mencapai sebuah level. */
export const expForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.55));
};

/** Level saat ini berdasarkan total EXP. */
export const levelFromExp = (exp) => {
  const total = Math.max(0, exp || 0);
  let level = 1;
  // Level dibatasi wajar (200) supaya loop tidak pernah tak berujung.
  while (level < 200 && total >= expForLevel(level + 1)) level++;
  return level;
};

/** Info lengkap progres level: level saat ini, EXP menuju level berikutnya, dst. */
export const levelProgress = (exp) => {
  const total = Math.max(0, exp || 0);
  const level = levelFromExp(total);
  const floor = expForLevel(level);
  const ceiling = expForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);
  const into = Math.max(0, total - floor);
  return {
    level,
    exp: total,
    expIntoLevel: into,
    expForNextLevel: span,
    expToNext: Math.max(0, ceiling - total),
    progressPercent: Math.min(100, Math.round((into / span) * 100)),
  };
};

/**
 * Helper generik: beri `amount` EXP ke `uid`, dijaga oleh dokumen penanda
 * `expLog/{markerId}` di dalam sebuah transaksi Firestore, supaya penanda
 * yang sama (1 episode / 1 chapter tertentu) hanya pernah memberi EXP satu
 * kali walaupun aksi yang memicunya (progres nonton, buka chapter, dst)
 * terjadi/tersimpan berkali-kali.
 */
const awardExp = async (uid, markerId, amount, extra = {}) => {
  if (!uid || !markerId || !amount) return;
  const markerRef = doc(db, 'expLog', markerId);
  const userRef = doc(db, 'users', uid);
  try {
    await runTransaction(db, async (tx) => {
      const markerSnap = await tx.get(markerRef);
      if (markerSnap.exists()) return; // sudah pernah dapat EXP untuk marker ini

      const userSnap = await tx.get(userRef);
      const prevExp = userSnap.exists() ? (userSnap.data().exp || 0) : 0;
      const newExp = prevExp + amount;
      const newLevel = levelFromExp(newExp);

      tx.set(markerRef, { uid, createdAt: serverTimestamp(), ...extra });
      tx.set(userRef, { exp: newExp, level: newLevel, updatedAt: serverTimestamp() }, { merge: true });
    });
  } catch {
    // Offline / permission error — abaikan, EXP akan menyusul lain kali.
  }
};

/**
 * Beri EXP untuk 1 episode (anime/donghua) yang sudah ditonton sampai
 * selesai. Marker id: `${uid}_${episodeId}`.
 */
export const awardEpisodeExp = (uid, episodeId) => {
  if (!uid || !episodeId) return;
  return awardExp(uid, `${uid}_${episodeId}`, EXP_PER_EPISODE, { episodeId, type: 'episode' });
};

/**
 * Beri EXP untuk 1 chapter komik yang sudah selesai dibaca. Marker id
 * diberi prefix `komik_` supaya tidak pernah bentrok dengan marker episode.
 */
export const awardChapterExp = (uid, chapterSlug) => {
  if (!uid || !chapterSlug) return;
  return awardExp(uid, `komik_${uid}_${chapterSlug}`, EXP_PER_CHAPTER, { chapterSlug, type: 'chapter' });
};
