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

  function addSection() {
    setDoc((prev: any) => {
      const sectionCount =
        prev.children.length + 1;

      return {
        ...prev,
        children: [
          ...prev.children,
          {
            id: crypto.randomUUID(),
            type: "section",
            title: `${sectionCount}. Section`,
            children: []
          }
        ]
      };
    });
  }

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

  function reorderSections(
    oldIndex: number,
    newIndex: number
  ) {
    setDoc((prev: any) => {
      const updated = [
        ...prev.children
      ];

      const [moved] =
        updated.splice(oldIndex, 1);

      updated.splice(
        newIndex,
        0,
        moved
      );

      return {
        ...prev,
        children: updated
      };
    });
  }

  return (
    <div
      style={{
        background: "#f3f3f3",
        minHeight: "100vh",
        padding: "40px",
        paddingLeft: "260px"
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          background: "white",
          minHeight: "90vh",
          padding: 40,
          boxShadow:
            "0 2px 12px rgba(0,0,0,0.08)"
        }}
      >
        <button
          onClick={addSection}
          style={{
            marginBottom: 20
          }}
        >
          + Add Section
        </button>

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
          reorderSections={
            reorderSections
          }
        />
      </div>

      <BlockPalette
        onReset={() =>
          setDoc(sampleDocument)
        }
      />
    </div>
  );
}