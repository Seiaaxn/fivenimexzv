import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ROLES,
  ROLE_LABELS,
  watchUsers,
  updateUserRole,
  updateUserProgress,
} from '../utils/roles';
import { levelProgress } from '../utils/levels';

/**
 * Manajemen pengguna untuk admin: daftar realtime (onSnapshot) sehingga
 * setiap user yang baru login / daftar langsung muncul tanpa refresh.
 * Admin bisa ubah role (user / premium / admin) dan atur level / EXP.
 */
const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [busyUid, setBusyUid] = useState(null);
  const [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState({});
  const [expandedUid, setExpandedUid] = useState(null);

  // ─── Realtime listener — berjalan selama AdminUsers di-mount ───
  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = watchUsers((list) => {
      setUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.uid || '').toLowerCase().includes(q),
    );
  }, [users, keyword]);

  const patchLocal = (uid, patch) =>
    setUsers((list) => list.map((u) => (u.uid === uid ? { ...u, ...patch } : u)));

  const handleRole = async (target, role) => {
    if (target.isOwner) {
      // Akun owner (VERIFIED_EMAIL) selalu efektif admin apa pun isi field
      // role-nya di Firestore — supaya owner tidak bisa mengunci dirinya
      // sendiri dari luar panel. Karena itu tombol role untuk baris ini
      // sengaja dinonaktifkan di UI (lihat render di bawah); handler ini
      // hanya jaga-jaga kalau tombol somehow masih terpanggil.
      setNotice('');
      setError('Akun ini adalah pemilik situs — rolenya selalu Admin dan tidak bisa diubah dari sini.');
      return;
    }

    const previousRole = target.role;
    setBusyUid(target.uid);
    setError(null);
    setNotice('');
    // Optimistic update dulu supaya UI langsung terasa responsif...
    patchLocal(target.uid, { role, storedRole: role });
    try {
      await updateUserRole(target.uid, role);
      setNotice(`✅ ${target.displayName} sekarang ${ROLE_LABELS[role]}.`);
    } catch (err) {
      // ...tapi kalau ternyata gagal/tertolak, kembalikan tampilan ke role
      // semula SEKALIGUS tampilkan alasannya, jadi tidak terlihat seperti
      // "diam-diam balik lagi" tanpa penjelasan.
      patchLocal(target.uid, { role: previousRole, storedRole: previousRole });
      setError(err?.message ?? 'Gagal mengubah role.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleProgress = async (target, field) => {
    const draft = drafts[target.uid] || {};
    const value = draft[field];
    if (value === undefined || value === '') {
      setError('Isi nilai level atau EXP dulu.');
      return;
    }
    setBusyUid(target.uid);
    setError(null);
    setNotice('');
    try {
      const res = await updateUserProgress(target.uid, { [field]: value });
      patchLocal(target.uid, res);
      setDrafts((d) => ({ ...d, [target.uid]: { ...d[target.uid], [field]: '' } }));
      setNotice(`✅ ${target.displayName}: level ${res.level} · ${res.exp} EXP.`);
    } catch (err) {
      setError(err?.message ?? 'Gagal menyimpan level/EXP.');
    } finally {
      setBusyUid(null);
    }
  };

  const setDraft = (uid, field, value) =>
    setDrafts((d) => ({ ...d, [uid]: { ...d[uid], [field]: value } }));

  /** Format timestamp Firestore → string yang mudah dibaca. */
  const fmtTs = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <section className="section section-neo">
      <div className="admin-episodes__header">
        <h2 className="dd-section-title">
          Pengguna ({users.length})
          <span
            style={{
              marginLeft: 8,
              fontSize: '0.6rem',
              fontWeight: 600,
              color: '#22c55e',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 999,
              padding: '2px 8px',
              verticalAlign: 'middle',
              letterSpacing: '0.04em',
            }}
          >
            ● LIVE
          </span>
        </h2>
      </div>
      <p className="admin-hint">
        Daftar ini diperbarui secara otomatis setiap ada user baru login atau mendaftar.
        Klik nama user untuk melihat detail lengkap (UID, email, waktu bergabung, dll).
      </p>

      <input
        type="search"
        className="admin-form__input"
        placeholder="Cari nama / email / UID..."
        value={keyword}
        onChange={(e) => { setKeyword(e.target.value); setNotice(''); }}
        style={{ marginBottom: 12 }}
      />

      {error && <p className="error-message">{error}</p>}
      {notice && <p className="admin-success">{notice}</p>}

      {loading ? (
        <div className="loading-container"><div className="spinner" aria-hidden /></div>
      ) : filtered.length === 0 ? (
        <p className="comment-empty">
          {keyword ? 'Tidak ada pengguna yang cocok.' : 'Belum ada pengguna terdaftar.'}
        </p>
      ) : (
        <div className="admin-user-list">
          {filtered.map((u) => {
            const prog = levelProgress(u.exp);
            const draft = drafts[u.uid] || {};
            const busy = busyUid === u.uid;
            const expanded = expandedUid === u.uid;
            const isMe = u.uid === user?.uid;

            return (
              <div
                className="admin-user"
                key={u.uid}
                style={{ borderLeft: isMe ? '3px solid var(--color-primary)' : undefined }}
              >
                {/* ── Header baris user ── */}
                <button
                  type="button"
                  className="admin-user__head"
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', padding: 0,
                  }}
                  onClick={() => setExpandedUid(expanded ? null : u.uid)}
                  aria-expanded={expanded}
                >
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="admin-user__avatar" />
                  ) : (
                    <div className="admin-user__avatar admin-user__avatar--fallback">
                      {(u.displayName || 'P').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="admin-user__meta">
                    <strong>
                      {u.displayName}
                      {isMe && <span className="admin-tier-badge"> kamu</span>}
                    </strong>
                    <span className="admin-hint" style={{ userSelect: 'text' }}>
                      {u.email || <em style={{ opacity: 0.5 }}>email tidak tersedia</em>}
                    </span>
                    <span className="admin-hint">
                      Level {prog.level} · {u.exp} EXP
                    </span>
                  </div>

                  <span className={`admin-role-badge admin-role-badge--${u.role}`}>
                    {ROLE_LABELS[u.role]}
                  </span>

                  <span style={{
                    marginLeft: 6, fontSize: '0.75rem', opacity: 0.5,
                    flexShrink: 0, alignSelf: 'center',
                  }}>
                    {expanded ? '▲' : '▼'}
                  </span>
                </button>

                {/* ── Detail (collapse) ── */}
                {expanded && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px',
                    background: 'rgba(0,0,0,0.04)', borderRadius: 8,
                    fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <InfoChip label="UID" value={u.uid} mono />
                      <InfoChip label="Email" value={u.email || '—'} />
                      <InfoChip label="Bergabung" value={fmtDate(u.createdAt)} />
                      <InfoChip label="Login terakhir" value={fmtTs(u.lastLoginAt)} />
                      <InfoChip label="Total login" value={u.loginCount || '—'} />
                      <InfoChip label="EXP" value={u.exp} />
                      <InfoChip label="Level" value={prog.level} />
                      <InfoChip label="Progress" value={`${prog.progressPercent}%`} />
                    </div>
                  </div>
                )}

                {/* ── Kontrol role & progress ── */}
                <div className="admin-user__controls">
                  <div className="admin-poster-toggle admin-poster-toggle--small">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={busy || u.isOwner || u.role === r}
                        className={`admin-toggle-btn ${u.role === r ? 'active' : ''}`}
                        onClick={() => handleRole(u, r)}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                  {u.isOwner && (
                    <p className="admin-hint" style={{ marginTop: 4 }}>
                      🔒 Akun pemilik situs — selalu Admin, role tidak bisa diubah dari panel ini.
                    </p>
                  )}

                  <div className="admin-user__progress">
                    <div className="admin-user__field">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        className="admin-form__input"
                        placeholder={`Level (kini ${prog.level})`}
                        value={draft.level ?? ''}
                        onChange={(e) => setDraft(u.uid, 'level', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        disabled={busy}
                        onClick={() => handleProgress(u, 'level')}
                      >
                        Set Level
                      </button>
                    </div>
                    <div className="admin-user__field">
                      <input
                        type="number"
                        min="0"
                        className="admin-form__input"
                        placeholder={`EXP (kini ${u.exp})`}
                        value={draft.exp ?? ''}
                        onChange={(e) => setDraft(u.uid, 'exp', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        disabled={busy}
                        onClick={() => handleProgress(u, 'exp')}
                      >
                        Set EXP
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

/** Chip info kecil (label: value) di panel detail user. */
const InfoChip = ({ label, value, mono = false }) => (
  <div style={{
    background: 'rgba(0,0,0,0.06)', borderRadius: 6,
    padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 1,
    minWidth: 0, maxWidth: '100%',
  }}>
    <span style={{ fontSize: '0.6rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </span>
    <span style={{
      fontFamily: mono ? 'monospace' : undefined,
      fontSize: mono ? '0.68rem' : '0.78rem',
      fontWeight: 600,
      wordBreak: 'break-all',
    }}>
      {value}
    </span>
  </div>
);

export default AdminUsers;
