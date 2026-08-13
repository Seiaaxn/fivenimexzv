import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import { watchComments, addComment, deleteComment } from '../utils/comments';
import { isVerifiedEmail } from '../utils/verified';
import { isPremiumEmail } from '../utils/premium';
import { isPremiumRole } from '../utils/roles';
import { useLiveUsers, withLiveUser } from '../hooks/useLiveUsers';
import VerifiedBadge from './VerifiedBadge';
import PremiumBadge from './PremiumBadge';
import './CommentSection.css';

const timeAgo = (createdAt) => {
  const seconds = createdAt?.seconds;
  if (!seconds) return 'baru saja';
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

const CommentAuthor = ({ uid, name, email, role }) => {
  const owner = isPremiumRole({ role }, email) || isPremiumEmail(email);
  const isSiteOwner = isPremiumEmail(email);
  return (
    <span className={`comment-item__author${owner ? ' comment-item__author--owner' : ''}`}>
      <Link to={`/u/${uid}`} className={`comment-item__name${owner ? ' comment-item__name--owner' : ''}`}>
        {name}
        {isVerifiedEmail(email) && <VerifiedBadge />}
        {owner && <PremiumBadge />}
      </Link>
      {isSiteOwner && <span className="comment-item__owner-tag">Pemilik</span>}
      {owner && !isSiteOwner && <span className="comment-item__owner-tag" style={{ background: 'linear-gradient(135deg,#FFD86B,#F5A524)', color: '#7a4400' }}>Premium</span>}
    </span>
  );
};

const ReplyForm = ({ onSubmit, onCancel, posting, replyingToName }) => {
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <form
      className="comment-reply-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(text);
        setText('');
      }}
    >
      {replyingToName && (
        <p className="comment-reply-form__to">Membalas <strong>{replyingToName}</strong></p>
      )}
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tulis balasan..."
        rows={2}
        maxLength={1000}
      />
      <div className="comment-reply-form__actions">
        <button type="submit" className="btn btn-primary" disabled={posting || !text.trim()}>
          {posting ? 'Mengirim...' : 'Balas'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={posting}>
          Batal
        </button>
      </div>
    </form>
  );
};

/**
 * contentType: 'anime' | 'donghua'
 * contentId: unique id for the episode/content
 */
