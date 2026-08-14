import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  REQUEST_LIMIT,
  TICK_LIMIT,
  saveStatusSnapshot,
  saveStatusTick,
  watchRequests,
  watchStatusSnapshot,
  watchStatusTicks,
} from '../utils/systemStatus';

const POLL_MS = 5000;

/**
 * Mengambil metrik server dari /api/public/system-status setiap 5 detik,
 * mengukur latency client -> server, lalu menyimpannya ke Firebase.
 * Grafik & daftar request dibaca kembali dari Firebase (realtime), dengan
 * fallback ke tick lokal ketika user belum login (tidak boleh menulis).
 */
export const useSystemStatus = ({ enabled = true } = {}) => {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const uidRef = useRef(uid);
  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  const [metrics, setMetrics] = useState(null);
  const [latency, setLatency] = useState(null);
  const [online, setOnline] = useState(true);
  const [storedSnapshot, setStoredSnapshot] = useState(null);
  const [remoteTicks, setRemoteTicks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [localTicks, setLocalTicks] = useState([]);

  const poll = useCallback(async () => {
    const started = performance.now();
    try {
      const res = await fetch('/api/public/system-status', { cache: 'no-store' });
      const ms = Math.round(performance.now() - started);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMetrics(data);
      setLatency(ms);
      setOnline(true);

      const tick = {
        cpuPercent: data?.cpu?.loadPercent ?? 0,
        ramPercent: data?.memory?.usedPercent ?? 0,
        latencyMs: ms,
      };
      setLocalTicks((prev) => [...prev, { ...tick, id: `${Date.now()}` }].slice(-TICK_LIMIT));

      if (uidRef.current) {
        saveStatusSnapshot(uidRef.current, { ...data, latencyMs: ms });
        saveStatusTick(uidRef.current, tick);
      }
    } catch {
      setOnline(false);
      setLatency(Math.round(performance.now() - started));
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, poll]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const unsubSnap = watchStatusSnapshot(setStoredSnapshot);
    const unsubTicks = watchStatusTicks(setRemoteTicks, TICK_LIMIT);
    const unsubReq = watchRequests(setRequests, REQUEST_LIMIT);
    return () => {
      unsubSnap?.();
      unsubTicks?.();
      unsubReq?.();
    };
  }, [enabled]);

  const ticks = remoteTicks.length ? remoteTicks : localTicks;

  return {
    metrics: metrics || storedSnapshot,
    storedSnapshot,
    latency,
    online,
    ticks,
    requests,
    persisted: Boolean(uid),
    refresh: poll,
  };
};

export default useSystemStatus;
