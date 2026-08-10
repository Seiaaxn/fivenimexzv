// Anime custom yang di-upload manual lewat halaman /admin (khusus akun
// pemilik SeivyNime, lihat utils/verified.js). Semuanya tersimpan di
// koleksi Firestore `customAnime` — poster boleh berupa file (dikompres
// jadi base64, sama seperti foto profil di AuthContext) atau URL langsung,
// sedangkan video episode hanya lewat URL/embed link karena project ini
// sengaja tidak memakai Firebase Storage (lihat catatan di utils/image.js).
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { VERIFIED_EMAIL } from './verified';

// Reuse akun terverifikasi sebagai satu-satunya admin yang boleh upload.
export const ADMIN_EMAIL = VERIFIED_EMAIL;
export const isAdminEmail = (email) => !!email && email.toLowerCase() === ADMIN_EMAIL;

const COLLECTION = 'customAnime';

/** Normalisasi 1 dokumen Firestore -> bentuk yang dipakai AnimeCard/AnimeDetail. */
export const normalizeCustomAnime = (docSnap) => {
  const data = docSnap.data();
  return {
    animeId: docSnap.id,
    id: docSnap.id,
    title: data.title || 'Tanpa Judul',
    poster: data.poster || '',
    description: data.description || '',
    // Alias 'synopsis' supaya AnimeDetail & Watch (yang dipakai anime dari API
    // otakudesu/samehadaku, field-nya bernama `synopsis`) bisa menampilkan
    // deskripsi anime custom tanpa perlu cabang kode terpisah.
    synopsis: data.description || '',
    status: data.status || 'ongoing',
    type: data.type || 'TV',
    // Meta tambahan gaya otakudesu/samehadaku (opsional, boleh kosong).
    aired: data.aired || '',
    duration: data.duration || '',
    studios: data.studios || '',
    score: data.score || '',
    genreList: (data.genres || []).map((g) => ({ genreId: g, title: g })),
    genres: data.genres || [],
    episodes: (data.episodes || []).length,
    episodeList: data.episodes || [],
    provider: 'custom',
    createdAt: data.createdAt || null,
  };
};

/** Ambil semua anime custom (dipakai admin panel & untuk digabung ke home/search). */
export const listCustomAnime = async () => {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map(normalizeCustomAnime);
};

/** Ambil anime custom berdasarkan status ('ongoing' | 'completed'). */
export const listCustomAnimeByStatus = async (status) => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('status', '==', status), orderBy('createdAt', 'desc')),
    );
    return snap.docs.map(normalizeCustomAnime);
  } catch {
    // Fallback kalau index composite belum ada — filter di client.
    const all = await listCustomAnime();
    return all.filter((a) => a.status === status);
  }
};

/** Ambil 1 dokumen anime custom by id (dipakai AnimeDetail). */
export const getCustomAnime = async (id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? normalizeCustomAnime(snap) : null;
};

/**
 * Tambah anime custom baru.
 * payload: { title, poster, description, status, type, aired, duration, studios,
 *            score, genres: string[], episodes: [{number,title,videoUrl}] }
 */
export const addCustomAnime = async (payload, adminUser) => {
  const ref = await addDoc(collection(db, COLLECTION), {
    title: (payload.title || '').trim(),
    poster: payload.poster || '',
    description: (payload.description || '').trim(),
    status: payload.status === 'completed' ? 'completed' : 'ongoing',
    type: payload.type || 'TV',
    aired: (payload.aired || '').trim(),
    duration: (payload.duration || '').trim(),
    studios: (payload.studios || '').trim(),
    score: (payload.score || '').trim(),
    genres: Array.isArray(payload.genres) ? payload.genres : [],
    episodes: Array.isArray(payload.episodes) ? payload.episodes : [],
    createdBy: adminUser?.email || ADMIN_EMAIL,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/** Update anime custom yang sudah ada. */
export const updateCustomAnime = async (id, payload) => {
  await updateDoc(doc(db, COLLECTION, id), {
    title: (payload.title || '').trim(),
    poster: payload.poster || '',
    description: (payload.description || '').trim(),
    status: payload.status === 'completed' ? 'completed' : 'ongoing',
    type: payload.type || 'TV',
    aired: (payload.aired || '').trim(),
    duration: (payload.duration || '').trim(),
    studios: (payload.studios || '').trim(),
    score: (payload.score || '').trim(),
    genres: Array.isArray(payload.genres) ? payload.genres : [],
    episodes: Array.isArray(payload.episodes) ? payload.episodes : [],
    updatedAt: serverTimestamp(),
  });
};

/** Hapus anime custom. */
export const deleteCustomAnime = async (id) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

/** Cari anime custom berdasarkan judul (client-side, dipakai UnifiedSearch). */
export const searchCustomAnime = async (keyword) => {
  const all = await listCustomAnime();
  const q = (keyword || '').toLowerCase().trim();
  if (!q) return [];
  return all.filter((a) => a.title.toLowerCase().includes(q));
};

// ─── Episode ID untuk halaman /watch ───
// Episode anime custom tidak punya episodeId dari API luar seperti
// otakudesu/samehadaku, jadi kita rakit sendiri: "custom__{animeId}__{nomor}".
// Dipakai supaya klik "Episode 1" di halaman detail bisa diarahkan ke
// /watch/... sama seperti provider lain, bukan diputar inline di halaman detail.
const CUSTOM_EP_PREFIX = 'custom__';

export const isCustomEpisodeId = (id) => typeof id === 'string' && id.startsWith(CUSTOM_EP_PREFIX);

export const buildCustomEpisodeId = (animeId, number) => `${CUSTOM_EP_PREFIX}${animeId}__${number}`;

export const parseCustomEpisodeId = (id) => {
  if (!isCustomEpisodeId(id)) return null;
  const rest = id.slice(CUSTOM_EP_PREFIX.length);
  const sepIdx = rest.lastIndexOf('__');
  if (sepIdx === -1) return null;
  const animeId = rest.slice(0, sepIdx);
  const number = Number(rest.slice(sepIdx + 2));
  if (!animeId || Number.isNaN(number)) return null;
  return { animeId, number };
};

// ─── Upload video episode ke Firebase Storage ───
// Poster/foto profil disimpan base64 langsung di Firestore, tapi video jauh
// lebih besar (puluhan-ratusan MB) sehingga wajib lewat Firebase Storage,
// bukan field Firestore. Hanya boleh dipanggil oleh admin (lihat storage.rules).
// `onProgress(percent)` dipanggil berkala selama upload berlangsung.
export const uploadEpisodeVideo = (file, animeIdForPath, onProgress) => {
  const safeAnimeId = animeIdForPath || `tmp-${Date.now()}`;
  const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `customAnime/${safeAnimeId}/${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  const promise = new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path });
        } catch (err) {
          reject(err);
        }
      },
    );
  });

  return { task, promise };
};

/** Hapus file video episode dari Storage (dipakai saat episode diganti/dihapus). */
export const deleteEpisodeVideo = async (path) => {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Abaikan (file mungkin sudah tidak ada / bukan file Storage kita).
  }
};
