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
  downloadProject,
  saveAutosave,
  loadAutosave,
  type BloxProject
} from "./utils/persistence";

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
                          layout.columns === c ? "var(--ui-accent-soft)" : "var(--ctrl-surface)"
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
      {!pendingFootnote && (
        <SelectionToolbar
          onBold={() => applyInlineFormat("bold")}
          onItalic={() => applyInlineFormat("italic")}
          onUnderline={() => applyInlineFormat("underline")}
          onFootnote={addFootnoteAtSelection}
          onQuote={openQuoteForSelection}
        />
      )}
      {citeEditor && (
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
      {showEditor && (
        <Editor
          sidebarsIn={phase === "editor"}
          template={template}
          project={project}
          onBack={goBack}
          dark={dark}
          onToggleTheme={toggleTheme}
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
            onToggleTheme={toggleTheme}
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

      {/* App-wide custom confirm dialog host. */}
      <ConfirmHost />
    </>
  );
}