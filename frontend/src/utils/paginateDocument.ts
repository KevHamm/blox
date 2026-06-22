import { PAGE_HEIGHT, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM } from './pageConfig';

const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

/**
 * A piece of a node that lands in one column. Containers (section / subsection
 * / subsubsection) may be split across columns: each split produces a chunk
 * with `header` = false for the continuation, and only the final chunk has
 * `isLast` = true (so trailing "add" controls render once).
 */
export type Chunk = {
  node: any;
  header: boolean;
  isLast: boolean;
  children: Chunk[];
  // For a paragraph that is split across columns/pages, the character range of
  // text rendered in this piece. Absent = the whole node.
  slice?: { start: number; end: number };
};
export type Column = Chunk[];
export type DocPage = Column[];

// Per-paragraph line geometry, measured from the DOM: each line's starting
// character offset and its cumulative bottom (px) from the paragraph's top.
export type LineInfo = { offset: number; bottom: number };
export type LineData = Record<string, LineInfo[]>;

const CONTAINERS = new Set(["section", "subsection", "subsubsection"]);
export const isContainerType = (t: string) => CONTAINERS.has(t);
// A beamer frame holds children like a container, but it is never split: each
// frame is laid out as exactly one page (one slide).
export const isFrameType = (t: string) => t === "frame";
// A node that always occupies exactly one page of its own, wherever it sits in
// the content run: beamer frames (slides) and imported design pages.
export const isOwnPageType = (t: string) => isFrameType(t) || t === "designpage";

function heightsUnchanged(
  prev: Record<string, number>,
  next: Record<string, number>
): boolean {
  const pk = Object.keys(prev), nk = Object.keys(next);
  if (pk.length !== nk.length) return false;
  return nk.every(k => Math.abs((prev[k] ?? -1) - next[k]) < 1);
}
export { heightsUnchanged };

/** A fully-placed chunk (used before any measurements exist). */
export function fullChunk(node: any): Chunk {
  return {
    node,
    header: true,
    isLast: true,
    children: isContainerType(node.type) || isFrameType(node.type)
      ? (node.children ?? []).map(fullChunk)
      : []
  };
}

// Special full-width pages that ignore column mode and break onto their own page.
const SPECIAL_PAGES = new Set(["coverpage", "toc", "bibliography"]);
export const isSpecialPage = (t: string) => SPECIAL_PAGES.has(t);

