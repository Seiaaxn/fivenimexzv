import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ROLES,
  ROLE_LABELS,
  listUsers,
  updateUserRole,
  updateUserProgress,
} from '../utils/roles';
import { levelProgress } from '../utils/levels';

/**
 * Manajemen pengguna untuk admin: ubah role (user / premium / admin) dan
 * atur level / EXP. Semua perubahan langsung ditulis ke dokumen
 * `users/{uid}` di Firestore (lihat firestore.rules — hanya admin yang
 * boleh menulis dokumen milik orang lain).
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err?.message ?? 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q),
    );
  }, [users, keyword]);

  const patchLocal = (uid, patch) =>
    setUsers((list) => list.map((u) => (u.uid === uid ? { ...u, ...patch } : u)));

  const handleRole = async (target, role) => {
    setBusyUid(target.uid);
    setError(null);
    setNotice('');
    try {
      await updateUserRole(target.uid, role);
      patchLocal(target.uid, { role });
      setNotice(`${target.displayName} sekarang ${ROLE_LABELS[role]}.`);
    } catch (err) {
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
      setNotice(`${target.displayName}: level ${res.level} · ${res.exp} EXP.`);
    } catch (err) {
      setError(err?.message ?? 'Gagal menyimpan level/EXP.');
    } finally {
      setBusyUid(null);
    }
  };

  const setDraft = (uid, field, value) =>
    setDrafts((d) => ({ ...d, [uid]: { ...d[uid], [field]: value } }));

  return (
    <section className="section section-neo">
      <div className="admin-episodes__header">
        <h2 className="dd-section-title">Pengguna ({users.length})</h2>
        <button type="button" className="btn btn-secondary btn-small" onClick={load}>Muat Ulang</button>
      </div>
      <p className="admin-hint">
        Ubah role user jadi Premium supaya bisa menonton anime bertanda Premium, atau jadikan Admin
        agar bisa membuka panel ini. Level & EXP juga bisa diatur manual di sini.
      </p>

      <input
        type="search"
        className="admin-form__input"
        placeholder="Cari nama / email / UID..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />

      {error && <p className="error-message">{error}</p>}
      {notice && <p className="admin-success">{notice}</p>}

      {loading ? (
        <div className="loading-container"><div className="spinner" aria-hidden /></div>
      ) : filtered.length === 0 ? (
        <p>Tidak ada pengguna yang cocok.</p>
      ) : (
        <div className="admin-user-list">
          {filtered.map((u) => {
            const prog = levelProgress(u.exp);
            const draft = drafts[u.uid] || {};
            const busy = busyUid === u.uid;
            return (
              <div className="admin-user" key={u.uid}>
                <div className="admin-user__head">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="admin-user__avatar" />
                  ) : (
                    <div className="admin-user__avatar admin-user__avatar--fallback">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="admin-user__meta">
                    <strong>
                      {u.displayName}
                      {u.uid === user?.uid && <span className="admin-tier-badge"> kamu</span>}
                    </strong>
                    <span className="admin-hint">{u.email || u.uid}</span>
                    <span className="admin-hint">
                      Level {prog.level} · {u.exp} EXP ({prog.progressPercent}% ke level berikutnya)
                    </span>
                  </div>
                  <span className={`admin-role-badge admin-role-badge--${u.role}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>

                <div className="admin-user__controls">
                  <div className="admin-poster-toggle admin-poster-toggle--small">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={busy || u.role === r}
                        className={`admin-toggle-btn ${u.role === r ? 'active' : ''}`}
                        onClick={() => handleRole(u, r)}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>

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

export default AdminUsers;
