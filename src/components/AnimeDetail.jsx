import { useEffect, useState } from 'react';
import { useParams, Link } from '@/lib/router-compat';
import { animeAPI, APIError } from '../services/api';
import AnimeCard from './AnimeCard';
import BookmarkButton from './BookmarkButton';
import AuthModal from './AuthModal';
import { getCustomAnime, listCustomAnime, buildCustomEpisodeId } from '../utils/customAnime';

// Urutan fallback provider saat membuka halaman detail.
// Semua provider sankavollerei ikut dicoba supaya "Episode list tidak
// tersedia" tidak muncul hanya karena provider-nya belum terdaftar.
const PROVIDER_ORDER = [
  'otakudesu',
  'samehadaku',
  'anoboy',
  'oploverz',
  'alqanime',
  'nimegami',
  'stream',
];

const AnimeDetail = () => {
  const { animeId, provider: providerParam } = useParams();
  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [batchUrl, setBatchUrl] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [providerUsed, setProviderUsed] = useState(null);
  const [epSearch, setEpSearch] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isCustom = (providerParam || '').toLowerCase() === 'custom';

  useEffect(() => {
    if (!isCustom) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAnime(null);

    getCustomAnime(animeId)
      .then((data) => {
        if (cancelled) return;
        if (data) { setAnime({ ...data, __provider: 'custom' }); setProviderUsed('custom'); }
        else setAnime(null);
      })
      .catch((err) => { if (!cancelled) setError(err?.message ?? String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [animeId, isCustom]);

  useEffect(() => {
    if (isCustom) return;
    const fetchAnimeData = async () => {
      setLoading(true);
      setError(null);
      setAnime(null);

      const initialProvider = (providerParam || 'otakudesu').toLowerCase();
      const startIndex = PROVIDER_ORDER.indexOf(initialProvider);
      const orderedProviders = startIndex >= 0
        ? [...PROVIDER_ORDER.slice(startIndex), ...PROVIDER_ORDER.slice(0, startIndex)]
        : PROVIDER_ORDER;

      const fetchByProvider = async (prov, id) => {
        if (prov === 'samehadaku') return animeAPI.getAnimeDetailSamehadaku(id);
        if (prov === 'stream') return animeAPI.getAnimeDetailStream(id);
        if (prov === 'anoboy') return animeAPI.getAnimeDetailAnoboy(id);
        if (prov === 'oploverz') return animeAPI.getAnimeDetailOploverz(id);
        if (prov === 'alqanime') return animeAPI.getAnimeDetailAlqanime(id);
        if (prov === 'nimegami') return animeAPI.getAnimeDetailNimegami(id);
        if (prov === 'nontonanimeid') return animeAPI.getAnimeDetailNaid(id);
        return animeAPI.getAnimeDetail(id);
      };


      let found = false;
      // Payload cadangan: detail yang ketemu tapi episode list-nya kosong.
      // Provider berikutnya tetap dicoba, siapa tahu punya daftar episode.
      let fallback = null;
      try {
        for (const prov of orderedProviders) {
          try {
            const data = await fetchByProvider(prov, animeId);
            const payload = data?.data || null;
            if (payload) {
              const hasEpisodes = Array.isArray(payload.episodeList) && payload.episodeList.length > 0;
              if (hasEpisodes) {
                setAnime({ ...payload, __provider: prov });
                setProviderUsed(prov);
                found = true;
                break;
              }
              if (!fallback) fallback = { payload, prov };
            }
          } catch (err) {
            if (err instanceof APIError && err.statusCode === 404) continue;
            // Provider lain masih boleh dicoba — jangan langsung berhenti
            continue;
          }
        }
        if (!found && fallback) {
          setAnime({ ...fallback.payload, __provider: fallback.prov });
          setProviderUsed(fallback.prov);
          found = true;
        }
        if (!found) { setAnime(null); setError(null); }
      } finally { setLoading(false); }

    };
    fetchAnimeData();
  }, [animeId, providerParam]);

  useEffect(() => {
    if ((providerUsed || (providerParam || 'otakudesu').toLowerCase()) !== 'otakudesu') return;

    const extractBatchUrl = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && val.startsWith('http')) return val;
      if (typeof val === 'object') {
        const u = val.url || val.batchUrl || val.downloadUrl || val.href;
        if (typeof u === 'string' && u.startsWith('http')) return u;
        if (Array.isArray(val)) {
          const first = val[0];
          if (typeof first === 'string') return first;
          if (first?.url) return first.url;
        }
        if (Array.isArray(val.list) && val.list[0]?.url) return val.list[0].url;
      }
      return null;
    };

    if (anime?.batch) {
      const url = extractBatchUrl(anime.batch);
      if (url) { setBatchUrl(url); return; }
    }
    const slugOrId = anime?.slug ?? anime?.animeId ?? animeId;
    if (!slugOrId) return;
    setBatchLoading(true);
    animeAPI.getBatch(slugOrId)
      .then((res) => {
        const url = extractBatchUrl(res?.data) || extractBatchUrl(res);
        if (url) setBatchUrl(url);
      })
      .catch(() => {})
      .finally(() => setBatchLoading(false));
  }, [anime?.slug, anime?.animeId, anime?.batch, animeId, providerUsed, providerParam]);

  // ── Rekomendasi lainnya (berdasarkan genre pertama, fallback ongoing) ──
  useEffect(() => {
    let cancelled = false;
    if (!anime) { setRecommendations([]); return; }

    if (isCustom) {
      listCustomAnime()
        .then((all) => {
          if (cancelled) return;
          setRecommendations(all.filter((it) => it.animeId !== animeId).slice(0, 12));
        })
        .catch(() => { if (!cancelled) setRecommendations([]); });
      return () => { cancelled = true; };
    }

    const genreId = anime?.genreList?.[0]?.genreId;

    const load = async () => {
      let list = [];
      try {
        if (genreId) {
          const res = await animeAPI.getAnimeByGenre(genreId);
          list = res?.data?.animeList || [];
        }
      } catch { /* ignore */ }
      if (list.length === 0) {
        try {
          const res = await animeAPI.getOngoing(1);
          list = res?.data?.animeList || [];
        } catch { /* ignore */ }
      }
      if (cancelled) return;
      setRecommendations(
        list.filter((it) => it.animeId && it.animeId !== animeId).slice(0, 12),
      );
    };

    load();
    return () => { cancelled = true; };
  }, [anime, animeId]);


  if (loading) {
    return (
      <div className="loading-container main-container">
        <div className="spinner" aria-hidden />
        <p>Memuat detail anime...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-container main-container">
        <p className="error-message">Gagal memuat detail anime: {error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Coba Lagi</button>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: 8 }}>Kembali ke Beranda</Link>
      </div>
    );
  }
  if (!anime) {
    return (
      <div className="error-container main-container">
        <h2>Anime tidak ditemukan</h2>
        <Link to="/" className="btn btn-primary">Kembali ke Beranda</Link>
      </div>
    );
  }

  const batchLink = (typeof batchUrl === 'string' && batchUrl.startsWith('http')) ? batchUrl
    : (typeof anime?.batch === 'string' && anime.batch.startsWith('http')) ? anime.batch
    : null;
  const providerLabel = (() => {
    const p = (providerUsed || providerParam || 'otakudesu').toLowerCase();
    if (p === 'custom') return 'FiveNime';
    if (p === 'otakudesu') return 'FiveNime';
    if (p === 'samehadaku') return 'FiveNime';
    if (p === 'kaizen') return 'FiveNime';
    if (p === 'stream') return 'FiveNime';
    return 'FiveNime';
  })();

  const slugTitle = (animeId || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  const title = [anime.title, anime.english, anime.japanese, anime.name, slugTitle]
    .find((t) => typeof t === 'string' && t.trim().length > 0) ?? 'Unknown Title';
  const poster = anime.poster ?? anime.poster_url ?? '';
  const status = anime.status ?? null;
  const statusColor = status?.toLowerCase().includes('ongoing') ? 'var(--color-success)'
    : status?.toLowerCase().includes('completed') ? 'var(--color-secondary)'
      : 'var(--color-text-muted)';

  const episodeList = anime.episodeList ?? [];
  const totalEpisodes = anime.episodes ?? anime.episodeCount ?? episodeList.length;
  const getEpisodeNum = (ep) => {
    const num = ep.eps ?? ep.episodeNumber ?? ep.number ?? ep.title;
    const parsed = parseInt(num, 10);
    return isNaN(parsed) ? 999 : parsed;
  };
  const sortedEpisodeList = episodeList.slice().sort((a, b) => getEpisodeNum(a) - getEpisodeNum(b));
  const firstEpisode = sortedEpisodeList.length > 0 ? sortedEpisodeList[0] : null;
  const latestEpisode = sortedEpisodeList.length > 0 ? sortedEpisodeList[sortedEpisodeList.length - 1] : null;

  const epLabel = (ep, idx) => `Episode ${ep.eps ?? ep.episodeNumber ?? ep.title ?? idx + 1}`;
  const customEpLabel = (ep, idx) => ep.title || `Episode ${ep.number ?? idx + 1}`;
  const filteredEps = epSearch.trim()
    ? sortedEpisodeList.filter((ep, idx) => (isCustom ? customEpLabel(ep, idx) : epLabel(ep, idx)).toLowerCase().includes(epSearch.toLowerCase()))
    : sortedEpisodeList;

  const synopsisParagraphs = anime.synopsis?.paragraphs?.length
    ? anime.synopsis.paragraphs
    : (typeof anime.synopsis === 'string' && anime.synopsis ? [anime.synopsis] : []);

  return (
    <article className="dd main-container" aria-labelledby="dd-title">
      {/* ── Breadcrumb ── */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Beranda</Link>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <Link to="/ongoing">Anime</Link>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <span className="breadcrumb-current" aria-current="page">{title}</span>
      </nav>

      {/* ── Hero ── */}
      <section className="dd-hero" aria-label="Info anime">
        {poster && (
          <div className="dd-hero__bg" style={{ backgroundImage: `url(${poster})` }} aria-hidden="true" />
        )}

        <div className="dd-hero__body">
          <div className="dd-hero__poster-wrap">
            <img
              src={poster}
              alt={`Poster ${title}`}
              className="dd-hero__poster"
              loading="eager"
              onError={(e) => { e.target.src = 'https://placehold.co/220x330/16161F/1D4ED8?text=No+Poster'; }}
            />
            {status && (
              <span className="dd-hero__badge" style={{ '--badge-color': statusColor }} aria-label={`Status: ${status}`}>
                {status}
              </span>
            )}
          </div>

          <div className="dd-hero__info">
            <p className="dd-hero__label">{anime.type ?? 'Anime'} · {providerLabel}</p>
            <h1 id="dd-title" className="dd-hero__title">{title}</h1>

            <dl className="dd-meta" aria-label="Detail informasi">
              {anime.score?.value && (
                <div className="dd-meta__item">
                  <dt className="visually-hidden">Skor</dt>
                  <dd className="dd-meta__pill dd-meta__pill--accent">{anime.score.value}</dd>
                </div>
              )}
              {typeof anime.score === 'string' && anime.score && (
                <div className="dd-meta__item">
                  <dt className="visually-hidden">Skor</dt>
                  <dd className="dd-meta__pill dd-meta__pill--accent">{anime.score}</dd>
                </div>
              )}
              {totalEpisodes > 0 && (
                <div className="dd-meta__item">
                  <dt className="visually-hidden">Jumlah episode</dt>
                  <dd className="dd-meta__pill">{totalEpisodes} eps</dd>
                </div>
              )}
              {anime.aired && (
                <div className="dd-meta__item">
                  <dt className="visually-hidden">Rilis</dt>
                  <dd className="dd-meta__pill">{anime.aired}</dd>
                </div>
              )}
              {anime.duration && (
                <div className="dd-meta__item">
                  <dt className="visually-hidden">Durasi</dt>
                  <dd className="dd-meta__pill">{anime.duration}</dd>
                </div>
              )}
              {anime.studios && (
                <div className="dd-meta__item">
                  <dt className="visually-hidden">Studio</dt>
                  <dd className="dd-meta__pill">{anime.studios}</dd>
                </div>
              )}
            </dl>

            {anime.genreList?.length > 0 && (
              <div className="dd-genres" role="list" aria-label="Genre">
                {anime.genreList.map((genre, idx) => (
                  isCustom ? (
                    <span key={idx} className="genre-tag" role="listitem">{genre.title}</span>
                  ) : (
                    <Link key={idx} to={`/genres?genre=${genre.genreId}`} className="genre-tag" role="listitem">
                      {genre.title}
                    </Link>
                  )
                ))}
              </div>
            )}

            <div className="dd-cta" role="group" aria-label="Mulai menonton">
              {isCustom && firstEpisode && (
                <Link
                  to={`/watch/${buildCustomEpisodeId(animeId, firstEpisode.number)}`}
                  className="btn btn-primary btn-large"
                >
                  {customEpLabel(firstEpisode, 0)}
                </Link>
              )}
              {isCustom && latestEpisode && sortedEpisodeList.length > 1 && (
                <Link
                  to={`/watch/${buildCustomEpisodeId(animeId, latestEpisode.number)}`}
                  className="btn btn-secondary btn-large"
                >
                  Episode Terbaru
                </Link>
              )}
              {!isCustom && firstEpisode?.episodeId && (
                <Link to={`/watch/${firstEpisode.episodeId}`} className="btn btn-primary btn-large">
                  Episode 1
                </Link>
              )}
              {!isCustom && latestEpisode?.episodeId && sortedEpisodeList.length > 1 && (
                <Link to={`/watch/${latestEpisode.episodeId}`} className="btn btn-secondary btn-large">
                  Episode Terbaru
                </Link>
              )}
              {(batchLink || batchLoading) && (
                batchLink ? (
                  <a href={batchLink} className="btn btn-secondary btn-large" target="_blank" rel="noopener noreferrer">
                    Download Batch
                  </a>
                ) : (
                  <span className="btn btn-secondary btn-large" style={{ opacity: 0.6 }}>Memuat batch...</span>
                )
              )}
              <BookmarkButton
                listType="favorite"
                item={{
                  contentId: anime.slug ?? anime.animeId ?? animeId,
                  title,
                  poster,
                  type: 'anime',
                  slug: anime.slug ?? anime.animeId ?? animeId,
                  provider: providerUsed,
                }}
                onRequireLogin={() => setAuthModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="dd-content">
        <section className="dd-synopsis section section-neo" aria-labelledby="dd-synopsis-heading">
          <h2 id="dd-synopsis-heading" className="dd-section-title">Sinopsis</h2>
          {synopsisParagraphs.length > 0 ? (
            synopsisParagraphs.map((para, idx) => (
              <p key={idx} className="dd-synopsis__text">{para}</p>
            ))
          ) : (
            <p className="dd-synopsis__text">Sinopsis tidak tersedia.</p>
          )}
        </section>

        {sortedEpisodeList.length > 0 && (
          <section className="dd-episodes section-neo" aria-labelledby="dd-ep-heading">
            <div className="dd-episodes__header">
              <h2 id="dd-ep-heading" className="dd-section-title">
                Episode
                <span className="dd-episodes__count" aria-label={`${sortedEpisodeList.length} episode`}>
                  {sortedEpisodeList.length}
                </span>
              </h2>
              {sortedEpisodeList.length > 12 && (
                <div className="dd-episodes__search">
                  <label htmlFor="ep-search" className="visually-hidden">Cari episode</label>
                  <input
                    id="ep-search"
                    type="search"
                    className="dd-episodes__search-input"
                    placeholder="Cari episode…"
                    value={epSearch}
                    onChange={(e) => setEpSearch(e.target.value)}
                    aria-label="Cari episode"
                  />
                </div>
              )}
            </div>

            {filteredEps.length === 0 ? (
              <p className="dd-episodes__empty">Tidak ada episode yang cocok.</p>
            ) : (
              <ol className="dd-ep-grid" aria-label="Daftar episode">
                {filteredEps.map((episode, idx) => {
                  if (isCustom) {
                    if (!episode.videoUrl) {
                      return (
                        <li key={idx} className="dd-ep-item">
                          <span className="dd-ep-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                            <span className="dd-ep-btn__title">{customEpLabel(episode, idx)}</span>
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={idx} className="dd-ep-item">
                        <Link
                          to={`/watch/${buildCustomEpisodeId(animeId, episode.number)}`}
                          className="dd-ep-btn"
                          aria-label={`Tonton ${customEpLabel(episode, idx)}`}
                        >
                          <span className="dd-ep-btn__title">{customEpLabel(episode, idx)}</span>
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={episode.episodeId ?? idx} className="dd-ep-item">
                      <Link
                        to={`/watch/${episode.episodeId}`}
                        className="dd-ep-btn"
                        state={{ provider: providerUsed }}
                        aria-label={`Tonton ${epLabel(episode, idx)}`}
                      >
                        <span className="dd-ep-btn__title">{epLabel(episode, idx)}</span>
                        {episode.date && <span className="dd-ep-btn__date">{episode.date}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}

        {sortedEpisodeList.length === 0 && (
          <div className="section section-neo empty-state">
            <p>Episode list tidak tersedia</p>
            <p className="error-hint">Detail lengkap mungkin belum tersedia dari API</p>
          </div>
        )}

        {recommendations.length > 0 && (
          <section className="section section-neo" aria-labelledby="dd-rec-heading">
            <h2 id="dd-rec-heading" className="dd-section-title">Rekomendasi Lainnya</h2>
            <div className="anime-grid">
              {recommendations.map((item, idx) => (
                <AnimeCard
                  key={item.animeId ?? idx}
                  anime={{ ...item, provider: isCustom ? 'custom' : 'otakudesu' }}
                  index={idx}
                  providerHint="FiveNime"
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </article>
  );
};

export default AnimeDetail;
