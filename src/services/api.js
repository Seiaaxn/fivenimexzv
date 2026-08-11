// Dev-only logger. Stripped/silent in production.
const isDev = import.meta.env?.DEV ?? false;
const devLog = (...args) => { if (isDev) console.log(...args); };
const devError = (...args) => { if (isDev) console.error(...args); };
// Always-log helpers for debugging production issues
export const logInfo = (...args) => console.info(...args);
export const logError = (...args) => console.error(...args);

const API_BASE_URL = 'https://www.sankavollerei.web.id/anime';

// ═══════════════════════════════════════════════════════
// TWO-LAYER CACHE — L1: in-memory (fast), L2: localStorage (persistent)
// ═══════════════════════════════════════════════════════
const L1 = new Map(); // in-memory, cleared on page reload
const LS_PREFIX = 'fnk_cache_';
const LS_MAX_ENTRIES = 60; // guard against localStorage bloat

const CACHE_TTL = {
  long:   30 * 60 * 1000,  // 30 min — genres, az-list, schedule
  medium: 10 * 60 * 1000,  // 10 min — home, ongoing, completed
  short:   3 * 60 * 1000,  //  3 min — episode detail, search
};

const getCacheTTL = (url) => {
  if (url.includes('/genre') || url.includes('/unlimited') || url.includes('/schedule'))
    return CACHE_TTL.long;
  if (url.includes('/search') || url.includes('/episode') || url.includes('/server'))
    return CACHE_TTL.short;
  return CACHE_TTL.medium;
};

// Prune expired localStorage entries to stay under LS_MAX_ENTRIES
const pruneLS = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
    const now = Date.now();
    let expired = keys.filter(k => {
      try { return now > JSON.parse(localStorage.getItem(k)).expiry; } catch { return true; }
    });
    expired.forEach(k => localStorage.removeItem(k));
    // If still too many, remove oldest by expiry
    const remaining = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
    if (remaining.length > LS_MAX_ENTRIES) {
      const sorted = remaining
        .map(k => { try { return { k, expiry: JSON.parse(localStorage.getItem(k)).expiry }; } catch { return { k, expiry: 0 }; } })
        .sort((a, b) => a.expiry - b.expiry);
      sorted.slice(0, sorted.length - LS_MAX_ENTRIES).forEach(({ k }) => localStorage.removeItem(k));
    }
  } catch { /* localStorage unavailable */ }
};

const getFromCache = (url) => {
  // L1 hit — fastest path
  const l1 = L1.get(url);
  if (l1) {
    if (Date.now() <= l1.expiry) return l1.data;
    L1.delete(url);
  }
  // L2 hit — localStorage survives page reload
  try {
    const raw = localStorage.getItem(LS_PREFIX + url);
    if (raw) {
      const entry = JSON.parse(raw);
      if (Date.now() <= entry.expiry) {
        L1.set(url, entry); // promote to L1
        return entry.data;
      }
      localStorage.removeItem(LS_PREFIX + url);
    }
  } catch { /* ignore parse errors */ }
  return null;
};

const setCache = (url, data) => {
  const ttl = getCacheTTL(url);
  const entry = { data, expiry: Date.now() + ttl };
  L1.set(url, entry);
  try {
    pruneLS();
    localStorage.setItem(LS_PREFIX + url, JSON.stringify(entry));
  } catch { /* quota exceeded — L1 only */ }
};

// ═══════════════════════════════════════════════════════
// GLOBAL RATE LIMITER — 40 req/min (safe margin from 50)
// Only blocks when approaching limit — requests are parallel by default
// ═══════════════════════════════════════════════════════
const globalRequests = [];
const MAX_REQUESTS_PER_MINUTE = 40;

const isRateLimited = () => {
  const now = Date.now();
  while (globalRequests.length > 0 && now - globalRequests[0] > 60000) {
    globalRequests.shift();
  }
  return globalRequests.length >= MAX_REQUESTS_PER_MINUTE;
};

const trackRequest = () => {
  globalRequests.push(Date.now());
};

// Wait until under rate limit (non-blocking for other parallel requests)
const waitForRateLimit = async () => {
  let attempts = 0;
  while (isRateLimited() && attempts < 5) {
    await new Promise(r => setTimeout(r, 1500));
    attempts++;
  }
  if (isRateLimited()) throw new Error('Server sedang sibuk. Tunggu sebentar lalu coba lagi.');
};

// enqueue kept for backward compat but now just parallel with rate-limit guard
const enqueue = (fn) => fn();

// Debounce function
export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// Error logging utility
export const logAPIError = (error, context = {}) => {
  const timestamp = new Date().toISOString();
  const errorData = {
    timestamp,
    error: error.message,
    name: error.name,
    stack: error.stack,
    context,
  };
  
  devError('API Error:', errorData);
  
  // Log to error tracking service (if available)
  if (typeof window !== 'undefined' && window.onerror) {
    window.onerror(error.message, window.location.href, null, null, error);
  }
  
  return errorData;
};

// Enhanced error handling
export class APIError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

// Utility functions
export const formatAnimeData = (data) => {
  if (!data || !data.results) return data;
  
  return data.results.map(anime => ({
    ...anime,
    title: anime.title || anime.name || anime.series_title,
    slug: anime.slug || anime.series_slug,
    image: anime.image || anime.cover_image || anime.thumbnail,
    episodes: anime.episodes || anime.episode_count,
    status: anime.status || anime.airing_status,
    type: anime.type || anime.series_type,
    year: anime.year || anime.release_year,
  }));
};

export const formatEpisodeData = (data) => {
  if (!data || !data.episodes) return data;
  
  return data.episodes.map(episode => ({
    ...episode,
    title: episode.title || episode.episode_title,
    slug: episode.slug || episode.episode_slug,
    number: episode.number || episode.episode_number,
    air_date: episode.air_date || episode.release_date,
    duration: episode.duration || episode.running_time,
  }));
};

export const formatServerData = (data) => {
  if (!data || !data.servers) return data;
  
  return data.servers.map(server => ({
    ...server,
    name: server.name || server.server_name,
    url: server.url || server.stream_url,
    quality: server.quality || server.resolution,
  }));
};

// Cache management
export const clearCache = () => {
  L1.clear();
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
};

export const getCacheSize = () => L1.size;

export const getCacheKeys = () => Array.from(L1.keys());

// Clear cache for specific pattern
export const clearCachePattern = (pattern) => {
  const keys = Array.from(L1.keys()).filter(key => pattern.test(key));
  keys.forEach(key => {
    L1.delete(key);
    try { localStorage.removeItem(LS_PREFIX + key); } catch { /* ignore */ }
  });
};

// Enhanced API fetching with smart cache, global rate limit, and request queue
const fetchAnime = async (endpoint, _provider = 'default', { priority = false, signal } = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  // Abort early if caller already cancelled
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // 1. Check cache first — no network needed
  const cachedData = getFromCache(url);
  if (cachedData) return cachedData;

  // 2. Check global rate limit — only blocks when near threshold
  if (isRateLimited()) {
    await waitForRateLimit();
  }

  // 3. Priority requests skip queue (episode detail, server fetch)
  const doFetch = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const cached2 = getFromCache(url);
    if (cached2) return cached2;
    trackRequest();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        // Rate limited by server — wait and retry once
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, 3000));
          const retry = await fetch(url, { headers: { 'Accept': 'application/json' }, signal });
          if (retry.ok) {
            const retryData = await retry.json();
            setCache(url, retryData);
            return retryData;
          }
          throw new APIError('Server rate limit. Coba lagi dalam beberapa detik.', 429);
        }

        let parsed = null;
        if (contentType.includes('application/json')) {
          try { parsed = await response.json(); } catch { /* ignore */ }
        }

        if (response.status === 404) {
          throw new APIError('Episode atau anime tidak ditemukan', 404);
        }

        if (parsed && typeof parsed === 'object') return parsed;

        throw new APIError(`Server error: ${response.status}`, response.status);
      }

      const data = await response.json();
      setCache(url, data);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (error instanceof APIError) throw error;
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Gagal terhubung ke server. Periksa koneksi internet.');
      }
      throw error;
    }
  };

  // Priority requests execute immediately, others go through queue
  if (priority) return doFetch();
  return enqueue(doFetch);
};

