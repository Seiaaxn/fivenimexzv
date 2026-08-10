import { Link } from '@/lib/router-compat';
import { ANNOUNCEMENTS } from '../config/announcements';
import './AnnouncementBanner.css';

const ICONS = { warning: '⚠️', info: 'ℹ️', success: '✅', error: '⛔' };

// Pengumuman permanen: tidak ada tombol tutup, tidak ada localStorage.
// Teksnya berjalan (marquee) ke arah kiri.
const AnnouncementBanner = () => {
  const active = (ANNOUNCEMENTS || []).filter((a) => a && a.active);
  if (active.length === 0) return null;

  return (
    <div className="announce-stack" role="region" aria-label="Pengumuman">
      {active.map((a) => {
        const type = ICONS[a.type] ? a.type : 'info';
        const isExternal = /^https?:\/\//.test(a.linkTo || '');

        const content = (
          <span className="announce__chunk">
            <span className="announce__icon" aria-hidden="true">{ICONS[type]}</span>
            {a.title && <strong className="announce__title">{a.title}</strong>}
            <span className="announce__text">{a.message}</span>
            {a.linkText && a.linkTo && (
              isExternal ? (
                <a
                  href={a.linkTo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="announce__link"
                >
                  {a.linkText}
                </a>
              ) : (
                <Link to={a.linkTo} className="announce__link">{a.linkText}</Link>
              )
            )}
          </span>
        );

        return (
          <div key={a.id} className={`announce announce--${type}`}>
            <div className="announce__marquee">
              <div className="announce__track">
                {content}
                {/* duplikat agar loop-nya mulus & tanpa celah */}
                <span aria-hidden="true">{content}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnnouncementBanner;
