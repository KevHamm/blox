import { PAGE_HEIGHT, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM } from './pageConfig';

const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

export type PageSection = {
  node: any;               // the section node
  children: any[];         // which children to render in this column
  isContinuation: boolean; // true = mid-section continuation, skip the header
  isLast: boolean;         // true = this chunk holds the section's final child
};

// A column is a list of section-chunks; a page is a list of columns.
export type Column = PageSection[];
export type DocPage = Column[];

function heightsUnchanged(
  prev: Record<string, number>,
  next: Record<string, number>
): boolean {
  const pk = Object.keys(prev), nk = Object.keys(next);
  if (pk.length !== nk.length) return false;
  return nk.every(k => Math.abs((prev[k] ?? -1) - next[k]) < 1);
}
export { heightsUnchanged };

/**
 * Flow the document into fixed-height COLUMNS, then group the columns into
 * pages (`columnsPerPage` columns each). Content fills a column top-to-bottom;
 * when it is full the next column starts; once a page's columns are all used a
 * new page begins. Sections taller than a column are split across the column
 * boundary at child granularity (just like a page break would).
 */
export function paginateColumns(
  doc: any,
  childHeights:   Record<string, number>,
  headerHeights:  Record<string, number>,
  titleReserved   = 0,
  columnsPerPage  = 1
): DocPage[] {

  const columns: Column[] = [[]];
  let used = 0;

  // The full-width title sits above every column on the first page, so each of
  // those leading columns loses the reserved title height.
  const capacityOf = (colIdx: number) =>
    CONTENT_HEIGHT - (colIdx < columnsPerPage ? titleReserved : 0);

  const startNewColumn = () => {
    columns.push([]);
    used = 0;
  };

  for (const section of doc.children) {
    const headerH = headerHeights[section.id] ?? 48;
    // Derive the section's total height from its header + children rather than
    // the section wrapper itself: a split section renders several wrappers that
    // all share `data-section-id`, so the measured wrapper height is unreliable.
    // Each child renders exactly once, so child heights are stable.
    const childrenH = section.children.reduce(
      (sum: number, c: any) => sum + (childHeights[c.id] ?? 100),
      0
    );
    const totalH   = headerH + childrenH;
    const capacity = capacityOf(columns.length - 1);

    // Whole section fits in the current column.
    if (used + totalH <= capacity) {
      columns[columns.length - 1].push({
        node: section, children: section.children,
        isContinuation: false, isLast: true,
      });
      used += totalH;
      continue;
    }

    // Otherwise split the section's children across columns.
    let remaining      = [...section.children];
    let isContinuation = false;

    while (remaining.length > 0) {
      const cap        = capacityOf(columns.length - 1);
      const headerCost = isContinuation ? 0 : headerH;

      // Not even room for the header here — move to the next column first.
      if (headerCost > cap - used && columns[columns.length - 1].length > 0) {
        startNewColumn();
        continue;
      }

      const available = cap - used;
      let chunkH      = headerCost;
      const chunk: any[] = [];

      for (const child of remaining) {
        const childH = childHeights[child.id] ?? 100;
        if (chunk.length === 0 || chunkH + childH <= available) {
          chunk.push(child);
          chunkH += childH;
        } else {
          break;
        }
      }

      if (chunk.length === 0) {
        chunk.push(remaining[0]);
        chunkH += childHeights[remaining[0].id] ?? 100;
      }

      remaining = remaining.slice(chunk.length);

      columns[columns.length - 1].push({
        node: section, children: chunk,
        isContinuation, isLast: remaining.length === 0,
      });
      used += chunkH;

      if (remaining.length > 0) {
        startNewColumn();
        isContinuation = true;
      }
    }
  }

  // Group columns into pages, padding the final page with empty columns so
  // every rendered column keeps the same width (and thus stable measurements).
  const pages: DocPage[] = [];
  for (let i = 0; i < columns.length; i += columnsPerPage) {
    const page = columns.slice(i, i + columnsPerPage);
    while (page.length < columnsPerPage) page.push([]);
    pages.push(page);
  }
  return pages;
}
