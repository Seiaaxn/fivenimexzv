// Akun premium (badge mahkota) — pakai email yang sama dengan akun
// terverifikasi (lihat utils/verified.js) karena ini akun pemilik SeivyNime.
import { VERIFIED_EMAIL } from './verified';

export const PREMIUM_EMAIL = VERIFIED_EMAIL;

export const isPremiumEmail = (email) =>
  !!email && email.toLowerCase() === PREMIUM_EMAIL;
