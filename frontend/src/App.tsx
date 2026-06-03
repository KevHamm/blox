import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";
import { Page } from "./components/Page";
import { TrashIcon } from "./components/TrashIcon";
import { numberDocument } from "./utils/numberDocument";
import { paginateColumns, fullChunk, heightsUnchanged } from "./utils/paginateDocument";
import { exportLatex } from "./utils/exportLatex";
import "katex/dist/katex.min.css";

import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  MeasuringStrategy
} from "@dnd-kit/core";

import {
  CONTENT_WIDTH,
  COLUMN_GAP
} from "./utils/pageConfig";

/* A sidebar image the user can drag into the document or delete. */
function DraggableImage({ img, onDelete }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `image::${img.id}`
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        position: "relative",
        textAlign: "center",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1
      }}
    >
      <button
        onClick={() => onDelete(img.id)}
        onPointerDown={(e) => e.stopPropagation()}
        title="Delete image"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "inline-flex",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "none",
          borderRadius: 4,
          padding: 3,
          cursor: "pointer",
          zIndex: 1
        }}
      >
        <TrashIcon size={14} />
      </button>

      <img
        src={img.src}
        alt={img.name}
        draggable={false}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: 4,
          border: "1px solid #ddd",
          display: "block",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: "#444",
          wordBreak: "break-word"
        }}
      >
        {img.name}
      </div>
    </div>
  );
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

// Default per-image width (fraction of the text column) for a new figure.
const DEFAULT_FIG_WIDTH = 0.6;

/* -----------------------------------------------------------------
   Pure document-tree helpers for figure (image container) editing.
----------------------------------------------------------------- */
function findFigureNode(node: any, figureId: string): any | null {
  if (node?.type === "figure" && node.id === figureId) return node;
  for (const c of node?.children ?? []) {
    const f = findFigureNode(c, figureId);
    if (f) return f;
  }
  return null;
}

function findDocImageSrc(root: any, figureId: string, imageId: string): string | null {
  const fig = findFigureNode(root, figureId);
  const im = (fig?.images ?? []).find((x: any) => x.id === imageId);
  return im?.src ?? null;
}

// Where a figure sits: the id of its parent and its index among siblings.
function locateFigure(node: any, figureId: string): { parentId: string; index: number } | null {
  const kids = node?.children ?? [];
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].id === figureId) return { parentId: node.id, index: i };
    const r = locateFigure(kids[i], figureId);
    if (r) return r;
  }
  return null;
}

// Remove one image from a figure; drop the figure entirely if it becomes empty.
function removeFigureImage(node: any, figureId: string, imageId: string): any {
  if (!node.children) return node;
  const children: any[] = [];
  for (const child of node.children) {
    if (child.type === "figure" && child.id === figureId) {
      const imgs = (child.images ?? []).filter((im: any) => im.id !== imageId);
      if (imgs.length > 0) children.push({ ...child, images: imgs });
    } else {
      children.push(removeFigureImage(child, figureId, imageId));
    }
  }
  return { ...node, children };
}

// Insert an image into a figure at a given slot, shrinking every image just
// enough that they all still fit across the column width.
function insertFigureImageAt(node: any, figureId: string, index: number, src: string): any {
  if (node.type === "figure" && node.id === figureId) {
    const imgs = [...(node.images ?? [])];
    imgs.splice(Math.min(Math.max(index, 0), imgs.length), 0, { id: crypto.randomUUID(), src });
    const width = Math.min(node.width ?? DEFAULT_FIG_WIDTH, 1 / imgs.length);
    return { ...node, images: imgs, width };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertFigureImageAt(c, figureId, index, src)) };
}

function insertFigure(node: any, containerId: string, index: number, src: string): any {
  if (node.id === containerId) {
    const fig = {
      id: crypto.randomUUID(),
      type: "figure",
      caption: "",
      width: DEFAULT_FIG_WIDTH,
      images: [{ id: crypto.randomUUID(), src }]
    };
    const kids = [...(node.children ?? [])];
    kids.splice(Math.min(Math.max(index, 0), kids.length), 0, fig);
    return { ...node, children: kids };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertFigure(c, containerId, index, src)) };
}

function setFigureWidthTree(node: any, figureId: string, width: number): any {
  if (node.type === "figure" && node.id === figureId) return { ...node, width };
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => setFigureWidthTree(c, figureId, width)) };
}

// Insert a fresh 3×3 table into a container at a given index.
function insertTableAt(node: any, containerId: string, index: number): any {
  if (node.id === containerId) {
    const table = {
      id: crypto.randomUUID(),
      type: "table",
      rows: Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (r === 0 ? `Column ${c + 1}` : ""))
      )
    };
    const kids = [...(node.children ?? [])];
    kids.splice(Math.min(Math.max(index, 0), kids.length), 0, table);
    return { ...node, children: kids };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertTableAt(c, containerId, index)) };
}

