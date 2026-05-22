import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import { BlockPalette } from "./components/BlockPalette";
import type { DocumentNode } from "./types/document";

import {
  DndContext,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

export default function App() {
  const [doc, setDoc] =
    useState<DocumentNode>(sampleDocument);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  // -----------------------------
  // DND SENSORS (CRITICAL FIX)
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );

  // -----------------------------
  // UPDATE PARAGRAPH
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
  // INSERT FROM PALETTE
  // -----------------------------
  function insertNode(type: string) {
    setDoc((prev: any) => {
      if (!prev || !prev.children) {
        console.error("Document root invalid:", prev);
        return prev;
      }

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

      const updated = {
        ...prev,
        children: [...prev.children, newNode]
      };

      console.log("INSERTED NODE:", newNode);
      console.log("UPDATED DOC:", updated);
      console.log("INSERT CALLED:", type);
      return updated;
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
  // REORDER PARAGRAPHS
  // -----------------------------
  function reorderSectionChildren(sectionId: string, oldIndex: number, newIndex: number) {
    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        const updated = [...node.children];

        const [moved] = updated.splice(oldIndex, 1);
        updated.splice(newIndex, 0, moved);

        return {
          ...node,
          children: updated
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
  // GLOBAL DND HANDLER
  // -----------------------------
  function handleDragEnd(event: any) {

    const { active, over } = event;


    console.log("DROP EVENT:", {
      active,
      over,
      data: active.data.current
    });

    if (!over) return;

    const data = active.data.current;

    // palette insert
    if (data?.isPaletteItem) {
      insertNode(data.type);
      return;
    }

    // paragraph reorder
    for (const section of doc.children) {
      const oldIndex = section.children?.findIndex(
        (c: any) => c.id === active.id
      );

      const newIndex = section.children?.findIndex(
        (c: any) => c.id === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSectionChildren(section.id, oldIndex, newIndex);
        return;
      }
    }

    // section reorder
    const oldSectionIndex = doc.children.findIndex(
      (c: any) => c.id === active.id
    );

    const newSectionIndex = doc.children.findIndex(
      (c: any) => c.id === over.id
    );

    if (oldSectionIndex !== -1 && newSectionIndex !== -1) {
      reorderSections(oldSectionIndex, newSectionIndex);
    }

  }

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
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
            reorderSectionChildren={reorderSectionChildren}
          />
        </div>

        <BlockPalette onReset={() => setDoc(sampleDocument)} />
      </div>
    </DndContext>
  );
}