export function paginateDocument(doc: any) {
  const pages: any[] = [];
  let currentPage: any[] = [];

  const MAX_NODES_PER_PAGE = 5;

  let sectionCounter = 0;

  for (const node of doc.children) {

    if (node.type === "section") {
      sectionCounter++;

      currentPage.push({
        ...node,
        sectionNumber: sectionCounter
      });
    } else {
      currentPage.push(node);
    }

    if (currentPage.length >= MAX_NODES_PER_PAGE) {
      pages.push(currentPage);
      currentPage = [];
    }
  }

  if (currentPage.length) {
    pages.push(currentPage);
  }

  return pages;
}