import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { watchGlobalChat } from '../utils/globalChat';
import { isPremiumEmail } from '../utils/premium';
import { useLiveUsers, withLiveUser } from '../hooks/useLiveUsers';
import PremiumBadge from './PremiumBadge';
import './GlobalChatBar.css';

const TICKER_LIMIT = 12;

/**
 * Bar ringkas "GLOBAL CHAT" yang tampil di Home — menunjukkan pesan-pesan
 * terbaru berjalan (marquee) lengkap dengan foto profil, nama, dan badge
 * Pemilik. Klik di mana saja pada bar akan mengarahkan ke halaman chat
 * penuh di /global-chat.
 */
const GlobalChatBar = () => {
  const [messages, setMessages] = useState([]);

  useEffect(() => watchGlobalChat(setMessages), []);

  const recent = useMemo(() => messages.slice(-TICKER_LIMIT), [messages]);
  const liveUids = useMemo(() => recent.map((m) => m.uid), [recent]);
  const liveUsers = useLiveUsers(liveUids);
  const items = useMemo(
    () => recent.map((raw) => withLiveUser(raw, liveUsers)),
    [recent, liveUsers],
  );

  const renderItems = (keyPrefix) =>
    items.map((m, i) => {
      const owner = isPremiumEmail(m.email);
      return (
        <span className="global-chat-bar__item" key={`${keyPrefix}-${m.id || i}`}>
          <img
            src={m.photoURL || '/logo.png'}
            alt=""
            className={`global-chat-bar__avatar${owner ? ' global-chat-bar__avatar--owner' : ''}`}
          />
          <span className="global-chat-bar__content">
            <span className="global-chat-bar__meta">
              <span className="global-chat-bar__name">{m.displayName || 'Pengguna'}</span>
              {owner && (
                <span className="global-chat-bar__owner-tag">
                  <PremiumBadge size={9} title="Pemilik FiveNime" />
                  Dev
                </span>
              )}
            </span>
            <span className="global-chat-bar__text">{m.text}</span>
          </span>
        </span>
      );
    });

  return (
    <Link to="/global-chat" className="global-chat-bar" aria-label="Buka Chat Global">
      <span className="global-chat-bar__label">
        <span className="global-chat-bar__label-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="8" cy="10.5" r="1.1" fill="currentColor" />
          </svg>
        </span>
        <span className="global-chat-bar__label-text">GLOBAL CHAT</span>
        <span className="global-chat-bar__live-dot" aria-hidden="true" />
      </span>

      <span className="global-chat-bar__divider" aria-hidden="true" />

      <span className="global-chat-bar__track-wrap">
        {items.length === 0 ? (
          <span className="global-chat-bar__empty">Belum ada obrolan. Jadilah yang pertama menyapa!</span>
        ) : (
          <span className="global-chat-bar__track">
            {renderItems('a')}
            {renderItems('b')}
          </span>
        )}
      </span>
    </Link>
  );
};

export default GlobalChatBar;
