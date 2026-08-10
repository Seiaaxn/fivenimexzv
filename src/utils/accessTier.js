// ─── Access tier (Free / Premium) ───
// Konten anime custom bisa ditandai `accessTier: 'free' | 'premium'`.
// Anime premium HANYA tampil untuk user premium/admin — user biasa tidak
// pernah melihatnya di beranda, ongoing, completed, pencarian, atau detail.
//
// Daftar anime diambil oleh fungsi-fungsi util (utils/customAnime.js) yang
// dipanggil dari luar komponen React, jadi tier penonton disimpan di sebuah
// "module state" ringan yang di-set oleh AuthContext setiap kali profil user
// berubah. Ini jauh lebih sederhana daripada mengoper props ke semua fetcher.

export const TIER_FREE = 'free';
export const TIER_PREMIUM = 'premium';

let viewerAccess = { role: 'guest', canPremium: false, isAdmin: false };

export const setViewerAccess = (next) => {
  viewerAccess = { role: 'guest', canPremium: false, isAdmin: false, ...next };
};

export const getViewerAccess = () => viewerAccess;

/** Normalisasi nilai tier dari Firestore. */
export const normalizeTier = (tier) => (tier === TIER_PREMIUM ? TIER_PREMIUM : TIER_FREE);

/** Boleh dilihat penonton saat ini? */
export const canViewTier = (tier) =>
  normalizeTier(tier) === TIER_FREE || viewerAccess.canPremium;

/** Filter list anime sesuai tier penonton. */
export const filterByViewerAccess = (list) =>
  (Array.isArray(list) ? list : []).filter((item) => canViewTier(item?.accessTier));
