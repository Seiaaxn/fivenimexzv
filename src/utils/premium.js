// Status premium sekarang ditentukan oleh ROLE di dokumen `users/{uid}`
// (lihat utils/roles.js), bukan lagi hardcoded satu email. Helper email lama
// tetap diekspor supaya kode/aksi lama tidak patah.
import { VERIFIED_EMAIL } from './verified';
import { isPremiumRole } from './roles';

export const PREMIUM_EMAIL = VERIFIED_EMAIL;

export const isPremiumEmail = (email) =>
  !!email && email.toLowerCase() === PREMIUM_EMAIL;

/** Sumber kebenaran baru: profil Firestore (+ fallback email owner). */
export const isPremiumUser = (profile, email) => isPremiumRole(profile, email);
