import { PAGE_HEIGHT, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM } from './pageConfig';

const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

export type PageSection = {
  node: any;               // the section node
  children: any[];         // which children to render on this page
  isContinuation: boolean; // true = this is a mid-section continuation, skip the header
};

function heightsUnchanged(
  prev: Record<string, number>,
  next: Record<string, number>
): boolean {
  const pk = Object.keys(prev), nk = Object.keys(next);
  if (pk.length !== nk.length) return false;
  return nk.every(k => Math.abs((prev[k] ?? -1) - next[k]) < 1);
}
export { heightsUnchanged };

export function paginateByHeights(
  doc: any,
  sectionHeights: Record<string, number>,
  childHeights:   Record<string, number>,
  headerHeights:  Record<string, number>,
  firstPageReserved = 0
): PageSection[][] {
  const pages: PageSection[][] = [[]];
  let currentH = firstPageReserved;

  for (const section of doc.children) {
    const totalH  = sectionHeights[section.id] ?? 300;
    const headerH = headerHeights[section.id]  ?? 48;

    // ── whole section fits on the current page ──────────────────────
    if (currentH + totalH <= CONTENT_HEIGHT) {
      pages[pages.length - 1].push({
        node: section,
        children: section.children,
        isContinuation: false,
      });
      currentH += totalH;
      continue;
    }

    // ── section needs splitting across pages ─────────────────────────
    let remaining     = [...section.children];
    let isContinuation = false;

    while (remaining.length > 0) {
      const headerCost = isContinuation ? 0 : headerH;
      const spaceLeft  = CONTENT_HEIGHT - currentH;

      // Header alone doesn't fit on a non-empty page → start a new page
      if (headerCost > spaceLeft && pages[pages.length - 1].length > 0) {
        pages.push([]);
        currentH = 0;
        continue;
      }

      // Greedily pack children into available space
      const available = CONTENT_HEIGHT - currentH;
      let used        = headerCost;
      const chunk: any[] = [];

      for (const child of remaining) {
        const childH = childHeights[child.id] ?? 100;
        // Always take at least one child so we never loop forever
        if (chunk.length === 0 || used + childH <= available) {
          chunk.push(child);
          used += childH;
        } else {
          break;
        }
      }

      pages[pages.length - 1].push({
        node: section,
        children: chunk,
        isContinuation,
      });
      currentH  += used;
      remaining  = remaining.slice(chunk.length);

      if (remaining.length > 0) {
        pages.push([]);
        currentH       = 0;
        isContinuation = true;   // next chunk of this section has no header
      }
    }
  }

  return pages;
}