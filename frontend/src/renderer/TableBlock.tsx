import { useRef, useState, useLayoutEffect } from "react";
import { DROP_LINE, TrashButton, CaptionField } from "./shared";

/* Brush-shaped mouse cursor used in table paint mode. */
const BRUSH_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'%3E%3Cpath d='M14 3l7 7-8 8H7v-6z' fill='%23cdb4ff' stroke='%23333' stroke-width='1'/%3E%3Cpath d='M7 18c-1 1-2 3-4 3 0-2 2-3 3-4z' fill='%23333'/%3E%3C/svg%3E\") 2 20, crosshair";

/* Red-cross cursor used in table delete mode. */
const DELETE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5L5 19' stroke='%23d23f3f' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E\") 10 10, crosshair";

/* Auto-growing, multi-line table cell. Shift+Enter inserts a line break; a plain
   Enter is swallowed so it can't accidentally add one. Long / pasted text wraps,
   and the cell (and therefore the whole row) grows downward to fit. */
function CellTextarea({ value, readOnly, onChange, onEnter, onDelete, fontSize, widthKey, pointerNone }: any) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Re-fit when the text, font size, or column width changes.
  useLayoutEffect(grow, [value, fontSize, widthKey]);

  // Re-fit when the cell box is resized for any other reason.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined" || !el.parentElement) return;
    const ro = new ResizeObserver(grow);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Shift+Enter = line break (textarea default). Plain Enter grows the
        // table: a new row (or a new column when in the header row).
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onEnter?.();
          return;
        }
        // Backspace / Delete in an empty cell may remove an empty row/column.
        if (
          (e.key === "Backspace" || e.key === "Delete") &&
          String(value ?? "").trim() === ""
        ) {
          if (onDelete?.()) e.preventDefault();
        }
      }}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        border: "none",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        padding: "4px 6px",
        margin: 0,
        background: "transparent",
        color: "#000",
        fontFamily: "var(--sans)",
        fontSize,
        lineHeight: 1.3,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        pointerEvents: pointerNone ? "none" : undefined
      }}
    />
  );
}

