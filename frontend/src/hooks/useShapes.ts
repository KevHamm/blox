import { useState, useEffect } from "react";
import { getEventCoordinates } from "@dnd-kit/utilities";
import type { Shape, ShapeKind } from "../types/document";

type SetDoc = (updater: (prev: any) => any) => void;

/**
 * Free-form overlay shapes (lines / arrows / rects / circles) stored on
 * `doc.shapes`. Owns the current selection plus the create / edit / delete
 * operations and the "click-away to deselect" / "Delete-key to remove"
 * behaviours. Placement clamps to the page geometry from `layout`.
 */
export function useShapes(setDoc: SetDoc, layout: { pageWidth: number; pageHeight: number }) {
  // The free-form shape currently selected (shows its handles + toolbar).
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShapeId]);

  return { selectedShapeId, setSelectedShapeId, updateShape, deleteShape, placeShapeFromDrag };
}
