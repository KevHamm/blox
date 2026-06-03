import { Fragment, useRef } from "react";
import type { PageSection } from "../utils/paginateDocument";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "katex/dist/katex.min.css";

/* -----------------------------
   SORTABLE WRAPPER (FIGURES ONLY)
----------------------------- */
function SortableItem({ id, children }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: 12,
        cursor: "grab"
      }}
    >
      {children}
    </div>
  );
}

/* -----------------------------
   DROP ZONE (image drop target)
----------------------------- */
function DropZone({ id }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();

  // Only reveal drop targets while an image is being dragged.
  const draggingImage =
    active != null && String(active.id).startsWith("image::");

  if (!draggingImage) {
    // Idle: zero-height so it never affects layout / pagination.
    return <div ref={setNodeRef} style={{ height: 0 }} />;
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        height: isOver ? 28 : 12,
        margin: "2px 0",
        borderRadius: 4,
        background: isOver ? "rgba(74,144,226,0.25)" : "rgba(74,144,226,0.08)",
        border: `1px dashed ${isOver ? "#4a90e2" : "rgba(74,144,226,0.4)"}`,
        transition: "height 0.08s ease"
      }}
    />
  );
}

/* -----------------------------
   PARAGRAPH
----------------------------- */
function Paragraph({
  node,
  editingId,
  setEditingId,
  updateTextById,
  lineHeight,
  fontSize
}: any) {
  const isEditing = editingId === node.id;

  return (
    <div style={{ padding: 6 }}>
      {isEditing ? (
        <textarea
          autoFocus
          value={node.text}
          onChange={(e) => updateTextById(node.id, e.target.value)}
          onBlur={() => setEditingId(null)}
          style={{
            width: "100%",
            minHeight: 120,
            padding: 8,
            border: "1px solid #ddd",
            lineHeight,
            fontSize
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{
            margin: 0,
            cursor: "pointer",
            lineHeight,
            fontSize
          }}
        >
          {node.text}
        </p>
      )}
    </div>
  );
}

/* -----------------------------
   FIGURE (KEEP DND)
----------------------------- */
function FigureBlock({
  node,
  deleteNodeById,
  updateFigureCaption,
  figureNumber
}: any) {
  return (
    <SortableItem id={node.id}>
      <div
        style={{
          border: "1px solid #ccc",
          background: "white",
          padding: 8,
          margin: "12px 0"
        }}
      >
        <button
          onClick={() => deleteNodeById(node.id)}
          style={{
            float: "right",
            background: "red",
            color: "white",
            border: "none",
            padding: "2px 6px"
          }}
        >
          ×
        </button>

        <img
          src={node.src}
          alt="figure"
          style={{
            width: "100%",
            height: "auto",
            display: "block"
          }}
        />

        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 14,
            fontStyle: "var(--sans)",
            color: "var(--text)"
          }}
        >
          <strong>Figure {figureNumber}:</strong>{" "}
          <input
            value={node.caption || ""}
            onChange={(e) =>
              updateFigureCaption(node.id, e.target.value)
            }
            style={{
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              width: "70%",
              textAlign: "center",
              fontStyle: "var(--sans)",
              background: "transparent",
              color: "var(--text)"
            }}
          />
        </div>
      </div>
    </SortableItem>
  );
}

