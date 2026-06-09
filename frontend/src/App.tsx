import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { DocumentRenderer, HeadingInput } from "./renderer/DocumentRenderer";
import { Page } from "./components/Page";
import { TrashIcon } from "./components/TrashIcon";
import { Welcome } from "./components/Welcome";
import { useDocument } from "./hooks/useDocument";
import { numberDocument } from "./utils/numberDocument";
import { paginateColumns, heightsUnchanged } from "./utils/paginateDocument";
import { exportLatex } from "./utils/exportLatex";

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
  footnoteNumbering
} from "./utils/docTree";
import {
  BLOCK_DEFS,
  STRUCTURAL,
  BLOX_ORDER,
  PAGE_ORDER,
  BlockBox,
  LayoutIcon
} from "./components/blocks";
import {
  DraggableImage,
  DroppableDocArea,
  DraggableBlock,
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

// Convert a viewport point to a character offset within a paragraph element.
function caretOffsetAtPoint(p: HTMLElement, x: number, y: number): number {
  const d: any = document;
  let node: Node | null = null, offset = 0;
  if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  } else if (d.caretPositionFromPoint) {
    const pos = d.caretPositionFromPoint(x, y);
    if (pos) { node = pos.offsetNode; offset = pos.offset; }
  }
  if (!node) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(p);
  try { pre.setEnd(node, offset); } catch { return 0; }
  return pre.toString().length;
}

// Measure each rendered line of a paragraph: where it starts (char offset) and
// its cumulative bottom (px) from the element's top.
function measureParagraphLines(p: HTMLElement): { offset: number; bottom: number }[] {
  if (!(p.textContent ?? "").length) return [];
  const pTop = p.getBoundingClientRect().top;
  const range = document.createRange();
  range.selectNodeContents(p);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
  const lines: { offset: number; bottom: number }[] = [];
  let prevTop = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.top > prevTop + 1) {
      lines.push({ offset: caretOffsetAtPoint(p, r.left + 1, r.top + r.height / 2), bottom: r.bottom - pTop });
      prevTop = r.top;
    } else {
      lines[lines.length - 1].bottom = Math.max(lines[lines.length - 1].bottom, r.bottom - pTop);
    }
  }
  if (lines.length) lines[0].offset = 0;
  return lines;
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

