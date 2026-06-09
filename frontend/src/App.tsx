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
  CONTENT_WIDTH,
  COLUMN_GAP,
  PAGE_WIDTH,
  PAGE_HEIGHT
} from "./utils/pageConfig";
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

function Editor({ sidebarsIn = true }: { sidebarsIn?: boolean }) {
  // ── 1. All state first ──────────────────────────────────
  // The document tree + every mutation handler live in this hook.
  const {
    doc, setDoc,
    updateTextById, updateSectionTitle, updateFigureCaption,
    updateMathItem, deleteMathItem, setFootnoteText, removeFootnote,
    updateListItem, addListItem, deleteListItem, setListStyle,
    addSectionAfter, updateFigureWidth,
    deleteFigureImage, addSubsection, addSubsubsection, updateTableCell,
    deleteNodeById, addTableRow, deleteTableRow, deleteTableRowAt,
    addTableColumn, deleteTableColumnAt, updateTableColWidths,
    updateTableCaption, updateTableColors, deleteTableColumn,
    toggleTableBorder, toggleCellBorder, reorderTableColumn, reorderTableRow,
    moveSection, moveSubsection
  } = useDocument();
  const [editingId, setEditingId] = useState<string | null>(null);
  // While true, the next click on a paragraph word attaches a footnote there.
  const [pendingFootnote, setPendingFootnote] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  // Measured heights: every flow leaf (paragraph/table/figure) and every
  // container header (section/subsection/subsubsection).
  const [leafHeights,   setLeafHeights]   = useState<Record<string, number>>({});
  const [headerHeights, setHeaderHeights] = useState<Record<string, number>>({});

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
  function setTyping(id: string | null) {
    if (id === null) {
      // Defer: only really clear once focus has settled outside any editor.
      requestAnimationFrame(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !a.classList.contains("blox-editable")) typingRef.current = null;
      });
    } else {
      typingRef.current = id;
    }
  }


  // article-class defaults: 10pt Computer Modern, 1.2 leading, and a text block
  // that fills exactly between the article margins (≈ 345pt / 66 chars).
  const [layout, setLayout] = useState({
    textWidth: CONTENT_WIDTH,
    lineHeight: 1.2,
    columns: 1,
    fontSize: 13
  });

  const rendererProps = {
    editingId, setEditingId, updateTextById, updateSectionTitle,
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
    onTyping: setTyping,
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
      TITLE_RESERVED,
      layout.columns
    );
  }, [numberedDoc, leafHeights, headerHeights, layout.columns]);

  // After a re-pagination, if the paragraph being typed in re-mounted on another
  // page (so it lost focus), re-focus it with the caret at the end — the cursor
  // follows the text to the next page.
  useLayoutEffect(() => {
    const id = typingRef.current;
    if (!id) return;
    const el = document.querySelector(`[data-leaf-id="${id}"] .blox-editable`) as HTMLElement | null;
    if (el && document.activeElement !== el) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
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

    setLeafHeights  (prev => heightsUnchanged(prev, lh) ? prev : lh);
    setHeaderHeights(prev => heightsUnchanged(prev, hh) ? prev : hh);

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
          <Collapsible title="Typography">
            <NumberControl
              label="Text Width"
              value={layout.textWidth}
              min={300}
              max={CONTENT_WIDTH}
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
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
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
              </div>
            </div>
          </Collapsible>

          <Collapsible title="Blox">
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
          </Collapsible>

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
                  <Page key={pageIndex} pageNumber={pageIndex + 1}>

                    {/* Title sits on the body's first page (after any cover / TOC).
                        \maketitle: \LARGE (1.728×) Computer Modern, centered. */}
                    {pageIndex === titlePageIndex && (
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
                      const blockWidth = Math.min(layout.textWidth, CONTENT_WIDTH);

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
                        <div style={{ marginTop: 20, width: Math.min(layout.textWidth, CONTENT_WIDTH), marginLeft: "auto", marginRight: "auto" }}>
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

  function start(_preset?: string, rect?: DOMRect) {
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

  // Map the (full-size) page box back onto the clicked card, so we can animate a
  // single GPU-composited `transform` from card → page instead of janky
  // width/height/top/left reflows.
  let morphTransform = "none";
  if (origin && target && !grown) {
    const sx = origin.width / target.width;
    const sy = origin.height / target.height;
    const tx = origin.left - target.left;
    const ty = origin.top - target.top;
    morphTransform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
  }

  return (
    <>
      {showEditor && <Editor sidebarsIn={phase === "editor"} />}

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

      {origin && target && (
        <div
          style={{
            position: "fixed",
            left: target.left,
            top: target.top,
            width: target.width,
            height: target.height,
            background: "#ffffff",
            borderRadius: 8,
            boxShadow:
              "0 12px 40px rgba(20, 20, 50, 0.18), 0 2px 6px rgba(20, 20, 50, 0.06)",
            transformOrigin: "0 0",
            transform: morphTransform,
            opacity: overlayOn ? 1 : 0,
            transition: `transform 0.55s ${MORPH_EASE}, opacity 0.3s ease`,
            willChange: "transform, opacity",
            zIndex: 60,
            pointerEvents: "none"
          }}
        />
      )}
    </>
  );
}