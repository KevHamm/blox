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

  // MOVE existing nodes
  function moveNode(
    draggedId: string,
    targetId: string,
    position?: "above" | "below"
  ) {
    setDoc((prev: any) => {
      const clone = structuredClone(prev);

      let draggedNode: any = null;

      function remove(node: any): any {
        if (node.id === draggedId) {
          draggedNode = node;
          return null;
        }

        if (node.children) {
          node.children = node.children
            .map(remove)
            .filter(Boolean);
        }

        return node;
      }

      remove(clone);

      function insert(node: any): any {
        if (!node.children) return node;

        const index = node.children.findIndex(
          (c: any) => c.id === targetId
        );

        if (index !== -1 && draggedNode) {
          const insertIndex =
            position === "below"
              ? index + 1
              : index;

          node.children.splice(
            insertIndex,
            0,
            draggedNode
          );

          return node;
        }

        node.children = node.children.map(insert);

        return node;
      }

      return insert(clone);
    });
  }

  // CREATE new blocks from palette
  function createBlock(
    type: string,
    targetId?: string,
    position?: "above" | "below"
  ) {
    const newNode =
      type === "section"
        ? {
            id: crypto.randomUUID(),
            type: "section",
            title: "New Section",
            children: []
          }
        : {
            id: crypto.randomUUID(),
            type: "paragraph",
            text: "New paragraph"
          };

    // APPEND if no target
    if (!targetId) {
      setDoc((prev: any) => ({
        ...prev,
        children: [...prev.children, newNode]
      }));

      return;
    }

    // INSERT near target
    setDoc((prev: any) => {
      const clone = structuredClone(prev);

      function insert(node: any): any {
        if (!node.children) return node;

        const index = node.children.findIndex(
          (c: any) => c.id === targetId
        );

        if (index !== -1) {
          const insertIndex =
            position === "below"
              ? index + 1
              : index;

          node.children.splice(
            insertIndex,
            0,
            newNode
          );

          return node;
        }

        node.children = node.children.map(insert);

        return node;
      }

      return insert(clone);
    });
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

      {/* DOCUMENT AREA */}
      <div
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
          createBlock={createBlock}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
        />
      </div>

      <BlockPalette />
    </div>
  );
}