/** Flow a run of content nodes into pages of `columnsPerPage` columns. */
function paginateRun(
  nodes: any[],
  leafHeights:   Record<string, number>,
  headerHeights: Record<string, number>,
  lineData:      LineData,
  contentHeight: number,
  titleReserved: number,
  columnsPerPage: number
): DocPage[] {

  const columns: Chunk[][] = [[]];
  let used = 0;
  let stack: Chunk[] = [];   // open container chunks (root → deepest) in this column

  const capacityOf = (idx: number) =>
    contentHeight - (idx < columnsPerPage ? titleReserved : 0);
  const capacity = () => capacityOf(columns.length - 1);

  const headerH = (node: any) => headerHeights[node.id] ?? 40;
  const leafH   = (node: any) => leafHeights[node.id] ?? 120;

  const appendChunk = (chunk: Chunk) => {
    if (stack.length) stack[stack.length - 1].children.push(chunk);
    else columns[columns.length - 1].push(chunk);
  };

  const startNewColumn = () => {
    const openNodes = stack.map((c) => c.node);
    columns.push([]);
    used = 0;
    stack = [];
    for (const node of openNodes) {
      const cont: Chunk = { node, header: false, isLast: false, children: [] };
      appendChunk(cont);
      stack.push(cont);
    }
  };

  const openContainer = (node: any) => {
    const chunk: Chunk = { node, header: true, isLast: false, children: [] };
    appendChunk(chunk);
    stack.push(chunk);
    used += headerH(node);
  };

  const closeContainer = () => {
    const chunk = stack.pop();
    if (chunk) chunk.isLast = true;
  };

  const placeLeaf = (node: any) => {
    // Paragraphs with measured line geometry (and no footnotes) can be split
    // across columns/pages at line boundaries so they never overflow a page.
    const lines = node.type === "paragraph" && !node.footnotes?.length
      ? lineData[node.id]
      : undefined;

    if (!lines || lines.length <= 1) {
      const h = leafH(node);
      if (used > 0 && used + h > capacity()) startNewColumn();
      appendChunk({ node, header: false, isLast: true, children: [] });
      used += h;
      return;
    }

    const text: string = node.text ?? "";
    let startLine = 0;
    while (startLine < lines.length) {
      const topOffset = startLine === 0 ? 0 : lines[startLine - 1].bottom;
      const cap = capacity() - used;

      // How many of the remaining lines fit in the space left in this column.
      let endLine = startLine;
      while (endLine < lines.length && lines[endLine].bottom - topOffset <= cap) endLine++;

      if (endLine === startLine) {
        // Not even one more line fits here — move to a fresh column first.
        if (used > 0) { startNewColumn(); continue; }
        endLine = startLine + 1; // a single line taller than a column: place it anyway
      }

      const sStart = startLine === 0 ? 0 : lines[startLine].offset;
      const sEnd = endLine >= lines.length ? text.length : lines[endLine].offset;
      const isLastSlice = endLine >= lines.length;

      appendChunk({ node, header: false, isLast: isLastSlice, children: [], slice: { start: sStart, end: sEnd } });
      used += lines[endLine - 1].bottom - topOffset;
      startLine = endLine;
      if (!isLastSlice) startNewColumn();
    }
  };

  const placeContainer = (node: any) => {
    if (used > 0 && used + headerH(node) > capacity()) startNewColumn();
    openContainer(node);
    for (const c of node.children ?? []) place(c);
    closeContainer();
  };

  function place(node: any) {
    if (isContainerType(node.type)) placeContainer(node);
    else placeLeaf(node);
  }

  for (const node of nodes) place(node);

  const pages: DocPage[] = [];
  for (let i = 0; i < columns.length; i += columnsPerPage) {
    const page = columns.slice(i, i + columnsPerPage);
    while (page.length < columnsPerPage) page.push([]);
    pages.push(page);
  }
  return pages;
}

/**
 * Paginate the whole document. Cover page / table of contents / bibliography
 * each get their own single-column page (column mode is ignored for them); the
 * remaining section content flows in `columnsPerPage` columns. Every special
 * page forces a page break.
 */
export function paginateColumns(
  doc: any,
  leafHeights:   Record<string, number>,
  headerHeights: Record<string, number>,
  lineData:      LineData = {},
  contentHeight  = CONTENT_HEIGHT,
  titleReserved  = 0,
  columnsPerPage = 1
): DocPage[] {

  const children = doc.children ?? [];

  // Leading pages (cover, table of contents), the section body, then trailing
  // pages (bibliography). Order is already enforced when nodes are inserted.
  const before  = children.filter((c: any) => c.type === "coverpage" || c.type === "toc");
  const after   = children.filter((c: any) => c.type === "bibliography");
  const content = children.filter(
    (c: any) => c.type !== "coverpage" && c.type !== "toc" && c.type !== "bibliography"
  );

  const out: DocPage[] = [];

  for (const node of before) {
    out.push([[fullChunk(node)]]);   // each its own full-width page
  }

  // The document body is always present — at least one page, even when empty —
  // so a cover page always pushes the body to the next page. The body's first
  // page carries the document title, so it reserves room for it.
  //
  // Beamer frames and imported design pages each occupy their own page, so they
  // never split and never spill onto the next page. Any other content between
  // them still flows normally.
  if (content.some((c: any) => isOwnPageType(c.type))) {
    let run: any[] = [];
    const flush = () => {
      if (run.length) {
        out.push(...paginateRun(run, leafHeights, headerHeights, lineData, contentHeight, titleReserved, columnsPerPage));
        run = [];
      }
    };
    for (const node of content) {
      if (isOwnPageType(node.type)) { flush(); out.push([[fullChunk(node)]]); }
      else run.push(node);
    }
    flush();
  } else {
    out.push(...paginateRun(content, leafHeights, headerHeights, lineData, contentHeight, titleReserved, columnsPerPage));
  }

  for (const node of after) {
    out.push([[fullChunk(node)]]);
  }

  return out;
}
