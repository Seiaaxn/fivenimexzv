import { Link } from '@/lib/router-compat';
import Footer from './Footer';
import './DMCA.css';

const DMCA = () => {
  return (
    <div className="dmca-page main-container">
      <div className="dmca-inner">
        {/* Breadcrumb */}
        <nav className="dmca-breadcrumb" aria-label="Navigasi">
          <Link to="/" className="dmca-breadcrumb-link">Beranda</Link>
          <span className="dmca-breadcrumb-sep" aria-hidden="true">›</span>
          <span className="dmca-breadcrumb-current">DMCA</span>
        </nav>

        {/* Hero */}
        <header className="dmca-hero">
          <div className="dmca-hero-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="dmca-hero-title">Kebijakan DMCA</h1>
          <p className="dmca-hero-subtitle">
            FiveNime menghormati hak kekayaan intelektual dan berkomitmen untuk mematuhi
            Digital Millennium Copyright Act (DMCA).
          </p>
        </header>

        {/* Disclaimer cards */}
        <div className="dmca-cards">
          <div className="dmca-card dmca-card--primary">
            <div className="dmca-card-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <div className="dmca-card-body">
              <h2 className="dmca-card-title">Kami Tidak Menyimpan File Video</h2>
              <p className="dmca-card-text">
                FiveNime <strong>tidak menyimpan, meng-host, atau mendistribusikan</strong> file
                video apapun di server kami. Semua konten video yang ditampilkan di situs ini
                merupakan <em>embed</em> dari sumber pihak ketiga yang beroperasi secara
                independen. FiveNime hanya berperan sebagai agregator tautan (link aggregator).
              </p>
            </div>
          </div>

          <div className="dmca-card">
            <div className="dmca-card-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="dmca-card-body">
              <h2 className="dmca-card-title">Konten Pihak Ketiga</h2>
              <p className="dmca-card-text">
                Semua stream dan media yang tersedia di FiveNime bersumber dari layanan streaming
                pihak ketiga seperti Otakudesu, Samehadaku, Anoboy, dan sejenisnya. Kami tidak
                memiliki kendali atas konten yang di-host oleh pihak ketiga tersebut dan tidak
                bertanggung jawab atas ketersediaan maupun legalitasnya.
              </p>
            </div>
          </div>

          <div className="dmca-card">
            <div className="dmca-card-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="dmca-card-body">
              <h2 className="dmca-card-title">Hak Cipta &amp; Kepemilikan Konten</h2>
              <p className="dmca-card-text">
                Seluruh judul anime, donghua, dan komik yang ditampilkan adalah milik studio,
                penerbit, dan pemegang hak cipta masing-masing. FiveNime tidak mengklaim kepemilikan
                atas konten apapun yang ditampilkan. Nama, logo, dan karakter yang tampil adalah
                merek dagang dari pemiliknya masing-masing.
              </p>
            </div>
          </div>
        </div>

        {/* Prosedur DMCA Takedown */}
        <section className="dmca-section">
          <h2 className="dmca-section-title">Prosedur Pengajuan DMCA Takedown</h2>
          <p className="dmca-section-intro">
            Jika kamu adalah pemegang hak cipta yang sah dan meyakini bahwa konten yang
            ditampilkan di FiveNime melanggar hak cipta kamu, silakan kirimkan pemberitahuan
            DMCA yang memuat informasi berikut:
          </p>
          <ol className="dmca-steps">
            <li className="dmca-step">
              <span className="dmca-step-num" aria-hidden="true">1</span>
              <div>
                <strong>Identitas pemohon</strong> — nama lengkap dan informasi kontak (email/telepon)
                dari pemegang hak cipta atau pihak yang berwenang mewakili.
              </div>
            </li>
            <li className="dmca-step">
              <span className="dmca-step-num" aria-hidden="true">2</span>
              <div>
                <strong>Identifikasi konten yang dilanggar</strong> — URL spesifik halaman di
                FiveNime yang memuat konten yang diduga melanggar hak cipta.
              </div>
            </li>
            <li className="dmca-step">
              <span className="dmca-step-num" aria-hidden="true">3</span>
              <div>
                <strong>Deskripsi karya asli</strong> — penjelasan singkat tentang karya berhak
                cipta yang diklaim dilanggar, beserta bukti kepemilikan jika tersedia.
              </div>
            </li>
            <li className="dmca-step">
              <span className="dmca-step-num" aria-hidden="true">4</span>
              <div>
                <strong>Pernyataan itikad baik</strong> — pernyataan bahwa penggunaan konten
                tersebut tidak diizinkan oleh pemegang hak cipta, agennya, atau hukum yang berlaku.
              </div>
            </li>
            <li className="dmca-step">
              <span className="dmca-step-num" aria-hidden="true">5</span>
              <div>
                <strong>Tanda tangan</strong> — tanda tangan fisik atau elektronik dari pemegang
                hak cipta atau pihak yang berwenang.
              </div>
            </li>
          </ol>
        </section>

        {/* Catatan penting */}
        <section className="dmca-section dmca-section--notice">
          <div className="dmca-notice-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="dmca-notice-title">Catatan Penting</h3>
            <p className="dmca-notice-text">
              Karena FiveNime tidak menyimpan file video di server kami, pengajuan DMCA
              sebaiknya ditujukan langsung ke penyedia hosting konten aslinya. Kami
              akan dengan senang hati membantu menghapus tautan terkait dari situs kami
              setelah menerima pemberitahuan yang valid.
            </p>
          </div>
        </section>

        {/* Tombol kembali */}
        <div className="dmca-back">
          <Link to="/" className="btn btn-primary dmca-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Kembali ke Beranda
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default DMCA;
