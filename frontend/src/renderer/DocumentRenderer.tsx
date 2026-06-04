import { Fragment, useRef, useEffect, useState } from "react";
import type { Chunk } from "../utils/paginateDocument";
import { isContainerType } from "../utils/paginateDocument";
import { useDroppable, useDraggable, useDndContext } from "@dnd-kit/core";
import { TrashIcon } from "../components/TrashIcon";
import "mathlive";
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
function DropZone({ id, containerType }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();

  // Only reveal a zone where the dragged thing can actually go:
  //   • images / tables / math  → any container
  //   • subsection block         → only inside a section
  //   • subsubsection block      → only inside a subsection
  //   • section block            → never (it drops anywhere, no zone)
  const activeId = String(active?.id ?? "");
  let dragging: boolean;
  if (isImageDragId(activeId)) dragging = true;
  else if (activeId === "block::section" || activeId.startsWith("block::page::")) dragging = false;
  else if (activeId === "block::subsection") dragging = containerType === "section";
  else if (activeId === "block::subsubsection") dragging = containerType === "subsection";
  else dragging = activeId.startsWith("block::"); // table / math → anywhere

  if (!dragging) {
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
function TrashButton({ onClick, label, className }: any) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={className}
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

/* Up/down move control (dir = -1 up, 1 down). */
function ChevronButton({ dir, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 22,
        height: 22,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        border: "1px solid #ddd",
        borderRadius: 4,
        color: "#555",
        cursor: "pointer"
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {dir < 0 ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
    </button>
  );
}

// LaTeX heading metrics relative to the body font size:
//   \section = \Large (1.44×) bold, \subsection = \large (1.2×) bold,
//   \subsubsection = \normalsize (1×) bold — all Computer Modern Bold.
function headingStyle(base: number, mult: number) {
  return {
    margin: 0,
    fontFamily: "var(--sans)",
    fontWeight: 700,
    fontSize: Math.round(base * mult * 100) / 100,
    lineHeight: 1.15,
    letterSpacing: "normal",
    color: "var(--text)"
  } as const;
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
  fontSize,
  firstChild = false
}: any) {
  const isEditing = editingId === node.id;

  if (isEditing) {
    return (
      <textarea
        autoFocus
        value={node.text}
        onChange={(e) => updateTextById(node.id, e.target.value)}
        onBlur={() => setEditingId(null)}
        style={{
          width: "100%",
          minHeight: 120,
          padding: 8,
          margin: "2px 0",
          border: "1px solid #ddd",
          lineHeight,
          fontSize,
          fontFamily: "var(--sans)",
          color: "var(--text)"
        }}
      />
    );
  }

  // LaTeX body: justified, hyphenated, first-line indent (none on the first
  // paragraph after a heading), and no space between paragraphs (\parskip = 0).
  return (
    <p
      onClick={() => setEditingId(node.id)}
      style={{
        margin: 0,
        cursor: "pointer",
        textAlign: "justify",
        hyphens: "auto",
        WebkitHyphens: "auto",
        textIndent: firstChild ? 0 : "1.5em",
        lineHeight,
        fontSize
      }}
    >
      {node.text}
    </p>
  );
}

/* -----------------------------
   MATH — a single directly-editable equation (MathLive). Dropping another math
   block beside it merges their LaTeX into one equation.
----------------------------- */
// MathLive's <math-field> custom element (typed loosely for JSX).
const MathFieldTag = "math-field" as any;

// Editable math field; renders the equation and edits it visually in place.
function MathField({ value, onChange }: any) {
  const ref = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep the field's value in sync without disturbing the caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (el && el.value !== value) el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.value = value;
    // Don't pop the on-screen keyboard on desktop.
    el.mathVirtualKeyboardPolicy = "manual";

    const onInput = () => onChangeRef.current(el.value);
    el.addEventListener("input", onInput);

    // Insert "<" / ">" literally instead of MathLive's "\lt"/"\gt" command flow.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "<" || e.key === ">") {
        e.preventDefault();
        e.stopPropagation();
        el.insert(e.key, { focus: true });
      }
    };
    el.addEventListener("keydown", onKeyDown, true);

    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MathFieldTag
      ref={ref}
      style={{
        fontSize: "1.3em",
        padding: "2px 4px",
        background: "transparent",
        color: "#000"
      }}
    />
  );
}

