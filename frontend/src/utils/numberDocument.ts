export function numberDocument(doc: any) {

  function stripPrefix(title: string) {
    return title.replace(/(\d+(\.\d+)+\s*)+/g, "").trim();
  }

  let sectionNumber = 0;

  return {
    ...doc,
    children: doc.children.map((section: any) => {

      sectionNumber++;
      let subsectionNumber = 0;

      const newChildren = section.children.map((child: any) => {

        if (child.type === "subsection") {
          subsectionNumber++;

          let subsubsectionNumber = 0;
          const subChildren = (child.children ?? []).map((gc: any) => {
            if (gc.type === "subsubsection") {
              subsubsectionNumber++;
              return {
                ...gc,
                title: `${sectionNumber}.${subsectionNumber}.${subsubsectionNumber} ${stripPrefix(gc.title)}`
              };
            }
            return gc;
          });

          return {
            ...child,
            title: `${sectionNumber}.${subsectionNumber} ${stripPrefix(child.title)}`,
            children: subChildren
          };
        }

        return child;
      });

      return {
        ...section,
        sectionNumber, // OK as derived value
        children: newChildren
      };
    })
  };
}