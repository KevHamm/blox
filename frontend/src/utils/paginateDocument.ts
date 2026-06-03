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
};
export type Column = Chunk[];
export type DocPage = Column[];

const CONTAINERS = new Set(["section", "subsection", "subsubsection"]);
export const isContainerType = (t: string) => CONTAINERS.has(t);

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
    children: isContainerType(node.type)
      ? (node.children ?? []).map(fullChunk)
      : []
  };
}

/**
 * Flow the document into fixed-height columns, splitting wherever needed — even
 * in the middle of a section, subsection or subsubsection. Columns are grouped
 * into pages of `columnsPerPage`.
 */
export function paginateColumns(
  doc: any,
  leafHeights:   Record<string, number>,
  headerHeights: Record<string, number>,
  titleReserved  = 0,
  columnsPerPage = 1
): DocPage[] {

  const columns: Chunk[][] = [[]];
  let used = 0;
  let stack: Chunk[] = [];   // open container chunks (root → deepest) in this column

  const capacityOf = (idx: number) =>
    CONTENT_HEIGHT - (idx < columnsPerPage ? titleReserved : 0);
  const capacity = () => capacityOf(columns.length - 1);

  const headerH = (node: any) => headerHeights[node.id] ?? 40;
  const leafH   = (node: any) => leafHeights[node.id] ?? 120;

  const appendChunk = (chunk: Chunk) => {
    if (stack.length) stack[stack.length - 1].children.push(chunk);
    else columns[columns.length - 1].push(chunk);
  };

  // Move to a fresh column, re-opening the current container path as
  // header-less continuations so nesting is preserved.
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
    if (chunk) chunk.isLast = true;   // the chunk in the final column is "last"
  };

  const placeLeaf = (node: any) => {
    const h = leafH(node);
    if (used > 0 && used + h > capacity()) startNewColumn();
    appendChunk({ node, header: false, isLast: true, children: [] });
    used += h;
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

  for (const section of doc.children ?? []) place(section);

  const pages: DocPage[] = [];
  for (let i = 0; i < columns.length; i += columnsPerPage) {
    const page = columns.slice(i, i + columnsPerPage);
    while (page.length < columnsPerPage) page.push([]);
    pages.push(page);
  }
  return pages;
}
