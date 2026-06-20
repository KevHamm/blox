import { LIBRARY_PROJECTS, LIBRARY_PAGES } from "./library";
import type { BloxProject } from "./persistence";

// The dev account's "My projects" = a persisted list of projects the user
// started from a template ("Open in editor") on top of the seeded library.
// Stored in localStorage so they survive returning from the editor.
const KEY = "blox-my-projects";

function readAdded(): BloxProject[] {
  try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : []; } catch { return []; }
}

export function addToMyProjects(p: BloxProject) {
  try {
    const added = readAdded().filter((q) => q.savedAt !== p.savedAt);
    added.unshift(p);
    localStorage.setItem(KEY, JSON.stringify(added.slice(0, 40)));
  } catch { /* ignore */ }
}

export function getMyProjects(): { projects: BloxProject[]; pages: BloxProject[] } {
  const added = readAdded();
  return {
    projects: [...added.filter((p) => p.kind !== "design"), ...LIBRARY_PROJECTS],
    pages: [...added.filter((p) => p.kind === "design"), ...LIBRARY_PAGES]
  };
}