// Drop slot to the left/right of an equation; appears while dragging a math
// block from the palette, so equations can be merged together.
function MathSlot({ id }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();
  const dragging = String(active?.id ?? "").startsWith("block::math::");

  if (!dragging) return <div ref={setNodeRef} style={{ width: 0 }} />;

  return (
    <div
      ref={setNodeRef}
      style={{
        width: isOver ? 28 : 16,
        alignSelf: "stretch",
        minHeight: 40,
        flexShrink: 0,
        borderRadius: 4,
        background: isOver ? "rgba(74,144,226,0.25)" : "rgba(74,144,226,0.08)",
        border: `1px dashed ${isOver ? "#4a90e2" : "rgba(74,144,226,0.4)"}`
      }}
    />
  );
}

function MathBlock({ node, updateMathItem, deleteMathItem }: any) {
  // Support the container model (and any legacy single-latex node).
  const items: any[] =
    node.items ?? (node.latex != null ? [{ id: `${node.id}-0`, latex: node.latex }] : []);

  return (
    <div style={{ margin: "12px 0" }}>
      {/* parts sit flush so it reads as one equation; slots between them open
          up while dragging a math block so you can insert anywhere. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MathSlot id={`mathdz::${node.id}::0`} />
        {items.map((it, i) => (
          <Fragment key={it.id}>
            <MathField
              value={it.latex}
              onChange={(v: string) =>
                v.trim() === ""
                  ? deleteMathItem(node.id, it.id)   // cleared → remove this part
                  : updateMathItem(node.id, it.id, v)
              }
            />
            <MathSlot id={`mathdz::${node.id}::${i + 1}`} />
          </Fragment>
        ))}
      </div>
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
  const width: number = node.width ?? 1;          // remembered per-image width
  const n = images.length || 1;
  // Cap the visible size so n images always fit; the stored width is preserved
  // so removing images restores the previous (wider) size.
  const perImage = Math.min(width, 1 / n);
  const containerFrac = n * perImage;

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const colW = wrapperRef.current?.offsetWidth || 1;
    const startX = e.clientX;
    const startW = perImage;   // start from the currently visible size

    function onMove(ev: MouseEvent) {
      const dw = (ev.clientX - startX) / (colW * n);
      updateFigureWidth(node.id, clampFrac(startW + dw, 0.1, 1));
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

/* Small green "+" / red "−" control button. */
function SquareButton({ color, onClick, title, children }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="tbl-btn"
      style={{
        width: 24,
        height: 24,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: color === "green" ? "#2e9e44" : "#d23f3f",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 17,
        fontWeight: 700,
        lineHeight: 1
      }}
    >
      {children}
    </button>
  );
}

/* Brush-shaped mouse cursor used in table paint mode. */
const BRUSH_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'%3E%3Cpath d='M14 3l7 7-8 8H7v-6z' fill='%23cdb4ff' stroke='%23333' stroke-width='1'/%3E%3Cpath d='M7 18c-1 1-2 3-4 3 0-2 2-3 3-4z' fill='%23333'/%3E%3C/svg%3E\") 2 20, crosshair";

/* Red-cross cursor used in table delete mode. */
const DELETE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5L5 19' stroke='%23d23f3f' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E\") 10 10, crosshair";

/* -----------------------------
   TABLE
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
    updateTableColWidths,
    updateTableCaption,
    updateTableColors,
    deleteTableRowAt,
    deleteTableColumnAt,
    tableNumbers
  } = props;

  const tableRef = useRef<HTMLTableElement>(null);
  // Active table tool: editing, painting cells, or deleting rows/columns.
  const [tool, setTool] = useState<"none" | "paint" | "delete">("none");
  const [brushColor, setBrushColor] = useState("#ffe08a");
  const active = tool !== "none";

  const colCount = node.rows[0]?.length || 0;

  // A normalized colour grid (sized to the current rows; missing = null).
  const buildColors = () =>
    node.rows.map((row: string[], r: number) =>
      row.map((_: string, c: number) => node.colors?.[r]?.[c] ?? null)
    );
  const paintCell = (r: number, c: number) => {
    const cols = buildColors();
    cols[r][c] = brushColor;
    updateTableColors(node.id, cols);
  };
  const paintColumn = (c: number) => {
    const cols = buildColors();
    cols.forEach((row: any[]) => { row[c] = brushColor; });
    updateTableColors(node.id, cols);
  };
  const paintRow = (r: number) => {
    const cols = buildColors();
    cols[r] = cols[r].map(() => brushColor);
    updateTableColors(node.id, cols);
  };

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
      <div style={{ position: "relative" }}>
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
                  onClick={
                    tool === "paint"
                      ? () => paintCell(r, c)
                      : tool === "delete"
                      ? () => (c === 0 && r > 0 ? deleteTableRowAt(node.id, r) : deleteTableColumnAt(node.id, c))
                      : undefined
                  }
                  onDoubleClick={
                    tool === "paint"
                      ? () => {
                          if (r === 0) paintColumn(c);     // header → whole column
                          else if (c === 0) paintRow(r);   // first cell → whole row
                        }
                      : undefined
                  }
                  style={{
                    border: "1px solid #ccc",
                    padding: 0,
                    position: "relative",
                    background: node.colors?.[r]?.[c] ?? undefined,
                    cursor:
                      tool === "paint" ? BRUSH_CURSOR : tool === "delete" ? DELETE_CURSOR : undefined
                  }}
                >
                  <input
                    value={cell}
                    readOnly={active}
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
                      fontFamily: "var(--sans)",
                      pointerEvents: active ? "none" : undefined
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
                        zIndex: 1,
                        pointerEvents: active ? "none" : undefined
                      }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

        {/* add / remove COLUMN — beside the header row, to the right (may
            overflow the text box) */}
        <div
          style={{
            position: "absolute",
            top: 2,
            right: -56,
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <SquareButton color="green" title="Add column" onClick={() => addTableColumn(node.id)}>+</SquareButton>
          <SquareButton color="red" title="Remove column" onClick={() => deleteTableColumn(node.id)}>−</SquareButton>
        </div>
      </div>

      {/* LaTeX-style caption */}
      <div
        style={{
          marginTop: 8,
          textAlign: "center",
          fontSize: 14,
          fontFamily: "var(--sans)",
          color: "var(--text)"
        }}
      >
        <strong>Table {tableNumbers?.[node.id]}:</strong>{" "}
        <input
          value={node.caption || ""}
          onChange={(e) => updateTableCaption(node.id, e.target.value)}
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

      {/* row +/-, paint tool, delete-table — all one line */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <SquareButton color="green" title="Add row" onClick={() => addTableRow(node.id)}>+</SquareButton>
        <SquareButton color="red" title="Remove row" onClick={() => deleteTableRow(node.id)}>−</SquareButton>

        <button
          className="tbl-btn"
          title="Paint cells (click a cell; double-click a header to fill a column, the first cell of a row to fill the row)"
          onClick={() => setTool((t) => (t === "paint" ? "none" : "paint"))}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tool === "paint" ? brushColor : "#eee",
            border: tool === "paint" ? "2px solid #333" : "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13
          }}
        >
          🖌
        </button>
        <input
          type="color"
          value={brushColor}
          onChange={(e) => setBrushColor(e.target.value)}
          title="Brush color"
          style={{
            width: 24,
            height: 24,
            padding: 0,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "none",
            cursor: "pointer"
          }}
        />

        <button
          className="tbl-btn"
          title="Delete tool: click a header to remove its column, the first cell of a row to remove that row"
          onClick={() => setTool((t) => (t === "delete" ? "none" : "delete"))}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tool === "delete" ? "#f5c6c6" : "#eee",
            border: tool === "delete" ? "2px solid #d23f3f" : "1px solid #ccc",
            borderRadius: 4,
            color: "#d23f3f",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700
          }}
        >
          ✕
        </button>

        <TrashButton
          className="tbl-btn"
          onClick={() => deleteNodeById(node.id)}
          label="Delete table"
        />
      </div>
    </div>
  );
}

