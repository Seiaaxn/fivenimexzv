import GlobalChat from './GlobalChat';
import './GlobalChatPage.css';

const GlobalChatPage = () => (
  <div className="main-container global-chat-page">
    <header className="page-header">
      <h1 className="main-title text-gradient">Chat Global</h1>
      <p className="subtitle">Ngobrol bareng semua pengguna secara real-time.</p>
    </header>

    <GlobalChat fullPage />
  </div>
);

export default GlobalChatPage;