// ═══════════════════════════════════════════════════════
// ANOBOY NORMALIZER
// Respons mentah Anoboy: { status, source, anime_list | genres | detail | streams }
// Dibuat menyerupai bentuk otakudesu/samehadaku: { data: { animeList | ... } }
// ═══════════════════════════════════════════════════════
const anoboyEpisodeNumber = (value, title = '') => {
  const fromField = Number(String(value ?? '').replace(/[^\d]/g, ''));
  if (fromField) return fromField;
  const m = String(title).match(/episode\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
};

// Slug rilisan terbaru Anoboy berupa slug EPISODE
// ("solo-leveling-episode-1-subtitle-indonesia"). Untuk kartu anime kita
// butuh slug ANIME-nya ("solo-leveling"), jadi bagian episode dipotong.
export const anoboyAnimeSlugFromEpisode = (slug = '') =>
  slug.replace(/-episode-\d+.*$/i, '').replace(/-subtitle-indonesia$/i, '');

export const normalizeAnoboyList = (res) => {
  const list = Array.isArray(res?.anime_list) ? res.anime_list : [];
  return {
    data: {
      animeList: list.map((item) => {
        const isEpisodeSlug = /-episode-\d+/i.test(item.slug || '');
        return {
        animeId: isEpisodeSlug ? anoboyAnimeSlugFromEpisode(item.slug) : item.slug,
        episodeId: isEpisodeSlug ? item.slug : null,
        slug: item.slug,
        title: isEpisodeSlug
          ? (item.title || '').replace(/\s*Episode\s*\d+.*$/i, '').trim()
          : (item.title || ''),
        poster: item.poster || '',
        status: item.status || '',
        type: item.type || '',
        // "Ep 7" → 7 (dipakai badge episode di AnimeCard)
        episodes: anoboyEpisodeNumber(item.episode, item.title),
        episodeLabel: item.episode || '',
        href: item.url || '',
        provider: 'anoboy',
        providers: ['anoboy'],
        };
      }),
    },
    pagination: { currentPage: res?.page ?? null },
  };
};

export const normalizeAnoboyGenres = (res) => ({
  data: {
    genreList: (Array.isArray(res?.genres) ? res.genres : []).map((g) => ({
      genreId: g.slug,
      slug: g.slug,
      title: g.name || g.slug,
      provider: 'anoboy',
    })),
  },
});

export const normalizeAnoboyDetail = (res, slug) => {
  const d = res?.detail;
  if (!d) return { data: null };
  const info = d.info || {};
  const episodeList = (Array.isArray(d.episode_list) ? d.episode_list : []).map((ep) => ({
    episodeId: ep.slug,
    slug: ep.slug,
    title: ep.title || `Episode ${ep.episode}`,
    episode: anoboyEpisodeNumber(ep.episode, ep.title),
    releaseDate: ep.release_date || '',
  }));

  return {
    data: {
      animeId: slug,
      slug,
      title: d.title || '',
      poster: d.poster || '',
      synopsis: d.synopsis || '',
      description: d.synopsis || '',
      status: info.status || '',
      type: info.type || '',
      studios: info.studio || '',
      aired: info.released || '',
      season: info.season || '',
      duration: info.duration || '',
      score: d.score || info.score || '',
      episodes: Number(info.episodes) || episodeList.length,
      genreList: (Array.isArray(d.genres) ? d.genres : []).map((g) => ({
        genreId: g.slug,
        title: g.name || g.slug,
      })),
      episodeList,
      provider: 'anoboy',
    },
  };
};

export const normalizeAnoboyEpisode = (res) => {
  const streams = Array.isArray(res?.streams) ? res.streams : [];
  const servers = streams.map((s, i) => ({
    title: s.name || `Server ${i + 1}`,
    name: s.name || `Server ${i + 1}`,
    url: s.url,
    quality: 'Streaming',
  }));
  if (!servers.length) return { data: null };
  return {
    data: {
      title: res.title || '',
      animeId: res.anime_slug || '',
      defaultStreamingUrl: servers[0].url,
      servers,
      downloads: Array.isArray(res.downloads) ? res.downloads : [],
      provider: 'anoboy',
    },
  };
};

// ═══════════════════════════════════════════════════════
// NONTONANIMEID (scraper internal, lewat /api/public/nontonanimeid)
// Semua respons di-normalisasi ke bentuk { data: { animeList } } supaya
// komponen yang sudah ada bisa memakainya sama seperti provider lain.
// ═══════════════════════════════════════════════════════
const NAID_ENDPOINT = '/api/public/nontonanimeid';

const naidSlug = (link = '') => {
  const path = String(link).replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '');
  return path.split('/').filter(Boolean).pop() || '';
};

