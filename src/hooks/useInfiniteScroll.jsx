import { useState, useEffect, useCallback, useRef } from 'react';

export const useInfiniteScroll = (fetchData, initialData = []) => {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const observer = useRef();
  const initialLoadDone = useRef(false);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Kunci unik per item supaya item yang sama tidak muncul dua kali
  // (provider berbeda / halaman berbeda sering mengembalikan judul sama).
  const seenRef = useRef(new Set());
  const itemKey = (item, i) =>
    String(
      item?.animeId ?? item?.slug ?? item?.id ?? item?.title ?? item?.name ?? `idx-${i}`,
    ).toLowerCase();

  const loadPage = useCallback(async (pageNum) => {
    setLoading(true);
    setError(null);
    try {
      const newData = await fetchData(pageNum);
      if (!isMounted.current) return;
      const list = Array.isArray(newData) ? newData : (newData?.data?.animeList ?? newData?.animeList ?? []);

      if (pageNum <= 1) seenRef.current = new Set();
      const fresh = [];
      (list || []).forEach((item, i) => {
        const key = itemKey(item, i);
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);
        fresh.push(item);
      });

      if (fresh.length > 0) {
        setData(prev => (pageNum <= 1 ? fresh : [...prev, ...fresh]));
        setPage(pageNum);
      }
      // Halaman kosong ATAU seluruhnya duplikat → hentikan infinite scroll,
      // supaya daftar tidak "hilang lalu muncul lagi" berulang.
      if (!list || list.length === 0 || fresh.length === 0) {
        setHasMore(false);
      }
    } catch (err) {
      if (isMounted.current) setError(err?.message ?? String(err));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadPage(1);
    }
  }, [loadPage]);

  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore) {
          loadPage(page + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, page, loadPage]
  );

  const reset = useCallback(() => {
    setData([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    seenRef.current = new Set();
    loadPage(1);
  }, [loadPage]);

  return {
    data,
    loading,
    error,
    hasMore,
    lastElementRef,
    reset,
  };
};
