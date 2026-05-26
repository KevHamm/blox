import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import { BlockPalette } from "./components/BlockPalette";
import type { DocumentNode } from "./types/document";

import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

export default function App() {
  const [doc, setDoc] =
    useState<DocumentNode>(sampleDocument);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editingCaptionId, setEditingCaptionId] =
    useState<string | null>(null);

  // -----------------------------
  // DND SENSORS
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );

  // -----------------------------
  // UPDATE TEXT
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
  // ADD SUBSECTION
  // -----------------------------
  function addSubsection(sectionId: string) {
    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [
            ...node.children,
            {
              id: crypto.randomUUID(),
              type: "subsection",
              title: "Subsection",
              children: [
                {
                  id: crypto.randomUUID(),
                  type: "paragraph",
                  text:
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
                }
              ]
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
          children: node.children.map(remove).filter(Boolean)
        };
      }

      return node;
    }

    setDoc((prev) => remove(prev));
  }

  // -----------------------------
  // INSERT NODE (PALETTE)
  // -----------------------------
  function insertNode(type: string) {
    setDoc((prev: any) => {
      const lorem =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

      const newNode =
        type === "section"
          ? {
              id: crypto.randomUUID(),
              type: "section",
              title: "New Section",
              children: [
                {
                  id: crypto.randomUUID(),
                  type: "paragraph",
                  text: lorem
                }
              ]
            }
          : {
              id: crypto.randomUUID(),
              type: "paragraph",
              text: lorem
            };

      return {
        ...prev,
        children: [...prev.children, newNode]
      };
    });
  }

  // -----------------------------
  // TABLE
  // -----------------------------
  function addTable(sectionId: string) {
    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [
            ...node.children,
            {
              id: crypto.randomUUID(),
              type: "table",
              rows: [
                ["", "", ""],
                ["", "", ""],
                ["", "", ""]
              ]
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

  function updateTableCell(
    tableId: string,
    rowIndex: number,
    colIndex: number,
    value: string
  ) {
    function update(node: any): any {
      if (node.id === tableId) {
        const rows = [...node.rows];
        rows[rowIndex][colIndex] = value;
        return { ...node, rows };
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
  // FIGURE (UPLOAD)
  // -----------------------------
  function addFigure(sectionId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        const url = reader.result as string;

        function update(node: any): any {
          if (node.id === sectionId && node.type === "section") {
            return {
              ...node,
              children: [
                ...node.children,
                {
                  id: crypto.randomUUID(),
                  type: "figure",
                  src: url,
                  caption: "Figure caption",
                  x: 50,
                  y: 50,
                  width: 300,
                  height: 200
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
      };

      reader.readAsDataURL(file);
    };

    input.click();
  }

  // -----------------------------
  // FIGURE POSITION
  // -----------------------------
  function updateFigurePosition(id: string, x: number, y: number) {
    function update(node: any): any {
      if (node.id === id) return { ...node, x, y };

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
  // FIGURE SIZE
  // -----------------------------
  function updateFigureSize(
    id: string,
    width: number,
    height: number,
    x: number,
    y: number
  ) {
    function update(node: any): any {
      if (node.id === id) {
        return { ...node, width, height, x, y };
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
  // FIGURE CAPTION
  // -----------------------------
  function updateFigureCaption(id: string, caption: string) {
    function update(node: any): any {
      if (node.id === id) {
        return { ...node, caption };
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
  // REORDER SECTIONS
  // -----------------------------
  function reorderSections(oldIndex: number, newIndex: number) {
    setDoc((prev: any) => {
      const updated = [...prev.children];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);

      return { ...prev, children: updated };
    });
  }

  // -----------------------------
  // DRAG END
  // -----------------------------
  function handleDragEnd(event: any) {
    const { active, over } = event;
    const data = active?.data?.current;

    if (data?.isPaletteItem) {
      insertNode(data.type);
      return;
    }

    if (!over) return;

    const oldIndex = doc.children.findIndex((c: any) => c.id === active.id);
    const newIndex = doc.children.findIndex((c: any) => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSections(oldIndex, newIndex);
    }
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          background: "#f3f3f3",
          minHeight: "100vh",
          padding: 40,
          paddingLeft: 260
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            background: "white",
            minHeight: "90vh",
            padding: 40,
            textAlign: "left"
          }}
        >
          <DocumentRenderer
            node={doc}
            editingId={editingId}
            setEditingId={setEditingId}
            updateTextById={updateTextById}
            updateSectionTitle={updateSectionTitle}
            addSubsection={addSubsection}
            addTable={addTable}
            addFigure={addFigure}
            updateFigurePosition={updateFigurePosition}
            updateFigureSize={updateFigureSize}
            updateTableCell={updateTableCell}
            updateFigureCaption={updateFigureCaption}
            setEditingCaptionId={setEditingCaptionId}
            editingCaptionId={editingCaptionId}
            deleteNodeById={deleteNodeById}
          />
        </div>

        <BlockPalette onReset={() => setDoc(sampleDocument)} />
      </div>
    </DndContext>
  );
}