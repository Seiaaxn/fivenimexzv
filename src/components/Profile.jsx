import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { watchUserHistory, formatTime, removeFromWatchHistory, clearWatchHistory, groupHistoryByAnime } from '../utils/watchHistory';
import { watchUserKomikHistory, removeFromKomikHistory, clearKomikHistory } from '../utils/komikHistory';
import { watchUserBookmarks, removeBookmark, groupByType, CONTENT_TYPES, CONTENT_TYPE_LABELS } from '../utils/bookmarks';
import { watchFollowers, watchFollowing, unfollowUser } from '../utils/friends';
import { isVerifiedEmail } from '../utils/verified';
import { isPremiumEmail } from '../utils/premium';
import VerifiedBadge from './VerifiedBadge';
import PremiumBadge from './PremiumBadge';
import AuthModal from './AuthModal';
import './PublicProfile.css';
import AdminPanel from './AdminPanel';
import './Profile.css';

const BASE_TABS = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'riwayat', label: 'Riwayat' },
  { id: 'favorit', label: 'Favorit' },
  { id: 'teman', label: 'Teman' },
];

// Tab "Admin Panel" hanya muncul untuk akun ber-role admin
// (default: ryu694602@gmail.com).
const ADMIN_TAB = { id: 'admin', label: 'Admin Panel' };

const bookmarkHref = (b) => {
  if (b.type === 'donghua') return `/donghua/${b.slug}`;
  if (b.type === 'komik') return `/komik/${b.slug}`;
  return `/anime/${b.slug}`;
};

/** Renders one type's bookmarks (e.g. just the "Anime" grid) — used inside GroupedBookmarks below. */
const BookmarkTypeGrid = ({ items, onRemove }) => (
  <div className="anime-grid">
    {items.map((b) => (
      <div key={b.id} className="anime-card card" style={{ position: 'relative' }}>
        <Link to={bookmarkHref(b)} className="card-image-wrapper" style={{ display: 'block' }}>
          {b.poster && <img src={b.poster} alt={b.title} className="poster" loading="lazy" decoding="async" />}
        </Link>
        <div className="anime-info">
          <h3>{b.title}</h3>
        </div>
        {onRemove && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '6px' }}
            onClick={() => onRemove(b.listType, b.type, b.contentId)}
          >
            Hapus
          </button>
        )}
      </div>
    ))}
  </div>
);

/** Splits a flat bookmark list into separate Anime / Donghua / Komik sub-sections. */
const GroupedBookmarks = ({ items, emptyText, onRemove }) => {
  if (items.length === 0) return <p className="comment-empty">{emptyText}</p>;
  const groups = groupByType(items);
  return (
    <>
      {CONTENT_TYPES.map((type) => (
        groups[type].length > 0 && (
          <div key={type} className="profile-subsection">
            <h3 className="profile-subsection__title">{CONTENT_TYPE_LABELS[type]}</h3>
            <BookmarkTypeGrid items={groups[type]} onRemove={onRemove} />
          </div>
        )
      ))}
    </>
  );
};

/** A watch-history card styled like the Home "Lanjut Tonton" rail card. */
const HistoryCard = ({ item, onRemove }) => {
  const pct = item.currentTime > 0 && item.duration > 0
    ? Math.min((item.currentTime / item.duration) * 100, 100)
    : 0;
  return (
    <div className="anime-card card history-card">
      {onRemove && (
        <button
          type="button"
          className="history-card__remove"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(item.episodeId); }}
          aria-label="Hapus dari riwayat"
          title="Hapus dari riwayat"
        >
          ×
        </button>
      )}
      <Link
        to={`/watch/${item.episodeId}`}
        state={{ provider: item.provider, backAnimeId: item.animeId }}
        className="card-image-wrapper"
        style={{ display: 'block' }}
      >
        <span className="anime-card-badge anime-card-badge--ongoing">Lanjut</span>
        {item.poster
          ? <img src={item.poster} alt={item.animeTitle} className="poster" loading="lazy" decoding="async" />
          : <div className="history-card__noposter">Video</div>}
        <div className="card-overlay"><span className="play-icon" aria-hidden>Play</span></div>
        {pct > 0 && (
          <div className="history-card__progress">
            <div className="history-card__progress-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </Link>
      <div className="anime-info">
        <h3>{item.animeTitle}</h3>
        <div className="meta">
          <span className="episode-count">{item.episodeTitle || `Episode ${item.episodeId}`}</span>
        </div>
        {item.currentTime > 0 && (
          <div className="history-card__time">
            {formatTime(item.currentTime)}{item.duration > 0 ? ` / ${formatTime(item.duration)}` : ''}
          </div>
        )}
      </div>
    </div>
  );
};

