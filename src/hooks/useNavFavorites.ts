import { useCallback, useEffect, useState } from "react";

const MAX_FAVORITES = 12;

function storageKey(userId?: string | null) {
  return `lexia-nav-favorites:${userId || "guest"}`;
}

function readFavorites(userId?: string | null): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

function writeFavorites(userId: string | null | undefined, urls: string[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(urls.slice(0, MAX_FAVORITES)));
  window.dispatchEvent(new CustomEvent("lexia-nav-favorites-changed"));
}

export function useNavFavorites(userId?: string | null) {
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites(userId));

  useEffect(() => {
    setFavorites(readFavorites(userId));
  }, [userId]);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites(userId));
    window.addEventListener("lexia-nav-favorites-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lexia-nav-favorites-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId]);

  const isPinned = useCallback((url: string) => favorites.includes(url), [favorites]);

  const togglePin = useCallback(
    (url: string) => {
      setFavorites((prev) => {
        const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url].slice(0, MAX_FAVORITES);
        writeFavorites(userId, next);
        return next;
      });
    },
    [userId],
  );

  const removePin = useCallback(
    (url: string) => {
      setFavorites((prev) => {
        const next = prev.filter((u) => u !== url);
        writeFavorites(userId, next);
        return next;
      });
    },
    [userId],
  );

  return { favorites, isPinned, togglePin, removePin, maxFavorites: MAX_FAVORITES };
}
