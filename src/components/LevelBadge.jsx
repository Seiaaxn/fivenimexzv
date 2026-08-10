import './LevelBadge.css';

/** Small "Lv. X" pill badge, used next to a user's name (profile, comments, chat). */
const LevelBadge = ({ level = 1, size = 'md' }) => (
  <span className={`level-badge level-badge--${size}`} title={`Level ${level}`}>
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M12 1.5l3.2 6.9 7.3 1.1-5.3 5.3 1.3 7.4-6.5-3.5-6.5 3.5 1.3-7.4-5.3-5.3 7.3-1.1z" />
    </svg>
    Lv. {level}
  </span>
);

export default LevelBadge;
