// A small, seeded "library" for the signed-in user: the saved Projects (flowing
// documents) and Pages (free-form design pages) shown as previews on the
// welcome screen after login. Each item is a full BloxProject, so clicking a
// preview reopens it through the normal morph (onOpen). Auth is a stub for now
// (dev / 123), so this content is deterministic sample data computed once.
import { buildProject, buildDesignProject, type BloxProject, type ProjectLayout } from "./persistence";
import { templateFor, templateDoc } from "./templates";
import type { DesignElement, DesignPage } from "../types/design";

export function layoutFor(cls: string): ProjectLayout {
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
  doc("book", "Foundations of Typesetting", 220),
  doc("wip", "Sandbox — 50-page stress test", 300)
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

// ── Starter templates ─────────────────────────────────────────────────────
// A larger, deterministic catalogue grouped like the user's own work
// (Documents / Presentations / Pages). Clicking one opens a fresh copy.
const DOC_TEMPLATES: [string, string][] = [
  ["article", "Academic Article"], ["report", "Technical Report"], ["book", "Textbook"],
  ["article", "Conference Paper"], ["report", "Lab Report"], ["article", "Essay"],
  ["book", "Thesis"], ["report", "Whitepaper"], ["article", "Journal Submission"],
  ["report", "Business Report"], ["book", "Manual"], ["article", "Short Note"],
  ["report", "Case Study"], ["article", "Literature Review"], ["report", "Project Proposal"],
  ["book", "Lecture Notes"], ["article", "Research Statement"], ["report", "Annual Review"],
  ["article", "CV / Résumé"], ["report", "Grant Application"], ["book", "Novel"],
  ["article", "Memo"], ["report", "Survey"], ["article", "Cover Letter"]
];
export const TEMPLATE_DOCUMENTS: BloxProject[] = DOC_TEMPLATES.map(([cls, title], i) => doc(cls, title, i + 1));

const BEAMER_TEMPLATES = [
  "Conference Talk", "Thesis Defense", "Lecture Slides", "Pitch Deck", "Seminar",
  "Lab Meeting", "Workshop", "Keynote", "Tutorial", "Poster Session", "Project Kickoff",
  "Sprint Review", "Webinar", "Course Intro", "Demo Day", "Onboarding"
];
export const TEMPLATE_PRESENTATIONS: BloxProject[] = BEAMER_TEMPLATES.map((title, i) => doc("beamer", title, i + 1));

// Cover-page templates cycle a few colourways so their previews read distinctly.
const COVER_STYLES = [
  { bg: "#0e0a1a", accent: "#7c3aed", ink: "#ffffff", sub: "#c4b5fd" },
  { bg: "#f4f1ea", accent: "#e0392b", ink: "#1d1d1f", sub: "#555555" },
  { bg: "#ffffff", accent: "#7c3aed", ink: "#111111", sub: "#444444" },
  { bg: "#10243a", accent: "#38bdf8", ink: "#ffffff", sub: "#bae6fd" },
  { bg: "#1f1147", accent: "#f5a623", ink: "#ffffff", sub: "#fcd34d" }
];
function coverTemplate(title: string, i: number): BloxProject {
  const s = COVER_STYLES[i % COVER_STYLES.length];
  return page(title, {
    kind: "cover", pageWidth: 816, pageHeight: 1056, bg: s.bg,
    elements: [
      el({ kind: "rect", x: 120, y: 210, w: 576, h: 6, fill: s.accent, stroke: s.accent, strokeWidth: 0 }),
      el({ kind: "text", x: 96, y: 420, w: 624, h: 180, text: title, fontSize: 66, fontFamily: "helvetica", color: s.ink, align: "center", bold: true }),
      el({ kind: "text", x: 96, y: 640, w: 624, h: 50, text: "A BLoX template", fontSize: 24, fontFamily: "helvetica", color: s.sub, align: "center" })
    ]
  }, i + 1);
}
const PAGE_TEMPLATES = [
  "Minimal", "Editorial", "Bold Serif", "Tech Report", "Academic", "Conference",
  "Magazine", "Portfolio", "Newsletter", "Brochure", "Title Slide", "Programme"
];
export const TEMPLATE_PAGES: BloxProject[] = PAGE_TEMPLATES.map((t, i) => coverTemplate(t, i));

export function getTemplates(): { documents: BloxProject[]; presentations: BloxProject[]; pages: BloxProject[] } {
  return { documents: TEMPLATE_DOCUMENTS, presentations: TEMPLATE_PRESENTATIONS, pages: TEMPLATE_PAGES };
}
