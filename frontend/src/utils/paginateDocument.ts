export function paginateDocument(doc: any) {
  const pages: any[] = [];
  let currentPage: any[] = [];

  const MAX_NODES_PER_PAGE = 25; // temporary heuristic

  for (const node of doc.children) {
    if (currentPage.length >= MAX_NODES_PER_PAGE) {
      pages.push(currentPage);
      currentPage = [];
    }

    currentPage.push(node);
  }

  if (currentPage.length) pages.push(currentPage);

  return pages;
}

