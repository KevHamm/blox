import type { DocumentNode } from "../types/document";

/* -----------------------------------------------------------------
   Pure document-tree helpers — node factories and immutable edits.
   None of these touch React or the DOM; they take a document tree
   (or sub-node) and return a new one.
----------------------------------------------------------------- */

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

// A freshly dropped image fills the whole column width.
export const DEFAULT_FIG_WIDTH = 1;

/* ---- figure (image container) helpers ---- */
export function findFigureNode(node: any, figureId: string): any | null {
  if (node?.type === "figure" && node.id === figureId) return node;
  for (const c of node?.children ?? []) {
    const f = findFigureNode(c, figureId);
    if (f) return f;
  }
  return null;
}

export function findDocImageSrc(root: any, figureId: string, imageId: string): string | null {
  const fig = findFigureNode(root, figureId);
  const im = (fig?.images ?? []).find((x: any) => x.id === imageId);
  return im?.src ?? null;
}

// Where a figure sits: the id of its parent and its index among siblings.
export function locateFigure(node: any, figureId: string): { parentId: string; index: number } | null {
  const kids = node?.children ?? [];
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].id === figureId) return { parentId: node.id, index: i };
    const r = locateFigure(kids[i], figureId);
    if (r) return r;
  }
  return null;
}

// Remove one image from a figure; drop the figure entirely if it becomes empty.
export function removeFigureImage(node: any, figureId: string, imageId: string): any {
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
export function insertFigureImageAt(node: any, figureId: string, index: number, src: string): any {
  if (node.type === "figure" && node.id === figureId) {
    const imgs = [...(node.images ?? [])];
    imgs.splice(Math.min(Math.max(index, 0), imgs.length), 0, { id: crypto.randomUUID(), src });
    return { ...node, images: imgs };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertFigureImageAt(c, figureId, index, src)) };
}

export function insertFigure(node: any, containerId: string, index: number, src: string): any {
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

export function setFigureWidthTree(node: any, figureId: string, width: number): any {
  if (node.type === "figure" && node.id === figureId) return { ...node, width };
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => setFigureWidthTree(c, figureId, width)) };
}

// Insert any new node into a container at a given index.
export function insertNodeAt(node: any, containerId: string, index: number, newNode: any): any {
  if (node.id === containerId) {
    const kids = [...(node.children ?? [])];
    kids.splice(Math.min(Math.max(index, 0), kids.length), 0, newNode);
    return { ...node, children: kids };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertNodeAt(c, containerId, index, newNode)) };
}

/* ---- table colour helpers ---- */
// A colour grid normalized to the table's current rows (missing cells → null).
export function tableColors(node: any): (string | null)[][] {
  return (node.rows ?? []).map((row: string[], r: number) =>
    row.map((_: string, c: number) => node.colors?.[r]?.[c] ?? null)
  );
}
// The shared colour of a row/column, or null if they aren't all the same.
export const uniformColor = (arr: (string | null)[]): string | null =>
  arr.length > 0 && arr[0] != null && arr.every((x) => x === arr[0]) ? arr[0] : null;

/* ---- structural node factories ---- */
export const newParagraph = (): DocumentNode => ({
  id: crypto.randomUUID(),
  type: "paragraph",
  text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
});
export const newSection = (): DocumentNode => ({
  id: crypto.randomUUID(), type: "section", title: "Section", children: [newParagraph()]
});
export const newSubsection = (): DocumentNode => ({
  id: crypto.randomUUID(), type: "subsection", title: "New Subsection", children: [newParagraph()]
});
export const newSubsubsection = (): DocumentNode => ({
  id: crypto.randomUUID(), type: "subsubsection", title: "New Subsubsection", children: [newParagraph()]
});

/* ---- special pages ---- */
export const PAGE_LABELS: Record<string, string> = {
  coverpage: "Cover Page",
  toc: "Table of Contents",
  bibliography: "Bibliography"
};
export const newPage = (type: string): DocumentNode => ({
  id: crypto.randomUUID(),
  type: type as any,
  title: PAGE_LABELS[type]
});

// The abstract — a singleton that always sits between the title and the first
// section.
export const newAbstract = (): DocumentNode => ({
  id: crypto.randomUUID(),
  type: "abstract" as any,
  text: "Write a short summary of the document here."
});

// A generic displayed equation (LaTeX \begin{equation}…\end{equation}): a
// numbered math container you can type into and drop math blox inside. It starts
// with one empty part and is removed only via its delete button (not by being
// emptied), unlike a bare math node created by dropping a single symbol.
export const newEquation = (): DocumentNode => ({
  id: crypto.randomUUID(),
  type: "math" as any,
  display: true,
  items: [{ id: crypto.randomUUID(), latex: "" }]
});

