import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { DocumentRenderer, HeadingInput } from "./renderer/DocumentRenderer";
import { Page } from "./components/Page";
import { TopBar, TOPBAR_HEIGHT, TOPBAR_COLLAPSED_HEIGHT } from "./components/TopBar";
import { TrashIcon } from "./components/TrashIcon";
import { Welcome } from "./components/Welcome";
import { useDocument } from "./hooks/useDocument";
import { useImageGallery } from "./hooks/useImageGallery";
import { useShapes } from "./hooks/useShapes";
import { useCitations } from "./hooks/useCitations";
import { useEditorDnd } from "./hooks/useEditorDnd";
import { numberDocument } from "./utils/numberDocument";
import { paginateColumns, heightsUnchanged } from "./utils/paginateDocument";
import { exportLatex } from "./utils/exportLatex";
import {
  buildProject,
  buildDesignProject,
  downloadProject,
  saveAutosave,
  loadAutosave,
  type BloxProject
} from "./utils/persistence";
import { CoverDesigner } from "./components/design/CoverDesigner";
import { ViewerBar } from "./components/welcome/ViewerBar";
import { DesignPreview } from "./components/welcome/DesignPreview";
import { useFavorites, favKey } from "./utils/favorites";
import { addToMyProjects } from "./utils/myProjects";
import { exportCover } from "./utils/exportCover";
import { blankDesign } from "./types/design";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy
} from "@dnd-kit/core";
import { snapCenterToCursor, dropCollision } from "./utils/dnd";
import {
  collectPageFootnotes,
  measureParagraphLines,
  flowHeight,
  lineDataUnchanged,
  placeCaretAt,
  type LineMap
} from "./utils/measure";

import {
  COLUMN_GAP,
  PAGE_WIDTH,
  PAGE_HEIGHT
} from "./utils/pageConfig";
import { templateFor, templateDoc, type TemplateLayout } from "./utils/templates";
import { DOC_FONTS, docFontCss } from "./utils/fonts";
import {
  addFootnoteToWord,
  addFootnoteAtOffset,
  footnoteNumbering,
  getBib,
  findNodeById,
  nodeHasContent
} from "./utils/docTree";
import {
  DOCUMENT_ORDER,
  MATH_ORDER,
  MATH_SYMBOL_GROUPS,
  SHAPE_ORDER,
  BlockBox,
  LayoutIcon
} from "./components/blocks";
import { ShapeLayer } from "./components/shapes";
import { ConfirmHost, confirmDialog } from "./components/ConfirmDialog";
import { SelectionToolbar, CiteEditor } from "./components/citations";
import {
  DraggableImage,
  DroppableDocArea,
  DraggableBlock,
  Collapsible,
  NumberControl,
  EdgeToggle
} from "./components/editorUi";

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

// A compact labelled integer field (px) used for the 2×2 margins grid.
function MarginField({ label, value, min, max, onChange }:
  { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    else setText(String(value));
  };
  return (
    <label className="margin-field">
      <span className="margin-field-lbl">{label}</span>
      <span className="margin-field-input">
        <input
          type="number" inputMode="numeric" value={text} min={min} max={max}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
        />
        <span className="margin-field-unit">px</span>
      </span>
    </label>
  );
}

// When set, the Editor renders as a read-only template viewer (slim bar, no
// sidebars, content non-interactive) rather than the full editor.
type ViewerProps = {
  onBack: () => void;
  onOpenInEditor: () => void;
  isFav: boolean;
  onToggleFav: () => void;
  // When true the Editor renders content-only (no top bar) and fills its
  // container, so a parent (the TemplateViewer carousel) can supply one
  // persistent bar above a sliding track of panes.
  bare?: boolean;
};

