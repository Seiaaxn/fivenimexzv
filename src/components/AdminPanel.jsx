import { useEffect, useState, useCallback } from 'react';
import { Link } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import {
  isAdminEmail,
  addCustomAnime,
  updateCustomAnime,
  deleteCustomAnime,
  listCustomAnime,
  uploadEpisodeVideo,
} from '../utils/customAnime';
import { resizeImageToDataUrl } from '../utils/image';
import './AdminPanel.css';

const emptyEpisode = () => ({ number: '', title: '', videoUrl: '' });

const emptyForm = () => ({
  title: '',
  description: '',
  status: 'ongoing',
  type: 'TV',
  aired: '',
  duration: '',
  studios: '',
  score: '',
  genres: '',
  posterMode: 'url', // 'url' | 'file'
  posterUrl: '',
  posterPreview: '',
  episodes: [emptyEpisode()],
});

const AdminPanel = () => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [posterFileBusy, setPosterFileBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  // Per baris episode: { mode: 'url' | 'file', progress: 0-100, busy, error }
  const [episodeUpload, setEpisodeUpload] = useState({});

  const isAdmin = isAdminEmail(user?.email);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await listCustomAnime();
      setItems(data);
    } catch (err) {
      setListError(err?.message ?? 'Gagal memuat daftar anime custom.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadList();
  }, [isAdmin, loadList]);

  if (authLoading) {
    return (
      <div className="main-container">
        <div className="loading-container"><div className="spinner" aria-hidden /></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="main-container">
        <div className="error-container section section-neo">
          <h2>Akses Ditolak</h2>
          <p>Halaman ini hanya untuk admin FiveNime.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>Kembali ke Beranda</Link>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormError(null);
    setEpisodeUpload({});
  };

  const startEdit = (anime) => {
    setEditingId(anime.animeId);
    setForm({
      title: anime.title || '',
      description: anime.description || '',
      status: anime.status === 'completed' ? 'completed' : 'ongoing',
      type: anime.type || 'TV',
      aired: anime.aired || '',
      duration: anime.duration || '',
      studios: anime.studios || '',
      score: anime.score || '',
      genres: (anime.genres || []).join(', '),
      posterMode: 'url',
      posterUrl: anime.poster && !anime.poster.startsWith('data:') ? anime.poster : '',
      posterPreview: anime.poster || '',
      episodes: anime.episodeList?.length
        ? anime.episodeList.map((ep) => ({
            number: ep.number ?? '',
            title: ep.title ?? '',
            videoUrl: ep.videoUrl ?? '',
          }))
        : [emptyEpisode()],
    });
    setFormError(null);
    setSuccessMsg('');
    setEpisodeUpload({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePosterFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterFileBusy(true);
    setFormError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 500, 0.8);
      setForm((f) => ({ ...f, posterPreview: dataUrl }));
    } catch (err) {
      setFormError(err?.message ?? 'Gagal memproses gambar poster.');
    } finally {
      setPosterFileBusy(false);
    }
  };

  const handlePosterUrlChange = (val) => {
    setForm((f) => ({ ...f, posterUrl: val, posterPreview: val }));
  };

  const updateEpisode = (idx, field, val) => {
    setForm((f) => {
      const episodes = f.episodes.slice();
      episodes[idx] = { ...episodes[idx], [field]: val };
      return { ...f, episodes };
    });
  };

  const addEpisodeRow = () => {
    setForm((f) => ({ ...f, episodes: [...f.episodes, emptyEpisode()] }));
  };

  const removeEpisodeRow = (idx) => {
    setForm((f) => ({ ...f, episodes: f.episodes.filter((_, i) => i !== idx) }));
    setEpisodeUpload((u) => {
      const next = { ...u };
      delete next[idx];
      return next;
    });
  };

  const setEpisodeVideoMode = (idx, mode) => {
    setEpisodeUpload((u) => ({ ...u, [idx]: { ...u[idx], mode } }));
  };

  const handleEpisodeVideoFile = (idx, file) => {
    if (!file) return;
    setEpisodeUpload((u) => ({ ...u, [idx]: { ...u[idx], mode: 'file', busy: true, progress: 0, error: null } }));

    const { promise } = uploadEpisodeVideo(file, editingId, (percent) => {
      setEpisodeUpload((u) => ({ ...u, [idx]: { ...u[idx], progress: percent } }));
    });

    promise
      .then(({ url }) => {
        updateEpisode(idx, 'videoUrl', url);
        setEpisodeUpload((u) => ({ ...u, [idx]: { ...u[idx], busy: false, progress: 100 } }));
      })
      .catch((err) => {
        setEpisodeUpload((u) => ({
          ...u,
          [idx]: { ...u[idx], busy: false, error: err?.message ?? 'Gagal upload video.' },
        }));
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg('');

    const title = form.title.trim();
    const poster = (form.posterMode === 'file' ? form.posterPreview : form.posterUrl).trim();

    if (!title) { setFormError('Judul wajib diisi.'); return; }
    if (!poster) { setFormError('Poster wajib diisi (upload file atau isi URL).'); return; }
    if (Object.values(episodeUpload).some((s) => s?.busy)) {
      setFormError('Masih ada video yang sedang diupload, tunggu sampai selesai.');
      return;
    }

    const genres = form.genres.split(',').map((g) => g.trim()).filter(Boolean);
    const episodes = form.episodes
      .filter((ep) => ep.title.trim() || ep.videoUrl.trim())
      .map((ep, idx) => ({
        number: ep.number ? Number(ep.number) || idx + 1 : idx + 1,
        title: ep.title.trim() || `Episode ${ep.number || idx + 1}`,
        videoUrl: ep.videoUrl.trim(),
      }));

    const payload = {
      title,
      poster,
      description: form.description.trim(),
      status: form.status,
      type: form.type,
      aired: form.aired.trim(),
      duration: form.duration.trim(),
      studios: form.studios.trim(),
      score: form.score.trim(),
      genres,
      episodes,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateCustomAnime(editingId, payload);
        setSuccessMsg('Anime berhasil diperbarui.');
      } else {
        await addCustomAnime(payload, user);
        setSuccessMsg('Anime berhasil diupload.');
      }
      resetForm();
      loadList();
    } catch (err) {
      setFormError(err?.message ?? 'Gagal menyimpan anime.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Hapus "${title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteCustomAnime(id);
      if (editingId === id) resetForm();
      loadList();
    } catch (err) {
      setListError(err?.message ?? 'Gagal menghapus anime.');
    }
  };

  return (
    <div className="main-container admin-panel">
      <header className="page-header section section-neo">
        <h1 className="main-title text-gradient">Admin — Upload Anime</h1>
        <p className="subtitle">Tambah anime custom yang tersimpan langsung di Firebase, tampil di Sedang Tayang / Baru Selesai / Pencarian.</p>
      </header>

      <section className="section section-neo admin-form-section">
        <h2 className="dd-section-title">{editingId ? 'Edit Anime' : 'Upload Anime Baru'}</h2>

        {formError && <p className="error-message">{formError}</p>}
        {successMsg && <p className="admin-success">{successMsg}</p>}

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form__row">
            <label className="admin-form__label" htmlFor="af-title">Judul *</label>
            <input
              id="af-title"
              type="text"
              className="admin-form__input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Judul anime"
              required
            />
          </div>

          <div className="admin-form__row admin-form__row--split">
            <div>
              <label className="admin-form__label" htmlFor="af-status">Status Tayang</label>
              <select
                id="af-status"
                className="admin-form__input"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="ongoing">Sedang Tayang</option>
                <option value="completed">Baru Selesai / Tamat</option>
              </select>
            </div>
            <div>
              <label className="admin-form__label" htmlFor="af-type">Tipe</label>
              <select
                id="af-type"
                className="admin-form__input"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="TV">TV</option>
                <option value="Movie">Movie</option>
                <option value="ONA">ONA</option>
                <option value="OVA">OVA</option>
                <option value="Special">Special</option>
              </select>
            </div>
          </div>

          <div className="admin-form__row admin-form__row--split">
            <div>
              <label className="admin-form__label" htmlFor="af-aired">Rilis</label>
              <input
                id="af-aired"
                type="text"
                className="admin-form__input"
                value={form.aired}
                onChange={(e) => setForm((f) => ({ ...f, aired: e.target.value }))}
                placeholder="mis. 12 Jan 2024"
              />
            </div>
            <div>
              <label className="admin-form__label" htmlFor="af-duration">Durasi</label>
              <input
                id="af-duration"
                type="text"
                className="admin-form__input"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="mis. 24 menit/episode"
              />
            </div>
          </div>

          <div className="admin-form__row admin-form__row--split">
            <div>
              <label className="admin-form__label" htmlFor="af-studios">Studio</label>
              <input
                id="af-studios"
                type="text"
                className="admin-form__input"
                value={form.studios}
                onChange={(e) => setForm((f) => ({ ...f, studios: e.target.value }))}
                placeholder="mis. MAPPA"
              />
            </div>
            <div>
              <label className="admin-form__label" htmlFor="af-score">Skor</label>
              <input
                id="af-score"
                type="text"
                className="admin-form__input"
                value={form.score}
                onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                placeholder="mis. 8.5"
              />
            </div>
          </div>

          <div className="admin-form__row">
            <label className="admin-form__label" htmlFor="af-genres">Genre (pisahkan dengan koma)</label>
            <input
              id="af-genres"
              type="text"
              className="admin-form__input"
              value={form.genres}
              onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))}
              placeholder="Action, Fantasy, Comedy"
            />
          </div>

          <div className="admin-form__row">
            <label className="admin-form__label" htmlFor="af-desc">Deskripsi / Sinopsis</label>
            <textarea
              id="af-desc"
              className="admin-form__input admin-form__textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Sinopsis singkat anime..."
              rows={4}
            />
          </div>

          <div className="admin-form__row">
            <span className="admin-form__label">Poster *</span>
            <div className="admin-poster-toggle">
              <button
                type="button"
                className={`admin-toggle-btn ${form.posterMode === 'url' ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, posterMode: 'url', posterPreview: f.posterUrl }))}
              >
                Pakai URL
              </button>
              <button
                type="button"
                className={`admin-toggle-btn ${form.posterMode === 'file' ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, posterMode: 'file' }))}
              >
                Upload File
              </button>
            </div>

            {form.posterMode === 'url' ? (
              <input
                type="url"
                className="admin-form__input"
                value={form.posterUrl}
                onChange={(e) => handlePosterUrlChange(e.target.value)}
                placeholder="https://contoh.com/poster.jpg"
              />
            ) : (
              <input
                type="file"
                accept="image/*"
                className="admin-form__input"
                onChange={handlePosterFile}
                disabled={posterFileBusy}
              />
            )}
            {posterFileBusy && <p className="admin-hint">Memproses gambar...</p>}
            {form.posterPreview && (
              <img src={form.posterPreview} alt="Preview poster" className="admin-poster-preview" />
            )}
          </div>

          <div className="admin-form__row">
            <div className="admin-episodes__header">
              <span className="admin-form__label">Episode</span>
              <button type="button" className="btn btn-secondary btn-small" onClick={addEpisodeRow}>+ Tambah Episode</button>
            </div>
            <p className="admin-hint">Video bisa diisi lewat URL/embed link, atau upload file video langsung (disimpan di Firebase Storage).</p>

            {form.episodes.map((ep, idx) => {
              const up = episodeUpload[idx] || {};
              const mode = up.mode || (ep.videoUrl && !up.mode ? 'url' : 'url');
              return (
                <div className="admin-episode-row admin-episode-row--stacked" key={idx}>
                  <div className="admin-episode-row__top">
                    <input
                      type="number"
                      className="admin-form__input admin-episode-row__num"
                      placeholder="No."
                      value={ep.number}
                      onChange={(e) => updateEpisode(idx, 'number', e.target.value)}
                    />
                    <input
                      type="text"
                      className="admin-form__input"
                      placeholder="Judul episode (opsional)"
                      value={ep.title}
                      onChange={(e) => updateEpisode(idx, 'title', e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-episode-row__remove"
                      onClick={() => removeEpisodeRow(idx)}
                      aria-label="Hapus episode ini"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="admin-poster-toggle admin-poster-toggle--small">
                    <button
                      type="button"
                      className={`admin-toggle-btn ${mode === 'url' ? 'active' : ''}`}
                      onClick={() => setEpisodeVideoMode(idx, 'url')}
                    >
                      URL / Embed
                    </button>
                    <button
                      type="button"
                      className={`admin-toggle-btn ${mode === 'file' ? 'active' : ''}`}
                      onClick={() => setEpisodeVideoMode(idx, 'file')}
                    >
                      Upload File
                    </button>
                  </div>

                  {mode === 'file' ? (
                    <>
                      <input
                        type="file"
                        accept="video/*"
                        className="admin-form__input"
                        disabled={up.busy}
                        onChange={(e) => handleEpisodeVideoFile(idx, e.target.files?.[0])}
                      />
                      {up.busy && (
                        <div className="admin-upload-progress" role="progressbar" aria-valuenow={up.progress || 0} aria-valuemin={0} aria-valuemax={100}>
                          <div className="admin-upload-progress__bar" style={{ width: `${up.progress || 0}%` }} />
                          <span className="admin-hint">Mengupload video... {up.progress || 0}%</span>
                        </div>
                      )}
                      {up.error && <p className="error-message">{up.error}</p>}
                      {!up.busy && ep.videoUrl && (
                        <p className="admin-hint">Video tersimpan ✓ ({ep.videoUrl.slice(0, 50)}…)</p>
                      )}
                    </>
                  ) : (
                    <input
                      type="url"
                      className="admin-form__input"
                      placeholder="URL video/embed"
                      value={ep.videoUrl}
                      onChange={(e) => updateEpisode(idx, 'videoUrl', e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="admin-form__actions">
            <button type="submit" className="btn btn-primary" disabled={saving || posterFileBusy || Object.values(episodeUpload).some((s) => s?.busy)}>
              {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Upload Anime'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Batal Edit</button>
            )}
          </div>
        </form>
      </section>

      <section className="section section-neo">
        <h2 className="dd-section-title">Anime Custom Ter-upload ({items.length})</h2>
        {listLoading ? (
          <div className="loading-container"><div className="spinner" aria-hidden /></div>
        ) : listError ? (
          <p className="error-message">{listError}</p>
        ) : items.length === 0 ? (
          <p>Belum ada anime custom yang diupload.</p>
        ) : (
          <div className="admin-list">
            {items.map((anime) => (
              <div className="admin-list__item" key={anime.animeId}>
                <img src={anime.poster} alt={anime.title} className="admin-list__poster" />
                <div className="admin-list__info">
                  <h3>{anime.title}</h3>
                  <p className="admin-hint">
                    {anime.status === 'completed' ? 'Tamat' : 'Sedang Tayang'} · {anime.type} · {anime.episodeList.length} episode
                  </p>
                  <div className="admin-list__actions">
                    <Link to={`/anime/custom/${anime.animeId}`} className="btn btn-secondary btn-small">Lihat</Link>
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => startEdit(anime)}>Edit</button>
                    <button type="button" className="btn btn-danger btn-small" onClick={() => handleDelete(anime.animeId, anime.title)}>Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminPanel;
