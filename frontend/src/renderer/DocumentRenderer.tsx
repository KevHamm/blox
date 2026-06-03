import { Fragment, useRef } from "react";
import type { PageSection } from "../utils/paginateDocument";
import { useDroppable, useDraggable, useDndContext } from "@dnd-kit/core";
import { TrashIcon } from "../components/TrashIcon";
import "katex/dist/katex.min.css";

// True while dragging an image — either a sidebar upload (`image::`) or one
// already placed in the document (`docimg::`).
export const isImageDragId = (id: unknown) => {
  const s = String(id ?? "");
  return s.startsWith("image::") || s.startsWith("docimg::");
};

const clampFrac = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/* -----------------------------
   DROP ZONE (image drop target)
----------------------------- */
function DropZone({ id }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();

  // Only reveal drop targets while an image is being dragged.
  const draggingImage = isImageDragId(active?.id);

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

/* Vertical drop slot that appears to the left/right of images inside a figure
   container while an image is being dragged. */
function FigureDropZone({ id }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();
  const dragging = isImageDragId(active?.id);

  if (!dragging) {
    return <div ref={setNodeRef} style={{ width: 0 }} />;
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        width: isOver ? 30 : 16,
        alignSelf: "stretch",
        minHeight: 48,
        flexShrink: 0,
        borderRadius: 4,
        background: isOver ? "rgba(74,144,226,0.25)" : "rgba(74,144,226,0.08)",
        border: `1px dashed ${isOver ? "#4a90e2" : "rgba(74,144,226,0.4)"}`,
        transition: "width 0.08s ease"
      }}
    />
  );
}

/* -----------------------------
   TRASH BUTTON (right-aligned)
----------------------------- */
function TrashButton({ onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        marginLeft: "auto",          // push to the far right of the line
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
      <TrashIcon />
    </button>
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
            fontSize,
            fontFamily: "var(--sans)",
            color: "var(--text)"
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{
            margin: 0,
            cursor: "pointer",
            textAlign: "justify",
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
   FIGURE — a container of one or more equally-sized images that share a
   single caption. A single image is centered; resizing controls how wide each
   image is (and therefore whether another image can fit beside it).
----------------------------- */
function DocImage({ figureId, image, deleteFigureImage }: any) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `docimg::${figureId}::${image.id}`
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        flex: 1,
        minWidth: 0,
        position: "relative",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1
      }}
    >
      {/* per-image trash; stops the pointer from starting a drag */}
      <button
        onClick={() => deleteFigureImage(figureId, image.id)}
        onPointerDown={(e) => e.stopPropagation()}
        title="Delete image"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "inline-flex",
          padding: 3,
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          zIndex: 2
        }}
      >
        <TrashIcon size={14} />
      </button>

      <img
        src={image.src}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none" }}
      />
    </div>
  );
}

function FigureBlock({
  node,
  updateFigureCaption,
  updateFigureWidth,
  deleteFigureImage,
  figureNumber
}: any) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const images: any[] = node.images ?? [];
  const width: number = node.width ?? 0.6;        // per-image fraction of column
  const n = images.length || 1;
  const containerFrac = Math.min(1, n * width);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const colW = wrapperRef.current?.offsetWidth || 1;
    const startX = e.clientX;
    const startW = width;

    function onMove(ev: MouseEvent) {
      const dw = (ev.clientX - startX) / (colW * n);
      updateFigureWidth(node.id, clampFrac(startW + dw, 0.1, 1 / n));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div ref={wrapperRef} style={{ margin: "12px 0" }}>
      <div
        style={{
          width: `${containerFrac * 100}%`,
          margin: "0 auto",
          border: "1px solid #ccc",
          background: "white",
          padding: 8,
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* images, with a drop slot to the left/right of each one */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <FigureDropZone id={`figdz::${node.id}::0`} />
          {images.map((im, i) => (
            <Fragment key={im.id}>
              <DocImage
                figureId={node.id}
                image={im}
                deleteFigureImage={deleteFigureImage}
              />
              <FigureDropZone id={`figdz::${node.id}::${i + 1}`} />
            </Fragment>
          ))}
        </div>

        {/* drag the right edge to resize every image in the container */}
        <div
          onMouseDown={startResize}
          title="Resize"
          style={{
            position: "absolute",
            top: 0,
            right: -4,
            width: 8,
            height: "100%",
            cursor: "col-resize",
            zIndex: 2
          }}
        />

        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 14,
            fontFamily: "var(--sans)",
            color: "var(--text)"
          }}
        >
          <strong>Figure {figureNumber}:</strong>{" "}
          <input
            value={node.caption || ""}
            onChange={(e) => updateFigureCaption(node.id, e.target.value)}
            style={{
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              width: "70%",
              textAlign: "center",
              fontFamily: "var(--sans)",
              background: "transparent",
              color: "var(--text)"
            }}
          />
        </div>
      </div>
    </div>
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
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => addTableRow(node.id)}>+ Row</button>
        <button onClick={() => deleteTableRow(node.id)}>– Row</button>
        <button onClick={() => addTableColumn(node.id)}>+ Column</button>
        <button onClick={() => deleteTableColumn(node.id)}>– Column</button>
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete table" />
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
  editingId,
  setEditingId,
  updateSectionTitle,
  deleteNodeById,
  moveSubsection,
  addSubsubsection,
  children
}: any) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

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

        {/* MOVE BUTTONS — to the right of the title */}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => moveSubsection(node.id, -1)}>↑</button>
          <button onClick={() => moveSubsection(node.id, 1)}>↓</button>
        </div>

        <TrashButton
          onClick={() => deleteNodeById(node.id)}
          label="Delete subsection"
        />
      </div>

      {children}

      <div style={{ marginTop: 10 }}>
        <button onClick={() => addSubsubsection(node.id)}>+ Subsubsection</button>
      </div>
    </div>
  );
}

