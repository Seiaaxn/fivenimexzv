// ─── Role pengguna (user / premium / admin) ───
// Role disimpan sebagai field `role` di dokumen `users/{uid}`. Email pemilik
// (VERIFIED_EMAIL) selalu dianggap admin walaupun field `role`-nya kosong,
// supaya akun owner tidak pernah bisa mengunci dirinya sendiri di luar panel.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  limit as fbLimit,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VERIFIED_EMAIL } from './verified';
import { levelFromExp, expForLevel } from './levels';

export const ROLE_USER = 'user';
export const ROLE_PREMIUM = 'premium';
export const ROLE_ADMIN = 'admin';

export const ROLES = [ROLE_USER, ROLE_PREMIUM, ROLE_ADMIN];

export const ROLE_LABELS = {
  [ROLE_USER]: 'User Biasa',
  [ROLE_PREMIUM]: 'Premium',
  [ROLE_ADMIN]: 'Admin',
};

export const OWNER_EMAIL = VERIFIED_EMAIL;

export const isOwnerEmail = (email) => !!email && email.toLowerCase() === OWNER_EMAIL;

/** Role efektif dari (profil Firestore, email akun). */
export const resolveRole = (profile, email) => {
  if (isOwnerEmail(email)) return ROLE_ADMIN;
  const role = (profile?.role || '').toLowerCase();
  return ROLES.includes(role) ? role : ROLE_USER;
};

export const isAdminRole = (profile, email) => resolveRole(profile, email) === ROLE_ADMIN;

/** Premium = role premium ATAU admin (admin selalu bisa melihat konten premium). */
export const isPremiumRole = (profile, email) => {
  const role = resolveRole(profile, email);
  return role === ROLE_PREMIUM || role === ROLE_ADMIN;
};

/** Helper: normalisasi satu dokumen user menjadi objek UI. */
const normalizeUser = (d) => {
  const data = d.data() || {};
  return {
    uid: d.id,
    displayName: data.displayName || 'Pengguna',
    email: data.email || '',
    photoURL: data.photoURL || '',
    // `role` = role EFEKTIF (dipakai untuk permission/badge di seluruh app).
    // `storedRole` = nilai MENTAH yang benar-benar tersimpan di Firestore,
    // dipakai admin panel supaya toggle role selalu mencerminkan data asli
    // (owner tetap admin secara efektif, tapi UI tidak "memaksa" nilai lain
    // terlihat seperti gagal tersimpan).
    role: resolveRole(data, data.email),
    storedRole: ROLES.includes((data.role || '').toLowerCase()) ? data.role.toLowerCase() : ROLE_USER,
    isOwner: isOwnerEmail(data.email),
    exp: data.exp || 0,
    level: data.level || levelFromExp(data.exp || 0),
    createdAt: data.createdAt || null,
    lastLoginAt: data.lastLoginAt || null,
    loginCount: data.loginCount || 0,
  };
};

// Urutkan di sisi client (bukan lewat Firestore `orderBy('createdAt')`).
// PENTING: query dengan `orderBy(field)` di Firestore diam-diam MEMBUANG
// dokumen yang tidak punya field tsb sama sekali (mis. user lama / user yang
// dokumennya sempat dibuat lewat jalur lain tanpa `createdAt`, atau dokumen
// yang `createdAt`-nya masih `null` karena serverTimestamp() belum di-ack).
// Akibatnya sebagian user "hilang" dari panel admin walau sudah login/daftar.
// Query di bawah TIDAK memakai orderBy sama sekali → semua dokumen user
// selalu ikut terbaca, lalu diurutkan manual (user tanpa createdAt taruh di
// bawah, bukan malah disembunyikan).
const sortByCreatedAtDesc = (list) =>
  [...list].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
    return tb - ta;
  });

/** Ambil daftar user sekali (fallback / non-realtime). */
export const listUsers = async (max = 500) => {
  const snap = await getDocs(query(collection(db, 'users'), fbLimit(max)));
  return sortByCreatedAtDesc(snap.docs.map(normalizeUser));
};