function Editor({ sidebarsIn = true, template }: { sidebarsIn?: boolean; template: TemplateLayout }) {
  // ── 1. All state first ──────────────────────────────────
  // Starting content for the chosen class (article / report / letter / …).
  const initialDoc = useMemo(() => templateDoc(template.cls), [template.cls]);
  // The document tree + every mutation handler live in this hook.
  const {
    doc, setDoc,
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
  // While true, the next click on a paragraph word attaches a footnote there.
  const [pendingFootnote, setPendingFootnote] = useState(false);
  const [documentTitle, setDocumentTitle] = useState(template.title);
  // Measured heights: every flow leaf (paragraph/table/figure) and every
  // container header (section/subsection/subsubsection).
  const [leafHeights,   setLeafHeights]   = useState<Record<string, number>>({});
  const [headerHeights, setHeaderHeights] = useState<Record<string, number>>({});
  // Per-paragraph line geometry, so a long paragraph can be split across pages.
  const [lineData, setLineData] = useState<LineMap>({});

  // Images uploaded via the right sidebar (preview gallery).
  const [images, setImages] = useState<{ id: string; src: string; name: string }[]>([]);
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
  // beamer / book). Page geometry stays fixed; the typography controls edit the
  // text settings.
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
    fontSize: template.fontSize
  }));

  // Usable width/height between the page margins (derived from the layout).
  const contentWidth = layout.pageWidth - layout.padLeft - layout.padRight;
  const contentHeight = layout.pageHeight - layout.padTop - layout.padBottom;

  const rendererProps = {
    editingId, setEditingId, updateTextById, updateRichText, updateSectionTitle,
    addSubsection, addSubsubsection, updateTableCell,
    deleteTableColumn, deleteNodeById, addTableRow, deleteTableRow,
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
      .forEach(el => { lh[el.dataset.leafId!] = el.getBoundingClientRect().height; });

    document.querySelectorAll<HTMLElement>("[data-head-id]")
      .forEach(el => { hh[el.dataset.headId!] = el.getBoundingClientRect().height; });

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

  const hasAbstract = (doc.children ?? []).some((c: any) => c.type === "abstract");

  // Bold / italic / underline the current text selection. The button's pointer
  // press is prevented from stealing focus, so the selection stays live inside
  // the contentEditable paragraph and execCommand applies there; the resulting
  // input event then persists the formatting (as marks) through the paragraph.
  function applyInlineFormat(cmd: "bold" | "italic" | "underline") {
    try { document.execCommand("styleWithCSS", false, "false"); } catch { /* ignore */ }
    document.execCommand(cmd);
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
  function uploadImage() {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";

    input.onchange = (e: any) => {
      const file = e.target.files[0];

      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        const url = reader.result as string;

        setImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), src: url, name: file.name }
        ]);
      };

      reader.readAsDataURL(file);
    };

    input.click();
  }

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
      <div
        className="editor-canvas"
        style={{
          display: "flex",
          minHeight: "100vh",
          overflowX: "hidden"
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

        {/* SIDEBAR */}
        <div
          className="ui-panel"
          style={{
            width: 280,
            padding: 20,
            borderRight: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100vh",
            overflowY: "auto",
            transform: sidebarsIn ? "translateX(0)" : "translateX(-100%)",
            opacity: sidebarsIn ? 1 : 0,
            transition:
              "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease"
          }}
        >
          {/* Tab strip: Typography controls vs the Blox palette. */}
          <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3 }}>
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
                  color: sidebarTab === t ? "var(--text)" : "#8a8a8e",
                  background: sidebarTab === t ? "#fff" : "transparent",
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
                        color: "#444",
                        transition: "border-color 0.15s ease, background 0.15s ease",
                        border:
                          layout.columns === c
                            ? "2px solid var(--ui-blue)"
                            : "1px solid rgba(0,0,0,0.12)",
                        background:
                          layout.columns === c ? "rgba(0,113,227,0.08)" : "rgba(255,255,255,0.7)"
                      }}
                    >
                      <LayoutIcon columns={c} />
                    </button>
                  ))}

                  {/* divider before the text-format buttons */}
                  <span style={{ width: 1, height: 26, background: "rgba(0,0,0,0.12)", margin: "0 2px" }} />

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
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "rgba(255,255,255,0.7)",
                        color: "#333",
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
                </div>
              </div>
            </div>
          )}

          {sidebarTab === "blox" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BLOX_ORDER
                  .filter((id) => id !== "block::abstract" || !hasAbstract)
                  .map((id) => (
                    <DraggableBlock key={id} id={id} />
                  ))}
              </div>

              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4, color: "#555" }}>
                Pages
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PAGE_ORDER.map((id) => (
                  <DraggableBlock key={id} id={id} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "auto" }}>
            <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", margin: "12px 0" }} />
            <button
              className="ui-btn primary"
              style={{ width: "100%" }}
              onClick={() => exportLatex(numberedDoc)}
            >
              Export LaTeX
            </button>
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
                          {fns.map(({ paragraphId, fn, number }) => (
                            <div key={fn.id} style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 2 }}>
                              <sup style={{ fontSize: layout.fontSize * 0.7, fontFamily: "var(--sans)", color: "var(--text)", lineHeight: 1.6 }}>{number}</sup>
                              <input
                                value={fn.text}
                                placeholder="Footnote text…"
                                onChange={(e) => setFootnoteText(paragraphId, fn.id, e.target.value)}
                                style={{
                                  flex: 1, border: "none", outline: "none", background: "transparent",
                                  fontFamily: "var(--sans)", color: "var(--text)",
                                  fontSize: layout.fontSize * 0.8
                                }}
                              />
                              <button
                                onClick={() => removeFootnote(paragraphId, fn.id)}
                                title="Delete footnote"
                                style={{ border: "none", background: "transparent", color: "#c0392b", cursor: "pointer", padding: 0 }}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                  </Page>
                ))}
        </DroppableDocArea>

        {/* RIGHT SIDEBAR — IMAGES */}
        <div
          className="ui-panel"
          style={{
            width: 260,
            padding: 20,
            borderLeft: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100vh",
            overflowY: "auto",
            transform: sidebarsIn ? "translateX(0)" : "translateX(100%)",
            opacity: sidebarsIn ? 1 : 0,
            transition:
              "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease"
          }}
        >
          <h3>Images</h3>

          <button className="ui-btn" style={{ width: "100%" }} onClick={uploadImage}>
            Upload image
          </button>

          {images.map((img) => (
            <DraggableImage key={img.id} img={img} onDelete={deleteImageUpload} />
          ))}
        </div>
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

  function start(preset?: string, rect?: DOMRect) {
    setTemplate(templateFor(preset));
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

  // Animate the box geometry from the clicked card to the page. Doing this
  // directly (rather than a non-uniform transform scale) keeps the corners round
  // and the morph clean even when the aspect ratio changes (e.g. a portrait card
  // growing into a landscape Beamer slide).
  const cur = grown && target ? target : origin;

  return (
    <>
      {showEditor && <Editor sidebarsIn={phase === "editor"} template={template} />}

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
          <Welcome onStart={start} />
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
    </>
  );
}