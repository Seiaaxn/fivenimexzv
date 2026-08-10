import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addBookmark, removeBookmark, watchIsBookmarked } from '../utils/bookmarks';

const LABELS = {
  favorite: { active: 'Favorit', inactive: 'Favorit' },
  watchlist: { active: 'Watchlist', inactive: '+ Watchlist' },
};

/**
 * item: { contentId, title, poster, type: 'anime' | 'donghua' | 'komik', slug, provider }
 * listType: 'favorite' | 'watchlist'
 */
const BookmarkButton = ({ item, listType = 'watchlist', onRequireLogin, className = '' }) => {
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const type = item?.type || 'anime';
  const labels = LABELS[listType] || LABELS.watchlist;

  useEffect(() => {
    if (!user || !item?.contentId) { setBookmarked(false); return; }
    return watchIsBookmarked(user.uid, listType, type, item.contentId, setBookmarked);
  }, [user, listType, type, item?.contentId]);

  const handleClick = async () => {
    if (!user) { onRequireLogin?.(); return; }
    if (!item?.contentId || busy) return;
    setBusy(true);
    try {
      if (bookmarked) await removeBookmark(user.uid, listType, type, item.contentId);
      else await addBookmark(user.uid, { ...item, listType });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn ${className || 'btn-large'} ${bookmarked ? 'btn-primary' : 'btn-secondary'}`}
      onClick={handleClick}
      disabled={busy}
      aria-pressed={bookmarked}
    >
      {bookmarked ? labels.active : labels.inactive}
    </button>
  );
};

export default BookmarkButton;
