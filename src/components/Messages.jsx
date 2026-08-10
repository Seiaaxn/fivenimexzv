import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@/lib/router-compat';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { watchMyChats, watchDmMessages, sendDmMessage, dmChatId } from '../utils/directMessages';
import { useLiveUsers } from '../hooks/useLiveUsers';
import AuthModal from './AuthModal';
import './Messages.css';

const timeAgo = (ts) => {
  const seconds = ts?.seconds;
  if (!seconds) return '';
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
  return `${Math.floor(diff / 86400)}h`;
};

/** Daftar percakapan (inbox) milik pengguna. */
const ChatInbox = ({ myUid, activeUid }) => {
  const [chats, setChats] = useState([]);

  useEffect(() => watchMyChats(myUid, setChats), [myUid]);

  // `participantInfo` di tiap chat hanyalah salinan nama/foto lawan bicara
  // saat terakhir dia mengirim pesan — timpa dengan data live per uid
  // supaya inbox selalu menampilkan nama/foto terbaru.
  const otherUids = useMemo(
    () => chats.map((c) => c.participants.find((p) => p !== myUid)).filter(Boolean),
    [chats, myUid],
  );
  const liveUsers = useLiveUsers(otherUids);

  if (chats.length === 0) {
    return <p className="comment-empty" style={{ padding: '16px' }}>Belum ada percakapan. Kunjungi profil teman lalu tekan "Pesan".</p>;
  }

  return (
    <ul className="dm-inbox">
      {chats.map((c) => {
        const otherUid = c.participants.find((p) => p !== myUid);
        const stale = c.participantInfo?.[otherUid] || {};
        const live = liveUsers[otherUid];
        const other = live ? { displayName: live.displayName, photoURL: live.photoURL } : stale;
        return (
          <li key={c.id}>
            <Link to={`/messages/${otherUid}`} className={`dm-inbox__item ${activeUid === otherUid ? 'active' : ''}`}>
              <img src={other.photoURL || '/logo.png'} alt="" className="dm-inbox__avatar" />
              <div className="dm-inbox__body">
                <span className="dm-inbox__name">{other.displayName || 'Pengguna'}</span>
                <span className="dm-inbox__preview">{c.lastMessage || ''}</span>
              </div>
              <span className="dm-inbox__time">{timeAgo(c.updatedAt)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

/** Satu jendela obrolan dengan seorang teman. */
const ChatThread = ({ myUid, myInfo, otherUid }) => {
  const [otherProfile, setOtherProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const chatId = useMemo(() => dmChatId(myUid, otherUid), [myUid, otherUid]);

  useEffect(() => {
    if (!otherUid) return;
    return onSnapshot(doc(db, 'users', otherUid), (snap) => setOtherProfile(snap.exists() ? snap.data() : null));
  }, [otherUid]);

  useEffect(() => watchDmMessages(chatId, setMessages), [chatId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendDmMessage({
        from: myInfo,
        to: { uid: otherUid, displayName: otherProfile?.displayName || 'Pengguna', photoURL: otherProfile?.photoURL || '' },
        text: body,
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dm-thread">
      <div className="dm-thread__header">
        <Link to={`/u/${otherUid}`} className="dm-thread__peer">
          <img src={otherProfile?.photoURL || '/logo.png'} alt="" className="dm-thread__avatar" />
          <span>{otherProfile?.displayName || 'Pengguna'}</span>
        </Link>
      </div>
      <div className="dm-thread__list" ref={listRef}>
        {messages.length === 0 && <p className="comment-empty" style={{ padding: '16px' }}>Mulai obrolan dengan mengirim pesan pertama.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`dm-bubble-row ${m.uid === myUid ? 'me' : ''}`}>
            <div className="dm-bubble">{m.text}</div>
          </div>
        ))}
      </div>
      <form className="dm-thread__form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis pesan..."
          maxLength={1000}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>Kirim</button>
      </form>
    </div>
  );
};

const Messages = () => {
  const { user, profile, loading } = useAuth();
  const { uid: activeUid } = useParams();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  if (loading) {
    return <div className="loading-container main-container"><div className="spinner" /></div>;
  }

  if (!user) {
    return (
      <div className="main-container">
        <header className="page-header">
          <h1 className="main-title text-gradient">Pesan</h1>
          <p className="subtitle">Masuk untuk mengirim dan menerima pesan dari teman kamu.</p>
        </header>
        <div className="empty-state">
          <button type="button" className="btn btn-primary" onClick={() => setAuthModalOpen(true)}>Masuk</button>
        </div>
        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  const myInfo = { uid: user.uid, displayName: profile?.displayName || user.displayName || 'Pengguna', photoURL: profile?.photoURL || user.photoURL || '' };

  return (
    <div className="main-container messages-page">
      <header className="page-header">
        <h1 className="main-title text-gradient">Pesan</h1>
        <p className="subtitle">Chat langsung dengan teman yang kamu ikuti.</p>
      </header>
      <div className={`messages-layout ${activeUid ? 'has-active' : ''}`}>
        <div className="messages-layout__inbox">
          <ChatInbox myUid={user.uid} activeUid={activeUid} />
        </div>
        <div className="messages-layout__thread">
          {activeUid ? (
            <ChatThread myUid={user.uid} myInfo={myInfo} otherUid={activeUid} />
          ) : (
            <p className="comment-empty" style={{ padding: '24px' }}>Pilih percakapan untuk mulai chat.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
