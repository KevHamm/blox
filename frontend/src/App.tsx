import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";
import { Page } from "./components/Page";
import { TrashIcon } from "./components/TrashIcon";
import { numberDocument } from "./utils/numberDocument";
import { paginateColumns, fullChunk, heightsUnchanged } from "./utils/paginateDocument";
import { exportLatex } from "./utils/exportLatex";
import katex from "katex";
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
import { getEventCoordinates } from "@dnd-kit/utilities";

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

// A freshly dropped image fills the whole column width.
const DEFAULT_FIG_WIDTH = 1;

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

// Insert an image into a figure at a given slot. The stored `width` (the
// intended per-image width) is left untouched — the renderer caps the visible
// size at 1/n so the row always fits, and the remembered width is restored
// when images are removed again.
function insertFigureImageAt(node: any, figureId: string, index: number, src: string): any {
  if (node.type === "figure" && node.id === figureId) {
    const imgs = [...(node.images ?? [])];
    imgs.splice(Math.min(Math.max(index, 0), imgs.length), 0, { id: crypto.randomUUID(), src });
    return { ...node, images: imgs };
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

// Insert any new node into a container at a given index.
function insertNodeAt(node: any, containerId: string, index: number, newNode: any): any {
  if (node.id === containerId) {
    const kids = [...(node.children ?? [])];
    kids.splice(Math.min(Math.max(index, 0), kids.length), 0, newNode);
    return { ...node, children: kids };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertNodeAt(c, containerId, index, newNode)) };
}

/* ---- structural node factories ---- */
const newParagraph = () => ({
  id: crypto.randomUUID(),
  type: "paragraph",
  text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
});
const newSection = () => ({
  id: crypto.randomUUID(), type: "section", title: "Section", children: [newParagraph()]
});
const newSubsection = () => ({
  id: crypto.randomUUID(), type: "subsection", title: "New Subsection", children: [newParagraph()]
});
const newSubsubsection = () => ({
  id: crypto.randomUUID(), type: "subsubsection", title: "New Subsubsection", children: [newParagraph()]
});

// A math block is a container of equation parts rendered flush together (so it
// reads as one equation). Dropping a math block onto a slot inserts a part at
// that position — including between two existing parts.
const mathNode = (latex: string) => ({
  id: crypto.randomUUID(),
  type: "math",
  items: [{ id: crypto.randomUUID(), latex }]
});

// Default LaTeX for each math Blox block.
const MATH_TEMPLATES: Record<string, string> = {
  "block::math::integral": "\\int_{a}^{b} f(x)\\,dx",
  "block::math::sum": "\\sum_{i=1}^{n} a_i",
  "block::math::product": "\\prod_{i=1}^{n} a_i",
  "block::math::fraction": "\\frac{a}{b}",
  "block::math::matrix": "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"
};

const mathBlock = (id: string, label: string, iconTex: string, iconSize = 22) => ({
  label,
  icon: () => <KatexIcon tex={iconTex} size={iconSize} />,
  make: () => mathNode(MATH_TEMPLATES[id])
});

// A heading glyph for the structural Blox items; the bar shrinks with depth.
function HeadingGlyph({ level }: { level: number }) {
  const headW = level === 1 ? 26 : level === 2 ? 20 : 15;
  const headH = level === 1 ? 6 : level === 2 ? 5 : 4;
  const y2 = 4 + headH + 5;
  return (
    <svg width="34" height="30" viewBox="0 0 34 30">
      <rect x="4" y="4" width={headW} height={headH} rx="1" fill="currentColor" />
      <rect x="4" y={y2} width="26" height="2.5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="4" y={y2 + 5} width="26" height="2.5" rx="1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

// Blox palette: block id → label, palette icon and a fresh-node factory.
const BLOCK_DEFS: Record<string, { label: string; icon: () => any; make: () => any }> = {
  "block::section":       { label: "Section",       icon: () => <HeadingGlyph level={1} />, make: () => newSection() },
  "block::subsection":    { label: "Subsection",    icon: () => <HeadingGlyph level={2} />, make: () => newSubsection() },
  "block::subsubsection": { label: "Subsubsection", icon: () => <HeadingGlyph level={3} />, make: () => newSubsubsection() },
  "block::table": {
    label: "Table",
    icon: () => <TableGlyph />,
    make: () => ({
      id: crypto.randomUUID(),
      type: "table",
      rows: Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (r === 0 ? `Column ${c + 1}` : ""))
      )
    })
  },
  "block::math::integral": mathBlock("block::math::integral", "Integral", "\\int"),
  "block::math::sum":      mathBlock("block::math::sum", "Sum", "\\sum"),
  "block::math::product":  mathBlock("block::math::product", "Product", "\\prod"),
  "block::math::fraction": mathBlock("block::math::fraction", "Fraction", "\\frac{a}{b}"),
  "block::math::matrix":   mathBlock("block::math::matrix", "Matrix", "\\left[\\begin{smallmatrix}a&b\\\\c&d\\end{smallmatrix}\\right]", 15)
};

// Structural blocks land at the correct hierarchy level, not literally at the
// drop index.
const STRUCTURAL: Record<string, "section" | "subsection" | "subsubsection"> = {
  "block::section": "section",
  "block::subsection": "subsection",
  "block::subsubsection": "subsubsection"
};

const BLOX_ORDER = [
  "block::section",
  "block::subsection",
  "block::subsubsection",
  "block::table",
  "block::math::integral",
  "block::math::sum",
  "block::math::product",
  "block::math::fraction",
  "block::math::matrix"
];

// Path of nodes from the document root down to (and including) the node with id.
function pathTo(node: any, id: string, acc: any[] = []): any[] | null {
  const next = [...acc, node];
  if (node.id === id) return next;
  for (const c of node.children ?? []) {
    const r = pathTo(c, id, next);
    if (r) return r;
  }
  return null;
}

// Insert a section / subsection / subsubsection at the correct level relative
// to the drop zone's container.
function insertStructuralAt(doc: any, containerId: string, index: number, kind: string): any {
  const path = pathTo(doc, containerId);
  if (!path) return doc;
  const container = path[path.length - 1];

  if (kind === "section") {
    const top = path.find((n: any) => n.type === "section");
    if (!top) return insertNodeAt(doc, doc.id, index, newSection());
    const di = (doc.children ?? []).findIndex((c: any) => c.id === top.id);
    return insertNodeAt(doc, doc.id, di + 1, newSection());
  }

  if (kind === "subsection") {
    const section = [...path].reverse().find((n: any) => n.type === "section");
    if (!section) return doc;
    if (container.id === section.id) return insertNodeAt(doc, section.id, index, newSubsection());
    const childOfSection = path[path.indexOf(section) + 1];
    const ci = (section.children ?? []).findIndex((c: any) => c.id === childOfSection.id);
    return insertNodeAt(doc, section.id, ci + 1, newSubsection());
  }

  if (kind === "subsubsection") {
    const subsection = [...path].reverse().find((n: any) => n.type === "subsection");
    if (!subsection) return doc;          // needs a subsection to live in
    if (container.id === subsection.id) return insertNodeAt(doc, subsection.id, index, newSubsubsection());
    const childOfSub = path[path.indexOf(subsection) + 1];
    const ci = (subsection.children ?? []).findIndex((c: any) => c.id === childOfSub.id);
    return insertNodeAt(doc, subsection.id, ci + 1, newSubsubsection());
  }
  return doc;
}

/* ---- math tree edits ---- */
// Insert an equation part at a given slot index (0..items.length).
function insertMathItem(node: any, mathId: string, index: number, latex: string): any {
  if (node.type === "math" && node.id === mathId) {
    const items = [...(node.items ?? [])];
    items.splice(Math.min(Math.max(index, 0), items.length), 0, { id: crypto.randomUUID(), latex });
    return { ...node, items };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertMathItem(c, mathId, index, latex)) };
}