// Find a node anywhere in the tree by id.
export function findNodeById(node: any, id: string): any | null {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = findNodeById(c, id);
    if (f) return f;
  }
  return null;
}

// Whether a node holds user content worth confirming before deletion.
export function nodeHasContent(node: any): boolean {
  switch (node?.type) {
    case "paragraph":
    case "abstract":
      return !!(node.text && node.text.trim());
    case "list":
      return (node.items ?? []).some((it: any) => (it.text ?? "").trim());
    case "math":
      return (node.items ?? []).some((it: any) => (it.latex ?? "").trim());
    case "table":
      return (node.rows ?? []).some((row: string[]) => row.some((c) => (c ?? "").trim()));
    case "figure":
      return (node.images ?? []).length > 0;
    case "section":
    case "subsection":
    case "subsubsection":
    case "frame":
      return !!(node.title && node.title.trim()) || (node.children ?? []).some(nodeHasContent);
    default:
      return false; // cover / toc / bibliography carry no body content
  }
}

// A list (LaTeX itemize / enumerate). `listStyle` picks the marker.
export const newList = (): DocumentNode => ({
  id: crypto.randomUUID(),
  type: "list" as any,
  listStyle: "dot",
  items: [
    { id: crypto.randomUUID(), text: "First item" },
    { id: crypto.randomUUID(), text: "Second item" }
  ]
});

/* ---- list edits ---- */
export function updateListItemTree(node: any, listId: string, itemId: string, text: string): any {
  if (node.type === "list" && node.id === listId) {
    return { ...node, items: (node.items ?? []).map((it: any) => (it.id === itemId ? { ...it, text } : it)) };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => updateListItemTree(c, listId, itemId, text)) };
}

// Insert a new empty item after `afterId` (or at the end when null).
export function addListItemTree(node: any, listId: string, afterId: string | null, newId: string): any {
  if (node.type === "list" && node.id === listId) {
    const items = [...(node.items ?? [])];
    const idx = afterId ? items.findIndex((it: any) => it.id === afterId) : items.length - 1;
    items.splice(idx + 1, 0, { id: newId, text: "" });
    return { ...node, items };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => addListItemTree(c, listId, afterId, newId)) };
}

// Remove an item; a list always keeps at least one.
export function deleteListItemTree(node: any, listId: string, itemId: string): any {
  if (node.type === "list" && node.id === listId) {
    const items = (node.items ?? []).filter((it: any) => it.id !== itemId);
    return { ...node, items: items.length ? items : node.items };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => deleteListItemTree(c, listId, itemId)) };
}

export function setListStyleTree(node: any, listId: string, style: "dash" | "dot" | "number"): any {
  if (node.type === "list" && node.id === listId) return { ...node, listStyle: style };
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => setListStyleTree(c, listId, style)) };
}

