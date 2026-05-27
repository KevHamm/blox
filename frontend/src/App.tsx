import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";
import "katex/dist/katex.min.css";

import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

export default function App() {
  const [doc, setDoc] = useState<DocumentNode>(sampleDocument);
  const [editingId, setEditingId] = useState<string | null>(null);

  // -----------------------------
  // LAYOUT STATE
  // -----------------------------
  const [layout, setLayout] = useState({
    textWidth: 650,
    lineHeight: 1.6
  });

  // -----------------------------
  // DND SENSORS
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
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
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }
    setDoc(prev => update(prev));
  }

  // -----------------------------
  // UPDATE TITLES
  // -----------------------------
  function updateSectionTitle(id: string, value: string) {
    function update(node: any): any {
      if (
        node.id === id &&
        (node.type === "section" || node.type === "subsection")
      ) {
        return { ...node, title: value };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }
    setDoc(prev => update(prev));
  }

  // -----------------------------
  // INSERT NODE
  // -----------------------------
  function insertNode(type: string) {
    const lorem =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

    const lorem_full =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

    setDoc(prev => {
      const newNode =
        type === "section"
          ? {
              id: crypto.randomUUID(),
              type: "section",
              title: "Section",
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
              text: lorem_full
            };

      return { ...prev, children: [...prev.children, newNode] };
    });
  }

  // -----------------------------
  // SUBSECTION
  // -----------------------------
  function addSubsection(sectionId: string) {
    const newNode = {
      id: crypto.randomUUID(),
      type: "subsection",
      title: "New Subsection",
      children: [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          text: "Lorem ipsum..."
        }
      ]
    };

    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return { ...node, children: [...node.children, newNode] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }

    setDoc(prev => update(prev));
  }

  // -----------------------------
  // TABLE
  // -----------------------------
  function addTable(sectionId: string) {
    const newTable = {
      id: crypto.randomUUID(),
      type: "table",
      rows: [
        ["Header 1", "Header 2"],
        ["Cell 1", "Cell 2"]
      ]
    };

    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return { ...node, children: [...node.children, newTable] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }

    setDoc(prev => update(prev));
  }

  // -----------------------------
  // TABLE CELL UPDATE
  // -----------------------------
  function updateTableCell(
    id: string,
    row: number,
    col: number,
    value: string
  ) {
    function update(node: any): any {
      if (node.id === id && node.type === "table") {
        const newRows = node.rows.map((r: any[], ri: number) =>
          ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
        );
        return { ...node, rows: newRows };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }
    setDoc(prev => update(prev));
  }

  // -----------------------------
  // DELETE NODE
  // -----------------------------
  function deleteNodeById(id: string) {
    function update(node: any): any {
      if (!node.children) return node;

      return {
        ...node,
        children: node.children
          .filter((c: any) => c.id !== id)
          .map(update)
      };
    }

    setDoc(prev => update(prev));
  }

  // -----------------------------
  // ADD ROW
  // -----------------------------
  function addTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 1;
        const newRow = Array(colCount).fill("New Cell");
        return { ...node, rows: [...node.rows, newRow] };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc(prev => update(prev));
  }

  // -----------------------------
  // DELETE LAST ROW
  // -----------------------------
  function deleteTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        if (node.rows.length <= 1) return node;
        return { ...node, rows: node.rows.slice(0, -1) };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc(prev => update(prev));
  }

  // -----------------------------
  // ADD COLUMN
  // -----------------------------
  function addTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;

        const newRows = node.rows.map((row: string[], rowIndex: number) => [
          ...row,
          rowIndex === 0
            ? `Header ${colCount + 1}`
            : `Cell ${rowIndex + 1}-${colCount + 1}`
        ]);

        return { ...node, rows: newRows };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc(prev => update(prev));
  }

  // -----------------------------
  // DELETE LAST COLUMN
  // -----------------------------
  function deleteTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;
        if (colCount <= 1) return node;

        const newRows = node.rows.map((row: string[]) =>
          row.slice(0, -1)
        );

        return { ...node, rows: newRows };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc(prev => update(prev));
  }

  // -----------------------------
  // ADD FIGURE (BLOCK ELEMENT)
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
                  src: url
                }
              ]
            };
          }

          if (node.children) return { ...node, children: node.children.map(update) };
          return node;
        }

        setDoc(prev => update(prev));
      };

      reader.readAsDataURL(file);
    };

    input.click();
  }

  // -----------------------------
  // DRAG END
  // -----------------------------
  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    function update(node: any): any {
      if (!node.children) return node;

      const oldIndex = node.children.findIndex(
        (c: any) => c.id === active.id
      );
      const newIndex = node.children.findIndex(
        (c: any) => c.id === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        const updated = [...node.children];
        const [moved] = updated.splice(oldIndex, 1);
        updated.splice(newIndex, 0, moved);
        return { ...node, children: updated };
      }

      return {
        ...node,
        children: node.children.map(update)
      };
    }

    setDoc(prev => update(prev));
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
          display: "flex",
          minHeight: "100vh",
          background: "#f3f3f3"
        }}
      >
        {/* ---------------- LEFT SIDEBAR ---------------- */}
        <div
          style={{
            width: 260,
            padding: 20,
            borderRight: "1px solid #ddd",
            background: "white"
          }}
        >
          <h3>Typography</h3>

          <label>Text Width</label>
          <input
            type="range"
            min={400}
            max={900}
            value={layout.textWidth}
            onChange={(e) =>
              setLayout({
                ...layout,
                textWidth: Number(e.target.value)
              })
            }
          />
          <div>{layout.textWidth}px</div>

          <hr />

          <label>Line Spacing</label>
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.1}
            value={layout.lineHeight}
            onChange={(e) =>
              setLayout({
                ...layout,
                lineHeight: Number(e.target.value)
              })
            }
          />
          <div>{layout.lineHeight}</div>
        </div>

        {/* ---------------- DOCUMENT AREA ---------------- */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: 40
          }}
        >
          {/* A4 PAGE */}
          <div
            style={{
              width: 794,
              padding: 40,
              background: "white",
              minHeight: "1123px",
              boxSizing: "border-box"
            }}
          >
            {/* TEXT COLUMN (THIS IS WHAT YOU CONTROL) */}
            <div
              style={{
                maxWidth: layout.textWidth,
                margin: "0 auto"
              }}
            >
              <button
                onClick={() => insertNode("section")}
                style={{ marginBottom: 20, padding: "8px 12px" }}
              >
                + Add Section
              </button>

              <DocumentRenderer
                node={doc}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
                updateSectionTitle={updateSectionTitle}
                addSubsection={addSubsection}
                addTable={addTable}
                addFigure={addFigure}
                updateTableCell={updateTableCell}
                deleteTableColumn={deleteTableColumn}
                deleteNodeById={deleteNodeById}
                addTableRow={addTableRow}
                deleteTableRow={deleteTableRow}
                addTableColumn={addTableColumn}
                lineHeight={layout.lineHeight}
              />
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}