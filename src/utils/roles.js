// ─── Role pengguna (user / premium / admin) ───
// Role disimpan sebagai field `role` di dokumen `users/{uid}`. Email pemilik
// (VERIFIED_EMAIL) selalu dianggap admin walaupun field `role`-nya kosong,
// supaya akun owner tidak pernah bisa mengunci dirinya sendiri di luar panel.
import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
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

/** Ambil daftar user untuk admin panel. */
export const listUsers = async (max = 300) => {
  const snap = await getDocs(
    query(collection(db, 'users'), orderBy('createdAt', 'desc'), fbLimit(max)),
  );
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      uid: d.id,
      displayName: data.displayName || 'Pengguna',
      email: data.email || '',
      photoURL: data.photoURL || '',
      role: resolveRole(data, data.email),
      exp: data.exp || 0,
      level: data.level || levelFromExp(data.exp || 0),
    };
  });
};

/** Ubah role seorang user (hanya dipanggil dari admin panel). */
export const updateUserRole = async (uid, role) => {
  if (!uid) throw new Error('UID tidak valid.');
  if (!ROLES.includes(role)) throw new Error('Role tidak dikenal.');
  await setDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() }, { merge: true });
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
