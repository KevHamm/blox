import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";

export default function App() {
  const [doc, setDoc] = useState<DocumentNode>(sampleDocument);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  return (
    <div style={{ padding: "40px" }}>
      <button onClick={() => setDoc(sampleDocument)}>
        Reset
      </button>

      <button
        onClick={() => {
          setDoc((prev: any) => ({
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
          }));
        }}
      >
        Add Section
      </button>

      <hr style={{ margin: "20px 0" }} />

      <DocumentRenderer
        node={doc}
        editingId={editingId}
        setEditingId={setEditingId}
        updateTextById={updateTextById}
      />
    </div>
  );
}