const naidEpisodeNumber = (value, title = '') => {
  const fromField = Number(String(value ?? '').replace(/[^\d]/g, ''));
  if (fromField) return fromField;
  const m = String(title).match(/episode\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
};

const naidCleanTitle = (title = '') =>
  String(title)
    .replace(/\s*Episode\s*\d+.*$/i, '')
    .replace(/^Nonton\s+/i, '')
    .replace(/\s*Sub(title)?\s*Indo(nesia)?$/i, '')
    .trim();

const fetchNaid = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
  });
  const url = `${NAID_ENDPOINT}?${query.toString()}`;

  const cached = getFromCache(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NontonAnimeID request failed (${res.status})`);
  const body = await res.json();
  if (!body?.ok) throw new Error(body?.error || 'NontonAnimeID scrape failed');
  setCache(url, body.data);
  return body.data;
};

const naidCardToAnime = (item, status) => {
  const link = item.link || item.url || '';
  const slug = naidSlug(link);
  const isEpisode = /-episode-\d+/i.test(slug) || /episode/i.test(item.episode || '');
  return {
    animeId: slug,
    slug,
    episodeId: isEpisode && /-episode-\d+/i.test(slug) ? slug : null,
    title: naidCleanTitle(item.title),
    poster: item.image || item.poster || '',
    status: item.status || status || '',
    type: item.type || '',
    score: item.rating || item.score || '',
    episodes: naidEpisodeNumber(item.current_episode || item.episode, item.title),
    episodeLabel: item.current_episode || item.episode || '',
    href: link,
    genres: Array.isArray(item.genres) ? item.genres : [],
    provider: 'nontonanimeid',
    providers: ['nontonanimeid'],
  };
};

export const normalizeNaidList = (data, status) => {
  const list = Array.isArray(data) ? data : [];
  return {
    data: { animeList: list.map((item) => naidCardToAnime(item, status)).filter((a) => a.title && a.slug) },
  };
};

export const normalizeNaidHome = (data) => ({
  data: {
    latest: (data?.episode_terbaru || []).map((i) => naidCardToAnime(i, 'Ongoing')),
    ongoing: (data?.series_terbaru_tv || []).map((i) => naidCardToAnime(i, 'Ongoing')),
    movies: (data?.series_terbaru_movie || []).map((i) => naidCardToAnime(i)),
    popular: (data?.popular_series_semua || []).map((i) => naidCardToAnime(i)),
  },
});

export const normalizeNaidGenres = (data) => ({
  data: {
    genreList: (Array.isArray(data) ? data : []).map((g) => ({
      genreId: g.slug,
      slug: g.slug,
      title: g.name || g.slug,
      poster: g.image || '',
      provider: 'nontonanimeid',
    })),
  },
});

export const normalizeNaidDetail = (data, slug) => {
  if (!data?.title) return { data: null };
  const details = data.details || {};
  return {
    data: {
      animeId: slug,
      slug,
      title: naidCleanTitle(data.title),
      poster: data.poster || '',
      synopsis: data.synopsis || '',
      description: data.synopsis || '',
      status: data.status || details['Status'] || '',
      type: data.type || details['Type'] || '',
      studios: details['Studio'] || details['Studios'] || '',
      aired: details['Released'] || details['Aired'] || '',
      season: data.season || '',
      duration: data.episode_duration || details['Duration'] || '',
      score: data.score || '',
      trailer: data.trailer || '',
      episodes: naidEpisodeNumber(data.total_episodes) || (data.episodes || []).length,
      genreList: (data.genres || []).map((g) => ({ genreId: naidSlug(g.link), title: g.name })),
      episodeList: (data.episodes || []).map((ep) => ({
        episodeId: naidSlug(ep.link),
        slug: naidSlug(ep.link),
        title: ep.title || '',
        episode: naidEpisodeNumber(ep.title, ep.title),
        releaseDate: ep.date || '',
      })),
      recommendations: (data.recommended_series || []).map((i) => naidCardToAnime(i)),
      provider: 'nontonanimeid',
    },
  };
};

export const normalizeNaidEpisode = (data) => {
  const servers = [];
  if (data?.default_video_url) {
    servers.push({ title: 'Default', name: 'Default', url: data.default_video_url, quality: 'Streaming' });
  }
  (data?.video_servers || []).forEach((s, i) => {
    servers.push({
      title: s.server_name || `Server ${i + 1}`,
      name: s.server_name || `Server ${i + 1}`,
      url: '',
      quality: 'Streaming',
      naid: { post: s.post_id, nume: s.nume, server: s.server_type, nonce: data.nonce, ajaxUrl: data.ajax_url },
    });
  });
  if (!servers.length) return { data: null };
  return {
    data: {
      title: data.title || '',
      animeId: naidSlug(data.anime_link || ''),
      defaultStreamingUrl: data.default_video_url || '',
      servers,
      downloads: data.download_links || [],
      prevEpisode: data.prev_episode_link ? { episodeId: naidSlug(data.prev_episode_link) } : null,
      nextEpisode: data.next_episode_link ? { episodeId: naidSlug(data.next_episode_link) } : null,
      provider: 'nontonanimeid',
    },
  };
};

// Provider-specific API endpoints


const providers = {
  otakudesu: {
    getHome: () => fetchAnime('/home', 'otakudesu'),
    getSchedule: () => fetchAnime('/schedule', 'otakudesu'),
    getOngoing: (page = 1) => fetchAnime(`/ongoing-anime?page=${page}`, 'otakudesu'),
    getCompleted: (page = 1) => fetchAnime(`/complete-anime?page=${page}`, 'otakudesu'),
    getGenres: () => fetchAnime('/genre', 'otakudesu'),
    getGenreAnime: (slug) => fetchAnime(`/genre/${slug}`, 'otakudesu'),
    search: (keyword) => fetchAnime(`/search/${encodeURIComponent(keyword)}`, 'otakudesu'),
    getAnimeDetail: (slug) => fetchAnime(`/anime/${slug}`, 'otakudesu'),
    getEpisodeDetail: (slug) => fetchAnime(`/episode/${slug}`, 'otakudesu', { priority: true }),
    getStreamingServer: (serverId) => fetchAnime(`/server/${serverId}`, 'otakudesu', { priority: true }),
    getBatch: (slug) => fetchAnime(`/batch/${slug}`, 'otakudesu'),
    getUnlimited: () => fetchAnime('/unlimited', 'otakudesu'),
  },
  
  donghua: {
    getHome: (page = 1) => fetchAnime(`/donghua/home/${page}`, 'donghua'),
    getOngoing: (page = 1) => fetchAnime(`/donghua/ongoing/${page}`, 'donghua'),
    getCompleted: (page = 1) => fetchAnime(`/donghua/completed/${page}`, 'donghua'),
    getGenres: () => fetchAnime('/donghua/genres', 'donghua'),
    getGenreAnime: (slug, page = 1) => fetchAnime(`/donghua/genres/${slug}/${page}`, 'donghua'),
    getAZList: (letter, page = 1) => fetchAnime(`/donghua/az-list/${letter}/${page}`, 'donghua'),
    search: (keyword) => fetchAnime(`/donghua/search/${encodeURIComponent(keyword)}`, 'donghua'),
  },
  
  samehadaku: {
    getHome: () => fetchAnime('/samehadaku/home', 'samehadaku'),
    getOngoing: () => fetchAnime('/samehadaku/ongoing', 'samehadaku'),
    getCompleted: () => fetchAnime('/samehadaku/completed', 'samehadaku'),
    getPopular: () => fetchAnime('/samehadaku/popular', 'samehadaku'),
    getMovies: () => fetchAnime('/samehadaku/movies', 'samehadaku'),
    getList: () => fetchAnime('/samehadaku/list', 'samehadaku'),
    getSchedule: () => fetchAnime('/samehadaku/schedule', 'samehadaku'),
    getGenres: () => fetchAnime('/samehadaku/genres', 'samehadaku'),
    getGenreAnime: (genreId) => fetchAnime(`/samehadaku/genres/${genreId}`, 'samehadaku'),
    search: (keyword) => fetchAnime(`/samehadaku/search?q=${encodeURIComponent(keyword)}`, 'samehadaku'),
    getAnimeDetail: (animeId) => fetchAnime(`/samehadaku/anime/${animeId}`, 'samehadaku'),
    getEpisodeDetail: (episodeId) => fetchAnime(`/samehadaku/episode/${episodeId}`, 'samehadaku', { priority: true }),
    getStreamingServer: (serverId) => fetchAnime(`/samehadaku/server/${serverId}`, 'samehadaku'),
    getBatchList: () => fetchAnime('/samehadaku/batch', 'samehadaku'),
    getBatchDetail: (batchId) => fetchAnime(`/samehadaku/batch/${batchId}`, 'samehadaku'),
  },
  
  kusonime: {
    getLatest: () => fetchAnime('/kusonime/latest', 'kusonime'),
    getAll: () => fetchAnime('/kusonime/all-anime', 'kusonime'),
    getGenres: () => fetchAnime('/kusonime/all-genres', 'kusonime'),
    getGenreAnime: (slug) => fetchAnime(`/kusonime/genre/${slug}`, 'kusonime'),
    search: (keyword) => fetchAnime(`/kusonime/search/${encodeURIComponent(keyword)}`, 'kusonime'),
  },
  
  // ── Anoboy (sankavollerei) ──
  // Semua endpoint di-normalisasi jadi bentuk { data: { animeList } } /
  // { data: { ...detail } } supaya komponen yang sudah ada (Home, Genres,
  // Search, AZList, AnimeDetail, Watch) bisa memakainya tanpa cabang khusus,
  // persis seperti otakudesu & samehadaku.
  anoboy: {
    getHome: (page = 1) =>
      fetchAnime(`/anoboy/home?page=${page}`, 'anoboy').then(normalizeAnoboyList),
    getList: ({ status = '', type = '', order = 'update', page = 1 } = {}) =>
      fetchAnime(
        `/anoboy/list?${new URLSearchParams({
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
          ...(order ? { order } : {}),
          page: String(page),
        }).toString()}`,
        'anoboy',
      ).then(normalizeAnoboyList),
    getGenres: () => fetchAnime('/anoboy/genres', 'anoboy').then(normalizeAnoboyGenres),
    getGenreAnime: (slug, page = 1) =>
      fetchAnime(`/anoboy/genre/${slug}?page=${page}`, 'anoboy').then(normalizeAnoboyList),
    getAZList: (letter = 'A', page = 1) =>
      fetchAnime(`/anoboy/az-list?page=${page}&show=${encodeURIComponent(letter)}`, 'anoboy')
        .then(normalizeAnoboyList),
    search: (keyword, page = 1) =>
      fetchAnime(
        `/anoboy/search/${encodeURIComponent(keyword)}?page=${page}`,
        'anoboy',
      ).then(normalizeAnoboyList),
    getAnimeDetail: (slug) =>
      fetchAnime(`/anoboy/anime/${slug}`, 'anoboy').then((res) => normalizeAnoboyDetail(res, slug)),
    getEpisodeDetail: (slug) =>
      fetchAnime(`/anoboy/episode/${slug}`, 'anoboy', { priority: true })
        .then(normalizeAnoboyEpisode),
  },

  // ── NontonAnimeID (scraper internal via /api/public/nontonanimeid) ──
  nontonanimeid: {
    getHome: () => fetchNaid({ action: 'home' }).then(normalizeNaidHome),
    getOngoing: (page = 1) =>
      fetchNaid({ action: 'ongoing', page }).then((d) => normalizeNaidList(d, 'Ongoing')),
    getList: (page = 1, filters = {}) =>
      fetchNaid({ action: 'list', page, ...filters }).then((d) => normalizeNaidList(d)),
    getCompleted: (page = 1) =>
      fetchNaid({ action: 'list', page, status: 'Completed' }).then((d) =>
        normalizeNaidList(d, 'Completed'),
      ),
    getPopular: (page = 1) => fetchNaid({ action: 'popular', page }),
    getSchedule: () => fetchNaid({ action: 'schedule' }),
    getGenres: () => fetchNaid({ action: 'genres' }).then(normalizeNaidGenres),
    getGenreAnime: (slug, page = 1) =>
      fetchNaid({ action: 'genre', slug, page }).then((d) => normalizeNaidList(d)),
    search: (keyword, page = 1) =>
      fetchNaid({ action: 'search', q: keyword, page }).then((d) => normalizeNaidList(d)),
    getAnimeDetail: (slug) =>
      fetchNaid({ action: 'detail', slug }).then((d) => normalizeNaidDetail(d, slug)),
    getEpisodeDetail: (slug) =>
      fetchNaid({ action: 'stream', slug }).then(normalizeNaidEpisode),
    getVideoIframe: ({ post, nume, server, nonce, ajaxUrl }) =>
      fetchNaid({ action: 'iframe', post, nume, server, nonce, ajax_url: ajaxUrl }),
  },


  oploverz: {
    getHome: () => fetchAnime('/oploverz/home', 'oploverz'),
    getSchedule: () => fetchAnime('/oploverz/schedule', 'oploverz'),
    getOngoing: () => fetchAnime('/oploverz/ongoing', 'oploverz'),
    getCompleted: () => fetchAnime('/oploverz/completed', 'oploverz'),
    getList: () => fetchAnime('/oploverz/list', 'oploverz'),
    search: (keyword) => fetchAnime(`/oploverz/search/${encodeURIComponent(keyword)}`, 'oploverz'),
    getAnimeDetail: (slug) => fetchAnime(`/oploverz/anime/${slug}`, 'oploverz'),
    getEpisodeDetail: (slug) => fetchAnime(`/oploverz/episode/${slug}`, 'oploverz'),
  },
  
  stream: {
    getLatest: () => fetchAnime('/stream/latest', 'stream'),
    getPopular: () => fetchAnime('/stream/popular', 'stream'),
    getList: () => fetchAnime('/stream/list', 'stream'),
    getMovie: () => fetchAnime('/stream/movie', 'stream'),
    getGenres: () => fetchAnime('/stream/genres', 'stream'),
    getGenreAnime: (slug) => fetchAnime(`/stream/genres/${slug}`, 'stream'),
    search: (keyword) => fetchAnime(`/stream/search/${encodeURIComponent(keyword)}`, 'stream'),
    getAnimeDetail: (slug) => fetchAnime(`/stream/anime/${slug}`, 'stream'),
    getEpisodeDetail: (slug) => fetchAnime(`/stream/episode/${slug}`, 'stream', { priority: true }),
  },
};

// Provider switching and search functionality
export const animeAPI = {
  // Provider switching
  setProvider: (provider) => {
     if (!providers[provider]) {
       throw new Error(`Provider ${provider} not found`);
     }
     return providers[provider];
   },

   // Get home data (uses default provider)
   getHome: async () => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getHome) {
       throw new Error('Default provider does not support getHome');
     }
     return defaultProvider.getHome();
   },

   // Home data for Samehadaku
   getHomeSamehadaku: async () => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getHome) {
       throw new Error('Samehadaku provider does not support getHome');
     }
     return providerAPI.getHome();
   },

   // Home data for Stream (Anime Indo) using latest endpoint
   getHomeStream: async () => {
     const providerAPI = providers.stream;
     if (!providerAPI?.getLatest) {
       throw new Error('Stream provider does not support getLatest');
     }
     return providerAPI.getLatest();
   },

   // Get anime detail (uses default provider)
   getAnimeDetail: async (slug) => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getAnimeDetail) {
       throw new Error('Default provider does not support getAnimeDetail');
     }
     return defaultProvider.getAnimeDetail(slug);
   },

   // Samehadaku anime detail
   getAnimeDetailSamehadaku: async (animeId) => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getAnimeDetail) {
       throw new Error('Samehadaku provider does not support getAnimeDetail');
     }
     return providerAPI.getAnimeDetail(animeId);
   },

   // Stream anime detail
   getAnimeDetailStream: async (slug) => {
     const providerAPI = providers.stream;
     if (!providerAPI?.getAnimeDetail) {
       throw new Error('Stream provider does not support getAnimeDetail');
     }
     return providerAPI.getAnimeDetail(slug);
   },

   // Get episode detail (uses default provider)
   getEpisodeDetail: async (slug) => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getEpisodeDetail) {
       throw new Error('Default provider does not support getEpisodeDetail');
     }
     return defaultProvider.getEpisodeDetail(slug);
   },

   // Samehadaku episode detail
   getEpisodeDetailSamehadaku: async (episodeId) => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getEpisodeDetail) {
       throw new Error('Samehadaku provider does not support getEpisodeDetail');
     }
     return providerAPI.getEpisodeDetail(episodeId);
   },

   // Stream episode detail
   getEpisodeDetailStream: async (slug) => {
     const providerAPI = providers.stream;
     if (!providerAPI?.getEpisodeDetail) {
       throw new Error('Stream provider does not support getEpisodeDetail');
     }
     return providerAPI.getEpisodeDetail(slug);
   },

   // Get streaming server URL (uses default provider)
   getStreamingServer: async (serverId) => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getStreamingServer) {
       throw new Error('Default provider does not support getStreamingServer');
     }
     return defaultProvider.getStreamingServer(serverId);
   },

   // Samehadaku streaming server
   getStreamingServerSamehadaku: async (serverId) => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getStreamingServer) {
       throw new Error('Samehadaku provider does not support getStreamingServer');
     }
     return providerAPI.getStreamingServer(serverId);
   },

   // Get schedule (uses default provider)
   getSchedule: async () => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getSchedule) {
       throw new Error('Default provider does not support getSchedule');
     }
     return defaultProvider.getSchedule();
   },

   // Samehadaku schedule
   getScheduleSamehadaku: async () => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getSchedule) {
       throw new Error('Samehadaku provider does not support getSchedule');
     }
     return providerAPI.getSchedule();
   },

   // Get batch download (uses default provider)
   getBatch: async (slug) => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getBatch) {
       throw new Error('Default provider does not support getBatch');
     }
     return defaultProvider.getBatch(slug);
   },

   // Samehadaku batch list and detail
   getBatchListSamehadaku: async () => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getBatchList) {
       throw new Error('Samehadaku provider does not support getBatchList');
     }
     return providerAPI.getBatchList();
   },

   getBatchDetailSamehadaku: async (batchId) => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getBatchDetail) {
       throw new Error('Samehadaku provider does not support getBatchDetail');
     }
     return providerAPI.getBatchDetail(batchId);
   },

   // Get unlimited list (A–Z style; uses default provider)
   getUnlimited: async () => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getUnlimited) {
       throw new Error('Default provider does not support getUnlimited');
     }
     return defaultProvider.getUnlimited();
   },

   // Search across active providers (Otakudesu + Samehadaku)
   searchAll: async (keyword) => {
     const searchResults = {};
     const providerKeys = ['otakudesu', 'samehadaku'];
     
     for (const providerKey of providerKeys) {
       try {
         const providerAPI = providers[providerKey];
         if (providerAPI.search) {
           const results = await providerAPI.search(keyword);
           
           // Check if results indicate "not found" in various formats
           const isNotFound = 
             // Format: { statusCode: 404, ... }
             (results?.statusCode === 404) ||
             // Format: { status: "error", ... }  
             (results?.status === 'error') ||
             // Empty animeList
             (Array.isArray(results?.animeList) && results.animeList.length === 0) ||
             (Array.isArray(results?.data?.animeList) && results.data.animeList.length === 0) ||
             // No data at all
             (!results?.animeList && !results?.data?.animeList && !results?.data);
           
           if (isNotFound) {
             searchResults[providerKey] = {
               data: {
                 animeList: [],
               },
             };
           } else {
             searchResults[providerKey] = results;
           }
         }
       } catch (error) {
         // Any error = treat as empty results for this provider
          devError(`Error searching in ${providerKey}:`, error.message);
         searchResults[providerKey] = {
           data: {
             animeList: [],
           },
         };
       }
     }
     
     return searchResults;
   },
   
   // Single provider search
   search: async (keyword, provider = 'otakudesu') => {
     const providerAPI = providers[provider];
     if (!providerAPI?.search) {
       throw new Error(`Provider ${provider} does not support search`);
     }
     return providerAPI.search(keyword);
   },
  
   // Cross-provider search with fallback
   searchWithFallback: async (keyword) => {
     const providersToSearch = ['otakudesu', 'anoboy', 'oploverz'];
     
     for (const provider of providersToSearch) {
       try {
         const providerAPI = providers[provider];
         if (providerAPI.search) {
           return await providerAPI.search(keyword);
         }
        } catch {
          devLog(`Search failed in ${provider}, trying next...`);
        }
     }
     
     throw new Error('No providers available for search');
   },
  
  // Get available providers (aktif di UI)
  getProviders: () => ['otakudesu', 'samehadaku', 'anoboy', 'nontonanimeid'],

  // ── Anoboy ──
  getHomeAnoboy: (page = 1) => providers.anoboy.getHome(page),
  getListAnoboy: (params) => providers.anoboy.getList(params),
  getGenresAnoboy: () => providers.anoboy.getGenres(),
  getGenreAnimeAnoboy: (slug, page = 1) => providers.anoboy.getGenreAnime(slug, page),
  getAZListAnoboy: (letter = 'A', page = 1) => providers.anoboy.getAZList(letter, page),
  searchAnoboy: (keyword, page = 1) => providers.anoboy.search(keyword, page),
  getAnimeDetailAnoboy: (slug) => providers.anoboy.getAnimeDetail(slug),
  getEpisodeDetailAnoboy: (slug) => providers.anoboy.getEpisodeDetail(slug),
  getOngoingAnoboy: (page = 1) =>
    providers.anoboy.getList({ status: 'ongoing', type: 'tv', order: 'update', page }),
  getCompletedAnoboy: (page = 1) =>
    providers.anoboy.getList({ status: 'completed', type: 'tv', order: 'update', page }),

  // ── NontonAnimeID ──
  getHomeNaid: () => providers.nontonanimeid.getHome(),
  getOngoingNaid: (page = 1) => providers.nontonanimeid.getOngoing(page),
  getCompletedNaid: (page = 1) => providers.nontonanimeid.getCompleted(page),
  getListNaid: (page = 1, filters = {}) => providers.nontonanimeid.getList(page, filters),
  getPopularNaid: (page = 1) => providers.nontonanimeid.getPopular(page),
  getScheduleNaid: () => providers.nontonanimeid.getSchedule(),
  getGenresNaid: () => providers.nontonanimeid.getGenres(),
  getGenreAnimeNaid: (slug, page = 1) => providers.nontonanimeid.getGenreAnime(slug, page),
  searchNaid: (keyword, page = 1) => providers.nontonanimeid.search(keyword, page),
  getAnimeDetailNaid: (slug) => providers.nontonanimeid.getAnimeDetail(slug),
  getEpisodeDetailNaid: (slug) => providers.nontonanimeid.getEpisodeDetail(slug),
  getVideoIframeNaid: (args) => providers.nontonanimeid.getVideoIframe(args),

  
   // Check if provider exists
   hasProvider: (provider) => Object.prototype.hasOwnProperty.call(providers, provider),
  
   // Get provider info
   getProviderInfo: (provider) => {
     if (!providers[provider]) {
       throw new Error(`Provider ${provider} not found`);
     }
     return {
       name: provider,
       endpoints: Object.keys(providers[provider]),
       available: true,
     };
   },

   // Get ongoing anime (uses default provider)
   getOngoing: async (page = 1) => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getOngoing) {
       throw new Error('Default provider does not support getOngoing');
     }
     return defaultProvider.getOngoing(page);
   },

   // Samehadaku ongoing list
   getOngoingSamehadaku: async () => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getOngoing) {
       throw new Error('Samehadaku provider does not support getOngoing');
     }
     return providerAPI.getOngoing();
   },

   // Get completed anime (uses default provider)
   getCompleted: async (page = 1) => {
     const defaultProvider = providers.otakudesu;
     if (!defaultProvider?.getCompleted) {
       throw new Error('Default provider does not support getCompleted');
     }
     return defaultProvider.getCompleted(page);
   },

   // Samehadaku completed list
   getCompletedSamehadaku: async () => {
     const providerAPI = providers.samehadaku;
     if (!providerAPI?.getCompleted) {
       throw new Error('Samehadaku provider does not support getCompleted');
     }
     return providerAPI.getCompleted();
   },

  // Samehadaku full A-Z style list
  getListSamehadaku: async () => {
    const providerAPI = providers.samehadaku;
    if (!providerAPI?.getList) {
      throw new Error('Samehadaku provider does not support list');
    }
    return providerAPI.getList();
  },

   // Get all genres
   getGenres: async (provider = 'otakudesu') => {
     const providerAPI = providers[provider];
     if (!providerAPI?.getGenres) {
       throw new Error(`Provider ${provider} does not support genres`);
     }
     return providerAPI.getGenres();
   },

   // Get anime by genre
   getAnimeByGenre: async (slug, provider = 'otakudesu') => {
     const providerAPI = providers[provider];
     if (!providerAPI?.getGenreAnime) {
       throw new Error(`Provider ${provider} does not support genre filtering`);
     }
     return providerAPI.getGenreAnime(slug);
   },

// Get A-Z list (uses providers that support it)
  getAZList: async (letter = null, provider = 'anoboy') => {
    const providerAPI = providers[provider];
    if (!providerAPI?.getAZList) {
      throw new Error(`Provider ${provider} does not support A-Z listing`);
    }
    
    try {
      if (letter) {
        // For providers that need a letter parameter (donghua)
        const data = await providerAPI.getAZList(letter);
        return data;
      }
      return await providerAPI.getAZList();
    } catch (error) {
      devError(`Failed to fetch A-Z list from ${provider}:`, error);
      throw error;
    }
  },
  
// Enhanced error handling with retry
  fetchWithRetry: async (endpoint, provider = 'default', retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fetchAnime(endpoint, provider);
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        devLog(`Retry ${i + 1} for ${endpoint}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
    // Batch requests
    ,
    batchFetch: async (requests) => {
      const results = {};
      const promises = requests.map(({ endpoint, provider = 'default', key }) => fetchAnime(endpoint, provider).then(data => ({ key, data })));
      
      const resolved = await Promise.allSettled(promises);
      resolved.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[requests[index].key] = result.value.data;
        } else {
          results[requests[index].key] = { error: result.reason.message };
        }
      });
      
      return results;
    },

  // ========== DONGHUA API ==========
  
  // Get Donghua home page
  getDonghuaHome: async (page = 1) => {
    return fetchAnime(`/donghua/home/${page}`, 'donghua');
  },

  // Get Donghua ongoing
  getDonghuaOngoing: async (page = 1) => {
    return fetchAnime(`/donghua/ongoing/${page}`, 'donghua');
  },

  // Get Donghua completed
  getDonghuaCompleted: async (page = 1) => {
    return fetchAnime(`/donghua/completed/${page}`, 'donghua');
  },

  // Get Donghua latest
  getDonghuaLatest: async (page = 1) => {
    return fetchAnime(`/donghua/latest/${page}`, 'donghua');
  },

  // Get Donghua schedule
  getDonghuaSchedule: async () => {
    return fetchAnime('/donghua/schedule', 'donghua');
  },

  // Search Donghua
  searchDonghua: async (keyword) => {
    return fetchAnime(`/donghua/search/${encodeURIComponent(keyword)}`, 'donghua');
  },

  // Get Donghua detail
  getDonghuaDetail: async (slug) => {
    return fetchAnime(`/donghua/detail/${slug}`, 'donghua');
  },

  // Get Donghua episode
  getDonghuaEpisode: async (slug) => {
    return fetchAnime(`/donghua/episode/${slug}`, 'donghua', { priority: true });
  },

  // Get Donghua genres
  getDonghuaGenres: async () => {
    return fetchAnime('/donghua/genres', 'donghua');
  },

  // Get Donghua by genre
  getDonghuaByGenre: async (slug, page = 1) => {
    return fetchAnime(`/donghua/genres/${slug}/${page}`, 'donghua');
  },

  // Get Donghua A-Z list
  getDonghuaAZList: async (letter, page = 1) => {
    return fetchAnime(`/donghua/az-list/${letter}/${page}`, 'donghua');
  },

  // Get Donghua by season/year
  getDonghuaBySeason: async (year) => {
    return fetchAnime(`/donghua/seasons/${year}`, 'donghua');
  },

};

