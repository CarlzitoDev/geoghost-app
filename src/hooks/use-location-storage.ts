import { useState, useCallback } from "react";

export interface SavedLocation {
  id: string;
  lat: number;
  lng: number;
  label: string;
  timestamp: number;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<SavedLocation[]>(() => load("geoghost_favorites", []));

  const addFavorite = useCallback((loc: Omit<SavedLocation, "id" | "timestamp">) => {
    setFavorites((prev) => {
      const next = [{ ...loc, id: crypto.randomUUID(), timestamp: Date.now() }, ...prev];
      save("geoghost_favorites", next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      save("geoghost_favorites", next);
      return next;
    });
  }, []);

  return { favorites, addFavorite, removeFavorite };
}

export function useRecents() {
  const [recents, setRecents] = useState<SavedLocation[]>(() => load("geoghost_recents", []));

  const addRecent = useCallback((loc: Omit<SavedLocation, "id" | "timestamp">) => {
    setRecents((prev) => {
      const next = [{ ...loc, id: crypto.randomUUID(), timestamp: Date.now() }, ...prev.filter((r) => !(r.lat === loc.lat && r.lng === loc.lng))].slice(0, 10);
      save("geoghost_recents", next);
      return next;
    });
  }, []);

  return { recents, addRecent };
}
