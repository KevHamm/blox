import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import { BlockPalette } from "./components/BlockPalette";
import type { DocumentNode } from "./types/document";

import {
  DndContext,
  closestCenter
} from "@dnd-kit/core";

export default function App() {
  const [doc, setDoc] =
    useState<DocumentNode>(sampleDocument);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  // -----------------------------
  // UPDATE PARAGRAPH TEXT
  // -----------------------------
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

  // -----------------------------
  // UPDATE SECTION TITLE
  // -----------------------------
  function updateSectionTitle(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "section") {
        return { ...node, title: value };
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

  // -----------------------------
  // ADD PARAGRAPH
  // -----------------------------
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

  // -----------------------------
  // DELETE NODE
  // -----------------------------
  function deleteNodeById(id: string) {
    function remove(node: any): any {
      if (node.id === id) return null;

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

  // -----------------------------
  // ADD NEW BLOCK (from palette)
  // -----------------------------
  function insertNode(type: string) {
    setDoc((prev: any) => {
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

      return {
        ...prev,
        children: [...prev.children, newNode]
      };
    });
  }

  // -----------------------------
  // REORDER SECTIONS
  // -----------------------------
  function reorderSections(oldIndex: number, newIndex: number) {
    setDoc((prev: any) => {
      const updated = [...prev.children];

      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);

      return {
        ...prev,
        children: updated
      };
    });
  }

  // -----------------------------
  // MAIN DND HANDLER
  // -----------------------------
  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (!over) return;

    const isPaletteItem =
      active.data.current?.isPaletteItem;

    // CASE 1: insert from palette
    if (isPaletteItem) {
      insertNode(active.data.current.type);
      return;
    }

    // CASE 2: reorder sections
    const oldIndex = doc.children.findIndex(
      (c: any) => c.id === active.id
    );

    const newIndex = doc.children.findIndex(
      (c: any) => c.id === over.id
    );

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSections(oldIndex, newIndex);
    }
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
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
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
          }}
        >
          <DocumentRenderer
            node={doc}
            editingId={editingId}
            setEditingId={setEditingId}
            updateTextById={updateTextById}
            updateSectionTitle={updateSectionTitle}
            addParagraph={addParagraph}
            deleteNodeById={deleteNodeById}
            reorderSections={reorderSections}
          />
        </div>

        <BlockPalette
          onReset={() => setDoc(sampleDocument)}
        />
      </div>
    </DndContext>
  );
}