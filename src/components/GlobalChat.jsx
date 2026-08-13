import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { useAuth } from '../contexts/AuthContext';
import { watchGlobalChat, sendGlobalChatMessage, deleteGlobalChatMessage } from '../utils/globalChat';
import { isVerifiedEmail } from '../utils/verified';
import { isPremiumEmail } from '../utils/premium';
import { isPremiumRole } from '../utils/roles';
import { useLiveUsers, withLiveUser } from '../hooks/useLiveUsers';
import VerifiedBadge from './VerifiedBadge';
import PremiumBadge from './PremiumBadge';
import AuthModal from './AuthModal';
import './GlobalChat.css';

const timeAgo = (createdAt) => {
  const seconds = createdAt?.seconds;
  if (!seconds) return 'baru saja';
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
  return `${Math.floor(diff / 86400)}h`;
};

const GlobalChat = ({ fullPage = false }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, displayName, text }
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const wasNearBottomRef = useRef(true);

  useEffect(() => watchGlobalChat(setMessages), []);

  // Nama/foto/level tersimpan di tiap pesan hanyalah salinan saat pesan itu
  // dikirim — timpa dengan data live per uid supaya selalu sinkron kalau
  // pengirimnya ganti nama/foto profil atau naik level.
  const liveUsers = useLiveUsers(useMemo(() => messages.map((m) => m.uid), [messages]));

  useEffect(() => {
    const el = listRef.current;
    if (el && wasNearBottomRef.current && !hidden) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, hidden]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) { el.scrollTop = el.scrollHeight; wasNearBottomRef.current = true; }
  };

  const handleReply = (msg) => {
    setReplyingTo({ id: msg.id, displayName: msg.displayName, text: msg.text });
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { setAuthModalOpen(true); return; }
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendGlobalChatMessage({
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Pengguna',
        photoURL: profile?.photoURL || user.photoURL || '',
        email: user.email || '',
        role: profile?.role || 'user',
        text: body,
        replyTo: replyingTo || null,
      });
      setText('');
      setReplyingTo(null);
      wasNearBottomRef.current = true;
    } finally {
      setSending(false);
    }
  };

  const isHidden = !fullPage && hidden;

  return (
    <section className={`section home-rail global-chat${fullPage ? ' global-chat--full' : ''}`}>
      {!fullPage && (
        <div className="section-header home-rail-header">
          <h2 className="section-title">Chat Global</h2>
          <div className="global-chat__header-actions">
            <span className="global-chat__live" aria-hidden="true">● Live</span>
            <button
              type="button"
              className="global-chat__toggle"
              onClick={() => setHidden((h) => !h)}
              aria-label={hidden ? 'Tampilkan chat' : 'Sembunyikan chat'}
              title={hidden ? 'Tampilkan chat' : 'Sembunyikan chat'}
            >
              {hidden ? '▼ Tampilkan' : '▲ Sembunyikan'}
            </button>
          </div>
        </div>
      )}

      {!isHidden && (
        <div className="global-chat__box">
          <div className="global-chat__list" ref={listRef} onScroll={handleScroll}>
            {messages.length === 0 && (
              <p className="comment-empty">Belum ada obrolan. Jadilah yang pertama menyapa!</p>
            )}
            {messages.map((raw) => {
              const m = withLiveUser(raw, liveUsers);
              const owner = isPremiumRole({ role: m.role }, m.email) || isPremiumEmail(m.email);
              return (
              <div key={m.id} className={`global-chat__msg${owner ? ' global-chat__msg--owner' : ''}`}>
                <Link to={`/u/${m.uid}`} className="global-chat__avatar-link">
                  <img src={m.photoURL || '/logo.png'} alt="" className={`global-chat__avatar${owner ? ' global-chat__avatar--owner' : ''}`} />
                </Link>
                <div className="global-chat__body">
                  <div className="global-chat__meta">
                    <Link to={`/u/${m.uid}`} className={`global-chat__name${owner ? ' global-chat__name--owner' : ''}`}>
                      {m.displayName}
                      {isVerifiedEmail(m.email) && <VerifiedBadge size={13} />}
                      {owner && <PremiumBadge size={13} />}
                    </Link>
                    {isVerifiedEmail(m.email) && !isPremiumEmail(m.email) ? null : null}
                    {isPremiumEmail(m.email) && <span className="global-chat__owner-tag">Pemilik</span>}
                    {owner && !isPremiumEmail(m.email) && <span className="global-chat__owner-tag" style={{ background: 'linear-gradient(135deg,#FFD86B,#F5A524)', color: '#7a4400' }}>Premium</span>}
                    <span className="global-chat__time">{timeAgo(m.createdAt)}</span>
                  </div>

                  {/* Reply quote */}
                  {m.replyTo && (
                    <div className="global-chat__reply-quote">
                      <span className="global-chat__reply-quote__name">↩ {m.replyTo.displayName}</span>
                      <span className="global-chat__reply-quote__text">
                        {m.replyTo.text?.slice(0, 60)}{m.replyTo.text?.length > 60 ? '…' : ''}
                      </span>
                    </div>
                  )}

                  <p className="global-chat__text">{m.text}</p>

                  <div className="global-chat__actions">
                    <button
                      type="button"
                      className="global-chat__reply-btn"
                      onClick={() => handleReply(m)}
                    >
                      Balas
                    </button>
                  </div>
                </div>
                {user?.uid === m.uid && (
                  <button
                    type="button"
                    className="global-chat__delete"
                    onClick={() => deleteGlobalChatMessage(m.id)}
                    aria-label="Hapus pesan"
                    title="Hapus pesan"
                  >
                    ×
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {/* Scroll to bottom button */}
          {!wasNearBottomRef.current && (
            <button type="button" className="global-chat__scroll-btn" onClick={scrollToBottom}>
              ↓ Pesan terbaru
            </button>
          )}

          {/* Reply indicator */}
          {replyingTo && (
            <div className="global-chat__replying-bar">
              <span>↩ Membalas <strong>{replyingTo.displayName}</strong>: {replyingTo.text?.slice(0, 50)}{replyingTo.text?.length > 50 ? '…' : ''}</span>
              <button type="button" className="global-chat__replying-cancel" onClick={() => setReplyingTo(null)}>×</button>
            </div>
          )}

          <form className="global-chat__form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={user ? (replyingTo ? `Balas ${replyingTo.displayName}...` : 'Tulis pesan ke semua orang...') : 'Masuk untuk ikut chat...'}
              maxLength={300}
              onFocus={() => { if (!user) setAuthModalOpen(true); }}
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
              {sending ? '...' : 'Kirim'}
            </button>
          </form>
        </div>
      )}

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </section>
  );
};

export default GlobalChat;
