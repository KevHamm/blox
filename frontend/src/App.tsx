import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { DocumentRenderer, HeadingInput } from "./renderer/DocumentRenderer";
import { Page } from "./components/Page";
import { TopBar, TOPBAR_HEIGHT, TOPBAR_COLLAPSED_HEIGHT } from "./components/TopBar";
import { TrashIcon } from "./components/TrashIcon";
import { Welcome } from "./components/Welcome";
import { useDocument } from "./hooks/useDocument";
import { numberDocument } from "./utils/numberDocument";
import { paginateColumns, heightsUnchanged } from "./utils/paginateDocument";
import { exportLatex } from "./utils/exportLatex";
import {
  buildProject,
  downloadProject,
  saveAutosave,
  loadAutosave,
  type BloxProject
} from "./utils/persistence";

import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";

import {
  COLUMN_GAP,
  PAGE_WIDTH,
  PAGE_HEIGHT
} from "./utils/pageConfig";
import { templateFor, templateDoc, type TemplateLayout } from "./utils/templates";
import {
  findFigureNode,
  findDocImageSrc,
  locateFigure,
  removeFigureImage,
  insertFigureImageAt,
  insertFigure,
  insertNodeAt,
  newSection,
  insertOrdered,
  insertPage,
  MATH_TEMPLATES,
  insertStructuralAt,
  insertMathItem,
  addFootnoteToWord,
  footnoteNumbering,
  findNodeById,
  nodeHasContent
} from "./utils/docTree";
import {
  BLOCK_DEFS,
  STRUCTURAL,
  DOCUMENT_ORDER,
  MATH_ORDER,
  MATH_SYMBOL_GROUPS,
  SHAPE_ORDER,
  BlockBox,
  LayoutIcon
} from "./components/blocks";
import { ShapeLayer } from "./components/shapes";
import { ConfirmHost, confirmDialog } from "./components/ConfirmDialog";
import type { Shape, ShapeKind } from "./types/document";
import {
  DraggableImage,
  DroppableDocArea,
  DraggableBlock,
  Collapsible,
  NumberControl
} from "./components/editorUi";

// Keep the drag preview centered on the cursor, so the pointer (what the drop
// zones actually test against) sits in the middle of the image being placed.
const snapCenterToCursor = ({ activatorEvent, draggingNodeRect, transform }: any) => {
  if (draggingNodeRect && activatorEvent) {
    const coords = getEventCoordinates(activatorEvent);
    if (!coords) return transform;
    return {
      ...transform,
      x: transform.x + coords.x - draggingNodeRect.left - draggingNodeRect.width / 2,
      y: transform.y + coords.y - draggingNodeRect.top - draggingNodeRect.height / 2
    };
  }
  return transform;
};

// Prefer real drop slots over the enclosing column/document droppables, so a
// zone always wins (and highlights/accepts) when the pointer is inside it.
function dropCollision(args: any) {
  const hits = pointerWithin(args);
  const zones = hits.filter((h: any) => {
    const id = String(h.id);
    return id.startsWith("dz::") || id.startsWith("figdz::") || id.startsWith("mathdz::");
  });
  return zones.length ? zones : hits;
}

// Gather every footnote whose target paragraph lands on this page (paragraphs
// are never split across pages), ordered by their global number.
function collectPageFootnotes(
  cols: any[],
  footnoteNumbers: Record<string, number>
): { paragraphId: string; fn: any; number: number }[] {
  const out: { paragraphId: string; fn: any; number: number }[] = [];
  const walk = (chunk: any) => {
    const n = chunk.node;
    if (n.type === "paragraph" && n.footnotes?.length) {
      n.footnotes.forEach((fn: any) =>
        out.push({ paragraphId: n.id, fn, number: footnoteNumbers[fn.id] ?? 0 })
      );
    }
    (chunk.children ?? []).forEach(walk);
  };
  cols.forEach((col: any[]) => col.forEach(walk));
  return out.sort((a, b) => a.number - b.number);
}

// Measure each rendered line of a paragraph: where it starts (char offset) and
// its cumulative bottom (px) from the element's top.
//
// Line geometry comes from Range.getClientRects() (one rect per wrapped line),
// which is layout-derived and therefore correct even for lines scrolled out of
// view or clipped by an overflow:hidden page. The per-line *start offset* is then
// found by binary-searching character positions with getBoundingClientRect —
// deliberately NOT caretRangeFromPoint, which returns null for any point outside
// the viewport and so silently collapsed every off-screen line to offset 0,
// breaking the split of long (multi-page) paragraphs.
function measureParagraphLines(p: HTMLElement): { offset: number; bottom: number }[] {
  const total = (p.textContent ?? "").length;
  if (!total) return [];
  const pTop = p.getBoundingClientRect().top;

  // Merge the raw client rects into one entry per visual line (by top).
  const range = document.createRange();
  range.selectNodeContents(p);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
  const lineRects: { top: number; bottom: number }[] = [];
  let prevTop = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.top > prevTop + 1) { lineRects.push({ top: r.top, bottom: r.bottom }); prevTop = r.top; }
    else { const L = lineRects[lineRects.length - 1]; L.bottom = Math.max(L.bottom, r.bottom); }
  }
  if (!lineRects.length) return [];

  // Contiguous text-node segments, so a global char offset can be turned into a
  // Range (footnote markers and other non-text nodes are skipped).
  const segs: { node: Node; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let acc = 0, n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    segs.push({ node: n, start: acc, end: acc + len });
    acc += len;
  }
  const charRange = (a: number, b: number): Range | null => {
    let sN: Node | null = null, sO = 0, eN: Node | null = null, eO = 0;
    for (const s of segs) {
      if (sN === null && a < s.end) { sN = s.node; sO = a - s.start; }
      if (b <= s.end) { eN = s.node; eO = b - s.start; break; }
    }
    if (!sN || !eN) return null;
    const r = document.createRange();
    try { r.setStart(sN, sO); r.setEnd(eN, eO); } catch { return null; }
    return r;
  };
  // Top (viewport y) of the single character starting at global offset `o`.
  const topOfChar = (o: number): number | null => {
    const r = charRange(o, o + 1);
    if (!r) return null;
    const cr = r.getBoundingClientRect();
    return cr.height ? cr.top : null;
  };

  // First line always starts at 0; each later line's start is the first char
  // whose rect sits on (or below) that line's top.
  const out: { offset: number; bottom: number }[] = [{ offset: 0, bottom: lineRects[0].bottom - pTop }];
  for (let i = 1; i < lineRects.length; i++) {
    const targetTop = lineRects[i].top;
    let lo = out[i - 1].offset + 1, hi = total - 1, ans = total;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = topOfChar(mid);
      if (t != null && t >= targetTop - 1) { ans = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    out.push({ offset: ans, bottom: lineRects[i].bottom - pTop });
  }
  return out;
}

// Vertical space a flow element really occupies, including its own vertical
// margins AND any child margin that collapses *through* it (a wrapper with no
// padding/border on that side does not contain the child's margin, so
// getBoundingClientRect misses it). LaTeX adds these spaces rather than
// collapsing them, so counting the full footprint keeps pagination from
// overfilling a page — the measured height now matches what is actually drawn.
function flowHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const num = (v: string) => parseFloat(v || "0") || 0;
  let h = el.getBoundingClientRect().height + num(cs.marginTop) + num(cs.marginBottom);
  if (num(cs.paddingTop) === 0 && num(cs.borderTopWidth) === 0) {
    const fc = el.firstElementChild as HTMLElement | null;
    if (fc) h += Math.max(0, num(getComputedStyle(fc).marginTop));
  }
  if (num(cs.paddingBottom) === 0 && num(cs.borderBottomWidth) === 0) {
    const lc = el.lastElementChild as HTMLElement | null;
    if (lc) h += Math.max(0, num(getComputedStyle(lc).marginBottom));
  }
  return h;
}