function updateMathItemTree(node: any, mathId: string, itemId: string, latex: string): any {
  if (node.type === "math" && node.id === mathId) {
    return { ...node, items: (node.items ?? []).map((it: any) => it.id === itemId ? { ...it, latex } : it) };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => updateMathItemTree(c, mathId, itemId, latex)) };
}

// Remove an equation part; drop the whole math block when its last part is gone.
function deleteMathItemTree(node: any, mathId: string, itemId: string): any {
  if (!node.children) return node;
  const children: any[] = [];
  for (const child of node.children) {
    if (child.type === "math" && child.id === mathId) {
      const items = (child.items ?? []).filter((it: any) => it.id !== itemId);
      if (items.length > 0) children.push({ ...child, items });
    } else {
      children.push(deleteMathItemTree(child, mathId, itemId));
    }
  }
  return { ...node, children };
}

/* A KaTeX-rendered glyph for the Blox palette icons. */
function KatexIcon({ tex, size = 22 }: { tex: string; size?: number }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false }),
    [tex]
  );
  return (
    <span
      style={{ fontSize: size, lineHeight: 1, color: "#333" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* Small line-art table icon for the Blox palette. */
function TableGlyph() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="3" y1="14.5" x2="21" y2="14.5" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

/* A page glyph filled with solid text blocks, in one or two columns. */
function LayoutIcon({ columns }: { columns: number }) {
  const pageW = 40, pageH = 50, pad = 6, top = 7, lineH = 3, gap = 3, rows = 6;
  const bars: any[] = [];
  if (columns === 1) {
    const w = pageW - pad * 2;
    for (let i = 0; i < rows; i++)
      bars.push(<rect key={i} x={pad} y={top + i * (lineH + gap)} width={w} height={lineH} rx={1} fill="currentColor" />);
  } else {
    const colW = (pageW - pad * 3) / 2;
    for (const c of [0, 1]) {
      const x = pad + c * (colW + pad);
      for (let i = 0; i < rows; i++)
        bars.push(<rect key={`${c}-${i}`} x={x} y={top + i * (lineH + gap)} width={colW} height={lineH} rx={1} fill="currentColor" />);
    }
  }
  return (
    <svg width={pageW} height={pageH} viewBox={`0 0 ${pageW} ${pageH}`}>
      <rect x={0.5} y={0.5} width={pageW - 1} height={pageH - 1} rx={3} fill="white" stroke="currentColor" strokeWidth={1} />
      {bars}
    </svg>
  );
}

/* The visual box for a Blox item: an icon with a label below it. */
function BlockBox({ id, shadow }: { id: string; shadow?: boolean }) {
  const def = BLOCK_DEFS[id];
  if (!def) return null;
  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "10px 6px",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        color: "#333",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: shadow ? "0 4px 12px rgba(0,0,0,0.25)" : undefined
      }}
    >
      {/* fixed-height icon area keeps every Blox item the same size */}
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        {def.icon()}
      </div>
      <span style={{ fontSize: 12 }}>{def.label}</span>
    </div>
  );
}