/**
 * Subscribe realtime ke SELURUH koleksi `users` (onSnapshot, tanpa orderBy).
 * Dipanggil dari AdminUsers supaya setiap user baru yang login/daftar
 * langsung muncul tanpa perlu refresh manual — dan tanpa risiko user
 * "hilang" karena field yang dipakai untuk sort tidak selalu ada.
 *
 * @param {function} callback  Dipanggil dengan array user setiap ada perubahan
 * @param {number}   max       Batas dokumen (default 500)
 * @returns {function}         Fungsi unsubscribe
 */
export const watchUsers = (callback, max = 500) => {
  const q = query(collection(db, 'users'), fbLimit(max));
  return onSnapshot(
    q,
    (snap) => callback(sortByCreatedAtDesc(snap.docs.map(normalizeUser))),
    () => callback([]),
  );
};

/**
 * Ubah role seorang user (hanya dipanggil dari admin panel).
 * Setelah menulis, kita baca ulang dokumennya (getDoc, bypass cache lokal)
 * untuk MEMASTIKAN role benar-benar tersimpan di server — bukan cuma
 * percaya pada write lokal yang optimistik. Kalau ternyata nilainya tidak
 * berubah (mis. Firestore Security Rules menolak tulisan karena akun ini
 * belum diakui admin oleh rules yang ter-deploy), kita lempar error yang
 * jelas alih-alih diam-diam "kembali ke role lama" di UI tanpa penjelasan.
 */
export const updateUserRole = async (uid, role) => {
  if (!uid) throw new Error('UID tidak valid.');
  if (!ROLES.includes(role)) throw new Error('Role tidak dikenal.');

  try {
    await setDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error(
        'Ditolak Firestore Security Rules. Akun kamu belum dikenali sebagai admin oleh rules yang ' +
        'sedang aktif di server — pastikan firestore.rules terbaru sudah di-deploy ' +
        '(firebase deploy --only firestore:rules) dan dokumen users/{uid} akun kamu punya field role: "admin".',
      );
    }
    throw err;
  }

  // Verifikasi: baca ulang dari server (bukan cache) untuk memastikan
  // tulisan benar-benar nyangkut, bukan cuma "terlihat sukses" di client.
  try {
    const verifySnap = await getDoc(doc(db, 'users', uid));
    const savedRole = (verifySnap.data()?.role || '').toLowerCase();
    if (savedRole !== role) {
      throw new Error(
        `Role tersimpan sebagai "${savedRole || '(kosong)'}", bukan "${role}". ` +
        'Kemungkinan tertolak diam-diam oleh Firestore Security Rules — cek apakah rules sudah di-deploy.',
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Role tersimpan')) throw err;
    // Gagal verifikasi (mis. offline) — jangan blokir, tulisan awal sudah sukses.
  }
};

/**
 * Set level dan/atau EXP seorang user.
 * - Kalau `exp` diisi, level otomatis dihitung ulang dari EXP.
 * - Kalau hanya `level` diisi, EXP di-set ke EXP minimum level tersebut
 *   supaya progress bar di profil tetap konsisten.
 */
export const updateUserProgress = async (uid, { level, exp } = {}) => {
  if (!uid) throw new Error('UID tidak valid.');
  const payload = { updatedAt: serverTimestamp() };

  if (exp !== undefined && exp !== null && exp !== '') {
    const nextExp = Math.max(0, Math.round(Number(exp) || 0));
    payload.exp = nextExp;
    payload.level = levelFromExp(nextExp);
  } else if (level !== undefined && level !== null && level !== '') {
    const nextLevel = Math.min(200, Math.max(1, Math.round(Number(level) || 1)));
    payload.level = nextLevel;
    payload.exp = expForLevel(nextLevel);
  } else {
    throw new Error('Isi level atau EXP terlebih dahulu.');
  }

  await setDoc(doc(db, 'users', uid), payload, { merge: true });
  return { level: payload.level, exp: payload.exp };
};