/* -----------------------------
   SUBSUBSECTION (NO DND)
----------------------------- */
function Subsubsection({
  node,
  editingId,
  setEditingId,
  updateSectionTitle,
  deleteNodeById,
  children
}: any) {
  return (
    <div style={{ marginTop: 16, marginLeft: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {editingId === node.id ? (
          <input
            autoFocus
            value={node.title}
            onChange={(e) => updateSectionTitle(node.id, e.target.value)}
            onBlur={() => setEditingId(null)}
          />
        ) : (
          <h4 style={{ margin: 0 }} onClick={() => setEditingId(node.id)}>
            {node.title}
          </h4>
        )}

        <TrashButton
          onClick={() => deleteNodeById(node.id)}
          label="Delete subsubsection"
        />
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

  const hasSubsections = (node.children ?? []).some(
    (c: any) => c.type === "subsection"
  );

  return (
    <div style={{ marginBottom: 30 }}>

      {/* Tag just the header row; hide it on continuation columns/pages. */}
      {!isContinuation && (
        <div
          data-section-header-id={node.id}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
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

          {/* MOVE BUTTONS — to the right of the title */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => moveSection(node.id, -1)}>↑</button>
            <button onClick={() => moveSection(node.id,  1)}>↓</button>
          </div>

          <button onClick={() => addTable(node.id)}>+ Table</button>

          <TrashButton
            onClick={() => deleteNodeById(node.id)}
            label="Delete section"
          />
        </div>
      )}

      {children}

      {/* End-of-section controls, only on the section's last chunk. */}
      {isLast && (
        <>
          {/* No subsections yet → offer "+ Subsection" right below the text. */}
          {!hasSubsections && (
            <div style={{ marginTop: 12 }}>
              <button onClick={() => addSubsection(node.id)}>+ Subsection</button>
            </div>
          )}

          {/* "+ Add Section" (and, once subsections exist, "+ Subsection"
              alongside it) live at the very bottom of the section. */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 16
            }}
          >
            {hasSubsections && (
              <button onClick={() => addSubsection(node.id)}>+ Subsection</button>
            )}
            <button onClick={() => addSectionAfter(node.id)}>+ Add Section</button>
          </div>
        </>
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
                      {(child.children ?? []).map((sub: any) =>
                        sub.type === "subsubsection" ? (
                          <Subsubsection key={sub.id} node={sub} {...props}>
                            {(sub.children ?? []).map((p: any) => (
                              <Paragraph key={p.id} node={p} {...props} />
                            ))}
                          </Subsubsection>
                        ) : (
                          <Paragraph key={sub.id} node={sub} {...props} />
                        )
                      )}
                    </Subsection>
                  )}
                  {child.type === "table" && (
                    <TableBlock node={child} {...props} />
                  )}
                  {child.type === "figure" && (
                    <FigureBlock
                      node={child}
                      updateFigureCaption={props.updateFigureCaption}
                      updateFigureWidth={props.updateFigureWidth}
                      deleteFigureImage={props.deleteFigureImage}
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