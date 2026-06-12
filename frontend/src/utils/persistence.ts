// Project persistence: a .blox project file is a single JSON object holding
// everything the editor needs to restore a session — the template class, the
// document title, the page/typography layout, the document tree (shapes and
// figure images ride along inside it as data URLs) and the right-sidebar image
// gallery. The same object is autosaved to localStorage while editing.
import type { DocumentNode } from "../types/document";

export type ProjectImage = { id: string; src: string; name: string };

export type ProjectLayout = {
  pageWidth: number;
  pageHeight: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
  textWidth: number;
  lineHeight: number;
  columns: number;
  fontSize: number;
};

export interface BloxProject {
  app: "blox";
  version: 1;
  savedAt: string; // ISO timestamp
  cls: string;     // template class (article / report / letter / beamer / book / wip)
  title: string;
  layout: ProjectLayout;
  doc: DocumentNode;
  images: ProjectImage[];
}

const AUTOSAVE_KEY = "blox-autosave";

export function buildProject(
  cls: string,
  title: string,
  layout: ProjectLayout,
  doc: DocumentNode,
  images: ProjectImage[]
): BloxProject {
  return { app: "blox", version: 1, savedAt: new Date().toISOString(), cls, title, layout, doc, images };
}

/** Parse + validate project JSON. Throws on anything that isn't a Blox project. */
export function parseProject(text: string): BloxProject {
  const p = JSON.parse(text);
  if (!p || p.app !== "blox" || typeof p.cls !== "string" ||
      !p.doc || typeof p.doc !== "object" || !Array.isArray(p.doc.children)) {
    throw new Error("Not a Blox project file");
  }
  p.title = typeof p.title === "string" ? p.title : "";
  p.layout = p.layout && typeof p.layout === "object" ? p.layout : {};
  p.images = Array.isArray(p.images) ? p.images : [];
  return p as BloxProject;
}

// --- Autosave (localStorage, single slot) ---------------------------------
// Image-heavy documents can exceed the ~5 MB localStorage quota; the write
// then fails silently and the explicit .blox download remains the safety net.
export function saveAutosave(project: BloxProject) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch {
    /* quota exceeded / storage unavailable */
  }
}

export function loadAutosave(): BloxProject | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    return text ? parseProject(text) : null;
  } catch {
    return null;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

// --- .blox file download ---------------------------------------------------
export function safeFilename(title: string, fallback = "document"): string {
  return (
    (title || "")
      .trim()
      .replace(/[^\w\- ]+/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase() || fallback
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadProject(project: BloxProject) {
  const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
  downloadBlob(blob, `${safeFilename(project.title, "project")}.blox`);
}

/** "just now" / "5 min ago" / "2 h ago" / a date — for the resume pill. */
export function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString();
}