/* A draggable block in the "Blox" sidebar (e.g. a table). */
function DraggableBlock({ id, label }: any) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "10px 12px",
        background: "#fafafa",
        cursor: "grab",
        textAlign: "center",
        opacity: isDragging ? 0.5 : 1
      }}
    >
      {label}
    </div>
  );
}

/* A labelled slider paired with a typed number input. Both edit the same
   value and are clamped to [min, max]. */
function NumberControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  // Local text so the user can type freely; committed (and clamped) on blur.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
    else setText(String(value));
  };

  return (
    <div>
      <label>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0 }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
          style={{ width: 64 }}
        />
        {unit && <span style={{ fontSize: 12, color: "#666" }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function App() {
  // ── 1. All state first ──────────────────────────────────
  const [doc, setDoc] = useState<DocumentNode>(sampleDocument);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  // Measured heights: every flow leaf (paragraph/table/figure) and every
  // container header (section/subsection/subsubsection).
  const [leafHeights,   setLeafHeights]   = useState<Record<string, number>>({});
  const [headerHeights, setHeaderHeights] = useState<Record<string, number>>({});

  // Images uploaded via the right sidebar (preview gallery).
  const [images, setImages] = useState<{ id: string; src: string; name: string }[]>([]);
  // Source of the image currently being dragged (for the drag overlay preview).
  const [activeDragSrc, setActiveDragSrc] = useState<string | null>(null);
  // Label of the Blox block currently being dragged (for the drag overlay).
  const [activeBlock, setActiveBlock] = useState<string | null>(null);


  // LaTeX-like defaults: text fills the margins, ~12pt body, tight leading.
  const [layout, setLayout] = useState({
    textWidth: CONTENT_WIDTH,
    lineHeight: 1.3,
    columns: 1,
    fontSize: 16
  });

  const rendererProps = {
    editingId, setEditingId, updateTextById, updateSectionTitle,
    addSubsection, addSubsubsection, updateTableCell,
    deleteTableColumn, deleteNodeById, addTableRow, deleteTableRow,
    addTableColumn, updateTableColWidths, addSectionAfter,
    lineHeight: layout.lineHeight, fontSize: layout.fontSize,
    moveSection, moveSubsection, updateFigureCaption, updateFigureWidth,
    deleteFigureImage,
  };

  // ── 2. Derived values ───────────────────────────────────
  const numberedDoc = numberDocument(doc);
  const TITLE_RESERVED = 100;   // constant, but must be above useMemo

  // ── 3. Paginate into columns/pages from measured heights ──
  // `pages[page][column]` is a list of chunks. Content flows left column →
  // right column → next page, and may break in the middle of any container.
  const pages = useMemo(() => {
    if (Object.keys(leafHeights).length === 0) {
      const page = [(numberedDoc.children ?? []).map(fullChunk)];
      while (page.length < layout.columns) page.push([]);
      return [page];
    }
    return paginateColumns(
      numberedDoc,
      leafHeights,
      headerHeights,
      TITLE_RESERVED,
      layout.columns
    );
  }, [numberedDoc, leafHeights, headerHeights, layout.columns]);

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

  // -----------------------------
  // DND SENSORS
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  // ----------------------------
  // LOREM TEXT
  // ----------------------------

  const lorem =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

  const lorem_full = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor" +
                     "incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation" +
                     "ullamco laboris nisi ut aliquid ex ea commodi consequat. Quisaute iure reprehenderit in" +
                     "voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat" +
                     "non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

  // -----------------------------
  // UPDATE TEXT
  // -----------------------------
  function updateTextById(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "paragraph") {
        return { ...node, text: value };
      }

      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // UPDATE TITLES
  // -----------------------------
  function updateSectionTitle(id: string, value: string) {
    function update(node: any): any {
      if (
        node.id === id &&
        (node.type === "section" || node.type === "subsection")
      ) {
        return { ...node, title: value };
      }

      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  function updateFigureCaption(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "figure") {
        return {
          ...node,
          caption: value
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }


  // -----------------------------
  // INSERT SECTION
  // -----------------------------

  // Insert a fresh section immediately after the given one.
  function addSectionAfter(sectionId: string) {
    setDoc((prev) => {
      const siblings = prev.children ?? [];
      const index = siblings.findIndex((c: any) => c.id === sectionId);
      if (index === -1) return prev;

      const newSection: DocumentNode = {
        id: crypto.randomUUID(),
        type: "section",
        title: "Section",
        children: [
          { id: crypto.randomUUID(), type: "paragraph", text: lorem }
        ]
      };

      const children = [...siblings];
      children.splice(index + 1, 0, newSection);
      return { ...prev, children };
    });
  }

  // Insert a fresh section at the very top of the document (under the title).
  function addSectionAtStart() {
    const newSection: DocumentNode = {
      id: crypto.randomUUID(),
      type: "section",
      title: "Section",
      children: [
        { id: crypto.randomUUID(), type: "paragraph", text: lorem }
      ]
    };

    setDoc((prev) => ({
      ...prev,
      children: [newSection, ...(prev.children ?? [])]
    }));
  }

  // Resize every image in a figure container (per-image fraction of column).
  function updateFigureWidth(figureId: string, width: number) {
    setDoc((prev) => setFigureWidthTree(prev, figureId, width));
  }

  // Remove an uploaded image from the sidebar gallery.
  function deleteImageUpload(imageId: string) {
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  // Delete a single image from a figure (drops the figure if it was the last).
  function deleteFigureImage(figureId: string, imageId: string) {
    setDoc((prev) => removeFigureImage(prev, figureId, imageId));
  }

  // -----------------------------
  // SUBSECTION
  // -----------------------------
  function addSubsection(sectionId: string) {
    const newNode = {
      id: crypto.randomUUID(),
      type: "subsection",
      title: "New Subsection",
      children: [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          text: lorem_full
        }
      ]
    };

    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [...node.children, newNode]
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // Append a subsubsection to the given subsection.
  function addSubsubsection(subsectionId: string) {
    const newNode = {
      id: crypto.randomUUID(),
      type: "subsubsection",
      title: "New Subsubsection",
      children: [
        { id: crypto.randomUUID(), type: "paragraph", text: lorem_full }
      ]
    };

    function update(node: any): any {
      if (node.id === subsectionId && node.type === "subsection") {
        return { ...node, children: [...(node.children ?? []), newNode] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // TABLE CELL UPDATE
  // -----------------------------
  function updateTableCell(
    id: string,
    row: number,
    col: number,
    value: string
  ) {
    function update(node: any): any {
      if (node.id === id && node.type === "table") {
        const newRows = node.rows.map((r: any[], ri: number) =>
          ri === row
            ? r.map((c, ci) => (ci === col ? value : c))
            : r
        );

        return {
          ...node,
          rows: newRows
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE NODE
  // -----------------------------
  function deleteNodeById(id: string) {
    function update(node: any): any {
      if (!node.children) return node;

      return {
        ...node,
        children: node.children
          .filter((c: any) => c.id !== id)
          .map(update)
      };
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // ADD ROW
  // -----------------------------
  function addTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 1;

        const newRow = Array(colCount).fill("");

        return {
          ...node,
          rows: [...node.rows, newRow]
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE ROW
  // -----------------------------
  function deleteTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        if (node.rows.length <= 1) return node;

        return {
          ...node,
          rows: node.rows.slice(0, -1)
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // ADD COLUMN
  // -----------------------------
  function addTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;

        const newRows = node.rows.map(
          (row: string[], rowIndex: number) => [
            ...row,
            rowIndex === 0 ? `Column ${colCount + 1}` : ""
          ]
        );

        return {
          ...node,
          rows: newRows
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // RESIZE COLUMNS (drag)
  // -----------------------------
  // Widths are stored as fractions that always sum to 1, so the table keeps
  // filling exactly the text-column width no matter how the user drags.
  function updateTableColWidths(tableId: string, widths: number[]) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        return { ...node, colWidths: widths };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE COLUMN
  // -----------------------------
  function deleteTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;

        if (colCount <= 1) return node;

        return {
          ...node,
          rows: node.rows.map((row: string[]) =>
            row.slice(0, -1)
          )
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
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
  // MOVE SECTION UP / DOWN
  // -----------------------------
  function moveSection(sectionId: string, direction: -1 | 1) {
    setDoc((prev) => {
      const siblings = prev.children ?? [];
      const index = siblings.findIndex((c: any) => c.id === sectionId);
      if (index === -1) return prev;

      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= siblings.length) return prev;

      const updated = [...siblings];
      const [moved] = updated.splice(index, 1);
      updated.splice(newIndex, 0, moved);

      return {
        ...prev,
        children: updated
      };
    });
  }

  // -----------------------------
  // MOVE SUBSECTION UP / DOWN
  // -----------------------------
  function moveSubsection(id: string, dir: -1 | 1) {
    setDoc((prev) => {
      const copy = structuredClone(prev);

      function findSection(node: any) {
        if (!node.children) return;

        // find subsection indexes INSIDE ORIGINAL CHILD ARRAY
        const subsectionIndexes = node.children
          .map((child: any, index: number) => ({
            child,
            index
          }))
          .filter((x: any) => x.child.type === "subsection");

        const currentSubIndex = subsectionIndexes.findIndex(
          (x: any) => x.child.id === id
        );

        // subsection not found here
        if (currentSubIndex === -1) {
          node.children.forEach(findSection);
          return;
        }

        const targetSubIndex = currentSubIndex + dir;

        // prevent moving outside subsection bounds
        if (
          targetSubIndex < 0 ||
          targetSubIndex >= subsectionIndexes.length
        ) {
          return;
        }

        // actual indexes in children[]
        const fromIndex = subsectionIndexes[currentSubIndex].index;
        const toIndex = subsectionIndexes[targetSubIndex].index;

        // swap ONLY subsection positions
        const updatedChildren = [...node.children];

        const temp = updatedChildren[fromIndex];
        updatedChildren[fromIndex] = updatedChildren[toIndex];
        updatedChildren[toIndex] = temp;

        node.children = updatedChildren;
      }

      findSection(copy);

      return copy;
    });
  }

  // -----------------------------
  // DRAG END
  // -----------------------------
  function handleDragStart(event: any) {
    const id = String(event.active.id);
    setActiveDragSrc(null);
    setActiveBlock(null);
    if (id.startsWith("image::")) {
      const img = images.find((i) => i.id === id.slice("image::".length));
      setActiveDragSrc(img?.src ?? null);
    } else if (id.startsWith("docimg::")) {
      const [, figId, imgId] = id.split("::");
      setActiveDragSrc(findDocImageSrc(doc, figId, imgId));
    } else if (id === "block::table") {
      setActiveBlock("Table");
    }
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    setActiveDragSrc(null);
    setActiveBlock(null);

    // A Blox block (e.g. a table) dropped into a between-block zone.
    if (String(active.id) === "block::table") {
      const overId = over ? String(over.id) : null;
      if (overId && overId.startsWith("dz::")) {
        const [, containerId, idxStr] = overId.split("::");
        setDoc((prev) => insertTableAt(prev, containerId, Number(idxStr)));
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
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDragSrc(null); setActiveBlock(null); }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "#f3f3f3"
        }}
      >
        {/* SIDEBAR */}
        <div
          style={{
            width: 280,
            padding: 20,
            borderRight: "1px solid #ddd",
            background: "white",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100vh",
            overflowY: "auto"
          }}
        >
          <h3>Typography</h3>

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

          <hr />

          <label>Layout</label>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() =>
                setLayout({ ...layout, columns: 1 })
              }
            >
              1 column
            </button>

            <button
              onClick={() =>
                setLayout({ ...layout, columns: 2 })
              }
            >
              2 columns
            </button>



          </div>

          <hr />

          <h3 style={{ marginBottom: 0 }}>Blox</h3>
          <DraggableBlock id="block::table" label="Table" />

          <div style={{ marginTop: "auto"}}>
            <hr />
            <button onClick={() => exportLatex(numberedDoc)}>
              Export LaTeX
            </button>
          </div>

        </div>


        {/* DOCUMENT */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 40,
            overflowY: "auto"
          }}
        >
                {pages.map((cols: any[], pageIndex: number) => (
                  <Page key={pageIndex} pageNumber={pageIndex + 1}>

                    {/* Title always spans full width above the columns */}
                    {pageIndex === 0 && (
                      <div style={{ textAlign: "center", marginBottom: 24 }}>
                        <input
                          value={documentTitle}
                          onChange={(e) => setDocumentTitle(e.target.value)}
                          style={{ fontSize: 42, fontWeight: 400, border: "none",
                                   outline: "none", textAlign: "center", width: "100%",
                                   fontFamily: "var(--sans)", color: "var(--text)",
                                   background: "transparent" }}
                        />

                        {/* Only offered while the document is empty; once a
                            section exists, sections are added via the buttons
                            at the end of each section. */}
                        {numberedDoc.children.length === 0 && (
                          <div style={{ marginTop: 8, marginBottom: 16 }}>
                            <button onClick={addSectionAtStart}>+ Add Section</button>
                          </div>
                        )}
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
                                {...rendererProps}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                  </Page>
                ))}
        </div>

        {/* RIGHT SIDEBAR — IMAGES */}
        <div
          style={{
            width: 260,
            padding: 20,
            borderLeft: "1px solid #ddd",
            background: "white",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100vh",
            overflowY: "auto"
          }}
        >
          <h3>Images</h3>

          <button onClick={uploadImage}>Upload image</button>

          {images.map((img) => (
            <DraggableImage key={img.id} img={img} onDelete={deleteImageUpload} />
          ))}
        </div>
      </div>

      {/* Floating preview of whatever is being dragged. */}
      <DragOverlay dropAnimation={null}>
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
              opacity: 0.9
            }}
          />
        ) : activeBlock ? (
          <div
            style={{
              padding: "10px 16px",
              border: "1px solid #4a90e2",
              borderRadius: 6,
              background: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              fontFamily: "var(--sans)"
            }}
          >
            {activeBlock}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}