/* -----------------------------
   TABLE
----------------------------- */
export function TableBlock(props: any) {
  const {
    node,
    updateTableCell,
    deleteNodeById,
    addTableRow,
    addTableColumn,
    updateTableColWidths,
    updateTableCaption,
    updateTableColors,
    deleteTableRowAt,
    deleteTableColumnAt,
    toggleTableBorder,
    toggleCellBorder,
    reorderTableColumn,
    reorderTableRow,
    tableNumbers,
    fontSize = 13
  } = props;

  const tableRef = useRef<HTMLTableElement>(null);
  // Active table tool: editing, painting, deleting, or editing grid separators.
  const [tool, setTool] = useState<"none" | "paint" | "delete" | "borders">("none");
  const [brushColor, setBrushColor] = useState("#ffe08a");
  const active = tool !== "none";

  // Live reorder indicator (a blue line showing where a row/column will land).
  const [marker, setMarker] = useState<{ axis: "col" | "row"; px: number } | null>(null);

  const colCount = node.rows[0]?.length || 0;
  const rowCount = node.rows.length;

  // Grid lines default to visible; either axis can be switched off globally, and
  // individual internal separators can be removed for custom tables.
  const bV = node.borders?.v !== false;
  const bH = node.borders?.h !== false;
  const sideBorder = (on: boolean) => (on ? "1px solid #ccc" : "none");
  const removedV: string[] = node.removedVBorders ?? [];
  const removedH: string[] = node.removedHBorders ?? [];
  const vGone = (r: number, c: number) => removedV.includes(`${r}:${c}`);
  const hGone = (r: number, c: number) => removedH.includes(`${r}:${c}`);
  // Per-cell border sides: outer frame follows the global toggles; internal
  // separators follow the per-edge removed sets (only one of each shared edge is
  // drawn, so border-collapse stays consistent).
  const cellBorders = (r: number, c: number) => ({
    borderLeft: c === 0 ? sideBorder(bV) : "none",
    borderTop: r === 0 ? sideBorder(bH) : "none",
    borderRight: c === colCount - 1 ? sideBorder(bV) : sideBorder(bV && !vGone(r, c)),
    borderBottom: r === rowCount - 1 ? sideBorder(bH) : sideBorder(bH && !hGone(r, c))
  });

  // Whole-row / whole-column emptiness (for backspace-to-remove).
  const isEmpty = (v: any) => String(v ?? "").trim() === "";
  const rowEmpty = (r: number) => node.rows[r].every(isEmpty);
  const colEmpty = (c: number) => node.rows.every((row: string[]) => isEmpty(row[c]));

  // ── Drag-to-reorder columns / rows ──────────────────────────────
  function startColReorder(from: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    let to = from;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    function onMove(ev: MouseEvent) {
      const cells = Array.from(table!.rows[0].cells) as HTMLElement[];
      const n = cells.length;
      const rects = cells.map((td) => td.getBoundingClientRect());
      const tableLeft = table!.getBoundingClientRect().left;
      let ins = rects.findIndex((r) => ev.clientX < r.left + r.width / 2);
      if (ins === -1) ins = n;
      to = ins > from ? ins - 1 : ins;
      const px = ins < n ? rects[ins].left - tableLeft : rects[n - 1].right - tableLeft;
      setMarker({ axis: "col", px });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      setMarker(null);
      if (to !== from) reorderTableColumn(node.id, from, to);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startRowReorder(from: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    let to = from;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    function onMove(ev: MouseEvent) {
      const rowsEls = Array.from(table!.rows) as HTMLElement[];
      const n = rowsEls.length;
      const rects = rowsEls.map((tr) => tr.getBoundingClientRect());
      const tableTop = table!.getBoundingClientRect().top;
      let ins = rects.findIndex((r) => ev.clientY < r.top + r.height / 2);
      if (ins === -1) ins = n;
      to = ins > from ? ins - 1 : ins;
      const px = ins < n ? rects[ins].top - tableTop : rects[n - 1].bottom - tableTop;
      setMarker({ axis: "row", px });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      setMarker(null);
      if (to !== from) reorderTableRow(node.id, from, to);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

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
    <div className="table-wrap" style={{ marginTop: 20 }}>
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
                    ...cellBorders(r, c),
                    padding: 0,
                    verticalAlign: "top",
                    position: "relative",
                    background: node.colors?.[r]?.[c] ?? undefined,
                    cursor:
                      tool === "paint" ? BRUSH_CURSOR : tool === "delete" ? DELETE_CURSOR : undefined
                  }}
                >
                  <CellTextarea
                    value={cell}
                    readOnly={active}
                    pointerNone={active}
                    fontSize={fontSize}
                    widthKey={widths[c]}
                    onChange={(v: string) => updateTableCell(node.id, r, c, v)}
                    onEnter={() =>
                      r === 0 ? addTableColumn(node.id) : addTableRow(node.id)
                    }
                    onDelete={() => {
                      // Header cell → drop an empty column; first cell of a data
                      // row → drop an empty row.
                      if (r === 0) {
                        if (colEmpty(c)) { deleteTableColumnAt(node.id, c); return true; }
                      } else if (c === 0) {
                        if (rowEmpty(r)) { deleteTableRowAt(node.id, r); return true; }
                      }
                      return false;
                    }}
                  />

                  {/* reorder grip above each column (top row only) */}
                  {!active && r === 0 && (
                    <div
                      className="tbl-grip"
                      title="Drag to reorder column"
                      onMouseDown={(e) => startColReorder(c, e)}
                      style={{
                        position: "absolute",
                        top: -15,
                        left: 1,
                        right: 1,
                        height: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "grab",
                        zIndex: 3
                      }}
                    >
                      <div style={{ width: "100%", maxWidth: 46, height: 7, borderRadius: 4, background: "#c2c8d2" }} />
                    </div>
                  )}

                  {/* reorder grip left of each row (first column only) */}
                  {!active && c === 0 && (
                    <div
                      className="tbl-grip"
                      title="Drag to reorder row"
                      onMouseDown={(e) => startRowReorder(r, e)}
                      style={{
                        position: "absolute",
                        left: -15,
                        top: 1,
                        bottom: 1,
                        width: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "grab",
                        zIndex: 3
                      }}
                    >
                      <div style={{ height: "100%", maxHeight: 46, width: 7, borderRadius: 4, background: "#c2c8d2" }} />
                    </div>
                  )}

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

                  {/* border-edit tool: click a separator to remove / re-add it */}
                  {tool === "borders" && c < colCount - 1 && (
                    <div
                      className="tbl-border-edge"
                      title={vGone(r, c) ? "Add column separator" : "Remove column separator"}
                      onClick={() => toggleCellBorder(node.id, "v", r, c)}
                      style={{ position: "absolute", top: 0, bottom: 0, right: -4, width: 9, cursor: "pointer", zIndex: 5 }}
                    />
                  )}
                  {tool === "borders" && r < rowCount - 1 && (
                    <div
                      className="tbl-border-edge"
                      title={hGone(r, c) ? "Add row separator" : "Remove row separator"}
                      onClick={() => toggleCellBorder(node.id, "h", r, c)}
                      style={{ position: "absolute", left: 0, right: 0, bottom: -4, height: 9, cursor: "pointer", zIndex: 5 }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

        {/* live reorder indicator */}
        {marker && (
          <div
            style={{
              position: "absolute",
              pointerEvents: "none",
              zIndex: 5,
              background: DROP_LINE,
              borderRadius: 1,
              ...(marker.axis === "col"
                ? { left: marker.px - 1, top: 0, bottom: 0, width: 2 }
                : { top: marker.px - 1, left: 0, right: 0, height: 2 })
            }}
          />
        )}
      </div>

      {/* LaTeX-style caption */}
      <CaptionField
        tag={`Table ${tableNumbers?.[node.id]}:`}
        value={node.caption || ""}
        onChange={(v) => updateTableCaption(node.id, v)}
      />

      {/* paint tool, grid-line toggles, delete-table — all one line */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
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

        <button
          className="tbl-btn"
          title="Border editor: click a grid line between cells to remove or re-add it"
          onClick={() => setTool((t) => (t === "borders" ? "none" : "borders"))}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tool === "borders" ? "#e8eefc" : "#eee",
            border: tool === "borders" ? `2px solid ${DROP_LINE}` : "1px solid #ccc",
            borderRadius: 4,
            color: tool === "borders" ? DROP_LINE : "#555",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          ⊞
        </button>

        {/* grid-line toggles */}
        <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 2px" }} />
        <button
          className="tbl-btn"
          title={bV ? "Hide vertical lines" : "Show vertical lines"}
          onClick={() => toggleTableBorder(node.id, "v")}
          style={{
            width: 24, height: 24, padding: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: bV ? "#e8eefc" : "#eee",
            border: bV ? `1px solid ${DROP_LINE}` : "1px solid #ccc",
            color: bV ? DROP_LINE : "#999",
            borderRadius: 4, cursor: "pointer", fontSize: 14
          }}
        >
          ▥
        </button>
        <button
          className="tbl-btn"
          title={bH ? "Hide horizontal lines" : "Show horizontal lines"}
          onClick={() => toggleTableBorder(node.id, "h")}
          style={{
            width: 24, height: 24, padding: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: bH ? "#e8eefc" : "#eee",
            border: bH ? `1px solid ${DROP_LINE}` : "1px solid #ccc",
            color: bH ? DROP_LINE : "#999",
            borderRadius: 4, cursor: "pointer", fontSize: 14
          }}
        >
          ▤
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