/** A komik-history card with a small "×" button to remove that one entry. */
const KomikHistoryCard = ({ item, onRemove }) => (
  <div className="anime-card card history-card">
    <button
      type="button"
      className="history-card__remove"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(item.komikId); }}
      aria-label="Hapus dari riwayat"
      title="Hapus dari riwayat"
    >
      ×
    </button>
    <Link to={`/komik/read/${item.chapterSlug}`} className="card-image-wrapper" style={{ display: 'block' }}>
      {item.cover && <img src={item.cover} alt={item.komikTitle} className="poster" loading="lazy" decoding="async" />}
      <div className="card-overlay"><span className="play-icon" aria-hidden>Baca</span></div>
    </Link>
    <div className="anime-info">
      <h3>{item.komikTitle}</h3>
      <div className="meta"><span className="episode-count">{item.chapterTitle || item.chapterSlug}</span></div>
    </div>
  </div>
);

/** One row in the followers/following list, with an Unfollow shortcut for "following". */
const FriendRow = ({ uid, name, photo, showUnfollow, onUnfollow }) => (
  <div className="friend-row">
    <Link to={`/u/${uid}`} className="friend-row__link">
      <img src={photo || '/logo.png'} alt="" className="friend-row__avatar" />
      <span className="friend-row__name">{name || 'Pengguna'}</span>
    </Link>
    {showUnfollow && (
      <button type="button" className="btn btn-secondary" onClick={() => onUnfollow(uid)}>
        Unfollow
      </button>
    )}
  </div>
);

/** Kartu statistik kecil — tanpa emoji */
const StatCard = ({ value, label, icon }) => (
  <div className="pp-stat">
    {icon && <span className="pp-stat__icon">{icon}</span>}
    <span className="pp-stat__value">{value}</span>
    <span className="pp-stat__label">{label}</span>
  </div>
);