/* -----------------------------
   SUBSECTION (NO DND)
----------------------------- */
function Subsection({
  node,
  showHeader = true,
  editingId,
  setEditingId,
  updateSectionTitle,
  deleteNodeById,
  moveSubsection,
  fontSize = 13,
  children
}: any) {
  return (
    <div style={{ marginTop: showHeader ? fontSize * 1.3 : 0 }}>
      {showHeader && (
        <div data-head-id={node.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: fontSize * 0.5 }}>
          {editingId === node.id ? (
            <input
              autoFocus
              value={node.title}
              onChange={(e) => updateSectionTitle(node.id, e.target.value)}
              onBlur={() => setEditingId(null)}
            />
          ) : (
            <h3 style={headingStyle(fontSize, 1.2)} onClick={() => setEditingId(node.id)}>
              {node.title}
            </h3>
          )}

          {/* MOVE BUTTONS — to the right of the title */}
          <div style={{ display: "flex", gap: 4 }}>
            <ChevronButton dir={-1} title="Move up" onClick={() => moveSubsection(node.id, -1)} />
            <ChevronButton dir={1} title="Move down" onClick={() => moveSubsection(node.id, 1)} />
          </div>

          <TrashButton
            onClick={() => deleteNodeById(node.id)}
            label="Delete subsection"
          />
        </div>
      )}

      {children}
    </div>
  );
}

