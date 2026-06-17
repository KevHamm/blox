import { useEffect, useState } from "react";
import type { DesignElement, DesignElementKind, DesignPage } from "../types/design";

const uid = () => crypto.randomUUID();

// Default geometry/style for a freshly added element, centred on the page.
function makeElement(kind: DesignElementKind, page: DesignPage): DesignElement {
  const cx = page.pageWidth / 2;
  const cy = page.pageHeight / 2;
  const box = (w: number, h: number): Pick<DesignElement, "x" | "y" | "w" | "h"> => ({
    x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h
  });
  const base = { id: uid(), kind };
  if (kind === "text") {
    return { ...base, ...box(440, 80), text: "Your text", fontSize: 34, fontFamily: "cm",
             color: "#111111", align: "center", bold: false, italic: false, underline: false };
  }
  if (kind === "rect") {
    return { ...base, ...box(240, 150), fill: "#7c3aed", stroke: "#7c3aed", strokeWidth: 0 };
  }
  // line — a horizontal rule across the box's top→bottom diagonal (h=0 ⇒ flat).
  return { ...base, ...box(260, 0), stroke: "#111111", strokeWidth: 2 };
}

/**
 * Owns a free-form design page (the cover designer's state) plus undo/redo and
 * the current selection. Mirrors `useDocument`'s history model and `useShapes`'s
 * click-away / Delete-key behaviour, but over a flat list of absolutely
 * positioned `DesignElement`s rather than a document tree.
 */
export function useDesign(initial: DesignPage) {
  const [hist, setHist] = useState<{ past: DesignPage[]; present: DesignPage; future: DesignPage[] }>(
    () => ({ past: [], present: initial, future: [] })
  );
  const design = hist.present;

  // The currently selected element (shows its handles + toolbar). Not part of
  // history, so undo/redo never resurrect a stale selection box.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function setDesign(updater: DesignPage | ((prev: DesignPage) => DesignPage)) {
    setHist((h) => {
      const next = typeof updater === "function" ? (updater as any)(h.present) : updater;
      if (next === h.present) return h;
      return { past: [...h.past, h.present], present: next, future: [] };
    });
  }
  function undo() {
    setHist((h) => (h.past.length
      ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
      : h));
  }
  function redo() {
    setHist((h) => (h.future.length
      ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
      : h));
  }
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  // --- element operations (each is one undo step) -----------------------
  function addElement(kind: DesignElementKind) {
    const el = makeElement(kind, design);
    setDesign((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }
  // Add an image element sized to fit the page while keeping its aspect ratio.
  function addImage(src: string, naturalW: number, naturalH: number) {
    const maxW = design.pageWidth * 0.5;
    const maxH = design.pageHeight * 0.5;
    const ratio = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : 1;
    let w = Math.min(maxW, naturalW || maxW);
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const el: DesignElement = {
      id: uid(), kind: "image", src,
      x: Math.round((design.pageWidth - w) / 2), y: Math.round((design.pageHeight - h) / 2),
      w: Math.round(w), h: Math.round(h)
    };
    setDesign((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }
  function updateElement(id: string, patch: Partial<DesignElement>) {
    setDesign((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  function deleteElement(id: string) {
    setDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }
  function setBg(bg: string) { setDesign((d) => ({ ...d, bg })); }
  function setPageSize(pageWidth: number, pageHeight: number) {
    setDesign((d) => ({ ...d, pageWidth, pageHeight }));
  }

  // Deselect when clicking anything that isn't an element / its toolbar.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-design-el], [data-design-toolbar]")) return;
      setSelectedId(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  // Delete / Backspace removes the selected element (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const a = document.activeElement as HTMLElement | null;
        if (a && (a.isContentEditable || a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
        e.preventDefault();
        deleteElement(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return {
    design, setDesign, undo, redo, canUndo, canRedo,
    selectedId, setSelectedId,
    addElement, addImage, updateElement, deleteElement, setBg, setPageSize
  };
}
