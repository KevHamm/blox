import { DocumentNode } from "../types/document";

export function DocumentRenderer({ node }: { node: DocumentNode }) {
  switch (node.type) {
    case "document":
      return (
        <div>
          {node.children.map((c, i) => (
            <DocumentRenderer key={i} node={c} />
          ))}
        </div>
      );

    case "section":
      return (
        <div>
          <h2>{node.title}</h2>
          {node.children.map((c, i) => (
            <DocumentRenderer key={i} node={c} />
          ))}
        </div>
      );

    case "paragraph":
      return <p>{node.text}</p>;
  }
}