type LineMap = Record<string, { offset: number; bottom: number }[]>;
function lineDataUnchanged(prev: LineMap, next: LineMap): boolean {
  const pk = Object.keys(prev), nk = Object.keys(next);
  if (pk.length !== nk.length) return false;
  for (const k of nk) {
    const a = prev[k], b = next[k];
    if (!a || a.length !== b.length) return false;
    for (let i = 0; i < b.length; i++) {
      if (a[i].offset !== b[i].offset || Math.abs(a[i].bottom - b[i].bottom) > 1) return false;
    }
  }
  return true;
}

// Place the caret at a character offset inside a contentEditable element.
function placeCaretAt(el: HTMLElement, offset: number) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset, target: Text | null = null, local = 0, n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    if (remaining <= len) { target = n as Text; local = remaining; break; }
    remaining -= len;
  }
  const range = document.createRange();
  if (target) { range.setStart(target, local); range.collapse(true); }
  else { range.selectNodeContents(el); range.collapse(false); }
  sel.removeAllRanges();
  sel.addRange(range);
}

// Friendly names for the delete-confirmation prompt, by node type.
const DELETE_LABELS: Record<string, string> = {
  section: "section",
  subsection: "subsection",
  subsubsection: "subsubsection",
  paragraph: "paragraph",
  abstract: "abstract",
  list: "list",
  table: "table",
  math: "equation",
  figure: "figure",
  frame: "slide"
};

