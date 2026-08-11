// ═══════════════════════════════════════════════════════════════
// Provider sankavollerei.web.id (Oploverz, Nimegami, Alqanime, Stream)
//
// Semua respons mentah dari API dinormalisasi ke bentuk yang sama dengan
// provider lama (otakudesu/samehadaku/anoboy):
//   list    -> { data: { animeList: [...] }, pagination: { currentPage } }
//   detail  -> { data: { ...detail, genreList, episodeList } }
//   episode -> { data: { title, servers, defaultStreamingUrl, downloads } }
// Sehingga Home, Search, AnimeDetail, dan Watch bisa memakainya tanpa
// cabang khusus per provider.
// ═══════════════════════════════════════════════════════════════

export const epNumber = (value, title = '') => {
  const fromField = Number(String(value ?? '').replace(/[^\d]/g, ''));
  if (fromField) return fromField;
  const m = String(title).match(/episode\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
};

export const animeSlugFromEpisode = (slug = '') =>
  String(slug)
    .replace(/-episode-[\d\w-]*$/i, '')
    .replace(/-subtitle-indonesia$/i, '');

export const cleanTitle = (title = '') =>
  String(title)
    .replace(/\s*Episode\s*[\d\S]*.*$/i, '')
    .replace(/^Nonton\s+/i, '')
    .replace(/\s*Sub(title)?\s*Indo(nesia)?\s*$/i, '')
    .replace(/\s*\[END\]\s*$/i, '')
    .trim();

// Kartu generik dari item `anime_list` (Anoboy / Oploverz / Nimegami)
const toCard = (item, provider, statusFallback = '') => {
  const slug = item.slug || '';
  const isEpisodeSlug = /-episode-[\d]/i.test(slug);
  return {
    animeId: isEpisodeSlug ? animeSlugFromEpisode(slug) : slug,
    episodeId: isEpisodeSlug ? slug : null,
    slug,
    title: cleanTitle(item.title || '') || item.title || '',
    poster: item.poster || item.image || '',
    status: item.status || statusFallback || '',
    type: item.type || '',
    score: item.rating || item.score || '',
    episodes: epNumber(item.episode, item.title),
    episodeLabel: item.episode || '',
    href: item.url || item.oploverz_url || item.nimegami_url || '',
    provider,
    providers: [provider],
  };
};

export const normalizeSankaList = (res, provider, statusFallback = '') => {
  const raw =
    (Array.isArray(res?.anime_list) && res.anime_list) ||
    (Array.isArray(res?.data) && res.data) ||
    (Array.isArray(res?.results) && res.results) ||
    (Array.isArray(res?.data?.anime_list) && res.data.anime_list) ||
    [];
  return {
    data: { animeList: raw.map((it) => toCard(it, provider, statusFallback)) },
    pagination: { currentPage: res?.page ?? res?.data?.page ?? null },
  };
};

export const normalizeSankaGenres = (res, provider) => {
  const raw =
    (Array.isArray(res?.genres) && res.genres) ||
    (Array.isArray(res?.data) && res.data) ||
    (Array.isArray(res?.data?.genres) && res.data.genres) ||
    [];
  return {
    data: {
      genreList: raw.map((g) => {
        if (typeof g === 'string') return { genreId: g.toLowerCase(), slug: g.toLowerCase(), title: g, provider };
        return { genreId: g.slug || g.id || g.name, slug: g.slug || g.name, title: g.name || g.title || g.slug, provider };
      }),
    },
  };
};

// ── Oploverz / Anoboy: { detail: { title, poster, info, genres, episode_list } }
export const normalizeSankaDetail = (res, slug, provider) => {
  const d = res?.detail || res?.data || null;
  if (!d) return { data: null };
  const info = d.info || {};
  const episodeList = (Array.isArray(d.episode_list) ? d.episode_list : []).map((ep, i) => ({
    episodeId: ep.slug || ep.url || `${slug}-episode-${ep.episode ?? i + 1}`,
    slug: ep.slug || '',
    title: ep.title || `Episode ${ep.episode ?? i + 1}`,
    episode: epNumber(ep.episode, ep.title) || i + 1,
    releaseDate: ep.release_date || ep.date || '',
  }));

  return {
    data: {
      animeId: slug,
      slug,
      title: cleanTitle(d.title || '') || d.title || slug,
      poster: d.poster || '',
      synopsis: d.synopsis || '',
      description: d.synopsis || '',
      status: info.status || '',
      type: info.type || info.tipe || '',
      studios: info.studio || '',
      aired: info.released_on || info.released || info.dirilis || '',
      season: info.season || info.musim || '',
      duration: info.duration || info.durasi || info.durasi_per_episode || '',
      score: d.rating || d.score || '',
      episodes: Number(info.episodes || info.episode) || episodeList.length,
      genreList: (Array.isArray(d.genres) ? d.genres : []).map((g) =>
        typeof g === 'string'
          ? { genreId: g.toLowerCase(), title: g }
          : { genreId: g.slug || g.name, title: g.name || g.slug },
      ),
      episodeList,
      downloads: Array.isArray(d.downloads) ? d.downloads : [],
      provider,
    },
  };
};

// ── Oploverz / Anoboy episode: { episode_title | title, streams, downloads }
export const normalizeSankaEpisode = (res, provider) => {
  const streams = Array.isArray(res?.streams) ? res.streams : [];
  const servers = streams
    .filter((s) => s?.url)
    .map((s, i) => ({
      title: s.name || `Server ${i + 1}`,
      name: s.name || `Server ${i + 1}`,
      url: s.url,
      quality: s.resolution || 'Streaming',
    }));
  if (!servers.length) return { data: null };
  return {
    data: {
      title: res.episode_title || res.title || '',
      animeId: res.anime_slug || animeSlugFromEpisode(res.slug || ''),
      defaultStreamingUrl: servers[0].url,
      servers,
      downloads: Array.isArray(res.downloads) ? res.downloads : [],
      provider,
    },
  };
};

// ── Nimegami: detail memakai `streams_by_episode` (tidak ada slug episode).
// Episode dibuat sintetis: "<slug>::<Episode X>" supaya bisa dirouting.
export const NIMEGAMI_EP_SEP = '$$';

export const normalizeNimegamiDetail = (res, slug) => {
  const d = res?.detail;
  if (!d) return { data: null };
  const info = d.info || {};
  const streamsByEp = res?.streams_by_episode || {};
  const episodeList = Object.keys(streamsByEp).map((label, i) => ({
    episodeId: `${slug}${NIMEGAMI_EP_SEP}${encodeURIComponent(label)}`,
    slug,
    title: label,
    episode: epNumber(label, label) || i + 1,
    releaseDate: '',
  }));

  return {
    data: {
      animeId: slug,
      slug,
      title: cleanTitle(info.judul || d.title || '') || d.title || slug,
      poster: d.poster || '',
      synopsis: d.synopsis || '',
      description: d.synopsis || '',
      status: info.status || '',
      type: info.type || '',
      studios: info.studio || '',
      aired: info.musim__rilis || '',
      season: info.musim__rilis || '',
      duration: info.durasi_per_episode || '',
      score: info.rating || '',
      episodes: episodeList.length,
      genreList: (Array.isArray(d.genres) ? d.genres : []).map((g) => ({
        genreId: g.slug || g.name,
        title: g.name || g.slug,
      })),
      episodeList,
      provider: 'nimegami',
    },
  };
};

export const normalizeNimegamiEpisode = (res, episodeLabel) => {
  const map = res?.streams_by_episode || {};
  const label = episodeLabel && map[episodeLabel] ? episodeLabel : Object.keys(map)[0];
  const list = Array.isArray(map[label]) ? map[label] : [];
  const servers = list
    .filter((s) => s?.url)
    .map((s, i) => ({
      title: s.name || `Server ${i + 1}`,
      name: s.name || `Server ${i + 1}`,
      url: s.url,
      quality: s.resolution || 'Streaming',
    }));
  if (!servers.length) return { data: null };
  const dlGroups = res?.download_groups || {};
  const dlKey = Object.keys(dlGroups).find((k) => k.startsWith(String(label)));
  return {
    data: {
      title: `${res?.detail?.title || ''} ${label || ''}`.trim(),
      animeId: '',
      defaultStreamingUrl: servers[0].url,
      servers,
      downloads: dlKey ? dlGroups[dlKey] : [],
      provider: 'nimegami',
    },
  };
};

// ── Alqanime: { data: { slider, hot, latest, ... } } / detail terpisah
const alqCard = (item, statusFallback = '') => ({
  animeId: item.slug || '',
  episodeId: null,
  slug: item.slug || '',
  title: cleanTitle(item.title || '') || item.title || '',
  poster: item.poster || '',
  status: item.status || statusFallback || '',
  type: item.type || '',
  score: item.rating || '',
  episodes: epNumber(item.episode, item.title),
  episodeLabel: item.episode || '',
  href: item.url || '',
  provider: 'alqanime',
  providers: ['alqanime'],
});

export const normalizeAlqList = (res, key = null, statusFallback = '') => {
  const d = res?.data;
  const raw = Array.isArray(d)
    ? d
    : (key && Array.isArray(d?.[key]) && d[key]) ||
      (Array.isArray(d?.latest) && d.latest) ||
      (Array.isArray(d?.anime_list) && d.anime_list) ||
      (Array.isArray(res?.anime_list) && res.anime_list) ||
      [];
  return {
    data: { animeList: raw.map((it) => alqCard(it, statusFallback)) },
    pagination: { currentPage: res?.page ?? null },
  };
};

export const normalizeAlqHome = (res) => {
  const d = res?.data || {};
  return {
    slider: (d.slider || []).map((i) => alqCard(i)),
    hot: (d.hot || []).map((i) => alqCard(i)),
    latest: (d.latest || []).map((i) => alqCard(i)),
    data: { animeList: (d.latest || []).map((i) => alqCard(i)) },
  };
};

export const normalizeAlqDetail = (res, slug) => {
  const d = res?.data;
  if (!d) return { data: null };
  const info = d.info || {};
  const episodeList = (Array.isArray(d.episode_list) ? d.episode_list : []).map((ep, i) => ({
    episodeId: ep.slug || `${slug}-episode-${ep.episode ?? i + 1}`,
    slug: ep.slug || '',
    title: ep.title || `Episode ${ep.episode ?? i + 1}`,
    episode: epNumber(ep.episode, ep.title) || i + 1,
    releaseDate: ep.date || '',
    // Alqanime kadang tidak punya slug episode — simpan link download sebagai fallback
    downloads: ep.links || [],
  }));

  return {
    data: {
      animeId: slug,
      slug,
      title: cleanTitle(d.title || '') || d.title || slug,
      poster: d.poster || '',
      synopsis: d.synopsis || '',
      description: d.synopsis || '',
      status: info.status || '',
      type: info.tipe || '',
      studios: info.studio || '',
      aired: info.dirilis || '',
      season: info.musim || '',
      duration: info.durasi || '',
      score: d.rating || '',
      trailer: d.trailer || '',
      episodes: episodeList.length,
      genreList: (Array.isArray(d.genres) ? d.genres : []).map((g) => ({
        genreId: g.slug || g.name,
        title: g.name || g.slug,
      })),
      episodeList,
      downloads: Array.isArray(d.downloads) ? d.downloads : [],
      stream_links: Array.isArray(d.stream_links) ? d.stream_links : [],
      provider: 'alqanime',
    },
  };
};

// ── Stream (anime-indo) ──
const streamCard = (item, statusFallback = '') => {
  const slug = item.slug || '';
  const isEpisodeSlug = /-episode-[\d]/i.test(slug);
  return {
    animeId: isEpisodeSlug ? animeSlugFromEpisode(slug) : slug,
    episodeId: isEpisodeSlug ? slug : null,
    slug,
    title: cleanTitle(item.title || '') || item.title || '',
    poster: item.poster || item.image || '',
    status: item.status || statusFallback || '',
    type: item.type || '',
    score: item.rating || item.score || '',
    episodes: epNumber(item.episode, item.title),
    episodeLabel: item.episode ? `Ep ${String(item.episode).replace(/[^\d]/g, '')}` : '',
    href: item.url || '',
    provider: 'stream',
    providers: ['stream'],
  };
};

export const normalizeStreamList = (res, statusFallback = '') => {
  const raw = Array.isArray(res?.data)
    ? res.data
    : (Array.isArray(res?.data?.anime) && res.data.anime) || [];
  return {
    data: { animeList: raw.map((it) => streamCard(it, statusFallback)) },
    pagination: { currentPage: res?.page ?? null },
  };
};

export const normalizeStreamDetail = (res, slug) => {
  const d = res?.data;
  if (!d) return { data: null };
  const episodeList = (Array.isArray(d.episodes) ? d.episodes : []).map((ep, i) => ({
    episodeId: ep.eps_slug || ep.slug || '',
    slug: ep.eps_slug || ep.slug || '',
    title: (ep.eps_title || `Episode ${i + 1}`).replace(/\s+/g, ' ').trim(),
    episode: epNumber(ep.eps_title, ep.eps_title) || i + 1,
    releaseDate: '',
  }));
  return {
    data: {
      animeId: slug,
      slug,
      title: cleanTitle(d.title || '') || d.title || slug,
      poster: d.poster || '',
      synopsis: d.synopsis || '',
      description: d.synopsis || '',
      status: d.status || '',
      type: d.type || '',
      studios: d.studio || '',
      score: d.rating || '',
      episodes: episodeList.length,
      genreList: (Array.isArray(d.genres) ? d.genres : []).map((g) =>
        typeof g === 'string' ? { genreId: g.toLowerCase(), title: g } : { genreId: g.slug, title: g.name },
      ),
      episodeList,
      provider: 'stream',
    },
  };
};

export const normalizeStreamEpisode = (res) => {
  const d = res?.data;
  const links = Array.isArray(d?.stream_links) ? d.stream_links : [];
  const servers = links
    .filter((s) => s?.url)
    .map((s, i) => ({
      title: s.server || `Server ${i + 1}`,
      name: s.server || `Server ${i + 1}`,
      url: s.url,
      quality: s.quality || 'Streaming',
    }));
  if (!servers.length) return { data: null };
  return {
    data: {
      title: d.title || '',
      animeId: animeSlugFromEpisode(d.slug || ''),
      poster: d.poster || '',
      synopsis: d.synopsis || '',
      defaultStreamingUrl: servers[0].url,
      servers,
      downloads: Array.isArray(d.download_links) ? d.download_links : [],
      provider: 'stream',
    },
  };
};
