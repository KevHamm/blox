import { useState } from "react";
import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";
import type { DocumentNode } from "./types/document";
import { Page } from "./components/Page";
import {numberDocument} from "./utils/numberDocument";
import { useLayoutEffect, useMemo, useRef } from "react";
import { paginateByHeights, heightsUnchanged } from "./utils/paginateDocument";
import { exportLatex } from "./utils/exportLatex";
import "katex/dist/katex.min.css";

import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_PADDING_TOP,
  PAGE_PADDING_BOTTOM,
  CONTENT_WIDTH,
  COLUMN_GAP
} from "./utils/pageConfig";

export default function App() {
  // ── 1. All state first ──────────────────────────────────
  const [doc, setDoc] = useState<DocumentNode>(sampleDocument);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>({});
  const [childHeights,   setChildHeights]   = useState<Record<string, number>>({});
  const [headerHeights,  setHeaderHeights]  = useState<Record<string, number>>({});


  // layout must be declared before useLayoutEffect references it
  const [layout, setLayout] = useState({
    textWidth: 650,
    lineHeight: 1.6,
    columns: 1,
    fontSize: 16
  });

  const rendererProps = {
    editingId, setEditingId, updateTextById, updateSectionTitle,
    addSubsection, addTable, addFigure, updateTableCell,
    deleteTableColumn, deleteNodeById, addTableRow, deleteTableRow,
    addTableColumn, updateTableColWidths,
    lineHeight: layout.lineHeight, fontSize: layout.fontSize,
    moveSection, moveSubsection, updateFigureCaption,
  };

  // ── 2. Derived values ───────────────────────────────────
  const numberedDoc = numberDocument(doc);
  const TITLE_RESERVED = 100;   // constant, but must be above useMemo

  // ── 3. useMemo (uses layout + sectionHeights) ───────────
  const pages = useMemo(() => {
    if (Object.keys(sectionHeights).length === 0) {
      return [numberedDoc.children.map((node: any) => ({
        node, children: node.children, isContinuation: false,
      }))];
    }
    return paginateByHeights(
      numberedDoc,
      sectionHeights,
      childHeights,
      headerHeights,
      TITLE_RESERVED,
      layout.columns    // ← add this
    );
  }, [numberedDoc, sectionHeights, childHeights, headerHeights, layout.columns]);

  // ── 4. useLayoutEffect (uses layout + doc) ──────────────
  useLayoutEffect(() => {
    const sh: Record<string, number> = {};
    const ch: Record<string, number> = {};
    const hh: Record<string, number> = {};

    document.querySelectorAll<HTMLElement>("[data-section-id]")
      .forEach(el => { sh[el.dataset.sectionId!] = el.getBoundingClientRect().height; });

    document.querySelectorAll<HTMLElement>("[data-child-id]")
      .forEach(el => { ch[el.dataset.childId!] = el.getBoundingClientRect().height; });

    document.querySelectorAll<HTMLElement>("[data-section-header-id]")
      .forEach(el => { hh[el.dataset.sectionHeaderId!] = el.getBoundingClientRect().height; });

    setSectionHeights(prev => heightsUnchanged(prev, sh) ? prev : sh);
    setChildHeights  (prev => heightsUnchanged(prev, ch) ? prev : ch);
    setHeaderHeights (prev => heightsUnchanged(prev, hh) ? prev : hh);

  }, [doc, layout.textWidth, layout.fontSize, layout.lineHeight, layout.columns]);

  // per-page figure start offset so numbers are globally correct
  const figureStartPerPage = useMemo(() => {
    let count = 0;
    return pages.map(pageSections => {
      const start = count;
      pageSections.forEach(ps =>
        ps.children.forEach((c: any) => { if (c.type === "figure") count++; })
      );
      return start;
    });
  }, [pages]);

  // -----------------------------
  // DND SENSORS
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  // ----------------------------
  // LOREM TEXT
  // ----------------------------

  const lorem =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

  const lorem_full = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor" +
                     "incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation" +
                     "ullamco laboris nisi ut aliquid ex ea commodi consequat. Quisaute iure reprehenderit in" +
                     "voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat" +
                     "non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

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

    setDoc((prev) => update(prev));
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

    setDoc((prev) => update(prev));
  }

  function updateFigureCaption(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "figure") {
        return {
          ...node,
          caption: value
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
  // INSERT SECTION
  // -----------------------------
  function insertNode(type: string) {

    setDoc((prev) => {
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

      return {
        ...prev,
        children: [...prev.children, newNode]
      };
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
          text: lorem_full
        }
      ]
    };

    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [...node.children, newNode]
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
  // TABLE
  // -----------------------------
  function addTable(sectionId: string) {
    const newTable = {
      id: crypto.randomUUID(),
      type: "table",
      rows: [["Column 1", "Column 2"], ["", ""]]
    };

    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [...node.children, newTable]
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
          ri === row
            ? r.map((c, ci) => (ci === col ? value : c))
            : r
        );

        return {
          ...node,
          rows: newRows
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
    function update(node: any): any {
      if (!node.children) return node;

      return {
        ...node,
        children: node.children
          .filter((c: any) => c.id !== id)
          .map(update)
      };
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // ADD ROW
  // -----------------------------
  function addTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 1;

        const newRow = Array(colCount).fill("");

        return {
          ...node,
          rows: [...node.rows, newRow]
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
  // DELETE ROW
  // -----------------------------
  function deleteTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        if (node.rows.length <= 1) return node;

        return {
          ...node,
          rows: node.rows.slice(0, -1)
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
  // ADD COLUMN
  // -----------------------------
  function addTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;

        const newRows = node.rows.map(
          (row: string[], rowIndex: number) => [
            ...row,
            rowIndex === 0 ? `Column ${colCount + 1}` : ""
          ]
        );

        return {
          ...node,
          rows: newRows
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
  // RESIZE COLUMNS (drag)
  // -----------------------------
  // Widths are stored as fractions that always sum to 1, so the table keeps
  // filling exactly the text-column width no matter how the user drags.
  function updateTableColWidths(tableId: string, widths: number[]) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        return { ...node, colWidths: widths };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE COLUMN
  // -----------------------------
  function deleteTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;

        if (colCount <= 1) return node;

        return {
          ...node,
          rows: node.rows.map((row: string[]) =>
            row.slice(0, -1)
          )
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
  // FIGURE
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
                  caption: "New figure caption"
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
  // MOVE SECTION UP / DOWN
  // -----------------------------
  function moveSection(sectionId: string, direction: -1 | 1) {
    setDoc((prev) => {
      const index = prev.children.findIndex((c: any) => c.id === sectionId);
      if (index === -1) return prev;

      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.children.length) return prev;

      const updated = [...prev.children];
      const [moved] = updated.splice(index, 1);
      updated.splice(newIndex, 0, moved);

      return {
        ...prev,
        children: updated
      };
    });
  }

  // -----------------------------
  // MOVE SUBSECTION UP / DOWN
  // -----------------------------
  function moveSubsection(id: string, dir: -1 | 1) {
    setDoc((prev) => {
      const copy = structuredClone(prev);

      function findSection(node: any) {
        if (!node.children) return;

        // find subsection indexes INSIDE ORIGINAL CHILD ARRAY
        const subsectionIndexes = node.children
          .map((child: any, index: number) => ({
            child,
            index
          }))
          .filter((x: any) => x.child.type === "subsection");

        const currentSubIndex = subsectionIndexes.findIndex(
          (x: any) => x.child.id === id
        );

        // subsection not found here
        if (currentSubIndex === -1) {
          node.children.forEach(findSection);
          return;
        }

        const targetSubIndex = currentSubIndex + dir;

        // prevent moving outside subsection bounds
        if (
          targetSubIndex < 0 ||
          targetSubIndex >= subsectionIndexes.length
        ) {
          return;
        }

        // actual indexes in children[]
        const fromIndex = subsectionIndexes[currentSubIndex].index;
        const toIndex = subsectionIndexes[targetSubIndex].index;

        // swap ONLY subsection positions
        const updatedChildren = [...node.children];

        const temp = updatedChildren[fromIndex];
        updatedChildren[fromIndex] = updatedChildren[toIndex];
        updatedChildren[toIndex] = temp;

        node.children = updatedChildren;
      }

      findSection(copy);

      return copy;
    });
  }

  // -----------------------------
  // DRAG END
  // -----------------------------
  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (!over || active.id === over.id ) return;

    setDoc((prev) => {
      const oldIndex = prev.children.findIndex(
       (c: any) => c.id === active.id
      );

      const newIndex = prev.children.findIndex(
        (c: any) => c.id === over.id
      );

      if (oldIndex === -1 || newIndex === -1) return prev;

      const updated = [...prev.children];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);

      return {
        ...prev,
        children: updated
      };
    });
  }

  const CONTENT_H = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

  function splitColumns(sections: any[], pageIndex: number): [any[], any[]] {
    // Both columns start below the full-width title on the first page, so the
    // usable height of each column shrinks by the reserved title space there.
    const colH = CONTENT_H - (pageIndex === 0 ? TITLE_RESERVED : 0);

    let used = 0;
    for (let i = 0; i < sections.length; i++) {
      const h = sectionHeights[sections[i].node.id] ?? 200;
      // Fill the LEFT column top-to-bottom first; only once the next section
      // would overflow it do we spill the remainder into the right column.
      // (i > 0 guarantees at least one section stays on the left.)
      if (i > 0 && used + h > colH) {
        return [sections.slice(0, i), sections.slice(i)];
      }
      used += h;
    }
    return [sections, []]; // everything fit in the left column
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
        {/* SIDEBAR */}
        <div
          style={{
            width: 260,
            padding: 20,
            borderRight: "1px solid #ddd",
            background: "white",
            display: "flex",
            flexDirection: "column",
            height: "100hv"
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

          <hr />

          <label>Font Size</label>

          <input
            type="range"
            min={10}
            max={28}
            step={1}
            value={layout.fontSize}
            onChange={(e) =>
              setLayout({
                ...layout,
                fontSize: Number(e.target.value)
              })
            }
          />
          <div>{layout.fontSize}px</div>

          <hr />

          <label>Layout</label>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() =>
                setLayout({ ...layout, columns: 1 })
              }
            >
              1 column
            </button>

            <button
              onClick={() =>
                setLayout({ ...layout, columns: 2 })
              }
            >
              2 columns
            </button>



          </div>

          <div style={{ marginTop: "auto"}}>
            <hr />
            <button onClick={() => exportLatex(numberedDoc)}>
              Export LaTeX
            </button>
          </div>

        </div>


        {/* DOCUMENT */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: 40
          }}
        >
          <div
            style={{
              flex: 1,
              padding: 40,
              overflowY: "auto"
            }}
          >
                <div
                  style={{
                    width: PAGE_WIDTH,
                    margin: "20px auto",
                    textAlign: "center"
                  }}
                >
                  <button
                    onClick={() => insertNode("section")}
                    style={{
                      marginBottom: 20,
                      padding: "8px 12px"
                    }}
                  >
                    + Add Section
                  </button>
                </div>

                {pages.map((pageSections, pageIndex) => (
                  <Page key={pageIndex} pageNumber={pageIndex + 1} totalPages={pages.length}>

                    {/* Title always spans full width above the columns */}
                    {pageIndex === 0 && (
                      <div style={{ textAlign: "center", marginBottom: 40 }}>
                        <input
                          value={documentTitle}
                          onChange={(e) => setDocumentTitle(e.target.value)}
                          style={{ fontSize: 42, fontWeight: 400, border: "none",
                                   outline: "none", textAlign: "center", width: "100%" }}
                        />
                      </div>
                    )}

                    {(() => {
                      // The text block fills the area between the page margins,
                      // never wider than the page itself. The slider can narrow
                      // it further (widening the margins, LaTeX-style).
                      const blockWidth = Math.min(layout.textWidth, CONTENT_WIDTH);

                      if (layout.columns !== 2) {
                        return (
                          <div style={{ width: blockWidth, margin: "0 auto" }}>
                            <DocumentRenderer
                              droppableId="document-root"
                              pageSections={pageSections}
                              figureStart={figureStartPerPage[pageIndex]}
                              {...rendererProps}
                            />
                          </div>
                        );
                      }

                      const [left, right] = splitColumns(pageSections, pageIndex);
                      const leftFigCount = left
                        .flatMap((ps: any) => ps.children)
                        .filter((c: any) => c.type === "figure").length;

                      // Two equal columns inside the text block, separated by a
                      // gutter; each is (blockWidth - COLUMN_GAP) / 2.
                      return (
                        <div style={{ display: "flex", gap: COLUMN_GAP,
                                      width: blockWidth, margin: "0 auto" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <DocumentRenderer
                              droppableId={`left-${pageIndex}`}
                              pageSections={left}
                              figureStart={figureStartPerPage[pageIndex]}
                              {...rendererProps}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <DocumentRenderer
                              droppableId={`right-${pageIndex}`}
                              pageSections={right}
                              figureStart={figureStartPerPage[pageIndex] + leftFigCount}
                              {...rendererProps}
                            />
                          </div>
                        </div>
                      );
                    })()}

                  </Page>
                ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}