/* A draggable Blox item. */
function DraggableBlock({ id }: { id: string }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
    >
      <BlockBox id={id} />
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
  // Id of the Blox block currently being dragged (for the drag overlay).
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);


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
    deleteFigureImage, updateMathItem, deleteMathItem,
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

  // Edit / delete an individual equation part within a math block.
  function updateMathItem(mathId: string, itemId: string, latex: string) {
    setDoc((prev) => updateMathItemTree(prev, mathId, itemId, latex));
  }
  function deleteMathItem(mathId: string, itemId: string) {
    setDoc((prev) => deleteMathItemTree(prev, mathId, itemId));
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

      // Section / Subsection / Subsubsection → insert at the right hierarchy level.
      const kind = STRUCTURAL[activeBlockId];
      if (kind) {
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

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {[1, 2].map((c) => (
              <button
                key={c}
                onClick={() => setLayout({ ...layout, columns: c })}
                title={c === 1 ? "One column" : "Two columns"}
                style={{
                  padding: 6,
                  lineHeight: 0,
                  cursor: "pointer",
                  borderRadius: 6,
                  color: "#444",
                  border:
                    layout.columns === c
                      ? "2px solid var(--accent)"
                      : "1px solid #ccc",
                  background:
                    layout.columns === c ? "var(--accent-bg)" : "white"
                }}
              >
                <LayoutIcon columns={c} />
              </button>
            ))}
          </div>

          <hr />

          <h3 style={{ marginBottom: 0 }}>Blox</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {BLOX_ORDER.map((id) => (
              <DraggableBlock key={id} id={id} />
            ))}
          </div>

          <div style={{ marginTop: "auto"}}>
            <hr />
            <button onClick={() => exportLatex(numberedDoc)}>
              Export LaTeX
            </button>
          </div>

        </div>


        {/* DOCUMENT */}
        <div
          className="doc-area"
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
              opacity: 0.9
            }}
          />
        ) : activeBlockId ? (
          <div style={{ width: 104 }}>
            <BlockBox id={activeBlockId} shadow />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}