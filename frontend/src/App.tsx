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

  // REORDER paragraphs inside section
  function reorderSectionChildren(
    sectionId: string,
    oldIndex: number,
    newIndex: number
  ) {
    function update(node: any): any {
      if (
        node.id === sectionId &&
        node.type === "section"
      ) {
        const updatedChildren = [
          ...node.children
        ];

        const [moved] =
          updatedChildren.splice(
            oldIndex,
            1
          );

        updatedChildren.splice(
          newIndex,
          0,
          moved
        );

        return {
          ...node,
          children: updatedChildren
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
          reorderSectionChildren={
            reorderSectionChildren
          }
        />
      </div>

      <BlockPalette />
    </div>
  );
}