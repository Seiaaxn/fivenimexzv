import { useState, useEffect } from 'react';
import { useParams, Link } from '@/lib/router-compat';
import { animeAPI } from '../services/api';
import AnimeCard from './AnimeCard';

const DonghuaGenreFilter = () => {
  const { slug } = useParams();
  const [donghua, setDonghua] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchDonghua = async () => {
      try {
        setLoading(true);
        const response = await animeAPI.getDonghuaByGenre(slug, page);
        const donghuaList = response?.data || [];
        setDonghua(donghuaList);
      } catch (err) {
        setError(err?.message ?? 'Gagal memuat donghua');
      } finally {
        setLoading(false);
      }
    };
    fetchDonghua();
  }, [slug, page]);

  const genreName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (loading) {
    return (
      <div className="loading-container main-container">
        <div className="spinner" />
        <p>Memuat donghua...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container main-container">
        <p className="error-message">{error}</p>
        <Link to="/donghua-genres" className="btn btn-primary">
          Kembali ke Genre
        </Link>
      </div>
    );
  }

  return (
    <div className="main-container">
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/donghua-genres">Genre</Link>
        <span>/</span>
        <span>{genreName}</span>
      </nav>

      <header className="page-header">
        <h1 className="main-title">{genreName}</h1>
        <p className="subtitle">{donghua.length} donghua</p>
      </header>

      {donghua.length > 0 ? (
        <div className="anime-grid">
          {donghua.map((item, idx) => (
            <AnimeCard
              key={item.slug || idx}
              anime={{
                ...item,
                animeId: item.slug,
                title: item.title,
                poster: item.poster,
                status: item.status,
                type: item.type,
                provider: 'donghua',
              }}
              index={idx}
              providerHint="Donghua"
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>Tidak ada donghua di genre ini</p>
          <Link to="/donghua-genres" className="btn btn-primary">
            Browse Genre Lain
          </Link>
        </div>
      )}

      <div className="pagination">
        {page > 1 && (
          <button className="btn btn-secondary" onClick={() => setPage(page - 1)}>
            ← Previous
          </button>
        )}
        <span className="btn">Page {page}</span>
        {donghua.length >= 10 && (
          <button className="btn btn-primary" onClick={() => setPage(page + 1)}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
};

export default DonghuaGenreFilter;
