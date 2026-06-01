export function numberDocument(doc) {

  function stripPrefix(title: string) {
    return title.replace(/(\d+(\.\d+)+\s*)+/g, "").trim();
  }

  let sectionNumber = 0;

  return {
    ...doc,
    children: doc.children.map(section => {

      sectionNumber++;
      let subsectionNumber = 0;

      const newChildren = section.children.map(child => {

        if (child.type === "subsection") {
          subsectionNumber++;

          return {
            ...child,
            title: `${sectionNumber}.${subsectionNumber} ${stripPrefix(child.title)}`
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