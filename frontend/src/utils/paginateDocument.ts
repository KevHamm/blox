import { PAGE_HEIGHT, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM } from './pageConfig';

const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

/**
 * Initial render: dump everything onto one page so we can measure it.
 */
export function paginateDocument(doc: any): any[][] {
  return [doc.children];
}

/**
 * Real pagination: called once we have measured DOM heights.
 */
export function paginateByHeights(
  doc: any,
  heights: Record<string, number>,
  firstPageReserved = 0   // pixels already consumed by the title on page 1
): any[][] {
  const pages: any[][] = [[]];
  let currentH = firstPageReserved;

  for (const section of doc.children) {
    const h = heights[section.id] ?? 200; // fallback estimate

    // Only break if the page already has content (avoid empty pages)
    if (currentH + h > CONTENT_HEIGHT && pages[pages.length - 1].length > 0) {
      pages.push([]);
      currentH = 0;
    }

    pages[pages.length - 1].push(section);
    currentH += h;
  }

  return pages;
}