// Toggle a single internal grid separator of a table on/off, for custom tables.
// axis "v" = the line to the right of cell (r,c); "h" = the line below it.
export function toggleTableCellBorderTree(
  node: any,
  tableId: string,
  axis: "v" | "h",
  r: number,
  c: number
): any {
  if (node.type === "table" && node.id === tableId) {
    const field = axis === "v" ? "removedVBorders" : "removedHBorders";
    const key = `${r}:${c}`;
    const cur: string[] = node[field] ?? [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    return { ...node, [field]: next };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((ch: any) => toggleTableCellBorderTree(ch, tableId, axis, r, c)) };
}

// Document ordering: cover page → table of contents → abstract → sections →
// bibliography.
export const pageRank = (node: any): number => {
  switch (node.type) {
    case "coverpage": return 0;
    case "toc": return 1;
    case "abstract": return 2;
    case "bibliography": return 4;
    default: return 3; // sections / normal content
  }
};

// Insert a node into the document at the position dictated by its rank.
export function insertOrdered(doc: any, node: any): any {
  const kids = [...(doc.children ?? [])];
  const rank = pageRank(node);
  let i = kids.findIndex((k: any) => pageRank(k) > rank);
  if (i === -1) i = kids.length;
  kids.splice(i, 0, node);
  return { ...doc, children: kids };
}

// Cover page / TOC / bibliography are singletons — only one of each.
export function insertPage(doc: any, node: any): any {
  const kids = doc.children ?? [];
  if (kids.some((k: any) => k.type === node.type)) return doc;
  return insertOrdered(doc, node);
}

// Insert a new section directly before/after a given top-level section.
export function insertSectionRelative(doc: any, sectionId: string, where: "before" | "after"): any {
  const kids = [...(doc.children ?? [])];
  const i = kids.findIndex((c: any) => c.id === sectionId);
  if (i === -1) return doc;
  kids.splice(where === "before" ? i : i + 1, 0, newSection());
  return { ...doc, children: kids };
}

// A math block is a container of equation parts rendered flush together (so it
// reads as one equation). Dropping a math block onto a slot inserts a part at
// that position — including between two existing parts.
export const mathNode = (latex: string) => ({
  id: crypto.randomUUID(),
  type: "math",
  items: [{ id: crypto.randomUUID(), latex }]
});

// Arrow / harpoon symbols offered as math Blox (the command name is also the id
// suffix and the rendered glyph). Case-sensitive: "Leftarrow" ≠ "leftarrow".
export const ARROW_COMMANDS = [
  "leftarrow", "Leftarrow", "rightarrow", "Rightarrow",
  "leftrightarrow", "rightleftharpoons", "uparrow", "downarrow",
  "Uparrow", "Downarrow", "Leftrightarrow", "Updownarrow",
  "mapsto", "longmapsto", "nearrow", "searrow",
  "swarrow", "nwarrow", "leftharpoonup", "rightharpoonup",
  "leftharpoondown", "rightharpoondown"
];

// Default LaTeX for each math Blox block.
export const MATH_TEMPLATES: Record<string, string> = {
  "block::math::integral": "\\int_{a}^{b} f(x)\\,dx",
  "block::math::sum": "\\sum_{i=1}^{n} a_i",
  "block::math::product": "\\prod_{i=1}^{n} a_i",
  "block::math::fraction": "\\frac{a}{b}",
  "block::math::matrix": "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"
};
// Each arrow symbol is just its command.
for (const c of ARROW_COMMANDS) MATH_TEMPLATES[`block::math::${c}`] = `\\${c}`;

// Path of nodes from the document root down to (and including) the node with id.
export function pathTo(node: any, id: string, acc: any[] = []): any[] | null {
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
export function insertStructuralAt(doc: any, containerId: string, index: number, kind: string): any {
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
export function insertMathItem(node: any, mathId: string, index: number, latex: string): any {
  if (node.type === "math" && node.id === mathId) {
    const items = [...(node.items ?? [])];
    items.splice(Math.min(Math.max(index, 0), items.length), 0, { id: crypto.randomUUID(), latex });
    return { ...node, items };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => insertMathItem(c, mathId, index, latex)) };
}

export function updateMathItemTree(node: any, mathId: string, itemId: string, latex: string): any {
  if (node.type === "math" && node.id === mathId) {
    return { ...node, items: (node.items ?? []).map((it: any) => it.id === itemId ? { ...it, latex } : it) };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => updateMathItemTree(c, mathId, itemId, latex)) };
}

/* ---- footnotes (attached to a word inside a paragraph) ---- */
// Attach a new footnote to the given word index of a paragraph.
export function addFootnoteToWord(node: any, paragraphId: string, word: number, id: string): any {
  if (node.type === "paragraph" && node.id === paragraphId) {
    const footnotes = [...(node.footnotes ?? []), { id, word, text: "" }];
    return { ...node, footnotes };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => addFootnoteToWord(c, paragraphId, word, id)) };
}

export function updateFootnoteText(node: any, paragraphId: string, footnoteId: string, text: string): any {
  if (node.type === "paragraph" && node.id === paragraphId) {
    return {
      ...node,
      footnotes: (node.footnotes ?? []).map((f: any) => (f.id === footnoteId ? { ...f, text } : f))
    };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => updateFootnoteText(c, paragraphId, footnoteId, text)) };
}

export function deleteFootnote(node: any, paragraphId: string, footnoteId: string): any {
  if (node.type === "paragraph" && node.id === paragraphId) {
    return { ...node, footnotes: (node.footnotes ?? []).filter((f: any) => f.id !== footnoteId) };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c: any) => deleteFootnote(c, paragraphId, footnoteId)) };
}

// A map of footnote id → global number, assigned in document reading order
// (paragraph order, then by word index within a paragraph).
export function footnoteNumbering(doc: any): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 0;
  const walk = (node: any) => {
    if (node.type === "paragraph" && node.footnotes?.length) {
      [...node.footnotes]
        .sort((a: any, b: any) => a.word - b.word)
        .forEach((f: any) => { map[f.id] = ++n; });
    }
    (node.children ?? []).forEach(walk);
  };
  walk(doc);
  return map;
}

// Remove an equation part; drop the whole math block when its last part is gone.
export function deleteMathItemTree(node: any, mathId: string, itemId: string): any {
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