/* -----------------------------
   TABLE (unchanged)
----------------------------- */
function TableBlock(props: any) {
  const {
    node,
    updateTableCell,
    deleteTableColumn,
    deleteNodeById,
    addTableRow,
    deleteTableRow,
    addTableColumn,
    updateTableColWidths
  } = props;

  const tableRef = useRef<HTMLTableElement>(null);

  const colCount = node.rows[0]?.length || 0;

  // Column widths are kept as fractions that always sum to 1, so the table
  // fills exactly the text-column width. Fall back to equal widths whenever
  // none are stored yet or a column was just added/removed.
  const widths: number[] =
    Array.isArray(node.colWidths) && node.colWidths.length === colCount
      ? node.colWidths
      : Array(colCount).fill(1 / colCount);

  const MIN = 0.05; // never let a column collapse completely

  function startResize(index: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const tableWidth = tableRef.current?.offsetWidth || 1;
    const startX = e.clientX;
    const startLeft = widths[index];
    const startRight = widths[index + 1];

    function onMove(ev: MouseEvent) {
      // Convert the pixel drag into a fraction, then trade width between this
      // column and its right neighbour so the total stays at 1 (no overflow).
      let delta = (ev.clientX - startX) / tableWidth;
      delta = Math.max(delta, MIN - startLeft);
      delta = Math.min(delta, startRight - MIN);

      const next = [...widths];
      next[index] = startLeft + delta;
      next[index + 1] = startRight - delta;
      updateTableColWidths(node.id, next);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => addTableRow(node.id)}>+ Row</button>
        <button onClick={() => deleteTableRow(node.id)}>– Row</button>
        <button onClick={() => addTableColumn(node.id)}>+ Column</button>
        <button onClick={() => deleteTableColumn(node.id)}>– Column</button>
        <button onClick={() => deleteNodeById(node.id)}>Delete</button>
      </div>

      <table
        ref={tableRef}
        style={{
          width: "100%",
          tableLayout: "fixed",     // honour our column widths, never auto-grow
          borderCollapse: "collapse",
          color: "#000",
          fontFamily: "var(--sans)"
        }}
      >
        <colgroup>
          {widths.map((w, c) => (
            <col key={c} style={{ width: `${w * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {node.rows.map((row: string[], r: number) => (
            <tr key={r}>
              {row.map((cell: string, c: number) => (
                <td
                  key={c}
                  style={{
                    border: "1px solid #ccc",
                    padding: 0,
                    position: "relative"
                  }}
                >
                  <input
                    value={cell}
                    onChange={(e) =>
                      updateTableCell(node.id, r, c, e.target.value)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "none",
                      outline: "none",
                      padding: "4px 6px",
                      background: "transparent",
                      color: "#000",
                      fontFamily: "var(--sans)"
                    }}
                  />

                  {/* drag handle straddling the right edge of each column */}
                  {c < colCount - 1 && (
                    <div
                      onMouseDown={(e) => startResize(c, e)}
                      style={{
                        position: "absolute",
                        top: 0,
                        right: -3,
                        width: 6,
                        height: "100%",
                        cursor: "col-resize",
                        userSelect: "none",
                        zIndex: 1
                      }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -----------------------------
   SUBSECTION (NO DND)
----------------------------- */
function Subsection({
  node,
  sectionIndex,
  subsectionIndex,
  editingId,
  setEditingId,
  updateSectionTitle,
  deleteNodeById,
  moveSubsection,
  children,
  lineHeight,
  fontSize
}: any) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center" }}>

        {/* MOVE BUTTONS */}
        <div style={{ display: "flex", gap: 6, marginRight: 10 }}>
          <button onClick={() => moveSubsection(node.id, -1)}>↑</button>
          <button onClick={() => moveSubsection(node.id, 1)}>↓</button>
        </div>

        {editingId === node.id ? (
          <input
            autoFocus
            value={node.title}
            onChange={(e) => updateSectionTitle(node.id, e.target.value)}
            onBlur={() => setEditingId(null)}
          />
        ) : (
          <h3 onClick={() => setEditingId(node.id)}>
            {node.title}
          </h3>
        )}

        <button
          onClick={() => deleteNodeById(node.id)}
          style={{ marginLeft: 10, background: "red", color: "white" }}
        >
          Delete Subsection
        </button>
      </div>

      {children}
    </div>
  );
}

/* -----------------------------
   SECTION (NO DND)
----------------------------- */
function Section({ node, isContinuation = false, isLast = false, ...rest }: any) {
  const {
    editingId, setEditingId, updateSectionTitle,
    addSubsection, addTable, addSectionAfter,
    deleteNodeById, moveSection, children
  } = rest;

  return (
    // ① tag the whole section
    <div data-section-id={node.id} style={{ marginBottom: 30 }}>

      {/* ② tag just the header row; hide it on continuation pages */}
      {!isContinuation && (
        <div
          data-section-header-id={node.id}
          style={{ display: "flex", alignItems: "center" }}
        >
          <div style={{ display: "flex", gap: 6, marginRight: 10 }}>
            <button onClick={() => moveSection(node.id, -1)}>↑</button>
            <button onClick={() => moveSection(node.id,  1)}>↓</button>
          </div>

          {editingId === node.id ? (
            <input
              value={node.title}
              onChange={e => updateSectionTitle(node.id, e.target.value)}
              onBlur={() => setEditingId(null)}
            />
          ) : (
            <h2 onClick={() => setEditingId(node.id)}>
              {node.sectionNumber} {node.title}
            </h2>
          )}

          <button onClick={() => addSubsection(node.id)}>+ Subsection</button>
          <button onClick={() => addTable(node.id)}>+ Table</button>
          <button
            onClick={() => deleteNodeById(node.id)}
            title="Delete section"
            aria-label="Delete section"
            style={{
              marginLeft: 10,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              background: "transparent",
              border: "none",
              color: "#c0392b",
              cursor: "pointer"
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}

      {children}

      {/* "Add Section" lives at the very end of the section, so a new section
          gets inserted exactly here. Only on the section's last chunk. */}
      {isLast && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => addSectionAfter(node.id)}>+ Add Section</button>
        </div>
      )}
    </div>
  );
}

/* -----------------------------
   DOCUMENT ROOT
----------------------------- */
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: props.droppableId ?? "document-root" });

  // figure numbering continues across sections on the same page
  let figureCounter = props.figureStart ?? 0;

  return (
    <div ref={setNodeRef}>
      {(props.pageSections as PageSection[]).map((ps, psIndex) => (
        <Section
          key={`${ps.node.id}-${psIndex}`}
          node={ps.node}
          isContinuation={ps.isContinuation}
          isLast={ps.isLast}
          {...props}   // spread all callbacks through
        >
          {ps.children.map((child: any) => {
            // Absolute index of this child within the *full* section, so a
            // dropped image lands at the right spot even on a split section.
            const absIndex = ps.node.children.findIndex(
              (c: any) => c.id === child.id
            );
            return (
              <Fragment key={child.id}>
                {/* drop an image above this block */}
                <DropZone id={`dz::${ps.node.id}::${absIndex}`} />

                {/* ③ tag every child so we can measure it independently */}
                <div data-child-id={child.id}>
                  {child.type === "paragraph" && (
                    <Paragraph node={child} {...props} />
                  )}
                  {child.type === "subsection" && (
                    <Subsection node={child} {...props}>
                      {child.children.map((p: any) => (
                        <Paragraph key={p.id} node={p} {...props} />
                      ))}
                    </Subsection>
                  )}
                  {child.type === "table" && (
                    <TableBlock node={child} {...props} />
                  )}
                  {child.type === "figure" && (
                    <FigureBlock
                      node={child}
                      deleteNodeById={props.deleteNodeById}
                      updateFigureCaption={props.updateFigureCaption}
                      figureNumber={++figureCounter}
                    />
                  )}
                </div>
              </Fragment>
            );
          })}

          {/* drop an image at the very end of the section */}
          {ps.isLast && (
            <DropZone id={`dz::${ps.node.id}::${ps.node.children.length}`} />
          )}
        </Section>
      ))}
    </div>
  );
}