// A small pinned button that rides the inner edge of a sidebar / the top bar.
// Clicking it slides that panel out of the way; when the panel is hidden the
// button stays at the screen edge so it can be slid back into view.
function EdgeToggle({
  edge, open, size, collapsedSize = 0, onToggle
}: { edge: "left" | "right" | "top"; open: boolean; size: number; collapsedSize?: number; onToggle: () => void }) {
  const vertical = edge === "top";
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
  // The panel-edge offset: full size when open, the collapsed remnant when hidden
  // (0 for the sidebars, the short control-bar height for the top bar).
  const off = open ? size : collapsedSize;
  // Anchor the panel-edge side flush (so the button is never clipped off-screen
  // when the panel is hidden) and only center on the long axis.
  const pos: React.CSSProperties = { position: "fixed", zIndex: 55 };
  if (edge === "left") {
    pos.left = off; pos.top = "50%";
    pos.transform = "translateY(-50%)"; pos.transition = `left 0.45s ${ease}`;
  } else if (edge === "right") {
    pos.right = off; pos.top = "50%";
    pos.transform = "translateY(-50%)"; pos.transition = `right 0.45s ${ease}`;
  } else {
    pos.top = off; pos.left = "50%";
    pos.transform = "translateX(-50%)"; pos.transition = `top 0.45s ${ease}`;
  }
  // Chevron points "in" (hide) when open, "out" (show) when closed.
  const dir =
    edge === "left" ? (open ? "left" : "right")
    : edge === "right" ? (open ? "right" : "left")
    : (open ? "up" : "down");
  return (
    <button
      onClick={onToggle}
      title={open ? "Hide panel" : "Show panel"}
      aria-label={open ? "Hide panel" : "Show panel"}
      style={{
        ...pos,
        width: vertical ? 42 : 20,
        height: vertical ? 20 : 42,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--edge-bg)",
        border: "1px solid var(--edge-border)",
        borderRadius: 7,
        boxShadow: "0 2px 8px rgba(20,20,50,0.16)",
        color: "var(--ui-2nd)",
        cursor: "pointer",
        padding: 0
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" && <polyline points="15 18 9 12 15 6" />}
        {dir === "right" && <polyline points="9 18 15 12 9 6" />}
        {dir === "up" && <polyline points="18 15 12 9 6 15" />}
        {dir === "down" && <polyline points="6 9 12 15 18 9" />}
      </svg>
    </button>
  );
}

function Editor({ sidebarsIn = true, template, project, onBack, dark, onToggleTheme }: { sidebarsIn?: boolean; template: TemplateLayout; project?: BloxProject | null; onBack?: () => void; dark: boolean; onToggleTheme: () => void }) {
  // ── 1. All state first ──────────────────────────────────
  // Starting content: the reopened project's tree, or fresh content for the
  // chosen class (article / report / letter / …).
  const initialDoc = useMemo(
    () => project?.doc ?? templateDoc(template.cls),
    [template.cls, project]
  );
  // The document tree + every mutation handler live in this hook.
  const {
    doc, setDoc,
    undo, redo, canUndo, canRedo,
    updateTextById, updateRichText, toggleParagraphAlign, updateSectionTitle, updateFigureCaption,
    updateMathItem, deleteMathItem, setFootnoteText, removeFootnote,
    updateListItem, addListItem, deleteListItem, setListStyle,
    addSectionAfter, updateFigureWidth,
    deleteFigureImage, addSubsection, addSubsubsection, updateTableCell,
    deleteNodeById, addTableRow, deleteTableRow, deleteTableRowAt,
    addTableColumn, deleteTableColumnAt, updateTableColWidths,
    updateTableCaption, updateTableColors, deleteTableColumn,
    toggleTableBorder, toggleCellBorder, reorderTableColumn, reorderTableRow,
    moveSection, moveSubsection
  } = useDocument(initialDoc);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Which sidebar tab is showing (Typography controls vs the Blox palette).
  const [sidebarTab, setSidebarTab] = useState<"typography" | "blox">("typography");
  // Whether each surrounding panel is shown; the edge toggles slide them away.
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [topOpen, setTopOpen] = useState(true);
  // The free-form shape currently selected (shows its handles + toolbar).
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  // While true, the next click on a paragraph word attaches a footnote there.
  const [pendingFootnote, setPendingFootnote] = useState(false);
  const [documentTitle, setDocumentTitle] = useState(project?.title ?? template.title);
  // Measured heights: every flow leaf (paragraph/table/figure) and every
  // container header (section/subsection/subsubsection).
  const [leafHeights,   setLeafHeights]   = useState<Record<string, number>>({});
  const [headerHeights, setHeaderHeights] = useState<Record<string, number>>({});
  // Per-paragraph line geometry, so a long paragraph can be split across pages.
  const [lineData, setLineData] = useState<LineMap>({});

  // Images uploaded via the right sidebar (preview gallery). Data URLs, so a
  // reopened project's gallery comes back intact.
  const [images, setImages] = useState<{ id: string; src: string; name: string }[]>(
    () => project?.images ?? []
  );
  // True while OS files are being dragged over the right sidebar (drop to upload).
  const [imageDropActive, setImageDropActive] = useState(false);
  // Source of the image currently being dragged (for the drag overlay preview).
  const [activeDragSrc, setActiveDragSrc] = useState<string | null>(null);
  // Id of the Blox block currently being dragged (for the drag overlay).
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // The paragraph currently being typed in. Live pagination can re-flow content
  // onto another page mid-keystroke; if that paragraph re-mounts on a new page we
  // re-focus it (caret at end) so the cursor "follows" the text to the next page.
  const typingRef = useRef<string | null>(null);
  const caretRef = useRef<{ id: string; offset: number } | null>(null);
  function setTyping(id: string | null) {
    if (id === null) {
      // Defer: only really clear once focus has settled outside any editor.
      requestAnimationFrame(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !a.classList.contains("blox-editable")) { typingRef.current = null; caretRef.current = null; }
      });
    } else {
      typingRef.current = id;
    }
  }
  // Records the caret position (as a full-text offset) of the paragraph being
  // edited, so the cursor can follow its text across a page split.
  function setCaret(id: string, offset: number) {
    typingRef.current = id;
    caretRef.current = { id, offset };
  }


  // Page layout, seeded from the chosen template (article / report / letter /
  // beamer / book), with a reopened project's saved layout merged on top. Page
  // geometry stays fixed; the typography controls edit the text settings.
  const [layout, setLayout] = useState(() => ({
    pageWidth: template.pageWidth,
    pageHeight: template.pageHeight,
    padTop: template.padTop,
    padBottom: template.padBottom,
    padLeft: template.padLeft,
    padRight: template.padRight,
    textWidth: template.textWidth,
    lineHeight: template.lineHeight,
    columns: template.columns,
    fontSize: template.fontSize,
    ...(project?.layout ?? {})
  }));

  // Usable width/height between the page margins (derived from the layout).
  const contentWidth = layout.pageWidth - layout.padLeft - layout.padRight;
  const contentHeight = layout.pageHeight - layout.padTop - layout.padBottom;

  // ── Autosave ────────────────────────────────────────────
  // Debounced snapshot of the whole session (doc, title, layout, gallery) into
  // the single localStorage autosave slot; the welcome screen offers it back as
  // "Continue last session".
  const autosaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      saveAutosave(buildProject(template.cls, documentTitle, layout, doc, images));
    }, 800);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [doc, documentTitle, layout, images, template.cls]);

  // Download the session as a .blox project file (re-openable from the
  // welcome screen's "Open project").
  function saveProject() {
    downloadProject(buildProject(template.cls, documentTitle, layout, doc, images));
  }

  const rendererProps = {
    editingId, setEditingId, updateTextById, updateRichText, updateSectionTitle,
    addSubsection, addSubsubsection, updateTableCell,
    deleteTableColumn, deleteNodeById: confirmDeleteNode, addTableRow, deleteTableRow,
    addTableColumn, updateTableColWidths, addSectionAfter,
    updateTableCaption, updateTableColors,
    deleteTableRowAt, deleteTableColumnAt,
    toggleTableBorder, toggleCellBorder, reorderTableColumn, reorderTableRow,
    lineHeight: layout.lineHeight, fontSize: layout.fontSize,
    moveSection, moveSubsection, updateFigureCaption, updateFigureWidth,
    deleteFigureImage, updateMathItem, deleteMathItem,
    updateListItem, addListItem, deleteListItem, setListStyle,
    onTyping: setTyping, onCaret: setCaret,
    // LaTeX letters are block-style: no first-line paragraph indent.
    blockParagraphs: template.cls === "letter",
  };

  // ── 2. Derived values ───────────────────────────────────
  const numberedDoc = numberDocument(doc);
  const TITLE_RESERVED = 100;   // constant, but must be above useMemo

  // ── 3. Paginate into columns/pages from measured heights ──
  // `pages[page][column]` is a list of chunks. Content flows left column →
  // right column → next page, and may break in the middle of any container.
  const pages = useMemo(() => {
    // paginateColumns handles missing measurements (defaults) and always keeps
    // cover page / TOC / bibliography on their own single-column pages.
    return paginateColumns(
      numberedDoc,
      leafHeights,
      headerHeights,
      lineData,
      contentHeight,
      TITLE_RESERVED,
      layout.columns
    );
  }, [numberedDoc, leafHeights, headerHeights, lineData, contentHeight, layout.columns]);

  // ── Document outline for the top-bar preview ──
  // Each top-level structural node (cover page, table of contents, every numbered
  // section, frame, bibliography) becomes a "group" with the range of page
  // indices it occupies, plus a human label. Sections that span several pages
  // carry all of them so the preview can stack / spread them.
  const outline = useMemo(() => {
    const OUTLINE_TYPES = new Set(["coverpage", "toc", "bibliography", "section", "frame"]);
    // node.id → sorted unique page indices where a top-level chunk for it appears.
    const nodePages = new Map<string, number[]>();
    pages.forEach((cols: any[], pi: number) => {
      cols.forEach((col: any[]) =>
        col.forEach((chunk: any) => {
          const id = chunk.node.id;
          const arr = nodePages.get(id);
          if (!arr) nodePages.set(id, [pi]);
          else if (arr[arr.length - 1] !== pi) arr.push(pi);
        })
      );
    });
    const out: { key: string; type: string; label: string; pages: number[]; first: number }[] = [];
    for (const node of (numberedDoc.children ?? []) as any[]) {
      if (!OUTLINE_TYPES.has(node.type)) continue;
      const pgs = nodePages.get(node.id);
      if (!pgs || !pgs.length) continue;
      const label =
        node.type === "coverpage" ? "Cover"
        : node.type === "toc" ? "Table of Contents"
        : node.type === "bibliography" ? "Bibliography"
        : node.type === "section" ? `${node.sectionNumber ?? ""} ${node.title ?? ""}`.trim() || "Section"
        : (node.title ?? "Slide");
      out.push({ key: node.id, type: node.type, label, pages: pgs, first: pgs[0] });
    }
    return out;
  }, [pages, numberedDoc]);

  // After a re-pagination, keep the cursor with the text it belongs to: if the
  // edited paragraph split and the caret's text moved to another page's slice,
  // focus that slice and restore the caret there (so typing flows to page 2).
  useLayoutEffect(() => {
    const id = typingRef.current;
    if (!id) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-para-id="${id}"]`));
    if (!els.length) return;

    const c = caretRef.current;
    const caret = c && c.id === id ? c.offset : null;
    if (caret == null) {
      if (document.activeElement !== els[0]) placeCaretAt(els[0], Number.MAX_SAFE_INTEGER);
      return;
    }

    // Find the slice whose character range contains the caret, then restore the
    // caret there (the DOM was just re-synced, so this also keeps the cursor put
    // while typing within one slice, and moves it to the next page on overflow).
    let target = els[els.length - 1];
    let local = caret - Number(target.dataset.sliceStart ?? 0);
    for (const el of els) {
      const s = Number(el.dataset.sliceStart ?? 0);
      const e = Number(el.dataset.sliceEnd ?? Number.MAX_SAFE_INTEGER);
      if (caret >= s && caret <= e) { target = el; local = caret - s; break; }
    }
    placeCaretAt(target, local);
  }, [pages]);

  // The document title lives on the body's first page — i.e. after any leading
  // cover page / table of contents.
  const titlePageIndex = (numberedDoc.children ?? []).filter(
    (c: any) => c.type === "coverpage" || c.type === "toc"
  ).length;

  // ── 4. Measure rendered leaf/header heights for pagination ──
  useLayoutEffect(() => {
    const lh: Record<string, number> = {};
    const hh: Record<string, number> = {};

    document.querySelectorAll<HTMLElement>("[data-leaf-id]")
      .forEach(el => { lh[el.dataset.leafId!] = flowHeight(el); });

    document.querySelectorAll<HTMLElement>("[data-head-id]")
      .forEach(el => {
        // A heading's footprint also includes the top margin of its section /
        // subsection wrapper (the LaTeX space *before* the heading).
        let h = flowHeight(el);
        const parent = el.parentElement;
        if (parent) h += Math.max(0, parseFloat(getComputedStyle(parent).marginTop || "0") || 0);
        hh[el.dataset.headId!] = h;
      });

    // Per-paragraph line geometry. A split paragraph renders as several slice
    // elements (same data-para-id); combine them back into the full geometry.
    const ld: LineMap = {};
    const byPara = new Map<string, HTMLElement[]>();
    document.querySelectorAll<HTMLElement>("[data-para-id]").forEach((p) => {
      if (p.querySelector("[data-fn]")) return; // footnoted paragraphs aren't split
      const id = p.dataset.paraId!;
      (byPara.get(id) ?? byPara.set(id, []).get(id)!).push(p);
    });
    byPara.forEach((els, id) => {
      els.sort((a, b) => Number(a.dataset.sliceStart ?? 0) - Number(b.dataset.sliceStart ?? 0));
      const full: { offset: number; bottom: number }[] = [];
      let cum = 0;
      for (const el of els) {
        const s = Number(el.dataset.sliceStart ?? 0);
        const sliceLines = measureParagraphLines(el);
        for (const ln of sliceLines) full.push({ offset: s + ln.offset, bottom: cum + ln.bottom });
        if (sliceLines.length) cum += sliceLines[sliceLines.length - 1].bottom;
      }
      if (full.length) { full[0].offset = 0; ld[id] = full; }
    });

    setLeafHeights  (prev => heightsUnchanged(prev, lh) ? prev : lh);
    setHeaderHeights(prev => heightsUnchanged(prev, hh) ? prev : hh);
    setLineData     (prev => lineDataUnchanged(prev, ld) ? prev : ld);

  }, [doc, layout.textWidth, layout.fontSize, layout.lineHeight, layout.columns]);

  // Global figure numbers, assigned in document order.
  const figureNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    const walk = (node: any) => {
      if (node.type === "figure") map[node.id] = ++n;
      (node.children ?? []).forEach(walk);
    };
    (numberedDoc.children ?? []).forEach(walk);
    return map;
  }, [numberedDoc]);

  // Global table numbers, assigned in document order.
  const tableNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    const walk = (node: any) => {
      if (node.type === "table") map[node.id] = ++n;
      (node.children ?? []).forEach(walk);
    };
    (numberedDoc.children ?? []).forEach(walk);
    return map;
  }, [numberedDoc]);

  // Global equation numbers for display equations (\begin{equation}), in order.
  const equationNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    const walk = (node: any) => {
      if (node.type === "math" && node.display) map[node.id] = ++n;
      (node.children ?? []).forEach(walk);
    };
    (numberedDoc.children ?? []).forEach(walk);
    return map;
  }, [numberedDoc]);

  // Global footnote numbers, assigned in reading order.
  const footnoteNumbers = useMemo(() => footnoteNumbering(numberedDoc), [numberedDoc]);

  // Click a paragraph word while in "pick a word" mode → attach a footnote.
  function handleWordClick(paragraphId: string, word: number) {
    if (!pendingFootnote) return;
    setDoc((prev) => addFootnoteToWord(prev, paragraphId, word, crypto.randomUUID()));
    setPendingFootnote(false);
  }

  // Esc cancels footnote word-picking.
  useEffect(() => {
    if (!pendingFootnote) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPendingFootnote(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingFootnote]);

  // Undo / redo keyboard shortcuts. We intercept Ctrl/Cmd+Z so the document
  // model is the single source of truth (the browser's native contentEditable
  // undo would desync it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const hasAbstract = (doc.children ?? []).some((c: any) => c.type === "abstract");

  // Bold / italic / underline the current text selection. The button's pointer
  // press is prevented from stealing focus, so the selection stays live inside
  // the contentEditable paragraph and execCommand applies there; the resulting
  // input event then persists the formatting (as marks) through the paragraph.
  function applyInlineFormat(cmd: "bold" | "italic" | "underline") {
    try { document.execCommand("styleWithCSS", false, "false"); } catch { /* ignore */ }
    document.execCommand(cmd);
  }

  // Center / un-center the paragraph that holds the current selection. Alignment
  // is a block property, so it applies to the whole paragraph, not a character
  // range. The button's pointer press is prevented from stealing focus so the
  // selection stays put.
  function centerSelection() {
    const sel = window.getSelection();
    const anchor = sel?.anchorNode ?? null;
    const from = anchor && anchor.nodeType === 1 ? (anchor as HTMLElement) : anchor?.parentElement ?? null;
    const el = from?.closest("[data-para-id]") as HTMLElement | null;
    if (el?.dataset.paraId) toggleParagraphAlign(el.dataset.paraId);
  }

  // Delete a block, asking first (via the custom confirm dialog) when it still
  // holds content. Used for every block-level trash button (sections, tables,
  // lists, equations, slides, …).
  function confirmDeleteNode(id: string) {
    const node = findNodeById(doc, id);
    if (node && nodeHasContent(node)) {
      const label = DELETE_LABELS[node.type] ?? "block";
      confirmDialog({
        title: `Delete ${label}?`,
        message: `This ${label} and its contents will be removed.`,
        confirmLabel: "Delete",
        danger: true
      }).then((ok) => { if (ok) deleteNodeById(id); });
      return;
    }
    deleteNodeById(id);
  }

  // -----------------------------
  // DND SENSORS
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  // Remove an uploaded image from the sidebar gallery.
  function deleteImageUpload(imageId: string) {
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  // -----------------------------
  // IMAGE UPLOAD (right sidebar gallery)
  // -----------------------------
  // Read one or more image files into the gallery (shared by the upload button
  // and by dropping files onto the sidebar).
  function addImageFiles(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setImages((prev) => [...prev, { id: crypto.randomUUID(), src: url, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e: any) => {
      if (e.target.files?.length) addImageFiles(e.target.files);
    };
    input.click();
  }

  // -----------------------------
  // SHAPES (free-form overlay graphics on doc.shapes)
  // -----------------------------
  // Apply a partial change to one shape (used for both a finished move/resize
  // gesture and discrete style edits — each is one undo step).
  function updateShape(id: string, patch: Partial<Shape>) {
    setDoc((prev: any) => ({
      ...prev,
      shapes: (prev.shapes ?? []).map((s: Shape) => (s.id === id ? { ...s, ...patch } : s))
    }));
  }
  function deleteShape(id: string) {
    setDoc((prev: any) => ({ ...prev, shapes: (prev.shapes ?? []).filter((s: Shape) => s.id !== id) }));
    setSelectedShapeId((cur) => (cur === id ? null : cur));
  }

  // Drop a shape Blox onto whatever page sits under the cursor at release. The
  // final pointer position is the drag's start point plus its accumulated delta;
  // we hit-test the rendered pages to find the target and local coordinates.
  function placeShapeFromDrag(kind: ShapeKind, activatorEvent: any, delta: any) {
    const coords = getEventCoordinates(activatorEvent);
    if (!coords) return;
    const px = coords.x + (delta?.x ?? 0);
    const py = coords.y + (delta?.y ?? 0);
    const pageEls = Array.from(document.querySelectorAll<HTMLElement>(".doc-area .blox-page"));
    let page = -1;
    let rect: DOMRect | null = null;
    for (let i = 0; i < pageEls.length; i++) {
      const r = pageEls[i].getBoundingClientRect();
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) { page = i; rect = r; break; }
    }
    if (page < 0 || !rect) return; // dropped off the pages → ignore

    const DEF: Record<ShapeKind, { w: number; h: number; fill: boolean }> = {
      line:   { w: 170, h: 0,   fill: false },
      arrow:  { w: 170, h: 0,   fill: false },
      rect:   { w: 150, h: 96,  fill: false },
      circle: { w: 120, h: 120, fill: false }
    };
    const { w, h } = DEF[kind];
    const clamp01 = (v: number, hi: number) => Math.min(Math.max(v, 0), Math.max(0, hi));
    const x = clamp01(px - rect.left - w / 2, layout.pageWidth - w);
    const y = clamp01(py - rect.top - h / 2, layout.pageHeight - h);
    const shape: Shape = {
      id: crypto.randomUUID(), kind, page, x, y, w, h,
      color: "#1d1d1f", strokeWidth: 2,
      ...(DEF[kind].fill ? { fill: "#cccccc" } : { fill: null })
    };
    setDoc((prev: any) => ({ ...prev, shapes: [...(prev.shapes ?? []), shape] }));
    setSelectedShapeId(shape.id);
  }

  // Deselect a shape when clicking anywhere that isn't a shape / its toolbar.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-shape], [data-shape-toolbar]")) return;
      setSelectedShapeId(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  // Delete / Backspace removes the selected shape (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedShapeId) {
        const a = document.activeElement as HTMLElement | null;
        if (a && (a.isContentEditable || a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
        e.preventDefault();
        deleteShape(selectedShapeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedShapeId]);

  // -----------------------------
  // DRAG END
  // -----------------------------
  function handleDragStart(event: any) {
    const id = String(event.active.id);
    setActiveDragSrc(null);
    setActiveBlockId(null);
    if (id.startsWith("image::")) {
      const img = images.find((i) => i.id === id.slice("image::".length));
      setActiveDragSrc(img?.src ?? null);
    } else if (id.startsWith("docimg::")) {
      const [, figId, imgId] = id.split("::");
      setActiveDragSrc(findDocImageSrc(doc, figId, imgId));
    } else if (BLOCK_DEFS[id]) {
      setActiveBlockId(id);
    }
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    setActiveDragSrc(null);
    setActiveBlockId(null);

    // A free-form shape Blox: placed at the cursor on whatever page it lands on,
    // independent of the text-flow drop zones.
    const dragId = String(active.id);
    if (dragId.startsWith("block::shape::")) {
      placeShapeFromDrag(dragId.slice("block::shape::".length) as ShapeKind, event.activatorEvent, event.delta);
      return;
    }

    // A Blox block (table / math) dropped into the document.
    const activeBlockId = String(active.id);
    const blockDef = BLOCK_DEFS[activeBlockId];
    if (blockDef) {
      const overId = over ? String(over.id) : null;
      if (!overId) return;

      // Footnote: no placement — drop anywhere to enter "pick a word" mode.
      if (activeBlockId === "block::footnote") {
        setPendingFootnote(true);
        return;
      }

      // Abstract: a singleton auto-placed between the title and first section.
      if (activeBlockId === "block::abstract") {
        setDoc((prev) => insertPage(prev, blockDef.make()));
        return;
      }

      // Special pages drop anywhere → auto-placed by document order (and unique).
      if (activeBlockId.startsWith("block::page::")) {
        setDoc((prev) => insertPage(prev, blockDef.make()));
        return;
      }

      // Section / Subsection / Subsubsection.
      const kind = STRUCTURAL[activeBlockId];
      if (kind) {
        // A section is dropped anywhere and simply appended after the last
        // section (ordered placement keeps it ahead of the bibliography).
        if (kind === "section") {
          setDoc((prev) => insertOrdered(prev, newSection()));
          return;
        }

        // Subsection / subsubsection: drop into their (only-eligible) container.
        if (overId.startsWith("dz::")) {
          const [, containerId, idxStr] = overId.split("::");
          setDoc((prev) => insertStructuralAt(prev, containerId, Number(idxStr), kind));
        }
        return;
      }

      // Math block dropped onto a slot → insert it as a part at that position.
      if (overId.startsWith("mathdz::") && activeBlockId.startsWith("block::math::")) {
        const [, mathId, idxStr] = overId.split("::");
        setDoc((prev) => insertMathItem(prev, mathId, Number(idxStr), MATH_TEMPLATES[activeBlockId]));
        return;
      }

      // Otherwise drop it as a new block in a between-block zone.
      if (overId.startsWith("dz::")) {
        const [, containerId, idxStr] = overId.split("::");
        setDoc((prev) => insertNodeAt(prev, containerId, Number(idxStr), blockDef.make()));
      }
      return;
    }

    const activeId = String(active.id);
    const isSidebar = activeId.startsWith("image::");
    const isDocImg  = activeId.startsWith("docimg::");

    // ── Non-image drag: keep the existing section reordering ──
    if (!isSidebar && !isDocImg) {
      if (!over || activeId === String(over.id)) return;
      const overId = String(over.id);
      setDoc((prev) => {
        const siblings = prev.children ?? [];
        const oldIndex = siblings.findIndex((c: any) => c.id === activeId);
        const newIndex = siblings.findIndex((c: any) => c.id === overId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const updated = [...siblings];
        const [moved] = updated.splice(oldIndex, 1);
        updated.splice(newIndex, 0, moved);
        return { ...prev, children: updated };
      });
      return;
    }

    // ── Image drag: resolve the source and (for in-document images) origin ──
    let originFig: string | null = null;
    let originImg: string | null = null;
    let src: string | null = null;

    if (isSidebar) {
      src = images.find((i) => i.id === activeId.slice("image::".length))?.src ?? null;
    } else {
      const [, figId, imgId] = activeId.split("::");
      originFig = figId;
      originImg = imgId;
      src = findDocImageSrc(doc, figId, imgId);
    }
    if (!src) return;
    const dropSrc = src;

    const overId = over ? String(over.id) : null;

    // Dropped outside every droppable → remove it from the document only.
    if (!overId) {
      if (isDocImg && originFig && originImg) {
        const fig = originFig, img = originImg;
        setDoc((prev) => removeFigureImage(prev, fig, img));
      }
      return;
    }

    // Drop into a left/right slot of a figure → add the image there, shrinking
    // the others so everything fits across the column.
    if (overId.startsWith("figdz::")) {
      const [, figureId, idxStr] = overId.split("::");
      let index = Number(idxStr);

      // Reordering within the same figure: account for the removed image.
      if (isDocImg && originFig === figureId) {
        const fig = findFigureNode(doc, figureId);
        const imgs = fig?.images ?? [];
        if (imgs.length <= 1) return;                           // nothing to do
        const fromPos = imgs.findIndex((im: any) => im.id === originImg);
        if (fromPos === -1) return;
        if (index === fromPos || index === fromPos + 1) return; // dropped on itself
        if (index > fromPos) index -= 1;
      }

      const fromFig = originFig, fromImg = originImg;
      setDoc((prev) => {
        let tree = prev;
        if (isDocImg && fromFig && fromImg) tree = removeFigureImage(tree, fromFig, fromImg);
        return insertFigureImageAt(tree, figureId, index, dropSrc);
      });
      return;
    }

    // Drop into a between-block zone → create a new (single-image) figure.
    if (overId.startsWith("dz::")) {
      const [, containerId, idxStr] = overId.split("::");
      let index = Number(idxStr);

      // If moving an image whose figure will disappear from this same
      // container before the target index, shift the index back by one.
      if (isDocImg && originFig) {
        const loc = locateFigure(doc, originFig);
        const fig = findFigureNode(doc, originFig);
        const willEmpty = (fig?.images ?? []).length <= 1;
        if (willEmpty && loc && loc.parentId === containerId && loc.index < index) {
          index -= 1;
        }
      }

      const fromFig = originFig, fromImg = originImg;
      setDoc((prev) => {
        let tree = prev;
        if (isDocImg && fromFig && fromImg) tree = removeFigureImage(tree, fromFig, fromImg);
        return insertFigure(tree, containerId, index, dropSrc);
      });
      return;
    }

    // Dropped over some other droppable (e.g. a column) → no-op.
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDragSrc(null); setActiveBlockId(null); }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
     <div className="editor-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Full-width top bar above the sidebars: logo, back, undo/redo and a
          live mini preview of the whole document. Wrapped so the edge toggle can
          collapse its height to slide it out of view. */}
      <div
        style={{
          flex: "0 0 auto",
          // minHeight:0 defeats the flex item's automatic min-size, and the
          // matching maxHeight caps it, so the explicit collapsed height (56) is
          // honoured instead of snapping back to the TopBar's content height.
          minHeight: 0,
          height: topOpen ? TOPBAR_HEIGHT : TOPBAR_COLLAPSED_HEIGHT,
          maxHeight: topOpen ? TOPBAR_HEIGHT : TOPBAR_COLLAPSED_HEIGHT,
          overflow: "hidden",
          transition: "height 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 5
        }}
      >
        <TopBar
          onBack={onBack}
          onUndo={undo}
          onRedo={redo}
          onSave={saveProject}
          onExport={() =>
            exportLatex(numberedDoc, {
              cls: template.cls,
              title: documentTitle,
              columns: layout.columns,
              fontSizePx: layout.fontSize
            }).catch(() =>
              confirmDialog({
                title: "Export failed",
                message: "Couldn't reach the export service — make sure the backend is running on localhost:8000.",
                confirmLabel: "OK",
                noCancel: true
              })
            )
          }
          canUndo={canUndo}
          canRedo={canRedo}
          visible={sidebarsIn}
          collapsed={!topOpen}
          pages={pages}
          outline={outline}
          layout={layout}
          dark={dark}
          onToggleTheme={onToggleTheme}
        />
      </div>
      <div
        className="editor-canvas"
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        {/* Footnote "pick a word" instruction banner. */}
        {pendingFootnote && (
          <div
            style={{
              position: "fixed",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100,
              background: "var(--ui-blue)",
              color: "#fff",
              fontFamily: "var(--ui-font)",
              fontSize: 13,
              fontWeight: 500,
              padding: "8px 16px",
              borderRadius: 999,
              boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              pointerEvents: "none"
            }}
          >
            Click a word to attach the footnote · Esc to cancel
          </div>
        )}

        {/* SIDEBAR — wrapper collapses its width to slide the panel away. */}
        <div
          style={{
            flex: "0 0 auto",
            width: leftOpen ? 280 : 0,
            height: "100%",
            overflow: "hidden",
            transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
        <div
          className="ui-panel"
          style={{
            width: 280,
            boxSizing: "border-box",
            padding: 20,
            borderRight: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            transform: sidebarsIn ? "translateX(0)" : "translateX(-100%)",
            opacity: sidebarsIn ? 1 : 0,
            transition:
              "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease"
          }}
        >
          {/* Tab strip: Typography controls vs the Blox palette. */}
          <div style={{ display: "flex", gap: 4, background: "var(--tabstrip-bg)", borderRadius: 10, padding: 3 }}>
            {(["typography", "blox"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSidebarTab(t)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: "none",
                  textTransform: "capitalize",
                  fontFamily: "var(--ui-font)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: sidebarTab === t ? "var(--ui-text)" : "var(--ui-2nd)",
                  background: sidebarTab === t ? "var(--tab-active-bg)" : "transparent",
                  boxShadow: sidebarTab === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "background 0.15s ease, color 0.15s ease"
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {sidebarTab === "typography" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <NumberControl
                label="Text Width"
                value={layout.textWidth}
                min={Math.min(200, contentWidth)}
                max={contentWidth}
                step={1}
                unit="px"
                onChange={(v) => setLayout({ ...layout, textWidth: v })}
              />

              <NumberControl
                label="Line Spacing"
                value={layout.lineHeight}
                min={1}
                max={2.5}
                step={0.1}
                onChange={(v) => setLayout({ ...layout, lineHeight: v })}
              />

              <NumberControl
                label="Font Size"
                value={layout.fontSize}
                min={8}
                max={28}
                step={1}
                unit="px"
                onChange={(v) => setLayout({ ...layout, fontSize: v })}
              />

              <div>
                <label>Layout</label>
                <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                  {[1, 2].map((c) => (
                    <button
                      key={c}
                      onClick={() => setLayout({ ...layout, columns: c })}
                      title={c === 1 ? "One column" : "Two columns"}
                      style={{
                        padding: 7,
                        lineHeight: 0,
                        cursor: "pointer",
                        borderRadius: 10,
                        color: "var(--ui-text)",
                        transition: "border-color 0.15s ease, background 0.15s ease",
                        border:
                          layout.columns === c
                            ? "2px solid var(--ui-blue)"
                            : "1px solid var(--ctrl-border)",
                        background:
                          layout.columns === c ? "rgba(0,113,227,0.08)" : "var(--ctrl-surface)"
                      }}
                    >
                      <LayoutIcon columns={c} />
                    </button>
                  ))}

                  {/* divider before the text-format buttons */}
                  <span style={{ width: 1, height: 26, background: "var(--divider)", margin: "0 2px" }} />

                  {/* Select text in a paragraph, then click to format it. */}
                  {([
                    { cmd: "bold" as const, label: "Bold", glyph: "B", css: { fontWeight: 700 } },
                    { cmd: "italic" as const, label: "Italic", glyph: "I", css: { fontStyle: "italic" } },
                    { cmd: "underline" as const, label: "Underline", glyph: "U", css: { textDecoration: "underline" } }
                  ]).map(({ cmd, label, glyph, css }) => (
                    <button
                      key={cmd}
                      title={label}
                      aria-label={label}
                      // Keep the paragraph selection alive (don't take focus).
                      onMouseDown={(e) => { e.preventDefault(); applyInlineFormat(cmd); }}
                      style={{
                        width: 34,
                        height: 34,
                        padding: 0,
                        cursor: "pointer",
                        borderRadius: 10,
                        border: "1px solid var(--ctrl-border)",
                        background: "var(--ctrl-surface)",
                        color: "var(--ui-text)",
                        fontFamily: "var(--sans)",
                        fontSize: 16,
                        lineHeight: 0,
                        transition: "border-color 0.15s ease, background 0.15s ease",
                        ...css
                      }}
                    >
                      {glyph}
                    </button>
                  ))}

                  {/* Center the paragraph holding the selection. */}
                  <button
                    title="Center"
                    aria-label="Center"
                    onMouseDown={(e) => { e.preventDefault(); centerSelection(); }}
                    style={{
                      width: 34,
                      height: 34,
                      padding: 0,
                      cursor: "pointer",
                      borderRadius: 10,
                      border: "1px solid var(--ctrl-border)",
                      background: "var(--ctrl-surface)",
                      color: "var(--ui-text)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "border-color 0.15s ease, background 0.15s ease"
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                      <line x1="5" y1="18" x2="19" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {sidebarTab === "blox" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* A grid of Blox icons; `symbols` lays them out compact (label-less). */}
              {(() => {
                const grid = (ids: readonly string[], symbols: boolean) => (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: symbols ? "1fr 1fr 1fr" : "1fr 1fr",
                      gap: 8
                    }}
                  >
                    {ids
                      .filter((id) => id !== "block::abstract" || !hasAbstract)
                      .map((id) => (
                        <DraggableBlock key={id} id={id} compact={symbols} />
                      ))}
                  </div>
                );
                return (
                  <>
                    <Collapsible title="Document">{grid(DOCUMENT_ORDER, false)}</Collapsible>
                    <Collapsible title="Shapes">{grid(SHAPE_ORDER, false)}</Collapsible>
                    <Collapsible title="Math">{grid(MATH_ORDER, false)}</Collapsible>
                    {/* Math symbols: an outer group holding a collapsible
                        subcategory per symbol family. */}
                    <Collapsible title="Math symbols">
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {MATH_SYMBOL_GROUPS.map((g) => (
                          <Collapsible key={g.title} title={g.title} sub defaultOpen={false}>
                            {grid(g.ids, true)}
                          </Collapsible>
                        ))}
                      </div>
                    </Collapsible>
                  </>
                );
              })()}
            </div>
          )}

        </div>
        </div>


        {/* DOCUMENT */}
        <DroppableDocArea visible={sidebarsIn}>
                {pages.map((cols: any[], pageIndex: number) => (
                  <Page
                    key={pageIndex}
                    pageNumber={pageIndex + 1}
                    width={layout.pageWidth}
                    height={layout.pageHeight}
                    padTop={layout.padTop}
                    padBottom={layout.padBottom}
                    padLeft={layout.padLeft}
                    padRight={layout.padRight}
                  >

                    {/* Title sits on the body's first page (after any cover / TOC).
                        \maketitle: \LARGE (1.728×) Computer Modern, centered.
                        Beamer slides carry their own frametitles, so the floating
                        document title is suppressed there. */}
                    {pageIndex === titlePageIndex && template.cls !== "beamer" && (
                      /* \maketitle: 2em above the \LARGE title, 1.5em below. */
                      <div style={{ textAlign: "center", marginTop: layout.fontSize * 2, marginBottom: layout.fontSize * 1.5 }}>
                        <HeadingInput
                          value={documentTitle}
                          onChange={setDocumentTitle}
                          ariaLabel="Document title"
                          style={{ fontSize: Math.round(layout.fontSize * 1.728 * 100) / 100,
                                   fontWeight: 400, textAlign: "center",
                                   fontFamily: "var(--sans)", color: "var(--text)",
                                   lineHeight: 1.15 }}
                        />
                      </div>
                    )}

                    {(() => {
                      // The text block fills the area between the page margins,
                      // never wider than the page itself. The slider can narrow
                      // it further (widening the margins, LaTeX-style). Every page
                      // holds `layout.columns` equal-width columns; content has
                      // already been flowed left → right → next page.
                      const blockWidth = Math.min(layout.textWidth, contentWidth);

                      return (
                        <div style={{ display: "flex", gap: COLUMN_GAP,
                                      width: blockWidth, margin: "0 auto" }}>
                          {cols.map((col: any[], colIndex: number) => (
                            <div key={colIndex} style={{ flex: 1, minWidth: 0 }}>
                              <DocumentRenderer
                                droppableId={`p${pageIndex}-c${colIndex}`}
                                column={col}
                                figureNumbers={figureNumbers}
                                tableNumbers={tableNumbers}
                                equationNumbers={equationNumbers}
                                pendingFootnote={pendingFootnote}
                                onWordClick={handleWordClick}
                                footnoteNumbers={footnoteNumbers}
                                {...rendererProps}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Footnotes for this page, beneath a short rule. */}
                    {(() => {
                      const fns = collectPageFootnotes(cols, footnoteNumbers);
                      if (!fns.length) return null;
                      return (
                        <div style={{ marginTop: 20, width: Math.min(layout.textWidth, contentWidth), marginLeft: "auto", marginRight: "auto" }}>
                          <div style={{ borderTop: "1px solid #999", width: 160, marginBottom: 6 }} />
                          {fns.map(({ paragraphId, fn, number }) => {
                            // A footnote whose target word was deleted is shown in red.
                            const fnColor = fn.unconnected ? "#c0392b" : "var(--text)";
                            return (
                            <div key={fn.id} style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 2 }}>
                              <sup style={{ fontSize: layout.fontSize * 0.7, fontFamily: "var(--sans)", color: fnColor, lineHeight: 1.6 }}>{number}</sup>
                              <input
                                value={fn.text}
                                placeholder="Footnote text…"
                                onChange={(e) => setFootnoteText(paragraphId, fn.id, e.target.value)}
                                style={{
                                  flex: 1, border: "none", outline: "none", background: "transparent",
                                  fontFamily: "var(--sans)", color: fnColor,
                                  fontWeight: fn.unconnected ? 600 : 400,
                                  fontSize: layout.fontSize * 0.8
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (!(fn.text ?? "").trim()) { removeFootnote(paragraphId, fn.id); return; }
                                  confirmDialog({
                                    title: "Delete footnote?",
                                    message: "This footnote and its text will be removed.",
                                    confirmLabel: "Delete",
                                    danger: true
                                  }).then((ok) => { if (ok) removeFootnote(paragraphId, fn.id); });
                                }}
                                title="Delete footnote"
                                style={{ border: "none", background: "transparent", color: "#c0392b", cursor: "pointer", padding: 0 }}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Free-form shape overlay for this page. */}
                    <ShapeLayer
                      pageIndex={pageIndex}
                      pageWidth={layout.pageWidth}
                      pageHeight={layout.pageHeight}
                      shapes={doc.shapes ?? []}
                      selectedId={selectedShapeId}
                      onSelect={setSelectedShapeId}
                      onCommit={updateShape}
                      onPatch={updateShape}
                      onDelete={deleteShape}
                    />

                  </Page>
                ))}
        </DroppableDocArea>

        {/* RIGHT SIDEBAR — IMAGES (wrapper collapses width to slide away) */}
        <div
          style={{
            flex: "0 0 auto",
            width: rightOpen ? 260 : 0,
            height: "100%",
            overflow: "hidden",
            transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
        <div
          className="ui-panel"
          // OS drag-and-drop image upload: dropping image files anywhere on this
          // sidebar adds them to the gallery. dragenter/over must preventDefault
          // for the drop to fire; a counter avoids flicker as the pointer crosses
          // child elements.
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes("Files")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              if (!imageDropActive) setImageDropActive(true);
            }
          }}
          onDragLeave={(e) => {
            // Only clear when the pointer actually leaves the panel.
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setImageDropActive(false);
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files?.length) {
              e.preventDefault();
              addImageFiles(e.dataTransfer.files);
            }
            setImageDropActive(false);
          }}
          style={{
            position: "relative",
            width: 260,
            boxSizing: "border-box",
            padding: 20,
            borderLeft: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            boxShadow: imageDropActive ? "inset 0 0 0 2px var(--ui-blue)" : "none",
            transform: sidebarsIn ? "translateX(0)" : "translateX(100%)",
            opacity: sidebarsIn ? 1 : 0,
            transition:
              "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease, box-shadow 0.15s ease"
          }}
        >
          <h3>Images</h3>

          <button className="ui-btn" style={{ width: "100%" }} onClick={uploadImage}>
            Upload image
          </button>

          <div
            style={{
              border: `2px dashed ${imageDropActive ? "var(--ui-blue)" : "var(--ctrl-border)"}`,
              borderRadius: 10,
              padding: "14px 10px",
              textAlign: "center",
              fontFamily: "var(--ui-font)",
              fontSize: 12,
              lineHeight: 1.4,
              color: imageDropActive ? "var(--ui-blue)" : "var(--ui-2nd)",
              background: imageDropActive ? "rgba(0,113,227,0.08)" : "transparent",
              transition: "border-color 0.15s ease, background 0.15s ease, color 0.15s ease",
              pointerEvents: "none"
            }}
          >
            {imageDropActive ? "Drop images to upload" : "or drag & drop images here"}
          </div>

          {images.map((img) => (
            <DraggableImage key={img.id} img={img} onDelete={deleteImageUpload} />
          ))}
        </div>
        </div>
      </div>

      {/* Edge toggles to hide / show each panel (only once the editor is in). */}
      {sidebarsIn && (
        <>
          <EdgeToggle edge="left"  open={leftOpen}  size={280}           onToggle={() => setLeftOpen((v) => !v)} />
          <EdgeToggle edge="right" open={rightOpen} size={260}           onToggle={() => setRightOpen((v) => !v)} />
          <EdgeToggle edge="top"   open={topOpen}   size={TOPBAR_HEIGHT} collapsedSize={TOPBAR_COLLAPSED_HEIGHT} onToggle={() => setTopOpen((v) => !v)} />
        </>
      )}
     </div>

      {/* Floating preview of whatever is being dragged, centered on the cursor. */}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeDragSrc ? (
          <img
            src={activeDragSrc}
            alt=""
            style={{
              width: 160,
              height: "auto",
              borderRadius: 4,
              border: "1px solid #4a90e2",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              opacity: 0.5
            }}
          />
        ) : activeBlockId ? (
          <div style={{ width: 104, opacity: 0.55 }}>
            <BlockBox id={activeBlockId} shadow />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type MorphRect = { left: number; top: number; width: number; height: number };
const MORPH_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export default function App() {
  // welcome → morph (card grows into the page) → editor (sidebars slide in).
  const [phase, setPhase] = useState<"welcome" | "morph" | "editor">("welcome");
  const [origin, setOrigin] = useState<MorphRect | null>(null);
  const [target, setTarget] = useState<MorphRect | null>(null);
  const [grown, setGrown] = useState(false);
  const [overlayOn, setOverlayOn] = useState(false);
  // The page layout for the selected template (article / report / letter / …).
  const [template, setTemplate] = useState<TemplateLayout>(templateFor("article"));
  // A saved project being reopened (from a .blox file or the autosave slot);
  // null means the editor starts from the template's fresh content.
  const [project, setProject] = useState<BloxProject | null>(null);
  // The autosaved session offered on the welcome screen, re-read every time the
  // welcome screen shows (it changes while editing).
  const [autosave, setAutosave] = useState<BloxProject | null>(null);
  useEffect(() => {
    if (phase === "welcome") setAutosave(loadAutosave());
  }, [phase]);
  // Dark mode for the whole app (welcome + editor chrome). Persisted and applied
  // as data-theme on <html> so scoped CSS re-skins everything; the document
  // paper itself stays white.
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("blox-theme") === "dark"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("blox-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  function start(preset?: string, rect?: DOMRect) {
    setProject(null);
    setTemplate(templateFor(preset));
    beginSession(rect);
  }

  // Reopen a saved project: same morph, but the editor seeds from the project.
  function openProject(p: BloxProject, rect?: DOMRect) {
    setProject(p);
    setTemplate(templateFor(p.cls));
    beginSession(rect);
  }

  function beginSession(rect?: DOMRect) {
    if (!rect) {
      setPhase("editor");
      return;
    }
    setOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    setOverlayOn(true);
    setGrown(false);
    setPhase("morph"); // mounts the editor behind the (fading) welcome screen

    requestAnimationFrame(() => {
      // The editor is now in the DOM — land the overlay exactly on the page.
      const el = document.querySelector(".blox-page") as HTMLElement | null;
      const t: MorphRect = el
        ? (() => {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
          })()
        : {
            left: (window.innerWidth - PAGE_WIDTH) / 2,
            top: 24,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT
          };
      setTarget(t);
      requestAnimationFrame(() => setGrown(true)); // trigger the grow transition
    });

    window.setTimeout(() => setPhase("editor"), 520); // sidebars slide in, welcome unmounts
    window.setTimeout(() => setOverlayOn(false), 560); // fade overlay → reveal the real document
    window.setTimeout(() => {
      setOrigin(null);
      setTarget(null);
      setGrown(false);
    }, 860);
  }

  const showEditor = phase === "morph" || phase === "editor";

  // Return to the template chooser (welcome screen). The editor unmounts, so its
  // document resets — picking a template starts a fresh project.
  function goBack() {
    setPhase("welcome");
    setOrigin(null);
    setTarget(null);
    setGrown(false);
    setOverlayOn(false);
  }

  // Animate the box geometry from the clicked card to the page. Doing this
  // directly (rather than a non-uniform transform scale) keeps the corners round
  // and the morph clean even when the aspect ratio changes (e.g. a portrait card
  // growing into a landscape Beamer slide).
  const cur = grown && target ? target : origin;

  return (
    <>
      {showEditor && (
        <Editor
          sidebarsIn={phase === "editor"}
          template={template}
          project={project}
          onBack={goBack}
          dark={dark}
          onToggleTheme={() => setDark((v) => !v)}
        />
      )}

      {phase !== "editor" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            opacity: phase === "morph" ? 0 : 1,
            transition: "opacity 0.4s ease",
            pointerEvents: phase === "morph" ? "none" : "auto"
          }}
        >
          <Welcome
            onStart={start}
            onOpen={openProject}
            autosave={autosave}
            dark={dark}
            onToggleTheme={() => setDark((v) => !v)}
          />
        </div>
      )}

      {origin && target && cur && (
        <div
          style={{
            position: "fixed",
            left: cur.left,
            top: cur.top,
            width: cur.width,
            height: cur.height,
            background: "#ffffff",
            borderRadius: 8,
            boxShadow:
              "0 12px 40px rgba(20, 20, 50, 0.18), 0 2px 6px rgba(20, 20, 50, 0.06)",
            opacity: overlayOn ? 1 : 0,
            transition: `left 0.55s ${MORPH_EASE}, top 0.55s ${MORPH_EASE}, width 0.55s ${MORPH_EASE}, height 0.55s ${MORPH_EASE}, opacity 0.3s ease`,
            willChange: "left, top, width, height, opacity",
            zIndex: 60,
            pointerEvents: "none"
          }}
        />
      )}

      {/* App-wide custom confirm dialog host. */}
      <ConfirmHost />
    </>
  );
}