export function numberDocument(doc: any) {

  let sectionNumber = 0;

  return {
    ...doc,
    children: (doc.children ?? []).map((section: any) => {

      // Pages (cover / toc / bibliography / abstract) aren't numbered.
      if (section.type !== "section") return section;

      sectionNumber++;
      let subsectionNumber = 0;

      const newChildren = (section.children ?? []).map((child: any) => {

        if (child.type === "subsection") {
          subsectionNumber++;

          let subsubsectionNumber = 0;
          const subChildren = (child.children ?? []).map((gc: any) => {
            if (gc.type === "subsubsection") {
              subsubsectionNumber++;
              return {
                ...gc,
                // Title stays raw — the number is rendered as a separate label.
                numberLabel: `${sectionNumber}.${subsectionNumber}.${subsubsectionNumber}`
              };
            }
            return gc;
          });

          return {
            ...child,
            numberLabel: `${sectionNumber}.${subsectionNumber}`,
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
