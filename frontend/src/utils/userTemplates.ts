import { useEffect, useState } from "react";
import type { BloxProject } from "./persistence";

// Templates the user saved from the page designer ("Save as template"). These
// are the user's *own* templates, kept separate from the seeded "Browse"
// catalogue (library.ts) and from "My projects" (myProjects.ts). Each entry is
// a full BloxProject (a design page), so a saved template can be previewed in
// the viewer, opened as a fresh copy, or removed. Stored in localStorage; a
// custom event keeps every mounted consumer in sync within the same tab.
const KEY = "blox-my-templates";
const EVENT = "blox-my-templates";

function read(): BloxProject[] {
  try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : []; } catch { return []; }
}
function write(list: BloxProject[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60))); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getUserTemplates(): BloxProject[] {
  return read();
}

/** Save (or refresh) a design page as one of the user's own templates. */
export function addUserTemplate(p: BloxProject) {
  const list = read().filter((q) => q.savedAt !== p.savedAt);
  list.unshift(p);
  write(list);
}

export function removeUserTemplate(p: BloxProject) {
  write(read().filter((q) => q.savedAt !== p.savedAt));
}

/** Live list of the user's own templates, re-read on add/remove. */
export function useUserTemplates(): BloxProject[] {
  const [templates, setTemplates] = useState<BloxProject[]>(() => read());
  useEffect(() => {
    const sync = () => setTemplates(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return templates;
}
