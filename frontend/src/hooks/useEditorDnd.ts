import { useState } from "react";
import type { ShapeKind } from "../types/document";
import { BLOCK_DEFS, STRUCTURAL } from "../components/blocks";
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
  insertMathItem
} from "../utils/docTree";

type SetDoc = (updater: (prev: any) => any) => void;

type Deps = {
  doc: any;
  setDoc: SetDoc;
  images: { id: string; src: string; name: string }[];
  placeShapeFromDrag: (kind: ShapeKind, activatorEvent: any, delta: any) => void;
  setPendingFootnote: (v: boolean) => void;
};

/**
 * All editor drag-and-drop wiring: tracking what's being dragged (for the drag
 * overlay preview) and resolving every drop — shape Blox onto a page, structural
 * / block / math Blox into a drop zone, section reordering, and sidebar / figure
 * image moves. Returns the dnd-kit handlers plus the active-drag state.
 */
export function useEditorDnd({ doc, setDoc, images, placeShapeFromDrag, setPendingFootnote }: Deps) {
  // Source of the image currently being dragged (for the drag overlay preview).
  const [activeDragSrc, setActiveDragSrc] = useState<string | null>(null);
  // Id of the Blox block currently being dragged (for the drag overlay).
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

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

  function handleDragCancel() {
    setActiveDragSrc(null);
    setActiveBlockId(null);
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

  return { activeDragSrc, activeBlockId, handleDragStart, handleDragEnd, handleDragCancel };
}
