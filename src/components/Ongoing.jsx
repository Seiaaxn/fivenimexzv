import { useCallback } from 'react';
import { animeAPI } from '../services/api';
import { SkeletonAnimeGrid } from './Skeleton';
import AnimeCard from './AnimeCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { mergeProviderLists } from '../utils/animeUtils';
import { listCustomAnimeByStatus } from '../utils/customAnime';

const emptyList = { data: { animeList: [] } };

// Semua provider dipanggil dengan halaman yang sama, jadi setiap scroll
// benar-benar memuat data baru (bukan mengulang halaman 1 terus-menerus).
const fetchOngoingData = async (page) => {
  const [sameRes, otakRes, alqRes, oploRes] = await Promise.all([
    animeAPI.getOngoingSamehadaku(page).catch(() => emptyList),
    animeAPI.getOngoing(page).catch(() => emptyList),
    animeAPI.getOngoingAlqanime(page).catch(() => emptyList),
    animeAPI.getOngoingOploverz(page).catch(() => emptyList),
  ]);

  const listOf = (res) => res?.data?.animeList || res?.animeList || [];

  let merged = mergeProviderLists(listOf(sameRes), listOf(otakRes), {
    primaryName: 'samehadaku',
    secondaryName: 'otakudesu',
  });
  merged = mergeProviderLists(merged, listOf(alqRes), {
    primaryName: 'samehadaku',
    secondaryName: 'alqanime',
  });
  merged = mergeProviderLists(merged, listOf(oploRes), {
    primaryName: 'samehadaku',
    secondaryName: 'oploverz',
  });

  if (page === 1) {
    const custom = await listCustomAnimeByStatus('ongoing').catch(() => []);
    return [...custom.map((a) => ({ ...a, provider: 'custom' })), ...merged];
  }

  return merged;
};

const Ongoing = () => {
  // Referensi stabil: kalau fungsinya dibuat ulang setiap render, observer
  // infinite scroll ikut dibuat ulang dan daftar bisa "kedip"/hilang.
  const fetchOngoing = useCallback((page) => fetchOngoingData(page), []);

  const {
    data: animes,
    loading,
    error,
    hasMore,
    lastElementRef,
    reset
  } = useInfiniteScroll(fetchOngoing, []);

  if (loading && animes.length === 0) {
    return (
      <div className="anime-list-page main-container">
        <header className="page-header section section-neo">
          <h1 className="main-title text-gradient">Sedang Tayang</h1>
          <p className="subtitle">Daftar anime yang saat ini masih on-going dari FiveNime.</p>
        </header>
        <section className="section section-neo">
          <SkeletonAnimeGrid count={12} />
        </section>
      </div>
    );
  }

  if (error && animes.length === 0) {
    return (
      <div className="anime-list-page main-container">
        <section className="section section-neo">
          <div className="error-container">
            <div className="error-icon" aria-hidden>⚠️</div>
            <p className="error-message">Gagal memuat anime sedang tayang: {error}</p>
            <p className="error-hint">Server mungkin sedang bermasalah (mis. error 500). Coba lagi nanti.</p>
            <button type="button" className="btn btn-primary" onClick={reset}>Coba Lagi</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="anime-list-page main-container">
      <header className="page-header section section-neo">
        <h1 className="main-title text-gradient">Sedang Tayang</h1>
        <p className="subtitle">Anime yang sedang tayang dari FiveNime.</p>
        {error && <p className="error-message">{error}</p>}
      </header>

      <section className="section section-neo">
        <div className="anime-grid">
          {animes.map((anime, idx) => {
            const providers = anime.providers || [anime.provider];
            const isCustomItem = anime.provider === 'custom';
            const providerHint = isCustomItem ? 'FiveNime' : providers.join(' & ');

            return (
              <AnimeCard
                key={`${anime.provider ?? 'p'}-${anime.animeId ?? anime.slug ?? idx}`}
                anime={{ ...anime, provider: anime.provider ?? 'samehadaku' }}
                index={idx}
                innerRef={idx === animes.length - 1 ? lastElementRef : undefined}
                statusOverride="Ongoing"
                providerHint={providerHint}
              />
            );
          })}
        </div>
      </section>

      {loading && hasMore && (
        <div className="loading-more">
          <div className="spinner" aria-hidden />
          <p>Memuat lebih banyak...</p>
        </div>
      )}

      {!hasMore && animes.length > 0 && (
        <div className="end-message">
          <p>Tidak ada lagi anime untuk dimuat</p>
        </div>
      )}
    </div>
  );
};

export default Ongoing;