function Editor({ sidebarsIn = true, template, project, onBack, dark, onToggleTheme, viewer }: { sidebarsIn?: boolean; template: TemplateLayout; project?: BloxProject | null; onBack?: () => void; dark: boolean; onToggleTheme: () => void; viewer?: ViewerProps }) {
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
    updateTextById, updateRichText, updateSectionTitle, updateFigureCaption,
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
  // Right-sidebar image gallery (uploads, drop-to-upload flag, remove).
  const {
    images, imageDropActive, setImageDropActive,
    addImageFiles, uploadImage, deleteImageUpload
  } = useImageGallery(project?.images ?? []);

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
    fontFamily: "cm",
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
    if (viewer) return; // a read-only preview never writes the autosave slot
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      saveAutosave(buildProject(template.cls, documentTitle, layout, doc, images));
    }, 800);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [doc, documentTitle, layout, images, template.cls, viewer]);

  // Download the session as a .blox project file (re-openable from the
  // welcome screen's "Open project").
  function saveProject() {
    downloadProject(buildProject(template.cls, documentTitle, layout, doc, images));
  }

  // Export the current document to LaTeX (shared by the top bar and the viewer
  // bar). `numberedDoc` is assigned below but only read when this is invoked.
  function exportDoc() {
    exportLatex(numberedDoc, {
      cls: template.cls, title: documentTitle, columns: layout.columns, fontSizePx: layout.fontSize
    }).catch(() =>
      confirmDialog({
        title: "Export failed",
        message: "Couldn't reach the export service — make sure the backend is running on localhost:8000.",
        confirmLabel: "OK", noCancel: true
      })
    );
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

  }, [doc, contentWidth, layout.fontSize, layout.lineHeight, layout.columns, layout.fontFamily]);

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

  // ── Citations / bibliography ────────────────────────────
  const {
    bibNumbers, citeEditor, setCiteEditor,
    openQuoteForSelection, openCiteEditorForEntry, saveCiteEditor, deleteCiteEntry, setBibStyle
  } = useCitations(doc, setDoc);

  // Selection-toolbar "Footnote": attach a footnote at the selection end.
  function addFootnoteAtSelection(paragraphId: string, offset: number) {
    setDoc((prev) => addFootnoteAtOffset(prev, paragraphId, offset, crypto.randomUUID()));
  }

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

  // Free-form overlay shapes (selection + create / edit / delete on doc.shapes).
  const {
    selectedShapeId, setSelectedShapeId, updateShape, deleteShape, placeShapeFromDrag
  } = useShapes(setDoc, layout);

  // All drag-and-drop wiring (overlay state + every drop resolution).
  const {
    activeDragSrc, activeBlockId, handleDragStart, handleDragEnd, handleDragCancel
  } = useEditorDnd({ doc, setDoc, images, placeShapeFromDrag, setPendingFootnote });

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
     <div className="editor-shell" style={{ display: "flex", flexDirection: "column", height: viewer?.bare ? "100%" : "100vh", overflow: "hidden" }}>
      {/* Full-width top bar above the sidebars: logo, back, undo/redo and a
          live mini preview of the whole document. Wrapped so the edge toggle can
          collapse its height to slide it out of view. Omitted in `bare` viewer
          panes — the carousel renders one persistent bar above the slide track. */}
      {!viewer?.bare && (
      <div
        style={{
          flex: "0 0 auto",
          // minHeight:0 defeats the flex item's automatic min-size, and the
          // matching maxHeight caps it, so the explicit collapsed height (56) is
          // honoured instead of snapping back to the TopBar's content height.
          minHeight: 0,
          height: viewer ? TOPBAR_COLLAPSED_HEIGHT : (topOpen ? TOPBAR_HEIGHT : TOPBAR_COLLAPSED_HEIGHT),
          maxHeight: viewer ? TOPBAR_COLLAPSED_HEIGHT : (topOpen ? TOPBAR_HEIGHT : TOPBAR_COLLAPSED_HEIGHT),
          overflow: "hidden",
          transition: "height 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 5
        }}
      >
        {viewer ? (
          <ViewerBar
            onBack={viewer.onBack}
            onOpenInEditor={viewer.onOpenInEditor}
            isFav={viewer.isFav}
            onToggleFav={viewer.onToggleFav}
            dark={dark}
            onToggleTheme={onToggleTheme}
            onExport={exportDoc}
          />
        ) : (
        <TopBar
          onBack={onBack}
          onUndo={undo}
          onRedo={redo}
          onSave={saveProject}
          onExport={exportDoc}
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
        )}
      </div>
      )}
      <div
        className="editor-canvas"
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        {/* A thin frame tracing the top + inner edges of the document "window",
            with rounded top corners that join each sidebar's inner edge into the
            top bar's underside — so the sidebars read as pillars supporting the
            top bar. Spans the doc-area edges (which track sidebar collapse); the
            bottom is left open. */}
        {!viewer && sidebarsIn && (
          <div
            className="doc-window-frame"
            style={{ left: leftOpen ? 280 : 0, right: rightOpen ? 260 : 0 }}
          />
        )}

        {/* Footnote "pick a word" instruction banner. */}
        {pendingFootnote && (
          <div
            style={{
              position: "fixed",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100,
              background: "var(--ui-accent-fill)",
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
        {!viewer && (
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
          className="ui-panel sidebar-panel"
          style={{
            width: 280,
            boxSizing: "border-box",
            padding: 20,
            borderRight: "1px solid var(--ui-hairline)",
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Body font (overrides the document's --sans). */}
              <div>
                <label>Font</label>
                <select
                  className="ui-select"
                  value={layout.fontFamily}
                  onChange={(e) => setLayout({ ...layout, fontFamily: e.target.value })}
                  style={{ marginTop: 8, width: "100%" }}
                >
                  {DOC_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              <NumberControl
                label="Font Size"
                value={layout.fontSize}
                min={8}
                max={28}
                step={1}
                unit="px"
                onChange={(v) => setLayout({ ...layout, fontSize: v })}
              />

              <NumberControl
                label="Line Spacing"
                value={layout.lineHeight}
                min={1}
                max={2.5}
                step={0.1}
                onChange={(v) => setLayout({ ...layout, lineHeight: v })}
              />

              {/* Page margins (the whitespace around the text block). */}
              <div>
                <label>Margins</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <MarginField label="Top"    value={layout.padTop}    min={24} max={layout.pageHeight - layout.padBottom - 160} onChange={(v) => setLayout({ ...layout, padTop: v })} />
                  <MarginField label="Bottom" value={layout.padBottom} min={24} max={layout.pageHeight - layout.padTop - 160}    onChange={(v) => setLayout({ ...layout, padBottom: v })} />
                  <MarginField label="Left"   value={layout.padLeft}   min={24} max={layout.pageWidth - layout.padRight - 120}   onChange={(v) => setLayout({ ...layout, padLeft: v })} />
                  <MarginField label="Right"  value={layout.padRight}  min={24} max={layout.pageWidth - layout.padLeft - 120}    onChange={(v) => setLayout({ ...layout, padRight: v })} />
                </div>
              </div>

              <div>
                <label>Columns</label>
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
                          layout.columns === c ? "var(--ui-accent-soft)" : "var(--ctrl-surface)"
                      }}
                    >
                      <LayoutIcon columns={c} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Bibliography style → LaTeX \bibliographystyle. */}
              <div>
                <label>Citation style</label>
                <select
                  className="ui-select"
                  value={getBib(doc).style}
                  onChange={(e) => setBibStyle(e.target.value)}
                  style={{ marginTop: 8, width: "100%" }}
                >
                  {["IEEEtran", "plain", "unsrt", "abbrv", "alpha", "apalike", "acm", "siam"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
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
        )}


        {/* DOCUMENT */}
        <DroppableDocArea visible={sidebarsIn} docFont={docFontCss(layout.fontFamily)} readOnly={!!viewer}>
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
                      // The text block fills the area between the page margins
                      // (set via the Typography panel's margin fields). Every page
                      // holds `layout.columns` equal-width columns; content has
                      // already been flowed left → right → next page.
                      const blockWidth = contentWidth;

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
                                citeNumbers={bibNumbers}
                                onCiteClick={openCiteEditorForEntry}
                                bibEntries={getBib(doc).entries}
                                onEditBibEntry={openCiteEditorForEntry}
                                onDeleteBibEntry={deleteCiteEntry}
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
                        <div style={{ marginTop: 20, width: contentWidth, marginLeft: "auto", marginRight: "auto" }}>
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
        {!viewer && (
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
          className="ui-panel sidebar-panel"
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
            borderLeft: "1px solid var(--ui-hairline)",
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
              background: imageDropActive ? "var(--ui-accent-soft)" : "transparent",
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
        )}
      </div>

      {/* Edge toggles to hide / show each panel (only once the editor is in). */}
      {!viewer && sidebarsIn && (
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
              border: "1px solid var(--ui-blue)",
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

      {/* Floating text-selection toolbar (bold / italic / underline / footnote /
          quote) and the BibTeX entry editor it opens. */}
      {!viewer && !pendingFootnote && (
        <SelectionToolbar
          onBold={() => applyInlineFormat("bold")}
          onItalic={() => applyInlineFormat("italic")}
          onUnderline={() => applyInlineFormat("underline")}
          onFootnote={addFootnoteAtSelection}
          onQuote={openQuoteForSelection}
        />
      )}
      {!viewer && citeEditor && (
        <CiteEditor
          initial={citeEditor.raw}
          isEdit={citeEditor.mode === "edit"}
          onSave={saveCiteEditor}
          onCancel={() => setCiteEditor(null)}
          onDelete={citeEditor.mode === "edit" ? () => deleteCiteEntry(citeEditor.entryId) : undefined}
        />
      )}
    </DndContext>
  );
}

type MorphRect = { left: number; top: number; width: number; height: number };
const MORPH_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// A copy of a template to open as a fresh personal project.
function copyForOpen(item: BloxProject): BloxProject {
  return { ...item, savedAt: new Date().toISOString() };
}

// A single content-only pane in the viewer carousel: a design page rendered at
// full size, or the document rendered through the Editor's `bare` viewer mode
// (no top bar — the carousel owns one persistent bar above the slide track).
function ViewerPane({
  item, shared, dark, onToggleTheme
}: {
  item: BloxProject; shared: Omit<ViewerProps, "bare">; dark: boolean; onToggleTheme: () => void;
}) {
  if (item.kind === "design") {
    const design = item.design!;
    return (
      <div className="editor-shell" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="doc-area" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: 40, overflowY: "auto" }}>
          <div className="blox-page" style={{ position: "relative", flex: "none", width: design.pageWidth, height: design.pageHeight, background: design.bg, borderRadius: 6, overflow: "hidden", boxShadow: "0 12px 40px rgba(55,45,25,0.10), 0 2px 6px rgba(55,45,25,0.06)" }}>
            <DesignPreview design={design} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <Editor viewer={{ ...shared, bare: true }} project={item} template={templateFor(item.cls)} sidebarsIn dark={dark} onToggleTheme={onToggleTheme} onBack={shared.onBack} />
  );
}

// The template "View" overlay: one persistent top bar above a horizontally
// sliding track of read-only panes. Prev/next (buttons or ←/→) slide the
// current document out and the neighbour in; the bar never re-renders.
function TemplateViewer({
  list, startIndex, onClose, onOpen, dark, onToggleTheme
}: {
  list: BloxProject[]; startIndex: number; onClose: () => void;
  onOpen: (p: BloxProject) => void; dark: boolean; onToggleTheme: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  // An in-flight slide: `from` is the outgoing item, `dir` its direction
  // (+1 next → content slides left, -1 prev → content slides right). A CSS
  // keyframe (keyed off data-dir) plays the slide the instant the track renders.
  const [anim, setAnim] = useState<{ from: number; dir: 1 | -1 } | null>(null);
  const animating = useRef(false);
  const { isFav, toggle } = useFavorites();

  const item = list[Math.min(index, list.length - 1)];
  const key = favKey(item);

  function endAnim() { animating.current = false; setAnim(null); }

  function go(dir: 1 | -1) {
    if (animating.current) return;
    const to = Math.max(0, Math.min(list.length - 1, index + dir));
    if (to === index) return;
    animating.current = true;
    setAnim({ from: index, dir });
    setIndex(to);
  }

  // End the slide when the keyframe finishes; a fallback timer covers the case
  // where `animationend` doesn't fire (kept a touch above the animation length).
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(endAnim, 560);
    return () => window.clearTimeout(t);
  }, [anim]);

  // Arrow keys walk the list; Escape closes. Re-bound when `index` changes so
  // `go` sees the current position.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list.length, onClose]);

  function openInEditor() {
    const copy = copyForOpen(item);
    addToMyProjects(copy);
    onClose();
    onOpen(copy);
  }

  // Export the currently shown item (kept at this level so the hoisted bar's
  // Export works without reaching into a pane's Editor).
  function exportItem() {
    const onFail = () => confirmDialog({ title: "Export failed", message: "Couldn't reach the export service — make sure the backend is running on localhost:8000.", confirmLabel: "OK", noCancel: true });
    if (item.kind === "design") { exportCover(item.design!, item.title).catch(onFail); return; }
    const L = item.layout ?? templateFor(item.cls);
    exportLatex(numberDocument(item.doc), { cls: item.cls, title: item.title, columns: L.columns, fontSizePx: L.fontSize }).catch(onFail);
  }

  const shared = { onBack: onClose, onOpenInEditor: openInEditor, isFav: isFav(key), onToggleFav: () => toggle(key) };
  const paneFor = (i: number) => (
    <div className="tv-pane" key={`p${i}`}>
      <ViewerPane item={list[i]} shared={shared} dark={dark} onToggleTheme={onToggleTheme} />
    </div>
  );
  const panes = anim
    ? (anim.dir === 1 ? [paneFor(anim.from), paneFor(index)] : [paneFor(index), paneFor(anim.from)])
    : [paneFor(index)];

  function onTrackEnd(e: React.AnimationEvent) {
    if (e.target === e.currentTarget) endAnim();
  }

  return (
    <div className="template-viewer">
      <div className="tv-topbar" style={{ height: TOPBAR_COLLAPSED_HEIGHT }}>
        <ViewerBar onBack={onClose} onOpenInEditor={openInEditor} isFav={isFav(key)} onToggleFav={() => toggle(key)} dark={dark} onToggleTheme={onToggleTheme} onExport={exportItem} />
      </div>
      <div className="tv-body">
        <div className="tv-track" data-dir={anim ? anim.dir : undefined} onAnimationEnd={onTrackEnd}>
          {panes}
        </div>
      </div>
      <button className="tv-nav tv-prev" disabled={index <= 0} onClick={() => go(-1)} aria-label="Previous template">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
      </button>
      <button className="tv-nav tv-next" disabled={index >= list.length - 1} onClick={() => go(1)} aria-label="Next template">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
      </button>
    </div>
  );
}

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
  // Which editor the session uses: the flowing document editor or the free-form
  // page designer ("Design a page").
  const [mode, setMode] = useState<"doc" | "design">("doc");
  // The autosaved session offered on the welcome screen, re-read every time the
  // welcome screen shows (it changes while editing).
  const [autosave, setAutosave] = useState<BloxProject | null>(null);
  useEffect(() => {
    if (phase === "welcome") setAutosave(loadAutosave());
  }, [phase]);
  // Signed-in user (a stub: dev / 123). Persisted so a refresh stays signed in;
  // when set, the welcome screen shows the user's library instead of the hero
  // paper.
  const [user, setUser] = useState<string | null>(() => {
    try { return localStorage.getItem("blox-user"); } catch { return null; }
  });
  function login(u: string, p: string): boolean {
    if (u === "dev" && p === "123") {
      setUser("dev");
      try { localStorage.setItem("blox-user", "dev"); } catch { /* ignore */ }
      return true;
    }
    return false;
  }
  function logout() {
    setUser(null);
    try { localStorage.removeItem("blox-user"); } catch { /* ignore */ }
  }
  // The read-only template "View" overlay (a list of items + the current index).
  const [viewerState, setViewerState] = useState<{ list: BloxProject[]; index: number } | null>(null);
  function openView(list: BloxProject[], index: number) { setViewerState({ list, index }); }
  // Dark mode for the whole app (welcome + editor chrome). Persisted and applied
  // as data-theme on <html> so scoped CSS re-skins everything; the document
  // paper itself stays white.
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("blox-theme") === "dark"; } catch { return false; }
  });
  // Apply synchronously (layout effect) so a View-Transition capture sees the
  // new theme within the same frame.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("blox-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  // Toggle light/dark with a smooth full-page crossfade (View Transitions API),
  // so the swap eases instead of snapping. Falls back to an instant toggle when
  // the API is unavailable or the user prefers reduced motion.
  function toggleTheme() {
    const start = (document as any).startViewTransition?.bind(document);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!start || reduce) { setDark((v) => !v); return; }
    start(() => flushSync(() => setDark((v) => !v)));
  }

  function start(preset?: string, rect?: DOMRect) {
    setProject(null);
    setMode("doc");
    setTemplate(templateFor(preset));
    beginSession(rect);
  }

  // Open the free-form page designer on a fresh page of the chosen kind.
  function startDesign(kind: string, rect?: DOMRect) {
    setProject(buildDesignProject("Cover Page", blankDesign(kind === "cover" ? "cover" : "cover")));
    setMode("design");
    beginSession(rect);
  }

  // Reopen a saved project: same morph, routed to the editor its kind needs.
  function openProject(p: BloxProject, rect?: DOMRect) {
    setProject(p);
    setMode(p.kind === "design" ? "design" : "doc");
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

    // Land the overlay exactly on the document's first page. Scope the query to
    // `.doc-area` — the top bar clones real `.blox-page` nodes into its outline
    // and renders earlier in the DOM, so an unscoped `.blox-page` would match a
    // tiny top-bar clone and the card would morph into the corner instead of the
    // page. Retry across a few frames in case the editor hasn't laid out yet.
    let tries = 0;
    const place = () => {
      const el = document.querySelector(".doc-area .blox-page") as HTMLElement | null;
      if (!el && tries++ < 20) { requestAnimationFrame(place); return; }
      const t: MorphRect = el
        ? (() => {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
          })()
        : {
            left: (window.innerWidth - PAGE_WIDTH) / 2,
            top: TOPBAR_HEIGHT + 24,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT
          };
      setTarget(t);
      requestAnimationFrame(() => setGrown(true)); // trigger the grow transition
    };
    requestAnimationFrame(place);

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
      {showEditor && (mode === "design" ? (
        <CoverDesigner
          sidebarsIn={phase === "editor"}
          project={project}
          onBack={goBack}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <Editor
          sidebarsIn={phase === "editor"}
          template={template}
          project={project}
          onBack={goBack}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      ))}

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
            onDesign={startDesign}
            onView={openView}
            autosave={autosave}
            dark={dark}
            onToggleTheme={toggleTheme}
            user={user}
            onLogin={login}
            onLogout={logout}
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
              "0 12px 40px rgba(55, 45, 25, 0.18), 0 2px 6px rgba(55, 45, 25, 0.06)",
            opacity: overlayOn ? 1 : 0,
            transition: `left 0.55s ${MORPH_EASE}, top 0.55s ${MORPH_EASE}, width 0.55s ${MORPH_EASE}, height 0.55s ${MORPH_EASE}, opacity 0.3s ease`,
            willChange: "left, top, width, height, opacity",
            zIndex: 60,
            pointerEvents: "none"
          }}
        />
      )}

      {/* Read-only template viewer overlay. */}
      {viewerState && (
        <TemplateViewer
          list={viewerState.list}
          startIndex={viewerState.index}
          onClose={() => setViewerState(null)}
          onOpen={(p) => { setViewerState(null); openProject(p); }}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      )}

      {/* App-wide custom confirm dialog host. */}
      <ConfirmHost />
    </>
  );
}