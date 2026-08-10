import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from '@/lib/router-compat';
import { animeAPI } from '../services/api';
import { addToWatchHistory, updateWatchProgress, getWatchProgress } from '../utils/watchHistory';
import { useAuth } from '../contexts/AuthContext';
import { createPlayer } from '@videojs/react';
import { VideoSkin, Video, videoFeatures } from '@videojs/react/video';
import '@videojs/react/video/skin.css';
import WatchLoading from './WatchLoading';
import EmbedPlayer from './EmbedPlayer';
import CommentSection from './CommentSection';
import AuthModal from './AuthModal';
import { getCustomAnime, isCustomEpisodeId, parseCustomEpisodeId, buildCustomEpisodeId } from '../utils/customAnime';

const isDev = typeof import.meta!== 'undefined' && import.meta.env && import.meta.env.DEV;
const devWarn = (...args) => { if (isDev) console.warn(...args); };
const devLog = (...args) => { if (isDev) console.log(...args); };

const Player = createPlayer({ features: videoFeatures });

const Watch = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [episodeData, setEpisodeData] = useState(null);
  const [animeData, setAnimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState('480p');
  const [selectedServer, setSelectedServer] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchLabel, setSwitchLabel] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const videoElRef = useRef(null);
  const saveTimerRef = useRef(null);
  const savedTimeRef = useRef(0);
  const historyItemRef = useRef(null);
  const uid = user?.uid || null;

  // If Firebase Auth hasn't finished resolving the session yet when this
  // page first loads (common right after a refresh), the very first
  // addToWatchHistory() call below may fire with uid=null and land in
  // localStorage instead of Firestore. Once `uid` becomes available,
  // re-send the last-known episode info so it still ends up saved.
  useEffect(() => {
    if (uid && historyItemRef.current) {
      addToWatchHistory(uid, historyItemRef.current);
    }
  }, [uid]);

  // ─── Progress helpers ───
  const saveProgress = useCallback(() => {
    if (!episodeId) return;
    const vid = videoElRef.current;
    if (vid && vid.currentTime > 5) {
      updateWatchProgress(uid, episodeId, vid.currentTime, vid.duration);
    }
  }, [episodeId, uid]);

  // Save on leave
  useEffect(() => {
    const onUnload = () => saveProgress();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      saveProgress();
    };
  }, [saveProgress]);

  // ─── Fetch episode ───
  useEffect(() => {
    let cancelled = false;

    setEpisodeData(null);
    setAnimeData(null);
    setVideoUrl('');
    setError(null);
    setLoading(true);
    setVideoFailed(false);
    setSwitching(false);
    historyItemRef.current = null;

    const fetchEpisodeData = async () => {
      try {
        // ─── Anime custom (upload admin) ───
        if (isCustomEpisodeId(episodeId)) {
          const parsed = parseCustomEpisodeId(episodeId);
          if (!parsed) throw new Error('Episode tidak ditemukan.');
          const anime = await getCustomAnime(parsed.animeId);
          if (cancelled) return;
          if (!anime) throw new Error('Episode tidak ditemukan.');

          const sorted = (anime.episodeList || []).slice().sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
          const idx = sorted.findIndex((ep) => Number(ep.number) === parsed.number);
          const episode = idx >= 0 ? sorted[idx] : null;
          if (!episode?.videoUrl) throw new Error('Episode tidak ditemukan.');

          const prevEp = idx > 0 ? sorted[idx - 1] : null;
          const nextEp = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

          const dd = {
            title: episode.title || `Episode ${episode.number}`,
            defaultStreamingUrl: episode.videoUrl,
            animeId: parsed.animeId,
            navigation: {
              previous_episode: prevEp ? { slug: buildCustomEpisodeId(parsed.animeId, prevEp.number) } : null,
              next_episode: nextEp ? { slug: buildCustomEpisodeId(parsed.animeId, nextEp.number) } : null,
            },
          };
          setEpisodeData(dd);
          setAnimeData({ ...anime, __provider: 'custom' });
          setVideoUrl(dd.defaultStreamingUrl);

          const historyItem = {
            animeId: parsed.animeId,
            episodeId,
            animeTitle: anime.title,
            episodeTitle: dd.title,
            poster: anime.poster,
            provider: 'custom',
          };
          historyItemRef.current = historyItem;
          addToWatchHistory(uid, historyItem);
          setLoading(false);
          return;
        }

        const stateProvider = location.state?.provider;
        const allProviders = [
          { fn: () => animeAPI.getDonghuaEpisode(episodeId), name: 'donghua' },
          { fn: () => animeAPI.getEpisodeDetail(episodeId), name: 'otakudesu' },
          { fn: () => animeAPI.getEpisodeDetailSamehadaku(episodeId), name: 'samehadaku' },
          { fn: () => animeAPI.getEpisodeDetailStream(episodeId), name: 'stream' },
        ];

        let providers;
        if (stateProvider) {
          const primary = allProviders.find(p => p.name === stateProvider);
          const rest = allProviders.filter(p => p.name!== stateProvider);
          providers = primary? [primary,...rest] : rest;
        } else {
          providers = allProviders;
        }

        let data = null, usedProvider = null, lastError = null;
        for (const p of providers) {
          if (cancelled) return;
          try {
            const result = await p.fn();
            if (result?.streaming?.servers || result?.data?.defaultStreamingUrl || result?.data?.servers || result?.data?.server) {
              data = result; usedProvider = p.name; break;
            }
          } catch (e) { lastError = e; }
        }
        if (cancelled) return;
        if (!data) throw new Error(lastError?.message || 'Episode tidak ditemukan.');

        // Donghua
        if (usedProvider === 'donghua' && data.streaming) {
          if (cancelled) return;
          const dd = {
            episode: data.episode,
            defaultStreamingUrl: data.streaming.main_url?.url || data.streaming.servers[0]?.url,
            server: { qualities: [{ title: 'Streaming', serverList: data.streaming.servers.map(s => ({ title: s.name, url: s.url })) }] },
            navigation: data.navigation, donghua_details: data.donghua_details,
          };
          setEpisodeData(dd);
          setVideoUrl(dd.defaultStreamingUrl);
          setSelectedQuality('Streaming');
          if (dd.server.qualities[0]?.serverList?.[0]) setSelectedServer(dd.server.qualities[0].serverList[0]);
          if (data.donghua_details) {
            const historyItem = { animeId: data.donghua_details.slug, episodeId, animeTitle: data.donghua_details.title, episodeTitle: data.episode, poster: data.donghua_details.poster, provider: 'donghua' };
            historyItemRef.current = historyItem;
            addToWatchHistory(uid, historyItem);
          }
          setLoading(false); return;
        }

        if (cancelled) return;

        // Anime
        const raw = data?.data || null;
        let normalized = raw;
        if (raw &&!raw.server && Array.isArray(raw.servers)) {
          const qm = new Map();
          raw.servers.forEach(s => {
            const q = s.quality || s.resolution || 'Default';
            if (!qm.has(q)) qm.set(q, []);
            qm.get(q).push({...s, title: s.name || s.server || s.title || 'Server' });
          });
          normalized = {...raw, defaultStreamingUrl: raw.defaultStreamingUrl || raw.servers[0]?.url, server: { qualities: Array.from(qm.entries()).map(([q, sl]) => ({ title: q, serverList: sl })) } };
        }

        setEpisodeData(normalized);
        if (normalized?.defaultStreamingUrl) setVideoUrl(normalized.defaultStreamingUrl);
        if (normalized?.server?.qualities?.length > 0) {
          const fq = normalized.server.qualities[0];
          setSelectedQuality(fq.title);
          if (fq.serverList?.[0]) setSelectedServer(fq.serverList[0]);
        }

        if (cancelled) return;

        if (normalized?.animeId) {
          try {
            const animeRes = await animeAPI.getAnimeDetail(normalized.animeId);
            if (cancelled) return;
            setAnimeData(animeRes?.data || null);
            const historyItem = { animeId: animeRes?.data?.animeId || normalized.animeId, episodeId, animeTitle: animeRes?.data?.title || normalized.title || episodeId, episodeTitle: normalized.title || episodeId, poster: animeRes?.data?.poster || animeRes?.data?.poster_url || '', provider: usedProvider || 'otakudesu' };
            historyItemRef.current = historyItem;
            addToWatchHistory(uid, historyItem);
          } catch {
            // Ignore history save errors
          }
        }
      } catch (err) {
        if (!cancelled) setError(err?.message?? String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEpisodeData();
    return () => { cancelled = true; };
  }, [episodeId]);

  // ─── Video.js progress tracking + error recovery ───
  const retryCountRef = useRef(0);

  useEffect(() => {
    const vid = videoElRef.current;
    if (!vid) return;
    retryCountRef.current = 0;

    let cancelled = false;
    getWatchProgress(uid, episodeId).then((t) => { if (!cancelled) savedTimeRef.current = t; });

    const onLoaded = () => {
      if (savedTimeRef.current > 5) vid.currentTime = savedTimeRef.current;
      setSwitching(false);
      retryCountRef.current = 0;
    };
    const onPause = () => {
      if (vid.currentTime > 5) updateWatchProgress(uid, episodeId, vid.currentTime, vid.duration);
    };
    const onPlay = () => {
      if (!saveTimerRef.current) {
        saveTimerRef.current = setInterval(() => {
          if (vid.currentTime > 5) updateWatchProgress(uid, episodeId, vid.currentTime, vid.duration);
        }, 5000);
      }
    };
    const onEnded = () => {
      if (vid.currentTime > 5) updateWatchProgress(uid, episodeId, vid.currentTime, vid.duration);
    };

    const onError = () => {
      const lastPos = vid.currentTime || 0;
      devWarn(`[Watch] Video error at ${lastPos}s, retry #${retryCountRef.current + 1}`);

      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        if (lastPos > 5) updateWatchProgress(uid, episodeId, lastPos, vid.duration);
        setTimeout(() => {
          try {
            vid.load();
            vid.addEventListener('loadeddata', () => {
              vid.currentTime = Math.max(0, lastPos - 2);
              vid.play().catch(() => {});
            }, { once: true });
          } catch {
            // Ignore video seek errors
          }
        }, 1000);
      } else {
        devWarn('[Watch] Max retries reached, falling back to iframe');
        setVideoFailed(true);
      }
    };

    let stallTimer = null;
    const onStalled = () => {
      stallTimer = setTimeout(() => {
        if (vid.readyState < 3 &&!vid.paused) {
          devWarn('[Watch] Video stalled, attempting recovery');
          const pos = vid.currentTime;
          vid.load();
          vid.addEventListener('loadeddata', () => {
            vid.currentTime = pos;
            vid.play().catch(() => {});
          }, { once: true });
        }
      }, 8000);
    };
    const onPlaying = () => {
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    };

    vid.addEventListener('loadeddata', onLoaded);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('error', onError);
    vid.addEventListener('stalled', onStalled);
    vid.addEventListener('playing', onPlaying);

    return () => {
      vid.removeEventListener('loadeddata', onLoaded);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('error', onError);
      vid.removeEventListener('stalled', onStalled);
      vid.removeEventListener('playing', onPlaying);
      if (saveTimerRef.current) { clearInterval(saveTimerRef.current); saveTimerRef.current = null; }
      if (stallTimer) clearTimeout(stallTimer);
      cancelled = true;
    };
  }, [videoUrl, episodeId, uid]);

  // ─── Auto-rotate on fullscreen (mobile) ───
  useEffect(() => {
    const onFullscreenChange = () => {
      try {
        if (document.fullscreenElement) {
          screen.orientation?.lock?.('landscape').catch(() => {});
        } else {
          screen.orientation?.unlock?.();
        }
      } catch {
        // Ignore orientation lock errors
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
    };
  }, []);

  // ─── Indikator buffering + anti-stall ───
  // Beberapa server streaming sering "menggantung" beberapa detik. Kita
  // tampilkan indikator halus (bukan blocking) dan otomatis memancing
  // browser melanjutkan buffer ketika video stall terlalu lama.
  useEffect(() => {
    const vid = videoElRef.current;
    if (!vid || !videoUrl) return;

    let stallTimer = null;
    const clearStall = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };

    const onWaiting = () => {
      setBuffering(true);
      clearStall();
      // Kalau masih stuck > 6 detik, nudge posisi play agar buffer jalan lagi.
      stallTimer = setTimeout(() => {
        try {
          if (vid.readyState < 3 && !vid.paused) {
            vid.currentTime = Math.max(0, vid.currentTime - 0.1);
            vid.play?.().catch(() => {});
          }
        } catch { /* ignore */ }
      }, 6000);
    };
    const onPlaying = () => { setBuffering(false); clearStall(); };
    const onCanPlay = () => { setBuffering(false); clearStall(); };

    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('stalled', onWaiting);
    vid.addEventListener('playing', onPlaying);
    vid.addEventListener('canplay', onCanPlay);
    vid.addEventListener('canplaythrough', onCanPlay);
    return () => {
      clearStall();
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('stalled', onWaiting);
      vid.removeEventListener('playing', onPlaying);
      vid.removeEventListener('canplay', onCanPlay);
      vid.removeEventListener('canplaythrough', onCanPlay);
    };
  }, [videoUrl]);

  // ─── Anti-ads ───
  useEffect(() => {
    const adP = ['doubleclick.net', 'googlesyndication.com', 'popads.net', 'popcash.net', 'adsterra.com', 'exoclick.com'];
    const isAd = (h) => h && adP.some(d => h.toLowerCase().includes(d));
    const block = (e) => { const l = e.target.closest('a[target="_blank"]'); if (l && isAd(l.href)) { e.preventDefault(); e.stopPropagation(); } };
    const orig = window.open;
    window.open = function(u) { if (u && isAd(u)) return null; return orig.apply(this, arguments); };
    document.addEventListener('click', block, true);
    return () => { document.removeEventListener('click', block, true); window.open = orig; };
  }, []);

  useEffect(() => {
    if (!switching) return;
    const timer = setTimeout(() => setSwitching(false), 3000);
    return () => clearTimeout(timer);
  }, [videoUrl, switching]);

  // ─── Handlers ───
  const handleServerSelect = (server) => {
    saveProgress();
    setSwitching(true);
    setSwitchLabel(server.title || 'Server');
    if (server.href) {
      const sid = server.serverId || server.href.split('/').pop();
      animeAPI.getStreamingServer(sid).then(d => {
        if (d?.data?.url) setVideoUrl(d.data.url);
        else setSwitching(false);
      }).catch(() => {
        if (episodeData?.defaultStreamingUrl) setVideoUrl(episodeData.defaultStreamingUrl);
        setSwitching(false);
      });
    } else if (server.url) {
      setVideoUrl(server.url);
    } else {
      setSwitching(false);
    }
    setVideoFailed(false);
    setSelectedServer(server);
  };

  const handleQualityChange = (quality) => {
    setSelectedQuality(quality);
    setSwitching(true);
    setSwitchLabel(quality);
    const servers = episodeData?.server?.qualities?.find(q => q.title === quality)?.serverList;
    if (servers?.length > 0) {
      handleServerSelect(servers.find(s => s.title?.toLowerCase().includes('ondesu')) || servers[0]);
    } else {
      setSwitching(false);
    }
  };

  const toEmbedUrl = (url) => {
    if (!url) return url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const v = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
      return `https://www.youtube.com/embed/${v}`;
    }
    if (url.includes('drive.google.com')) {
      const f = url.split('/d/')[1]?.split('/')[0];
      return `https://drive.google.com/file/d/${f}/preview`;
    }
    return url;
  };

  const useVideoJs = videoUrl &&!videoFailed;

  // ─── Render ───
  if (loading) return <div className="loading-container main-container"><div className="spinner" /><p>Memuat video...</p></div>;

  if (error ||!episodeData) {
    const nf = error?.includes('tidak ditemukan') || error?.includes('404');
    return (
      <div className="error-container main-container">
        <h2>{nf? 'Episode Tidak Ditemukan' : 'Terjadi Kesalahan'}</h2>
        <p className="error-message">{error || 'Episode tidak ditemukan'}</p>
        <div className="error-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(-1)}>Kembali</button>
          <Link to="/" className="btn btn-secondary">Ke Beranda</Link>
        </div>
      </div>
    );
  }

  const iframeSrc = videoFailed? toEmbedUrl(videoUrl) : null;
  const isCustomEp = animeData?.__provider === 'custom';
  const backId = animeData?.slug?? animeData?.animeId?? animeData?.id?? episodeData?.animeId?? episodeData?.animeSlug;
  const hasBack = backId!= null && String(backId).trim()!== '';
  const backHref = isCustomEp ? `/anime/custom/${backId}` : `/anime/${backId}`;

  const synopsisParagraphs = animeData?.synopsis?.paragraphs?.length
    ? animeData.synopsis.paragraphs
    : (typeof animeData?.synopsis === 'string' && animeData.synopsis ? [animeData.synopsis] : []);

  return (
    <div className="watch-page main-container">
      <div style={{ marginBottom: '12px' }}>
        {hasBack? (
          <Link to={backHref} className="back-link">Kembali ke {(animeData?.title || 'Anime').substring(0, 40)}</Link>
        ) : (
          <button type="button" className="back-link" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', padding: 0, fontFamily: 'var(--font-sans)' }}>Kembali</button>
        )}
      </div>

      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: '16px' }}>{episodeData.title}</h1>

      {/* Video Player */}
      <div className="video-player-wrapper" style={{ position: 'relative' }}>
        {switching && <WatchLoading message="Mengganti server..." serverName={switchLabel} />}
        {!switching && buffering && (
          <div className="watch-buffering" role="status" aria-live="polite">
            <span className="watch-buffering__spinner" aria-hidden />
            <span>Menyiapkan buffer...</span>
          </div>
        )}
        {videoUrl? (
          useVideoJs? (
            <Player.Provider key={videoUrl}>
              <VideoSkin>
                <Video
                  ref={(el) => {
                    videoElRef.current = el;
                    if (el) {
                      el.onerror = () => {
                        devLog('[Watch] Video.js failed, falling back to iframe');
                        setVideoFailed(true);
                        setSwitching(false);
                      };
                    }
                  }}
                  src={videoUrl}
                  playsInline
                  autoPlay
                  preload="auto"
                />
              </VideoSkin>
            </Player.Provider>
          ) : iframeSrc? (
            <EmbedPlayer src={iframeSrc} title={episodeData.title} onLoad={() => setSwitching(false)} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Buka Video</a>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><div className="spinner" /></div>
        )}
      </div>

      {/* Quality & Server */}
      <div className="server-selector">
        {episodeData?.server?.qualities?.length > 0 && (
          <div className="qs-section">
            <div className="qs-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z"/></svg>
              Kualitas
            </div>
            <div className="quality-tabs">
              {episodeData.server.qualities.map(q => (
                <button
                  key={q.title}
                  type="button"
                  className={`quality-tab ${selectedQuality === q.title ? 'active' : ''}`}
                  onClick={() => handleQualityChange(q.title)}
                  aria-pressed={selectedQuality === q.title}
                >
                  {q.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="qs-section">
          <div className="qs-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Server
          </div>
          <div className="server-list">
            {episodeData?.server?.qualities?.find(q => q.title === selectedQuality)?.serverList?.map((s, idx) => (
              <button
                key={s.serverId || s.title}
                type="button"
                className={`server-btn ${selectedServer?.title === s.title ? 'active' : ''}`}
                onClick={() => handleServerSelect(s)}
                aria-pressed={selectedServer?.title === s.title}
                title={`FiveNime ${idx + 1}`}
              >
                {selectedServer?.title === s.title && (
                  <span className="server-btn__dot" aria-hidden="true" />
                )}
                FiveNime {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="episode-navigation">
        {(episodeData?.navigation?.previous_episode || (episodeData?.hasPrevEpisode &&!episodeData?.navigation)) && (
          <Link to={`/watch/${episodeData?.navigation?.previous_episode?.slug || episodeData?.prevEpisode?.episodeId || episodeId}`} className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>Eps Sebelumnya</Link>
        )}
        {(episodeData?.navigation?.next_episode || (episodeData?.hasNextEpisode &&!episodeData?.navigation)) && (
          <Link to={`/watch/${episodeData?.navigation?.next_episode?.slug || episodeData?.nextEpisode?.episodeId || episodeId}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>Eps Berikutnya</Link>
        )}
      </div>

      {/* Anime Info */}
      {animeData && (
        <div className="detail-header" style={{ marginTop: '20px' }}>
          <div className="detail-poster" style={{ width: '140px' }}>
            <img src={animeData.poster || animeData.poster_url} alt={animeData.title} loading="lazy" decoding="async" />
          </div>
          <div className="detail-info">
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '8px' }}>{animeData.title}</h2>
            <div className="detail-meta">
              {animeData.type && <span className="detail-meta-item">{animeData.type}</span>}
              {(animeData.score?.value || (typeof animeData.score === 'string' && animeData.score)) && (
                <span className="detail-meta-item">{animeData.score?.value || animeData.score}</span>
              )}
              {animeData.episodes!= null && <span className="detail-meta-item">{animeData.episodes} Episode</span>}
              {animeData.status && <span className="detail-meta-item">{animeData.status}</span>}
              {animeData.aired && <span className="detail-meta-item">{animeData.aired}</span>}
              {animeData.duration && <span className="detail-meta-item">{animeData.duration}</span>}
              {animeData.studios && <span className="detail-meta-item">{animeData.studios}</span>}
            </div>
            {animeData.genreList?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', justifyContent: 'center', textAlign: 'center', width: '100%' }}>
                {animeData.genreList.map(g => <span key={g.title} className="detail-meta-item" style={{ fontSize: '0.65rem' }}>{g.title}</span>)}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Sinopsis */}
      {animeData && (
        <section className="dd-synopsis section section-neo" aria-labelledby="watch-synopsis-heading" style={{ marginTop: '20px' }}>
          <h2 id="watch-synopsis-heading" className="dd-section-title">Sinopsis</h2>
          {synopsisParagraphs.length > 0 ? (
            synopsisParagraphs.map((para, idx) => (
              <p key={idx} className="dd-synopsis__text">{para}</p>
            ))
          ) : (
            <p className="dd-synopsis__text">Sinopsis tidak tersedia.</p>
          )}
        </section>
      )}

      <CommentSection
        contentType={episodeData?.donghua_details ? 'donghua' : 'anime'}
        contentId={episodeId}
        contentTitle={animeData?.title || episodeData?.donghua_details?.title || episodeData?.title}
        onRequireLogin={() => setAuthModalOpen(true)}
      />

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export default Watch;