const CommentSection = ({ contentType = 'anime', contentId, contentTitle, onRequireLogin }) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const activeKeyRef = useRef('');

  useEffect(() => {
    if (!contentId) { setComments([]); setLoading(false); return; }
    const key = `${contentType}:${contentId}`;
    activeKeyRef.current = key;
    setComments([]);
    setLoading(true);
    setReplyingTo(null);

    const unsub = watchComments(contentType, contentId, (items) => {
      if (activeKeyRef.current !== key) return;
      setComments(items);
      setLoading(false);
    });
    return unsub;
  }, [contentType, contentId]);

  const { topLevel, repliesByParent } = useMemo(() => {
    const top = [];
    const byParent = {};
    comments.forEach((c) => {
      if (c.parentId) {
        if (!byParent[c.parentId]) byParent[c.parentId] = [];
        byParent[c.parentId].push(c);
      } else {
        top.push(c);
      }
    });
    Object.values(byParent).forEach((list) =>
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
    );
    return { topLevel: top, repliesByParent: byParent };
  }, [comments]);

  // Nama/foto/level tersimpan di tiap komentar hanyalah salinan saat
  // komentar itu dibuat — supaya selalu sinkron kalau penulisnya ganti
  // nama/foto profil atau naik level, timpa dengan data live per uid.
  const liveUsers = useLiveUsers(useMemo(() => comments.map((c) => c.uid), [comments]));

  const postComment = async ({ replyText, parentId, replyToName, replyToUid }) => {
    if (!user) { onRequireLogin?.(); return; }
    const body = replyText ?? text;
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      await addComment({
        contentType,
        contentId,
        contentTitle,
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Pengguna',
        photoURL: profile?.photoURL || user.photoURL || '',
        email: user.email || '',
        level: currentLevel,
        role: profile?.role || 'user',
        text: body,
        parentId: parentId || null,
        replyToName: replyToName || null,
        replyToUid: replyToUid || null,
      });
      if (!parentId) setText('');
      else setReplyingTo(null);
    } finally {
      setPosting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    postComment({});
  };

  const handleDelete = async (id) => {
    await deleteComment(id);
  };

  const renderReply = (raw, rootId) => {
    const r = withLiveUser(raw, liveUsers);
    const isReplying = replyingTo?.parentId === rootId && replyingTo?.replyId === r.id;
    const owner = isPremiumRole({ role: r.role }, r.email) || isPremiumEmail(r.email);
    return (
      <li key={r.id} className={`comment-item comment-item--reply${owner ? ' comment-item--owner' : ''}`}>
        <Link to={`/u/${r.uid}`}>
          <img src={r.photoURL || '/logo.png'} alt="" className={`comment-avatar comment-avatar--sm${owner ? ' comment-avatar--owner' : ''}`} />
        </Link>
        <div className="comment-item__body">
          <div className="comment-item__meta">
            <CommentAuthor uid={r.uid} name={r.displayName} email={r.email} role={r.role} />
            <span className="comment-item__time">{timeAgo(r.createdAt)}</span>
          </div>
          {r.replyToName && r.replyToUid && (
            <p className="comment-mention">
              <Link to={`/u/${r.replyToUid}`} className="comment-mention__link">@{r.replyToName}</Link>
            </p>
          )}
          <p className="comment-item__text">{r.text}</p>
          <div className="comment-item__actions">
            <button
              type="button"
              className="comment-reply-btn"
              onClick={() =>
                setReplyingTo(
                  isReplying ? null : { parentId: rootId, replyId: r.id, replyToName: r.displayName, replyToUid: r.uid }
                )
              }
            >
              Balas
            </button>
            {user?.uid === r.uid && (
              <button type="button" className="comment-delete" onClick={() => handleDelete(r.id)}>
                Hapus
              </button>
            )}
          </div>
          {isReplying && (
            <ReplyForm
              posting={posting}
              replyingToName={replyingTo.replyToName}
              onCancel={() => setReplyingTo(null)}
              onSubmit={(replyText) =>
                postComment({ replyText, parentId: rootId, replyToName: r.displayName, replyToUid: r.uid })
              }
            />
          )}
        </div>
      </li>
    );
  };

  const renderComment = (raw) => {
    const c = withLiveUser(raw, liveUsers);
    const isReplying = replyingTo?.parentId === c.id && !replyingTo?.replyId;
    const replies = repliesByParent[c.id] || [];
    const owner = isPremiumRole({ role: c.role }, c.email) || isPremiumEmail(c.email);
    return (
      <li key={c.id} className={`comment-item${owner ? ' comment-item--owner' : ''}`}>
        <Link to={`/u/${c.uid}`}>
          <img src={c.photoURL || '/logo.png'} alt="" className={`comment-avatar${owner ? ' comment-avatar--owner' : ''}`} />
        </Link>
        <div className="comment-item__body">
          <div className="comment-item__meta">
            <CommentAuthor uid={c.uid} name={c.displayName} email={c.email} role={c.role} />
            <span className="comment-item__time">{timeAgo(c.createdAt)}</span>
          </div>
          <p className="comment-item__text">{c.text}</p>
          <div className="comment-item__actions">
            <button
              type="button"
              className="comment-reply-btn"
              onClick={() =>
                setReplyingTo(
                  isReplying ? null : { parentId: c.id, replyToName: c.displayName, replyToUid: c.uid }
                )
              }
            >
              Balas
            </button>
            {user?.uid === c.uid && (
              <button type="button" className="comment-delete" onClick={() => handleDelete(c.id)}>
                Hapus
              </button>
            )}
          </div>

          {isReplying && (
            <ReplyForm
              posting={posting}
              replyingToName={replyingTo.replyToName}
              onCancel={() => setReplyingTo(null)}
              onSubmit={(replyText) =>
                postComment({ replyText, parentId: c.id, replyToName: c.displayName, replyToUid: c.uid })
              }
            />
          )}

          {replies.length > 0 && (
            <ul className="comment-list comment-list--replies">
              {replies.map((r) => renderReply(r, c.id))}
            </ul>
          )}
        </div>
      </li>
    );
  };

  const totalCount = topLevel.length + Object.values(repliesByParent).reduce((s, a) => s + a.length, 0);

  return (
    <section className="comment-section" aria-label="Komentar">
      <h2 className="comment-section__title">
        Komentar {totalCount > 0 ? `(${totalCount})` : ''}
      </h2>

      {user ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <img
            src={profile?.photoURL || user.photoURL || '/logo.png'}
            alt=""
            className="comment-avatar"
          />
          <div className="comment-form__body">
            <div className="comment-form__user-info">
              <span className="comment-form__name">{profile?.displayName || user.displayName || 'Pengguna'}</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tulis komentar kamu..."
              maxLength={1000}
              rows={2}
            />
            <button type="submit" className="btn btn-primary" disabled={posting || !text.trim()}>
              {posting ? 'Mengirim...' : 'Kirim'}
            </button>
          </div>
        </form>
      ) : (
        <div className="comment-login-prompt">
          <p>Masuk untuk ikut berkomentar.</p>
          <button type="button" className="btn btn-secondary" onClick={() => onRequireLogin?.()}>Masuk</button>
        </div>
      )}

      {loading ? (
        <p className="comment-empty">Memuat komentar...</p>
      ) : topLevel.length === 0 ? (
        <p className="comment-empty">Belum ada komentar. Jadilah yang pertama!</p>
      ) : (
        <ul className="comment-list">
          {topLevel.map((c) => renderComment(c))}
        </ul>
      )}
    </section>
  );
};

export default CommentSection;