// ═══════════════════════════════════════════════════════
// COMIC API — bacakomik provider on the same Sanka domain.
// Reuses the same cache + rate limiter infra as animeAPI.
// Base path: /comic/bacakomik
// ═══════════════════════════════════════════════════════
const COMIC_BASE_URL = 'https://www.sankavollerei.web.id/comic/bacakomik';

const fetchComic = async (endpoint, { priority = false, signal } = {}) => {
  const url = `${COMIC_BASE_URL}${endpoint}`;

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const cachedData = getFromCache(url);
  if (cachedData) return cachedData;

  if (isRateLimited()) await waitForRateLimit();

  const doFetch = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const cached2 = getFromCache(url);
    if (cached2) return cached2;
    trackRequest();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, 3000));
          const retry = await fetch(url, { headers: { 'Accept': 'application/json' }, signal });
          if (retry.ok) {
            const retryData = await retry.json();
            setCache(url, retryData);
            return retryData;
          }
          throw new APIError('Server rate limit. Coba lagi dalam beberapa detik.', 429);
        }

        let parsed = null;
        if (contentType.includes('application/json')) {
          try { parsed = await response.json(); } catch { /* ignore */ }
        }

        if (response.status === 404) {
          throw new APIError('Komik atau chapter tidak ditemukan', 404);
        }

        if (parsed && typeof parsed === 'object') return parsed;

        throw new APIError(`Server error: ${response.status}`, response.status);
      }

      const data = await response.json();
      setCache(url, data);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (error instanceof APIError) throw error;
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Gagal terhubung ke server. Periksa koneksi internet.');
      }
      throw error;
    }
  };

  if (priority) return doFetch();
  return enqueue(doFetch);
};

