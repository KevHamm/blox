import { useEffect, useState } from "react";
import type { BloxProject } from "./persistence";

// Favorited templates, stored as a list of stable keys in localStorage. Titles
// are unique within the seeded template catalogue, so title (+ cls/kind) is a
// stable identity. A custom event keeps every mounted consumer (the heart, the
// Favorites tab, the viewer bar) in sync within the same tab.
const KEY = "blox-favorites";
const EVENT = "blox-fav";

export function favKey(item: BloxProject): string {
  return item.kind === "design" ? `design:${item.title}` : `${item.cls}:${item.title}`;
}

function read(): string[] {
  try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : []; } catch { return []; }
}
function write(keys: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(keys)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function toggleFavorite(key: string) {
  const keys = read();
  const i = keys.indexOf(key);
  if (i >= 0) keys.splice(i, 1); else keys.push(key);
  write(keys);
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(read()));
  useEffect(() => {
    const sync = () => setFavorites(new Set(read()));
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return {
    favorites,
    isFav: (key: string) => favorites.has(key),
    toggle: (key: string) => toggleFavorite(key)
  };
}
