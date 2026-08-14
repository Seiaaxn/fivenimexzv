/**
 * Normalize an anime title for de-duplication across providers.
 * Same anime from different providers may have slightly different titles
 * ("Nonton X Sub Indo", "X BD", "X Episode 12"), so we strip the common
 * provider prefixes/suffixes and punctuation to get a stable comparison key.
 */
const STRIP_PATTERNS = [
  /^(nonton|streaming|download|baca)\s+/,
  /\b(sub\s?indo(nesia)?|subtitle\s+indonesia|dub\s?indo|softsub|batch|bd|bluray|blu-ray|uncensored|full\s?hd)\b/g,
  /\bepisode\s*\d+(\s*(end|tamat))?\b/g,
  /\bep\.?\s*\d+\b/g,
  /\b(480p|720p|1080p|360p|4k)\b/g,
];

export const normalizeKey = (item) => {
  let raw = (item?.title || item?.name || '').toString().toLowerCase();
  STRIP_PATTERNS.forEach((re) => {
    raw = raw.replace(re, ' ');
  });
  return raw
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Remove duplicate anime entries that share the same normalized title.
 * The first occurrence wins; later duplicates only contribute missing
 * fields (poster, episode, url) and their provider name.
 */
export const dedupeByTitle = (list = []) => {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = normalizeKey(item);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, providers: item.providers || (item.provider ? [item.provider] : []) });
      return;
    }
    const providers = new Set([...(existing.providers || []), ...(item.providers || []), item.provider].filter(Boolean));
    map.set(key, {
      ...item,
      ...existing,
      poster: existing.poster || item.poster,
      image: existing.image || item.image,
      episode: existing.episode || item.episode,
      providers: Array.from(providers),
    });
  });
  return Array.from(map.values());
};


/**
 * Merge anime lists from two providers. Items present in both providers are
 * marked with `providers: ['otakudesu', 'samehadaku']` so the UI can show
 * a multi-provider badge. The first provider wins on field conflicts.
 *
 * @param {Array} primary    items from the primary provider
 * @param {Array} secondary  items from the secondary provider
 * @param {Object} options
 * @param {string} options.primaryName    e.g. 'otakudesu'
 * @param {string} options.secondaryName  e.g. 'samehadaku'
 * @param {string} [options.status]       optional status to attach (e.g. 'Ongoing')
 * @returns {Array} merged list with `providers` and `provider` fields
 */
export const mergeProviderLists = (
  primary = [],
  secondary = [],
  { primaryName = 'otakudesu', secondaryName = 'samehadaku', status } = {},
) => {
  const map = new Map();

  for (const a of primary) {
    const key = normalizeKey(a);
    if (!key) continue;
    map.set(key, {
      ...a,
      providers: [primaryName],
      provider: primaryName,
      ...(status ? { status } : {}),
    });
  }

  for (const b of secondary) {
    const key = normalizeKey(b);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      const providers = Array.from(new Set([...(existing.providers || []), secondaryName]));
      map.set(key, { ...existing, providers });
    } else {
      map.set(key, {
        ...b,
        providers: [secondaryName],
        provider: secondaryName,
        ...(status ? { status } : {}),
      });
    }
  }

  return Array.from(map.values());
};

/**
 * Backward-compatible alias for code that imports `mergeAnimeLists`
 * with the default Otakudesu/Samehadaku pairing.
 */
export const mergeAnimeLists = (otakList, sameList, status) =>
  mergeProviderLists(otakList, sameList, {
    primaryName: 'otakudesu',
    secondaryName: 'samehadaku',
    status,
  });
