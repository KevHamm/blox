export function indexDocument(doc: any) {
  let sectionCounter = 0;

  function walk(node: any, sectionIndex = 0) {
    if (!node) return node;

    if (node.type === "section") {
      sectionCounter++;
      sectionIndex = sectionCounter;

      let subsectionCounter = 0;

      return {
        ...node,
        sectionNumber: sectionIndex,
        children: node.children?.map((child: any) => {
          if (child.type === "subsection") {
            subsectionCounter++;

            return {
              ...child,
              sectionNumber: sectionIndex,
              subsectionNumber: subsectionCounter
            };
          }

          return walk(child, sectionIndex);
        })
      };
    }

    if (node.children) {
      return {
        ...node,
        children: node.children.map((child: any) =>
          walk(child, sectionIndex)
        )
      };
    }

    return node;
  }

  return walk(doc);
}