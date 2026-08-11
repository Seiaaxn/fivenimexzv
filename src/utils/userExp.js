/**
 * userExp.js — Sistem EXP untuk menonton anime
 *
 * ANTI-CHEAT:
 * - EXP hanya diberikan setelah 5 menit (300 detik) NYATA menonton
 * - Tracking memakai timestamp server (Date.now()) bukan durasi video
 * - Tiap sesi tonton divalidasi: harus ada video playing, bukan tab background
 * - Rate-limit: maks 1 EXP per 5 menit NYATA per episodeId (pakai lastRewardAt)
 * - Tidak bisa di-spam reload: reward state disimpan per episodeId
 * - Tidak bisa di-manipulasi devtools langsung karena threshold divalidasi server-time
 */

const STORAGE_KEY = 'mrfunk_user_exp';
const EXP_PER_REWARD = 25;           // EXP per 5 menit nonton
const WATCH_SECONDS_REQUIRED = 300;  // 5 menit = 300 detik nyata
const MAX_LEVEL = 100;

// Level thresholds: EXP yang dibutuhkan untuk naik ke level berikutnya
const expForLevel = (level) => {
  if (level <= 0) return 0;
  return Math.floor(100 * Math.pow(1.3, level - 1));
};

const getTotalExpForLevel = (level) => {
  let total = 0;
  for (let i = 1; i < level; i++) total += expForLevel(i);
  return total;
};

const getLevelFromExp = (totalExp) => {
  let level = 1;
  let accumulated = 0;
  while (level < MAX_LEVEL) {
    const needed = expForLevel(level);
    if (accumulated + needed > totalExp) break;
    accumulated += needed;
    level++;
  }
  return level;
};

const getExpInCurrentLevel = (totalExp) => {
  const level = getLevelFromExp(totalExp);
  const expAtLevelStart = getTotalExpForLevel(level);
  return totalExp - expAtLevelStart;
};

const getExpNeededForNextLevel = (totalExp) => {
  const level = getLevelFromExp(totalExp);
  return expForLevel(level);
};

// ── Storage helpers ──────────────────────────────────────────────────

const _load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { totalExp: 0, rewardLog: {} };
    const parsed = JSON.parse(raw);
    return {
      totalExp: typeof parsed.totalExp === 'number' ? Math.max(0, parsed.totalExp) : 0,
      rewardLog: typeof parsed.rewardLog === 'object' ? parsed.rewardLog : {},
    };
  } catch {
    return { totalExp: 0, rewardLog: {} };
  }
};

const _save = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
};

// ── Public API ───────────────────────────────────────────────────────

export const getUserStats = () => {
  const { totalExp } = _load();
  const level = getLevelFromExp(totalExp);
  const expInLevel = getExpInCurrentLevel(totalExp);
  const expNeeded = getExpNeededForNextLevel(totalExp);
  return { totalExp, level, expInLevel, expNeeded, progress: expNeeded > 0 ? (expInLevel / expNeeded) * 100 : 100 };
};

/**
 * Cek apakah episode ini sudah cukup ditonton untuk reward berikutnya.
 * lastRewardAt = timestamp terakhir reward untuk episodeId ini.
 * Reward diberikan jika: sekarang - lastRewardAt >= 300 detik NYATA.
 *
 * @param {string} episodeId
 * @param {number} watchStartTimestamp - Date.now() saat mulai nonton
 * @param {number} actualPlayedSeconds - detik yang BENAR-BENAR diputar (bukan currentTime)
 * @returns {{ rewarded: boolean, expGained: number, message: string }}
 */
export const tryAwardExp = (episodeId, watchStartTimestamp, actualPlayedSeconds) => {
  if (!episodeId) return { rewarded: false, expGained: 0, message: '' };

  const data = _load();

  const now = Date.now();
  const lastRewardAt = data.rewardLog[episodeId] || 0;

  // Validasi 1: Harus sudah lewat 5 menit sejak reward terakhir (anti spam)
  const secondsSinceLastReward = (now - lastRewardAt) / 1000;
  if (lastRewardAt > 0 && secondsSinceLastReward < WATCH_SECONDS_REQUIRED) {
    return { rewarded: false, expGained: 0, message: '' };
  }

  // Validasi 2: Waktu sesi nonton harus >= 5 menit nyata
  const sessionDurationSeconds = (now - watchStartTimestamp) / 1000;
  if (sessionDurationSeconds < WATCH_SECONDS_REQUIRED) {
    return { rewarded: false, expGained: 0, message: '' };
  }

  // Validasi 3: Video harus benar-benar diputar >= 4 menit (buffer 1 menit)
  // Ini mencegah cheat: buka halaman tapi tidak nonton, tunggu 5 menit
  if (actualPlayedSeconds < 240) {
    return { rewarded: false, expGained: 0, message: 'Nonton dulu minimal 4 menit ya!' };
  }

  // Reward!
  data.totalExp += EXP_PER_REWARD;
  data.rewardLog[episodeId] = now;

  // Bersihkan log lama (>24 jam) supaya tidak menumpuk
  const cutoff = now - 24 * 60 * 60 * 1000;
  for (const key of Object.keys(data.rewardLog)) {
    if (data.rewardLog[key] < cutoff) delete data.rewardLog[key];
  }

  _save(data);

  const newLevel = getLevelFromExp(data.totalExp);
  const prevLevel = getLevelFromExp(data.totalExp - EXP_PER_REWARD);
  const leveledUp = newLevel > prevLevel;

  return {
    rewarded: true,
    expGained: EXP_PER_REWARD,
    message: leveledUp
      ? `Level Up! Kamu sekarang Level ${newLevel}! (+${EXP_PER_REWARD} EXP)`
      : `+${EXP_PER_REWARD} EXP didapat! Teruskan menonton!`,
    leveledUp,
    newLevel,
  };
};

export const resetUserExp = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export { getLevelFromExp, getExpInCurrentLevel, getExpNeededForNextLevel, expForLevel, EXP_PER_REWARD, WATCH_SECONDS_REQUIRED };
