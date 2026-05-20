import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";

export default function App() {
  const [doc, setDoc] = useState<DocumentNode>(sampleDocument);

  return (
    <div style={{ padding: "40px" }}>
      <button
        onClick={() =>
          setDoc({
            type: "document",
            children: [
              {
                type: "section",
                title: "New Section",
                children: [{ type: "paragraph", text: "New paragraph" }],
              },
            ],
          })
        }
      >
        Reset Document
      </button>

      <button
        onClick={() => {
          setDoc((prev) => ({
            type: "document",
            children: [
              ...prev.children,
              {
                type: "section",
                title: "New Section",
                children: [
                  {
                    type: "paragraph",
                    text: "New paragraph",
                  },
                ],
              },
            ],
          }));
        }}
      >
        Add Section
      </button>
      <hr style={{ margin: "20px 0" }} />
      <DocumentRenderer node={doc} />
    </div>
  );
}
