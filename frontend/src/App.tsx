import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";

export default function App() {
  const [doc, setDoc] = useState<DocumentNode>(sampleDocument);
  const [editingId, setEditingId] = useState<string | null>(null);

  // EDIT paragraph text by ID
  function updateTextById(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "paragraph") {
        return { ...node, text: value };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // ADD paragraph inside a section
  function addParagraph(sectionId: string) {
    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [
            ...node.children,
            {
              id: crypto.randomUUID(),
              type: "paragraph",
              text: "New paragraph"
            }
          ]
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  function deleteNodeById(id: string) {
    function remove(node: any): any {
      // If this is the node to delete → return null
      if (node.id === id) {
        return null;
      }

      // If it has children → recurse
      if (node.children) {
        const updatedChildren = node.children
          .map(remove)
          .filter(Boolean); // remove nulls

        return {
          ...node,
          children: updatedChildren
        };
      }

      return node;
    }

    setDoc((prev) => remove(prev));
  }

  return (
    <div style={{ padding: "40px" }}>
      <button onClick={() => setDoc(sampleDocument)}>
        Reset
      </button>

      <button
        onClick={() =>
          setDoc((prev) => ({
            ...prev,
            children: [
              ...prev.children,
              {
                id: crypto.randomUUID(),
                type: "section",
                title: "New Section",
                children: [
                  {
                    id: crypto.randomUUID(),
                    type: "paragraph",
                    text: "New paragraph"
                  }
                ]
              }
            ]
          }))
        }
      >
        Add Section
      </button>

      <hr style={{ margin: "20px 0" }} />

      <DocumentRenderer
        node={doc}
        editingId={editingId}
        setEditingId={setEditingId}
        updateTextById={updateTextById}
        addParagraph={addParagraph}
        deleteNodeById={deleteNodeById}
      />
    </div>
  );
}