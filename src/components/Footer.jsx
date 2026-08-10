import { useState } from 'react';
import { Link } from '@/lib/router-compat';
import './Footer.css';

const Footer = () => {
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const year = new Date().getFullYear();

  const handleSendReport = () => {
    const subject = encodeURIComponent('[FiveNime] Laporan Bug');
    const body = encodeURIComponent(`Bug:\n\n${reportText || '(Jelaskan masalah)'}\n\n---\nURL: ${window.location.href}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowReport(false);
    setReportText('');
  };

  return (
    <>
      <footer className="footer">
        <div className="footer-glow" />
        <div className="footer-inner">
          {/* Brand */}
          <div className="footer-brand-section">
            <Link to="/" className="footer-brand-link">
              <img src="/logo.png" alt="FiveNime" className="footer-logo-img" />
              <span className="footer-brand-name">FiveNime</span>
            </Link>
            <p className="footer-tagline">
              Tempat nonton anime & donghua sub Indo paling lengkap. Gratis, kualitas terbaik.
            </p>
          </div>

          {/* Links */}
          <div className="footer-links-section">
            <div className="footer-col">
              <h4 className="footer-col-title">Jelajahi</h4>
              <Link to="/ongoing" className="footer-link">Anime Ongoing</Link>
              <Link to="/completed" className="footer-link">Anime Completed</Link>
              <Link to="/donghua-ongoing" className="footer-link">Donghua</Link>
              <Link to="/schedule" className="footer-link">Jadwal Tayang</Link>
            </div>
            <div className="footer-col">
              <h4 className="footer-col-title">Lainnya</h4>
              <Link to="/genres" className="footer-link">Genre</Link>
              <Link to="/az-list" className="footer-link">A-Z List</Link>
              <Link to="/search" className="footer-link">Pencarian</Link>
              <Link to="/history" className="footer-link">Riwayat</Link>
            </div>
            <div className="footer-col">
              <h4 className="footer-col-title">Bantuan</h4>
              <button type="button" className="footer-link footer-link-btn" onClick={() => setShowReport(true)}>Lapor Bug</button>
            </div>
          </div>

          {/* Bottom */}
          <div className="footer-bottom">
            <p className="footer-copy">© {year} FiveNime. All rights reserved.</p>
            <p className="footer-disclaimer">FiveNime adalah platform streaming anime gratis. Kami tidak menyimpan file video di server kami.</p>
          </div>
        </div>
      </footer>

      {/* Report Modal */}
      {showReport && (
        <div className="report-modal-overlay" onClick={() => setShowReport(false)}>
          <div className="report-modal" onClick={e => e.stopPropagation()}>
            <button className="report-modal-close" onClick={() => setShowReport(false)}>✕</button>
            <h2 className="report-modal-title">Lapor Bug</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '12px' }}>Jelaskan error yang kamu temukan.</p>
            <textarea
              className="report-modal-textarea"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Contoh: Video tidak bisa diputar di halaman..."
              rows={4}
            />
            <div className="report-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReport(false)}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={handleSendReport}>Kirim via Email</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
