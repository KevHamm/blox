import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import { BlockPalette } from "./components/BlockPalette";
import type { DocumentNode } from "./types/document";

export default function App() {
  const [doc, setDoc] =
    useState<DocumentNode>(sampleDocument);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [dropTarget, setDropTarget] = useState<{
    id: string | null;
    position: "above" | "below" | null;
  }>({ id: null, position: null });

  // EDIT paragraph text
  function updateTextById(
    id: string,
    value: string
  ) {
    function update(node: any): any {
      if (
        node.id === id &&
        node.type === "paragraph"
      ) {
        return {
          ...node,
          text: value
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

  // ADD paragraph
  function addParagraph(sectionId: string) {
    function update(node: any): any {
      if (
        node.id === sectionId &&
        node.type === "section"
      ) {
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

  // DELETE node
  function deleteNodeById(id: string) {
    function remove(node: any): any {
      if (node.id === id) {
        return null;
      }

      if (node.children) {
        return {
          ...node,
          children: node.children
            .map(remove)
            .filter(Boolean)
        };
      }

      return node;
    }

    setDoc((prev) => remove(prev));
  }

  // MOVE node
   function moveNode(draggedId: string, targetId: string, position?: "above" | "below") {
    setDoc((prev: any) => {
      const clone = structuredClone(prev);

      let draggedNode: any = null;

      function remove(node: any): any {
        if (node.id === draggedId) {
          draggedNode = node;
          return null;
        }

        if (node.children) {
          node.children = node.children.map(remove).filter(Boolean);
        }

        return node;
      }

      remove(clone);

      function insert(node: any): any {
        if (!node.children) return node;

        const index = node.children.findIndex((c: any) => c.id === targetId);

        if (index !== -1 && draggedNode) {
          const insertIndex =
            position === "below" ? index + 1 : index;

          node.children.splice(insertIndex, 0, draggedNode);
          return node;
        }

        node.children = node.children.map(insert);
        return node;
      }

      return insert(clone);
    });
  }

  // CREATE new block from sidebar
  function createBlock(type: string) {
    console.log("CREATE BLOCK:", type);

    if (type === "section") {
      setDoc((prev) => ({
        ...prev,
        children: [
          ...prev.children,
          {
            id: crypto.randomUUID(),
            type: "section",
            title: "New Section",
            children: []
          }
        ]
      }));
    }

    if (type === "paragraph") {
      setDoc((prev) => ({
        ...prev,
        children: [
          ...prev.children,
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            text: "New paragraph"
          }
        ]
      }));
    }
  }

  return (
    <div
      style={{
        padding: "40px",
        paddingLeft: "260px",
        minHeight: "100vh"
      }}
    >
      <button
        onClick={() =>
          setDoc(sampleDocument)
        }
      >
        Reset
      </button>

      <hr
        style={{
          margin: "20px 0"
        }}
      />

      {/* DOCUMENT DROP ZONE */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();

          const blockType =
            e.dataTransfer.getData(
              "application/blox-block"
            );

          console.log(
            "DROPPED:",
            blockType
          );

          if (blockType) {
            createBlock(blockType);
          }
        }}
        style={{
          minHeight: "400px",
          padding: "20px",
          border: "2px dashed #ccc",
          borderRadius: "8px"
        }}
      >
        <DocumentRenderer
          node={doc}
          editingId={editingId}
          setEditingId={setEditingId}
          updateTextById={
            updateTextById
          }
          addParagraph={addParagraph}
          deleteNodeById={
            deleteNodeById
          }
          moveNode={moveNode}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
        />
      </div>

      <BlockPalette />
    </div>
  );
}