// Normalize a bacakomik list/search item into a flat card shape.
// bacakomik items: { title, slug, cover, chapter?, date?, type?, rating?, genre? }
// Defensive: read both camelCase and snake_case since the API is inconsistent.
const normalizeComicItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const cover = item.cover ?? item.poster ?? item.image ?? item.thumbnail ?? '';
  return {
    slug: item.slug ?? '',
    title: item.title ?? item.name ?? 'Untitled',
    poster: cover,
    image: cover,
    chapter: item.chapter ?? item.latestChapter ?? null,
    date: item.date ?? item.time_ago ?? null,
    type: item.type ?? null,
    rating: item.rating ?? null,
    genre: item.genre ?? null,
    provider: 'comic',
  };
};

export const comicAPI = {
  // Latest comics (terbaru) — paginated via ?page=N
  getComicTerbaru: async (page = 1, { signal } = {}) => {
    const path = page > 1 ? `/latest?page=${page}` : '/latest';
    const data = await fetchComic(path, { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return {
      comics,
      hasMore: data?.hasNextPage ?? false,
      currentPage: data?.currentPage ?? page,
      raw: data,
    };
  },

  // Popular comics
  getComicPopuler: async ({ signal } = {}) => {
    const data = await fetchComic('/populer', { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return {
      comics,
      hasMore: data?.hasNextPage ?? false,
      currentPage: data?.currentPage ?? 1,
      raw: data,
    };
  },

  // Search comics — path param, URL-encoded. Supports pagination via ?page=N
  searchComics: async (query, { page = 1, signal } = {}) => {
    if (!query?.trim()) return { comics: [], hasMore: false, raw: null };
    const q = encodeURIComponent(query.trim());
    const data = await fetchComic(`/search/${q}?page=${page}`, { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return {
      comics,
      hasMore: data?.hasNextPage ?? false,
      currentPage: data?.currentPage ?? 1,
      raw: data,
    };
  },

  // All genres — flat array of { title, slug }
  getComicGenres: async ({ signal } = {}) => {
    const data = await fetchComic('/genres', { signal });
    const genres = data?.genres ?? [];
    return genres
      .filter(g => g && (g.slug || g.title))
      .map(g => ({ slug: g.slug ?? '', title: g.title ?? g.slug ?? '' }));
  },

  // Comics by genre — /genre/{slug}?page=N (singular 'genre', not 'genres')
  // Same response shape as latest/populer: komikList[] + hasNextPage + currentPage
  getComicByGenre: async (genreSlug, page = 1, { signal } = {}) => {
    if (!genreSlug) return { comics: [], hasMore: false, currentPage: 1, raw: null };
    const data = await fetchComic(`/genre/${genreSlug}?page=${page}`, { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return {
      comics,
      hasMore: data?.hasNextPage ?? false,
      currentPage: data?.currentPage ?? page,
      raw: data,
    };
  },

  // Comic detail + chapter list
  // Response: { detail: { title, cover, rating, otherTitle, status, type, author,
  //   artist, release, series, reader, synopsis, genres[], chapters[] } }
  // chapters are newest-first (Ch.N first, Ch.1 last)
  getComicDetail: async (slug, { signal } = {}) => {
    const data = await fetchComic(`/detail/${slug}`, { signal });
    const detail = data?.detail ?? data;
    return {
      ...detail,
      provider: 'comic',
      raw: data,
    };
  },

  // Read chapter — priority: true to skip rate-limit queue (LCP-critical)
  // Response: { title, images[], navigation: { next, prev } }
  getComicChapter: async (chapterSlug, { signal } = {}) => {
    const data = await fetchComic(`/chapter/${chapterSlug}`, { signal, priority: true });
    // Normalize navigation: bacakomik uses { next, prev } (may be null at ends)
    const nav = data?.navigation ?? {};
    return {
      title: data?.title ?? '',
      images: Array.isArray(data?.images) ? data.images : [],
      navigation: {
        next: nav.next ?? null,
        prev: nav.prev ?? null,
      },
      raw: data,
    };
  },

  // Recommendations
  getComicRecommendations: async ({ signal } = {}) => {
    const data = await fetchComic('/recomen', { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return { comics, raw: data };
  },

  // Colored comics (komik berwarna) — paginated by path param
  getComicBerwarna: async (page = 1, { signal } = {}) => {
    const data = await fetchComic(`/komikberwarna/${page}`, { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return {
      comics,
      hasMore: data?.hasNextPage ?? false,
      currentPage: data?.currentPage ?? page,
      raw: data,
    };
  },

  // Filter metadata (status, type, genre, author, artist, release, orderby)
  // Returns { title, value } arrays for each filter — NO comic items.
  getComicFilters: async ({ signal } = {}) => {
    const data = await fetchComic('/list', { signal });
    const pick = (arr) => Array.isArray(arr)
      ? arr.filter(v => v && (v.value || v.title)).map(v => ({ title: v.title ?? v.value ?? '', value: v.value ?? '' }))
      : [];
    return {
      status: pick(data?.status),
      type: pick(data?.type),
      genres: pick(data?.genres),
      author: pick(data?.author),
      artist: pick(data?.artist),
      release: pick(data?.release),
      orderby: pick(data?.orderby),
      raw: data,
    };
  },

  // Top/ranking — /top (no pagination, same shape as populer)
  // Response: komikList[] with {title, slug, cover, rating}
  getComicTop: async ({ signal } = {}) => {
    const data = await fetchComic('/top', { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return { comics, raw: data };
  },

  // Filter by type — /only/{type}?page=N (type: manga/manhwa/manhua)
  // Same response shape as latest: komikList[] with {title, slug, cover, chapter, date, type}
  getComicByType: async (type, page = 1, { signal } = {}) => {
    if (!type) return { comics: [], hasMore: false, currentPage: 1, raw: null };
    const data = await fetchComic(`/only/${type}?page=${page}`, { signal });
    const comics = (data?.komikList ?? []).map(normalizeComicItem).filter(Boolean);
    return {
      comics,
      hasMore: data?.hasNextPage ?? false,
      currentPage: data?.currentPage ?? page,
      raw: data,
    };
  },
};

// ═══════════════════════════════════════════════════════
// COMIC API — shinigami provider, diakses via server-side proxy.
// Browser tidak bisa langsung fetch ke sankavollerei.web.id karena CORS.
// Semua request diarahkan ke /api/public/shinigami-proxy?path=<endpoint>
// yang berjalan di server (tidak ada batasan CORS di sisi server).
// ═══════════════════════════════════════════════════════

// Cache key tetap menggunakan path asli agar tidak bentrok dengan provider lain.
const SHINIGAMI_CACHE_PREFIX = 'shinigami:';

const fetchShinigami = async (endpoint, { priority = false, signal } = {}) => {
  // Gunakan path endpoint sebagai cache key (bukan URL eksternal)
  const cacheKey = `${SHINIGAMI_CACHE_PREFIX}${endpoint}`;

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const cachedData = getFromCache(cacheKey);
  if (cachedData) return cachedData;

  if (isRateLimited()) await waitForRateLimit();

  const doFetch = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const cached2 = getFromCache(cacheKey);
    if (cached2) return cached2;
    trackRequest();

    // Route ke server-side proxy — menghindari CORS
    const proxyUrl = `/api/public/shinigami-proxy?path=${encodeURIComponent(endpoint)}`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, 3000));
          const retry = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' }, signal });
          if (retry.ok) {
            const retryData = await retry.json();
            setCache(cacheKey, retryData);
            return retryData;
          }
          throw new APIError('Server rate limit. Coba lagi dalam beberapa detik.', 429);
        }

        let parsed = null;
        if (contentType.includes('application/json')) {
          try { parsed = await response.json(); } catch { /* ignore */ }
        }

        if (response.status === 404) {
          throw new APIError('Komik atau chapter tidak ditemukan', 404);
        }

        if (parsed && typeof parsed === 'object') return parsed;

        throw new APIError(`Server error: ${response.status}`, response.status);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (error instanceof APIError) throw error;
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Gagal terhubung ke server. Periksa koneksi internet.');
      }
      throw error;
    }
  };

  if (priority) return doFetch();
  return enqueue(doFetch);
};

// Normalize a shinigami list/search item into the same flat card shape
// used by normalizeComicItem, so UI components can stay provider-agnostic.
// shinigami items key on manga_id (not slug) and carry genres as
// [{ name, slug }], authors[]/artists[] as [{ name, slug }].
const normalizeShinigamiItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const cover = item.cover ?? item.cover_portrait ?? '';
  return {
    slug: item.manga_id ?? '',
    mangaId: item.manga_id ?? '',
    title: item.title ?? 'Untitled',
    alternativeTitle: item.alternative_title ?? null,
    poster: cover,
    image: cover,
    coverPortrait: item.cover_portrait ?? null,
    chapter: item.latest_chapter ?? null,
    latestChapterId: item.latest_chapter_id ?? null,
    date: item.latest_chapter_time ?? null,
    status: item.status ?? null,
    releaseYear: item.release_year ?? null,
    country: item.country ?? null,
    type: item.format ?? null, // Manga/Manhwa/Manhua
    sourceType: item.type ?? null, // Mirror/Project
    rating: item.rating ?? null,
    views: item.views ?? null,
    bookmarks: item.bookmarks ?? null,
    isRecommended: item.is_recommended ?? false,
    genres: Array.isArray(item.genres) ? item.genres : [],
    authors: Array.isArray(item.authors) ? item.authors : [],
    artists: Array.isArray(item.artists) ? item.artists : [],
    provider: 'shinigami',
  };
};

// Shared pagination shape used by every paginated shinigami endpoint:
// { current_page, total_pages, total_record, page_size }
const normalizeShinigamiPagination = (pagination, fallbackPage = 1) => ({
  currentPage: pagination?.current_page ?? fallbackPage,
  totalPages: pagination?.total_pages ?? 1,
  totalRecord: pagination?.total_record ?? 0,
  pageSize: pagination?.page_size ?? 0,
  hasMore: (pagination?.current_page ?? fallbackPage) < (pagination?.total_pages ?? 1),
});

export const shinigamiAPI = {
  // Home — bundles latest[]/recommended[]/popular[] in one response
  getHome: async ({ signal } = {}) => {
    const data = await fetchShinigami('/home', { signal });
    const d = data?.data ?? {};
    return {
      latest: (d.latest ?? []).map(normalizeShinigamiItem).filter(Boolean),
      recommended: (d.recommended ?? []).map(normalizeShinigamiItem).filter(Boolean),
      popular: (d.popular ?? []).map(normalizeShinigamiItem).filter(Boolean),
      raw: data,
    };
  },

  // Homepage hero slider — { id, title, rating, background_image, chara_image,
  // manga_id, blur_color, category, description, badges[] }
  getSlider: async ({ signal } = {}) => {
    const data = await fetchShinigami('/slider', { signal });
    const slides = Array.isArray(data?.data) ? data.data : [];
    return {
      slides: slides.map(s => ({
        id: s.id ?? null,
        mangaId: s.manga_id ?? '',
        title: s.title ?? '',
        rating: s.rating ?? null,
        backgroundImage: s.background_image ?? '',
        charaImage: s.chara_image ?? '',
        blurColor: s.blur_color ?? null,
        category: s.category ?? null,
        description: s.description ?? '',
        badges: Array.isArray(s.badges) ? s.badges : [],
      })),
      raw: data,
    };
  },

  // Curated explore rows shown on the homepage — /explore/{category-slug}
  // e.g. 'explore-list-1'. Same flat item shape as other list endpoints.
  getExplore: async (categorySlug, { signal } = {}) => {
    if (!categorySlug) return { comics: [], raw: null };
    const data = await fetchShinigami(`/explore/${categorySlug}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return { comics, raw: data };
  },

  // Latest updates — /latest?page=N
  getLatest: async (page = 1, { signal } = {}) => {
    const data = await fetchShinigami(`/latest?page=${page}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return { comics, pagination: normalizeShinigamiPagination(data?.pagination, page), raw: data };
  },

  // Popular comics — /popular?page=N
  getPopular: async (page = 1, { signal } = {}) => {
    const data = await fetchShinigami(`/popular?page=${page}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return { comics, pagination: normalizeShinigamiPagination(data?.pagination, page), raw: data };
  },

  // Recommended comics — /recommended?page=N
  getRecommended: async (page = 1, { signal } = {}) => {
    const data = await fetchShinigami(`/recommended?page=${page}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return { comics, pagination: normalizeShinigamiPagination(data?.pagination, page), raw: data };
  },

  // Search — /search/{query} (path param, URL-encoded, no pagination observed)
  search: async (query, { signal } = {}) => {
    if (!query?.trim()) return { comics: [], raw: null };
    const q = encodeURIComponent(query.trim());
    const data = await fetchShinigami(`/search/${q}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return {
      comics,
      pagination: data?.pagination ? normalizeShinigamiPagination(data.pagination) : null,
      raw: data,
    };
  },

  // Comic detail — /detail/{manga_id}. Response is a single object (not array),
  // with a nested latest_chapter object instead of latest_chapter/_id/_time fields.
  getDetail: async (mangaId, { signal } = {}) => {
    if (!mangaId) return null;
    const data = await fetchShinigami(`/detail/${mangaId}`, { signal });
    const d = data?.data ?? {};
    return {
      mangaId: d.manga_id ?? mangaId,
      title: d.title ?? '',
      alternativeTitle: d.alternative_title ?? null,
      description: d.description ?? '',
      cover: d.cover ?? '',
      coverPortrait: d.cover_portrait ?? null,
      status: d.status ?? null,
      releaseYear: d.release_year ?? null,
      country: d.country ?? null,
      rating: d.rating ?? null,
      views: d.views ?? null,
      bookmarks: d.bookmarks ?? null,
      isRecommended: d.is_recommended ?? false,
      latestChapter: d.latest_chapter ?? null, // { chapter_id, chapter_number, updated_at }
      genres: Array.isArray(d.genres) ? d.genres : [],
      authors: Array.isArray(d.authors) ? d.authors : [],
      artists: Array.isArray(d.artists) ? d.artists : [],
      format: Array.isArray(d.format) ? d.format : [],
      type: Array.isArray(d.type) ? d.type : [],
      provider: 'shinigami',
      raw: data,
    };
  },

  // Chapter list for a manga — /chapters/{manga_id}, paginated.
  // Items: { chapter_id, manga_id, chapter_number, chapter_title, thumbnail, views, release_date }
  getChapters: async (mangaId, page = 1, { signal } = {}) => {
    if (!mangaId) return { chapters: [], pagination: normalizeShinigamiPagination(null, page), raw: null };
    const path = page > 1 ? `/chapters/${mangaId}?page=${page}` : `/chapters/${mangaId}`;
    const data = await fetchShinigami(path, { signal });
    const chapters = (data?.data ?? []).map(c => ({
      chapterId: c.chapter_id ?? '',
      mangaId: c.manga_id ?? mangaId,
      chapterNumber: c.chapter_number ?? null,
      chapterTitle: c.chapter_title ?? null,
      thumbnail: c.thumbnail ?? '',
      views: c.views ?? null,
      releaseDate: c.release_date ?? null,
    }));
    return { chapters, pagination: normalizeShinigamiPagination(data?.pagination, page), raw: data };
  },

  // Read chapter — /read/{chapter_id}. priority: true skips the rate-limit
  // queue since this is LCP-critical (first images of a chapter).
  getChapter: async (chapterId, { signal } = {}) => {
    const data = await fetchShinigami(`/read/${chapterId}`, { signal, priority: true });
    const d = data?.data ?? {};
    return {
      chapterId: d.chapter_id ?? chapterId,
      mangaId: d.manga_id ?? '',
      chapterNumber: d.chapter_number ?? null,
      chapterTitle: d.chapter_title ?? null,
      thumbnail: d.thumbnail ?? '',
      views: d.views ?? null,
      releaseDate: d.release_date ?? null,
      images: Array.isArray(d.images) ? d.images : [],
      totalImages: d.total_images ?? (Array.isArray(d.images) ? d.images.length : 0),
      navigation: {
        prev: d.prev_chapter ? { chapterId: d.prev_chapter.chapter_id, chapterNumber: d.prev_chapter.chapter_number } : null,
        next: d.next_chapter ? { chapterId: d.next_chapter.chapter_id, chapterNumber: d.next_chapter.chapter_number } : null,
      },
      raw: data,
    };
  },

  // Full catalog list with filters — /list?format=manhwa&type=&status=&author=&artist=&page=N
  // Also returns a `facet` block (counts per taxonomy) alongside `data`.
  getList: async (filters = {}, { signal } = {}) => {
    const { page = 1, format, type, status, author, artist } = filters;
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (author) params.set('author', author);
    if (artist) params.set('artist', artist);
    params.set('page', String(page));
    const data = await fetchShinigami(`/list?${params.toString()}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return {
      comics,
      pagination: normalizeShinigamiPagination(data?.pagination, page),
      facet: data?.facet ?? null,
      raw: data,
    };
  },

  // Advanced search — /advanced-search with genre include/exclude + modes + sort.
  // genreInclude/genreExclude accept an array of slugs or a comma-separated string.
  advancedSearch: async (filters = {}, { signal } = {}) => {
    const {
      page = 1,
      query,
      genreInclude,
      genreExclude,
      genreIncludeMode = 'or',
      genreExcludeMode = 'or',
      format,
      type,
      status,
      author,
      artist,
      sort,
    } = filters;
    const toParam = (v) => Array.isArray(v) ? v.join(',') : v;
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (genreInclude) params.set('genre_include', toParam(genreInclude));
    if (genreExclude) params.set('genre_exclude', toParam(genreExclude));
    if (genreInclude) params.set('genre_include_mode', genreIncludeMode);
    if (genreExclude) params.set('genre_exclude_mode', genreExcludeMode);
    if (format) params.set('format', format);
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (author) params.set('author', author);
    if (artist) params.set('artist', artist);
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    const data = await fetchShinigami(`/advanced-search?${params.toString()}`, { signal });
    const comics = (data?.data ?? []).map(normalizeShinigamiItem).filter(Boolean);
    return {
      comics,
      pagination: normalizeShinigamiPagination(data?.pagination, page),
      facet: data?.facet ?? null,
      appliedFilters: data?.filters ?? null,
      raw: data,
    };
  },

  // Taxonomy — genres, formats, types: flat arrays of { id, slug, name, type }
  getGenres: async ({ signal } = {}) => {
    const data = await fetchShinigami('/genres', { signal });
    return { genres: Array.isArray(data?.data) ? data.data : [], raw: data };
  },

  getFormats: async ({ signal } = {}) => {
    const data = await fetchShinigami('/formats', { signal });
    return { formats: Array.isArray(data?.data) ? data.data : [], raw: data };
  },

  getTypes: async ({ signal } = {}) => {
    const data = await fetchShinigami('/types', { signal });
    return { types: Array.isArray(data?.data) ? data.data : [], raw: data };
  },

  // Authors / artists directory — /authors?q=&page=N, /artists?q=&page=N
  getAuthors: async ({ q = '', page = 1 } = {}, { signal } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('page', String(page));
    const data = await fetchShinigami(`/authors?${params.toString()}`, { signal });
    return {
      authors: Array.isArray(data?.data) ? data.data : [],
      pagination: normalizeShinigamiPagination(data?.pagination, page),
      raw: data,
    };
  },

  getArtists: async ({ q = '', page = 1 } = {}, { signal } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('page', String(page));
    const data = await fetchShinigami(`/artists?${params.toString()}`, { signal });
    return {
      artists: Array.isArray(data?.data) ? data.data : [],
      pagination: normalizeShinigamiPagination(data?.pagination, page),
      raw: data,
    };
  },
};
