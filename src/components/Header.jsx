import { useState, useEffect } from 'react';
import { Link, useLocation } from '@/lib/router-compat';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import './Header.css';


const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="15.5" y1="15.5" x2="21" y2="21" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
  </svg>
);

const Header = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, profile, isAdmin } = useAuth();
  const isLight = theme === 'light';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);


  // Reset UI state on navigation
  useEffect(() => { setMobileMenuOpen(false); setOpenDropdown(null); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => { setMobileMenuOpen(false); setOpenDropdown(null); };
  const toggleDropdown = (label) => setOpenDropdown((prev) => (prev === label? null : label));

  const navLinks = [
    { to: '/', label: 'Home' },
    { label: 'Anime', submenu: [
      { to: '/ongoing', label: 'Ongoing' },
      { to: '/completed', label: 'Completed' },
      { to: '/az-list', label: 'A-Z List' },
    ]},
    { label: 'Donghua', submenu: [
      { to: '/donghua-ongoing', label: 'Ongoing' },
      { to: '/donghua-completed', label: 'Completed' },
      { to: '/donghua-genres', label: 'Genres' },
      { to: '/donghua-az', label: 'A-Z List' },
    ]},
    { to: '/genres', label: 'Genres' },
    { label: 'Komik', submenu: [
      { to: '/komik', label: 'Terbaru' },
      { to: '/komik/genres', label: 'Genres' },
      { to: '/komik/berwarna', label: 'Berwarna' },
      { to: '/komik/type/manga', label: 'Manga' },
      { to: '/komik/type/manhwa', label: 'Manhwa' },
      { to: '/komik/type/manhua', label: 'Manhua' },
    ]},
    { to: '/schedule', label: 'Schedule' },
    { to: '/history', label: 'History' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <>
      <header className="header">
        <nav className="nav-container" aria-label="Main navigation">
          <div className="nav-brand">
            <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
              <img src="/logo.png" alt="FiveNime" className="logo-image" />
              <span className="logo-text">FiveNime</span>
            </Link>
          </div>
          <div className={`nav-menu ${mobileMenuOpen? 'open' : ''}`} role="navigation">
            {navLinks.map((link, idx) => {
              if (link.submenu) {
                const isOpen = openDropdown === link.label;
                return (
                  <div key={idx} className={`nav-dropdown ${isOpen? 'open' : ''}`}>
                    <button type="button" className="nav-link dropdown-trigger" onClick={() => toggleDropdown(link.label)} aria-expanded={isOpen}>
                      {link.label}
                      <span className={`dropdown-arrow ${isOpen? 'rotated' : ''}`}>▾</span>
                    </button>
                    <div className={`dropdown-menu ${isOpen? 'show' : ''}`}>
                      {link.submenu.map((sub) => (
                        <Link key={sub.to} to={sub.to} className={`dropdown-item ${location.pathname === sub.to? 'active' : ''}`} onClick={closeMobileMenu}>{sub.label}</Link>
                      ))}
                    </div>
                  </div>
                );
              }
              return <Link key={link.to} to={link.to} className={`nav-link ${location.pathname === link.to? 'active' : ''}`} onClick={closeMobileMenu}>{link.label}</Link>;
            })}
          </div>
          <div className="nav-actions">
            <button
              type="button"
              className="nav-mode-btn"
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              aria-label={isLight ? 'Aktifkan dark mode' : 'Aktifkan light mode'}
              title={isLight ? 'Dark mode' : 'Light mode'}
            >
              {isLight ? <MoonIcon /> : <SunIcon />}
            </button>
            <Link to="/search" className="nav-search-link" onClick={closeMobileMenu} aria-label="Cari">
              <SearchIcon />
            </Link>
            {user ? (
              <Link to="/messages" className="nav-avatar-link" onClick={closeMobileMenu} aria-label="Pesan" title="Pesan">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 5h16v11H7l-3 3V5z" />
                </svg>
              </Link>
            ) : null}
            {user ? (
              <Link to="/profile" className="nav-avatar-link" onClick={closeMobileMenu} aria-label="Profil saya">
                <img
                  src={profile?.photoURL || user.photoURL || '/logo.png'}
                  alt=""
                  className="nav-avatar-img"
                />
              </Link>
            ) : (
              <button type="button" className="nav-login-btn" onClick={() => setAuthModalOpen(true)}>
                Masuk
              </button>
            )}
            <button type="button" className={`mobile-menu-btn ${mobileMenuOpen? 'open' : ''}`} onClick={() => setMobileMenuOpen(p =>!p)} aria-label="Menu">
              <span className="hamburger-line" /><span className="hamburger-line" /><span className="hamburger-line" />
            </button>
          </div>

        </nav>
      </header>
      {mobileMenuOpen && <div className="mobile-overlay open" onClick={closeMobileMenu} />}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
};

export default Header;