/* -----------------------------
   SUBSUBSECTION (NO DND)
----------------------------- */
function Subsubsection({
  node,
  showHeader = true,
  editingId,
  setEditingId,
  updateSectionTitle,
  deleteNodeById,
  fontSize = 13,
  children
}: any) {
  return (
    <div style={{ marginTop: showHeader ? fontSize * 1.1 : 0 }}>
      {showHeader && (
        <div data-head-id={node.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: fontSize * 0.4 }}>
          {editingId === node.id ? (
            <input
              autoFocus
              value={node.title}
              onChange={(e) => updateSectionTitle(node.id, e.target.value)}
              onBlur={() => setEditingId(null)}
            />
          ) : (
            <h4 style={headingStyle(fontSize, 1)} onClick={() => setEditingId(node.id)}>
              {node.title}
            </h4>
          )}

          <TrashButton
            onClick={() => deleteNodeById(node.id)}
            label="Delete subsubsection"
          />
        </div>
      )}

      {children}
    </div>
  );
}

/* -----------------------------
   SECTION (NO DND)
----------------------------- */
function Section({ node, showHeader = true, ...rest }: any) {
  const {
    editingId, setEditingId, updateSectionTitle,
    deleteNodeById, moveSection, children, fontSize = 13
  } = rest;

  return (
    <div style={{ marginTop: showHeader ? fontSize * 1.6 : 0 }}>

      {/* Header row; hidden on continuation columns/pages. */}
      {showHeader && (
        <div
          data-head-id={node.id}
          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: fontSize * 0.8 }}
        >
          {editingId === node.id ? (
            <input
              value={node.title}
              onChange={e => updateSectionTitle(node.id, e.target.value)}
              onBlur={() => setEditingId(null)}
            />
          ) : (
            <h2 style={headingStyle(fontSize, 1.44)} onClick={() => setEditingId(node.id)}>
              {node.sectionNumber} {node.title}
            </h2>
          )}

          {/* MOVE BUTTONS — to the right of the title */}
          <div style={{ display: "flex", gap: 4 }}>
            <ChevronButton dir={-1} title="Move up" onClick={() => moveSection(node.id, -1)} />
            <ChevronButton dir={1} title="Move down" onClick={() => moveSection(node.id, 1)} />
          </div>

          <TrashButton
            onClick={() => deleteNodeById(node.id)}
            label="Delete section"
          />
        </div>
      )}

      {children}
    </div>
  );
}

