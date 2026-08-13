import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from '@/lib/router-compat';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isVerifiedEmail } from '../utils/verified';
import { isPremiumEmail } from '../utils/premium';
import { isPremiumRole } from '../utils/roles';
import { useLiveUsers } from '../hooks/useLiveUsers';
import { groupByType, CONTENT_TYPES, CONTENT_TYPE_LABELS } from '../utils/bookmarks';
import {
  followUser,
  unfollowUser,
  watchIsFollowing,
  watchFollowers,
  watchFollowing,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  watchFriendRequestStatus,
} from '../utils/friends';
import VerifiedBadge from './VerifiedBadge';
import PremiumBadge from './PremiumBadge';
import './PublicProfile.css';
import './Profile.css';

const itemHref = (b) => {
  if (b.type === 'donghua') return `/donghua/${b.slug}`;
  if (b.type === 'komik') return `/komik/${b.slug}`;
  return `/anime/${b.slug}`;
};

const GroupedList = ({ items, emptyText }) => {
  if (!items || items.length === 0) return <p className="comment-empty">{emptyText}</p>;
  const groups = groupByType(items);
  return (
    <>
      {CONTENT_TYPES.map((type) => (
        groups[type].length > 0 && (
          <div key={type} className="profile-subsection">
            <h3 className="profile-subsection__title">{CONTENT_TYPE_LABELS[type]}</h3>
            <div className="anime-grid">
              {groups[type].map((b) => (
                <Link key={`${b.type}-${b.contentId}`} to={itemHref(b)} className="anime-card card">
                  <div className="card-image-wrapper">
                    {b.poster && <img src={b.poster} alt={b.title} className="poster" loading="lazy" decoding="async" />}
                    <div className="card-overlay"><span className="play-icon" aria-hidden="true">▶</span></div>
                  </div>
                  <div className="anime-info">
                    <h3>{b.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      ))}
    </>
  );
};

const StatCard = ({ value, label }) => (
  <div className="pp-stat">
    <span className="pp-stat__value">{value}</span>
    <span className="pp-stat__label">{label}</span>
  </div>
);

const UserList = ({ users, emptyText, liveUsers }) => {
  if (!users.length) return <p className="comment-empty">{emptyText}</p>;
  return (
    <div className="pp-user-list">
      {users.map((u) => {
        const live = liveUsers?.[u.uid];
        const name = live ? (live.displayName || 'Pengguna') : (u.name || 'Pengguna');
        const photo = live ? live.photoURL : u.photo;
        return (
          <Link key={u.uid} to={`/u/${u.uid}`} className="pp-user-item">
            <img src={photo || '/logo.png'} alt="" className="pp-user-item__avatar" />
            <span className="pp-user-item__name">{name}</span>
          </Link>
        );
      })}
    </div>
  );
};

const PublicProfile = () => {
  const { uid } = useParams();
  const { user, profile: myProfile } = useAuth();
  const navigate = useNavigate();

  const [targetProfile, setTargetProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friendReqStatus, setFriendReqStatus] = useState(null); // null | { status, _direction }
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('favorit');

  useEffect(() => {
    if (user && uid && user.uid === uid) navigate('/profile', { replace: true });
  }, [user, uid, navigate]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        setTargetProfile(snap.exists() ? snap.data() : null);
        setNotFound(!snap.exists());
        setLoading(false);
      },
      () => { setNotFound(true); setLoading(false); },
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!user || !uid) return;
    const u1 = watchIsFollowing(user.uid, uid, setIsFollowing);
    const u2 = watchFriendRequestStatus(user.uid, uid, setFriendReqStatus);
    return () => { u1(); u2(); };
  }, [user, uid]);

  useEffect(() => {
    if (!uid) return;
    const u1 = watchFollowers(uid, (list) =>
      setFollowers(list.map((f) => ({ uid: f.followerUid, name: f.followerName, photo: f.followerPhoto })))
    );
    const u2 = watchFollowing(uid, (list) =>
      setFollowing(list.map((f) => ({ uid: f.followingUid, name: f.followingName, photo: f.followingPhoto })))
    );
    return () => { u1(); u2(); };
  }, [uid]);

  // `followerName`/`followerPhoto` (dan pasangan `following...`-nya) hanya
  // salinan saat baris follow itu dibuat — timpa dengan data live per uid
  // supaya daftar Pengikut/Mengikuti selalu tampilkan nama/foto terbaru.
  const followListUids = useMemo(
    () => [...followers, ...following].map((u) => u.uid),
    [followers, following],
  );
  const liveUsers = useLiveUsers(followListUids);

  const handleFollow = useCallback(async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(user.uid, uid);
      } else {
        await followUser(
          { uid: user.uid, displayName: myProfile?.displayName || user.displayName, photoURL: myProfile?.photoURL || user.photoURL },
          { uid, displayName: targetProfile?.displayName, photoURL: targetProfile?.photoURL },
        );
      }
    } finally { setActionLoading(false); }
  }, [user, uid, isFollowing, myProfile, targetProfile]);

  const handleFriendAction = useCallback(async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      if (!friendReqStatus) {
        // Kirim permintaan
        await sendFriendRequest(
          { uid: user.uid, displayName: myProfile?.displayName || user.displayName, photoURL: myProfile?.photoURL || user.photoURL },
          uid,
        );
      } else if (friendReqStatus._direction === 'sent' && friendReqStatus.status === 'pending') {
        // Batalkan permintaan
        await cancelFriendRequest(user.uid, uid);
      } else if (friendReqStatus._direction === 'received' && friendReqStatus.status === 'pending') {
        // Terima permintaan
        await acceptFriendRequest(friendReqStatus.fromUid, user.uid);
      } else if (friendReqStatus.status === 'accepted') {
        // Batalkan pertemanan
        const fUid = friendReqStatus.fromUid === user.uid ? uid : friendReqStatus.fromUid;
        const tUid = friendReqStatus.fromUid === user.uid ? friendReqStatus.fromUid : user.uid;
        await rejectFriendRequest(fUid, tUid);
      }
    } finally { setActionLoading(false); }
  }, [user, uid, friendReqStatus, myProfile]);

  const handleRejectFriend = useCallback(async () => {
    if (!friendReqStatus) return;
    setActionLoading(true);
    try {
      await rejectFriendRequest(friendReqStatus.fromUid, user.uid);
    } finally { setActionLoading(false); }
  }, [user, friendReqStatus]);

  const getFriendBtnLabel = () => {
    if (!friendReqStatus) return '+ Tambah Teman';
    if (friendReqStatus.status === 'accepted') return '✓ Berteman';
    if (friendReqStatus._direction === 'sent') return 'Permintaan Terkirim';
    if (friendReqStatus._direction === 'received') return '✓ Terima Permintaan';
    return '+ Tambah Teman';
  };

  if (loading) return <div className="loading-container main-container"><div className="spinner" /></div>;
  if (notFound || !targetProfile) return (
    <div className="main-container">
      <div className="pp-notfound">
        <span className="pp-notfound__icon">👤</span>
        <h1>Pengguna Tidak Ditemukan</h1>
        <p>Profil ini tidak tersedia atau sudah dihapus.</p>
        <Link to="/" className="btn btn-primary">Ke Beranda</Link>
      </div>
    </div>
  );

  const displayName = targetProfile.displayName || 'Pengguna';
  const verified = isVerifiedEmail(targetProfile.email);
  const premium = isPremiumRole(targetProfile, targetProfile.email); // role-based
  const isOwner = isPremiumEmail(targetProfile.email); // hanya email pemilik situs
  const statsPublic = targetProfile.statsPublic !== false;
  const stats = targetProfile.stats || {};
  const isFriend = friendReqStatus?.status === 'accepted';
  const receivedRequest = friendReqStatus?._direction === 'received' && friendReqStatus?.status === 'pending';

  return (
    <div className="main-container pp-page">
      {/* Hero */}
      <div className={`pp-hero${premium ? ' pp-hero--owner' : ''}`}>
        <div className="pp-hero__bg" aria-hidden="true" />
        <div className="pp-hero__content">
          <div className={`pp-avatar-wrap${premium ? ' pp-avatar-wrap--owner' : ''}`}>
            <img src={targetProfile.photoURL || '/logo.png'} alt={displayName} className="pp-avatar" />
            {verified && <span className="pp-avatar__verified" title="Terverifikasi"><VerifiedBadge size={18} /></span>}
          </div>
          <div className="pp-hero__info">
            <h1 className={`pp-name${premium ? ' pp-name--owner' : ''}`}>
              {displayName}
              {verified && <VerifiedBadge size={20} />}
              {premium && <PremiumBadge size={20} />}
            </h1>
            <p className="pp-handle">
              @{uid?.slice(0, 10)}
              {isOwner && <span className="pp-owner-tag">Pemilik FiveNime</span>}
              {premium && !isOwner && <span className="pp-owner-tag" style={{ background: 'linear-gradient(135deg,#FFD86B,#F5A524)', color: '#7a4400' }}>Premium</span>}
            </p>


            {/* Follow counts */}
            <div className="pp-follow-counts">
              <button type="button" className="pp-follow-count-btn" onClick={() => setActiveTab('followers')}>
                <strong>{followers.length}</strong> Pengikut
              </button>
              <button type="button" className="pp-follow-count-btn" onClick={() => setActiveTab('following')}>
                <strong>{following.length}</strong> Mengikuti
              </button>
            </div>

            {/* Action buttons */}
            {user && (
              <div className="pp-hero__actions">
                <button
                  type="button"
                  className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleFollow}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : isFollowing ? 'Berhenti Ikuti' : '+ Ikuti'}
                </button>
                <button
                  type="button"
                  className={`btn ${isFriend ? 'btn-secondary' : receivedRequest ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={handleFriendAction}
                  disabled={actionLoading}
                  title={isFriend ? 'Klik untuk batalkan pertemanan' : ''}
                >
                  {actionLoading ? '...' : getFriendBtnLabel()}
                </button>
                {receivedRequest && (
                  <button type="button" className="btn btn-danger pp-btn-reject" onClick={handleRejectFriend} disabled={actionLoading}>
                    Tolak
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => navigate(`/messages/${uid}`)}>
                  💬 Pesan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {statsPublic ? (
        <>
          {/* Stats */}
          <div className="pp-stats">
            <StatCard value={stats.episodesWatched || 0} label="Episode" />
            <StatCard value={stats.favoritCount || 0} label="Favorit" />
          </div>

          {/* Tabs */}
          <div className="pp-tabs">
            <button type="button" className={`pp-tab ${activeTab === 'favorit' ? 'pp-tab--active' : ''}`} onClick={() => setActiveTab('favorit')}>Favorit</button>
            <button type="button" className={`pp-tab ${activeTab === 'followers' ? 'pp-tab--active' : ''}`} onClick={() => setActiveTab('followers')}>Pengikut ({followers.length})</button>
            <button type="button" className={`pp-tab ${activeTab === 'following' ? 'pp-tab--active' : ''}`} onClick={() => setActiveTab('following')}>Mengikuti ({following.length})</button>
          </div>

          {activeTab === 'favorit' && (
            <section className="pp-section">
              {targetProfile.publicFavorites?.length > 0
                ? <GroupedList items={targetProfile.publicFavorites} emptyText="Belum ada favorit." />
                : <div className="pp-empty-state"><span>🎌</span><p>Belum ada favorit.</p></div>
              }
            </section>
          )}
          {activeTab === 'followers' && (
            <section className="pp-section">
              <UserList users={followers} emptyText="Belum ada pengikut." liveUsers={liveUsers} />
            </section>
          )}
          {activeTab === 'following' && (
            <section className="pp-section">
              <UserList users={following} emptyText="Belum mengikuti siapapun." liveUsers={liveUsers} />
            </section>
          )}
        </>
      ) : (
        <div className="pp-private">
          <span className="pp-private__icon">🔒</span>
          <p>Pengguna ini menjadikan statistiknya privat.</p>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;

