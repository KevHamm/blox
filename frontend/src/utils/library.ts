// A small, seeded "library" for the signed-in user: the saved Projects (flowing
// documents) and Pages (free-form design pages) shown as previews on the
// welcome screen after login. Each item is a full BloxProject, so clicking a
// preview reopens it through the normal morph (onOpen). Auth is a stub for now
// (dev / 123), so this content is deterministic sample data computed once.
import { buildProject, buildDesignProject, type BloxProject, type ProjectLayout } from "./persistence";
import { templateFor, templateDoc } from "./templates";
import type { DesignElement, DesignPage } from "../types/design";

function layoutFor(cls: string): ProjectLayout {
  const t = templateFor(cls);
  return {
    pageWidth: t.pageWidth, pageHeight: t.pageHeight,
    padTop: t.padTop, padBottom: t.padBottom, padLeft: t.padLeft, padRight: t.padRight,
    textWidth: t.textWidth, lineHeight: t.lineHeight, columns: t.columns, fontSize: t.fontSize,
    fontFamily: "cm"
  };
}

// Stamp a fixed savedAt so the "saved N ago" labels read sensibly and stably.
function dated<T extends BloxProject>(p: T, hoursAgo: number): T {
  return { ...p, savedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString() };
}

function doc(cls: string, title: string, hoursAgo: number): BloxProject {
  return dated(buildProject(cls, title, layoutFor(cls), templateDoc(cls), []), hoursAgo);
}

const uid = () => crypto.randomUUID();
const el = (e: Omit<DesignElement, "id">): DesignElement => ({ id: uid(), ...e });

function page(title: string, p: DesignPage, hoursAgo: number): BloxProject {
  return dated(buildDesignProject(title, p), hoursAgo);
}

// Document projects.
export const LIBRARY_PROJECTS: BloxProject[] = [
  doc("article", "Attention as a Spectral Operator", 2),
  doc("report", "Q3 Infrastructure Review", 27),
  doc("beamer", "Thesis Defense — Final", 51),
  doc("article", "A Note on Low-Rank Adaptation", 96),
  doc("book", "Foundations of Typesetting", 220)
];

// Free-form design pages (covers).
export const LIBRARY_PAGES: BloxProject[] = [
  page("Annual Report 2026", {
    kind: "cover", pageWidth: 816, pageHeight: 1056, bg: "#0e0a1a",
    elements: [
      el({ kind: "rect", x: 120, y: 196, w: 576, h: 6, fill: "#7c3aed", stroke: "#7c3aed", strokeWidth: 0 }),
      el({ kind: "text", x: 108, y: 392, w: 600, h: 150, text: "Annual\nReport", fontSize: 86, fontFamily: "helvetica", color: "#ffffff", align: "center", bold: true }),
      el({ kind: "text", x: 108, y: 612, w: 600, h: 80, text: "2026", fontSize: 56, fontFamily: "helvetica", color: "#c4b5fd", align: "center", bold: true }),
      el({ kind: "text", x: 108, y: 940, w: 600, h: 40, text: "BLoX INDUSTRIES", fontSize: 22, fontFamily: "helvetica", color: "#ffffff", align: "center" })
    ]
  }, 5),
  page("Workshop Programme", {
    kind: "cover", pageWidth: 816, pageHeight: 1056, bg: "#f4f1ea",
    elements: [
      el({ kind: "rect", x: 96, y: 120, w: 180, h: 180, fill: "#e0392b", stroke: "#e0392b", strokeWidth: 0 }),
      el({ kind: "text", x: 96, y: 420, w: 624, h: 200, text: "Composition\n& Form", fontSize: 78, fontFamily: "palatino", color: "#1d1d1f", align: "left", bold: true }),
      el({ kind: "text", x: 96, y: 700, w: 540, h: 60, text: "A two-day workshop on visual typesetting", fontSize: 26, fontFamily: "palatino", color: "#555555", align: "left", italic: true }),
      el({ kind: "line", x: 96, y: 800, w: 360, h: 0, stroke: "#1d1d1f", strokeWidth: 3 })
    ]
  }, 30),
  page("Title — Spectral Methods", {
    kind: "cover", pageWidth: 816, pageHeight: 1056, bg: "#ffffff",
    elements: [
      el({ kind: "text", x: 108, y: 360, w: 600, h: 180, text: "Spectral Methods for Visual Recognition", fontSize: 52, fontFamily: "cm", color: "#111111", align: "center", bold: true }),
      el({ kind: "line", x: 258, y: 560, w: 300, h: 0, stroke: "#7c3aed", strokeWidth: 2 }),
      el({ kind: "text", x: 108, y: 600, w: 600, h: 50, text: "A. Lovelace · D. E. Knuth", fontSize: 24, fontFamily: "cm", color: "#444444", align: "center" })
    ]
  }, 73)
];

export function getLibrary(): { projects: BloxProject[]; pages: BloxProject[] } {
  return { projects: LIBRARY_PROJECTS, pages: LIBRARY_PAGES };
}