/* -----------------------------
   SPECIAL PAGE (cover / TOC / bibliography) — header only for now.
----------------------------- */
const PAGE_TITLES: Record<string, string> = {
  coverpage: "Cover Page",
  toc: "Table of Contents",
  bibliography: "Bibliography"
};
function PageBlock({ node, deleteNodeById }: any) {
  return (
    <div
      style={{
        marginBottom: 30,
        padding: "20px 0",
        borderTop: "2px solid #e0e0e0",
        position: "relative"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 30 }}>
          {PAGE_TITLES[node.type] ?? node.title}
        </h1>
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete page" />
      </div>
    </div>
  );
}

/* -----------------------------
   RECURSIVE CHUNK RENDERING
----------------------------- */
// The drop zones + child elements inside a container chunk.
function containerInner(chunk: Chunk, props: any) {
  const node = chunk.node;
  const fullChildren = node.children ?? [];

  // Only show the trailing "append to this container" zone when the block
  // actually rendered last in this chunk is a leaf. If it's another container,
  // that container already renders its own end zone at this spot, so an outer
  // one would just stack up dead/redundant slots beneath the trailing
  // "+ …" buttons (e.g. a section-level zone under "+ Subsubsection").
  const lastRendered = chunk.children[chunk.children.length - 1];
  const showEndZone =
    chunk.isLast && (!lastRendered || !isContainerType(lastRendered.node.type));

  return (
    <>
      {chunk.children.map((ch) => {
        const absIndex = fullChildren.findIndex((c: any) => c.id === ch.node.id);
        return (
          <Fragment key={ch.node.id}>
            <DropZone id={`dz::${node.id}::${absIndex}`} containerType={node.type} />
            {renderChunk(ch, props, absIndex === 0)}
          </Fragment>
        );
      })}
      {showEndZone && (
        <DropZone id={`dz::${node.id}::${fullChildren.length}`} containerType={node.type} />
      )}
    </>
  );
}

function renderChunk(chunk: Chunk, props: any, firstChild = false): any {
  const node = chunk.node;

  if (node.type === "paragraph") {
    return (
      <div data-leaf-id={node.id}>
        <Paragraph node={node} {...props} firstChild={firstChild} />
      </div>
    );
  }
  if (node.type === "table") {
    return (
      <div data-leaf-id={node.id}>
        <TableBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "math") {
    return (
      <div data-leaf-id={node.id}>
        <MathBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "coverpage" || node.type === "toc" || node.type === "bibliography") {
    return (
      <div data-leaf-id={node.id}>
        <PageBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "figure") {
    return (
      <div data-leaf-id={node.id}>
        <FigureBlock
          node={node}
          updateFigureCaption={props.updateFigureCaption}
          updateFigureWidth={props.updateFigureWidth}
          deleteFigureImage={props.deleteFigureImage}
          figureNumber={props.figureNumbers?.[node.id]}
        />
      </div>
    );
  }
  if (node.type === "subsection") {
    return (
      <Subsection node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
        {containerInner(chunk, props)}
      </Subsection>
    );
  }
  if (node.type === "subsubsection") {
    return (
      <Subsubsection node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
        {containerInner(chunk, props)}
      </Subsubsection>
    );
  }
  // section
  return (
    <Section node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
      {containerInner(chunk, props)}
    </Section>
  );
}

/* -----------------------------
   DOCUMENT ROOT (renders one column)
----------------------------- */
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: props.droppableId ?? "document-root" });

  return (
    <div ref={setNodeRef}>
      {(props.column as Chunk[]).map((chunk, i) => (
        <Fragment key={`${chunk.node.id}-${i}`}>{renderChunk(chunk, props)}</Fragment>
      ))}
    </div>
  );
}