const Profile = () => {
  const { user, profile, isAdmin, isPremium, loading, updateUserProfile, updateStatsPrivacy, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('ringkasan');

  const [history, setHistory] = useState([]);
  const [komikHistory, setKomikHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  const uid = user?.uid || null;

  useEffect(() => watchUserHistory(uid, setHistory), [uid]);
  useEffect(() => watchUserKomikHistory(uid, setKomikHistory), [uid]);
  useEffect(() => watchUserBookmarks(uid, 'favorite', setFavorites), [uid]);
  useEffect(() => watchFollowers(uid, setFollowers), [uid]);
  useEffect(() => watchFollowing(uid, setFollowing), [uid]);

  useEffect(() => {
    if (user) setName(profile?.displayName || user.displayName || '');
  }, [user, profile]);

  const stats = useMemo(() => {
    const episodesWatched = history.length;
    return {
      episodesWatched,
      favoritCount: favorites.length,
    };
  }, [history, favorites]);

  // Sama seperti Home: satu kartu per anime (bukan per episode).
  const groupedHistory = useMemo(() => groupHistoryByAnime(history), [history]);

  const continueWatching = useMemo(() => {
    return groupHistoryByAnime(history)
     .filter((h) => (h.currentTime || 0) > 5 && (!h.duration || h.duration - h.currentTime > 30))
     .slice(0, 12);
  }, [history]);

  const condensedFavorites = useMemo(
    () => favorites.slice(0, 60).map((b) => ({ contentId: b.contentId, type: b.type, title: b.title, poster: b.poster, slug: b.slug })),
    [favorites],
  );

  useEffect(() => {
    if (!uid) return;
    setDoc(
      doc(db, 'users', uid),
      {
        stats: {
          episodesWatched: stats.episodesWatched,
          favoritCount: stats.favoritCount,
        },
        publicFavorites: condensedFavorites,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => {});
  }, [uid, stats.episodesWatched, stats.favoritCount, condensedFavorites]);

  const [privacyBusy, setPrivacyBusy] = useState(false);
  const statsPublic = profile?.statsPublic!== false; // default: public

  const handleTogglePrivacy = async () => {
    setPrivacyBusy(true);
    try {
      await updateStatsPrivacy(!statsPublic);
    } finally {
      setPrivacyBusy(false);
    }
  };

  if (loading) {
    return <div className="loading-container main-container"><div className="spinner" /></div>;
  }

  if (!user) {
    return (
      <div className="main-container">
        <header className="page-header">
          <h1 className="main-title text-gradient">Profil</h1>
          <p className="subtitle">Masuk untuk melihat profil, riwayat tonton/baca, bookmark, dan statistik kamu.</p>
        </header>
        <div className="empty-state">
          <button type="button" className="btn btn-primary" onClick={() => setAuthModalOpen(true)}>Masuk</button>
        </div>
        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  const displayName = profile?.displayName || user.displayName || 'Pengguna';
  const photoURL = photoPreview || profile?.photoURL || user.photoURL || '/logo.png';
  const verified = isVerifiedEmail(user.email);
  const premium = isPremium; // true untuk role premium & admin
  const isOwner = isPremiumEmail(user.email); // hanya email pemilik situs
  const TABS = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  const startEditing = () => {
    setName(displayName);
    setPhotoFile(null);
    setPhotoPreview('');
    setSaveError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setPhotoFile(null);
    setPhotoPreview('');
    setSaveError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setSaveError('File harus berupa gambar.'); return; }
    if (file.size > 5 * 1024 * 1024) { setSaveError('Ukuran gambar maksimal 5MB.'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateUserProfile({ displayName: name, photoFile });
      setEditing(false);
      setPhotoFile(null);
      setPhotoPreview('');
    } catch (err) {
      setSaveError(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBookmark = async (listType, type, contentId) => {
    await removeBookmark(user.uid, listType, type, contentId);
  };

  const handleRemoveHistoryItem = async (episodeId) => {
    await removeFromWatchHistory(uid, episodeId);
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Hapus semua riwayat tonton?')) return;
    await clearWatchHistory(uid);
  };

  const handleRemoveKomikHistoryItem = async (komikId) => {
    await removeFromKomikHistory(uid, komikId);
  };

  const handleClearKomikHistory = async () => {
    if (!window.confirm('Hapus semua riwayat baca komik?')) return;
    await clearKomikHistory(uid);
  };

  const handleUnfollow = async (targetUid) => {
    await unfollowUser(uid, targetUid);
  };

  return (
    <div className="main-container profile-page pp-page">
      {/* Hero — sama seperti tampilan Profil Publik */}
      <div className={`pp-hero${premium? ' pp-hero--owner' : ''}`}>
        <div className="pp-hero__bg" aria-hidden="true" />
        <div className="pp-hero__content">
          <div className={`pp-avatar-wrap${premium? ' pp-avatar-wrap--owner' : ''}`}>
            <img src={photoURL} alt={displayName} className="pp-avatar" />
            {verified &&!editing && (
              <span className="pp-avatar__verified" title="Terverifikasi"><VerifiedBadge size={18} /></span>
            )}
            {editing && (
              <button type="button" className="profile-card__avatar-edit pp-avatar-edit" onClick={() => fileInputRef.current?.click()}>
                Ganti Foto
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>

          <div className="pp-hero__info">
            {editing? (
              <>
                <label className="profile-card__label" htmlFor="profile-name">Nama Pengguna</label>
                <input
                  id="profile-name"
                  type="text"
                  className="profile-card__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                />
                {saveError && <p className="auth-error">{saveError}</p>}
                <div className="profile-card__actions">
                  <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving ||!name.trim()}>
                    {saving? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>Batal</button>
                </div>
              </>
            ) : (
              <>
                <h1 className={`pp-name${premium? ' pp-name--owner' : ''}`}>
                  {displayName}
                  {verified && <VerifiedBadge size={20} />}
                  {premium && <PremiumBadge size={20} />}
                </h1>
                <p className="pp-handle">
                  {user.email}
                  {isOwner && <span className="pp-owner-tag">Pemilik FiveNime</span>}
                  {premium && !isOwner && <span className="pp-owner-tag" style={{ background: 'linear-gradient(135deg,#FFD86B,#F5A524)', color: '#7a4400' }}>Premium</span>}
                </p>


                {/* Follow counts */}
                <div className="pp-follow-counts">
                  <button type="button" className="pp-follow-count-btn" onClick={() => setActiveTab('teman')}>
                    <strong>{followers.length}</strong> Pengikut
                  </button>
                  <button type="button" className="pp-follow-count-btn" onClick={() => setActiveTab('teman')}>
                    <strong>{following.length}</strong> Mengikuti
                  </button>
                </div>

                <div className="pp-hero__actions">
                  <button type="button" className="btn btn-primary" onClick={startEditing}>Edit Profil</button>
                  <button type="button" className="btn btn-secondary" onClick={logout}>Keluar</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats — grid 4 kolom tanpa emoji */}
      <section className="profile-stats-wrap">
        <div className="profile-privacy">
          <span>
            Statistik publik {statsPublic? '(terlihat oleh pengguna lain)' : '(hanya kamu yang bisa lihat)'}
          </span>
          <button
            type="button"
            className={`privacy-toggle ${statsPublic? 'on' : ''}`}
            onClick={handleTogglePrivacy}
            disabled={privacyBusy}
            role="switch"
            aria-checked={statsPublic}
            aria-label="Publik/Privat statistik"
          >
            <span className="privacy-toggle__dot" />
          </button>
          <span className="privacy-toggle__state">{statsPublic? 'Publik' : 'Privat'}</span>
        </div>
        <div className="pp-stats">
          <StatCard value={stats.episodesWatched} label="Episode" />
          <StatCard value={stats.favoritCount} label="Favorit" />
        </div>
      </section>

      {/* Tabs */}
      <nav className="pp-tabs" aria-label="Bagian profil">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pp-tab ${activeTab === t.id? 'pp-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'ringkasan' && (
        <section className="profile-section">
          <h2 className="dd-section-title">Lanjutkan Nonton</h2>
          {continueWatching.length === 0? (
            <p className="comment-empty">Belum ada tontonan yang bisa dilanjutkan.</p>
          ) : (
            <div className="anime-grid">
              {continueWatching.map((item, idx) => (
                <HistoryCard key={`${item.episodeId}-${idx}`} item={item} onRemove={handleRemoveHistoryItem} />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'riwayat' && (
        <>
          <section className="profile-section">
            <div className="profile-section__header">
              <h2 className="dd-section-title">Riwayat Tonton</h2>
              {history.length > 0 && (
                <button type="button" className="profile-section__clear" onClick={handleClearHistory}>
                  Hapus Semua
                </button>
              )}
            </div>
            {history.length === 0? (
              <p className="comment-empty">Belum ada riwayat tonton.</p>
            ) : (
              <div className="anime-grid">
                {groupedHistory.slice(0, 24).map((item, idx) => (
                  <HistoryCard key={`${item.episodeId}-${idx}`} item={item} onRemove={handleRemoveHistoryItem} />
                ))}
              </div>
            )}
          </section>

          <section className="profile-section">
            <div className="profile-section__header">
              <h2 className="dd-section-title">Riwayat Baca Komik</h2>
              {komikHistory.length > 0 && (
                <button type="button" className="profile-section__clear" onClick={handleClearKomikHistory}>
                  Hapus Semua
                </button>
              )}
            </div>
            {komikHistory.length === 0? (
              <p className="comment-empty">Belum ada riwayat baca komik.</p>
            ) : (
              <div className="anime-grid">
                {komikHistory.slice(0, 24).map((item, idx) => (
                  <KomikHistoryCard key={`${item.komikId}-${idx}`} item={item} onRemove={handleRemoveKomikHistoryItem} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'favorit' && (
        <section className="profile-section">
          <h2 className="dd-section-title">Favorit</h2>
          <GroupedBookmarks items={favorites} emptyText="Belum ada yang difavoritkan." onRemove={handleRemoveBookmark} />
        </section>
      )}

      {activeTab === 'teman' && (
        <>
          <section className="profile-section">
            <h2 className="dd-section-title">Mengikuti ({following.length})</h2>
            {following.length === 0? (
              <p className="comment-empty">Kamu belum mengikuti siapa pun.</p>
            ) : (
              <div className="friend-list">
                {following.map((f) => (
                  <FriendRow key={f.id} uid={f.followingUid} name={f.followingName} photo={f.followingPhoto} showUnfollow onUnfollow={handleUnfollow} />
                ))}
              </div>
            )}
          </section>
          <section className="profile-section">
            <h2 className="dd-section-title">Pengikut ({followers.length})</h2>
            {followers.length === 0? (
              <p className="comment-empty">Belum ada yang mengikuti kamu.</p>
            ) : (
              <div className="friend-list">
                {followers.map((f) => (
                  <FriendRow key={f.id} uid={f.followerUid} name={f.followerName} photo={f.followerPhoto} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'admin' && isAdmin && (
        <section className="profile-section profile-admin">
          <AdminPanel embedded />
        </section>
      )}

    </div>
  );
};

export default Profile;
