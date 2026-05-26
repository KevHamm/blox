import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Rnd } from "react-rnd";

/* -----------------------------
   PARAGRAPH
----------------------------- */
function Paragraph({ node, editingId, setEditingId, updateTextById }: any) {
  const isEditing = editingId === node.id;

  return (
    <div style={{ padding: 6, marginBottom: 6 }}>
      {isEditing ? (
        <textarea
          autoFocus
          value={node.text}
          onChange={(e) => updateTextById(node.id, e.target.value)}
          onBlur={() => setEditingId(null)}
          style={{
            width: "100%",
            minHeight: 120,
            resize: "vertical",
            padding: 8,
            border: "1px solid #ddd",
            outline: "none",
            textAlign: "left"
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{ margin: 0, cursor: "pointer", textAlign: "left" }}
        >
          {node.text}
        </p>
      )}
    </div>
  );
}

/* -----------------------------
   TABLE
----------------------------- */
function TableBlock({
  node,
  updateTableCell,
  deleteTableColumn,
  deleteNodeById,
  addTableRow,
  deleteTableRow,
  addTableColumn
}: any) {
  return (
    <div style={{ marginTop: 20, marginBottom: 20 }}>
      {/* TABLE CONTROL BAR */}
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => addTableRow(node.id)}>+ Row</button>
        <button onClick={() => deleteTableRow(node.id)} style={{ marginLeft: 6 }}>
          – Row
        </button>
        <button onClick={() => addTableColumn(node.id)} style={{ marginLeft: 6 }}>
          + Column
        </button>
        <button onClick={() => deleteTableColumn(node.id)} style={{ marginLeft: 6 }}>
          – Column
        </button>
        <button
          onClick={() => deleteNodeById(node.id)}
          style={{
            marginLeft: 12,
            background: "red",
            color: "white",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer"
          }}
        >
          Delete Table
        </button>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 4
        }}
      >
        <tbody>
          {node.rows.map((row: string[], r: number) => (
            <tr key={r}>
              {row.map((cell: string, c: number) => (
                <td key={c} style={{ border: "1px solid #ccc", padding: 8 }}>
                  <input
                    value={cell}
                    onChange={(e) =>
                      updateTableCell(node.id, r, c, e.target.value)
                    }
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none"
                    }}
                  />
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
   FIGURE (FREE FLOATING)
----------------------------- */
function FigureBlock({
  node,
  updateFigurePosition,
  updateFigureSize,
  deleteNodeById
}: any) {
  return (
    <Rnd
      size={{ width: node.width, height: node.height }}
      position={{ x: node.x, y: node.y }}
      onDragStop={(e, d) => updateFigurePosition(node.id, d.x, d.y)}
      onResizeStop={(e, dir, ref, delta, position) => {
        updateFigureSize(
          node.id,
          parseInt(ref.style.width),
          parseInt(ref.style.height),
          position.x,
          position.y
        );
      }}
      enableResizing
      dragAxis="both"
      style={{
        position: "absolute",
        border: "1px solid #ccc",
        background: "white",
        overflow: "hidden",
        zIndex: 50
      }}
    >
      <button
        onClick={() => deleteNodeById(node.id)}
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          zIndex: 100,
          background: "red",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: 24,
          height: 24,
          cursor: "pointer"
        }}
      >
        ×
      </button>

      <img
        src={node.src}
        alt="figure"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none"
        }}
      />
    </Rnd>
  );
}

/* -----------------------------
   SUBSECTION
----------------------------- */
function Subsection({
  node,
  sectionIndex,
  subsectionIndex,
  editingId,
  setEditingId,
  updateTextById,
  updateSectionTitle,
  deleteNodeById
}: any) {
  return (
    <div style={{ marginTop: 20, marginLeft: 20 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {editingId === node.id ? (
          <input
            autoFocus
            value={node.title}
            onChange={(e) => updateSectionTitle(node.id, e.target.value)}
            onBlur={() => setEditingId(null)}
            style={{
              fontSize: 18,
              fontWeight: 600,
              width: "100%",
              border: "none",
              outline: "none",
              textAlign: "left"
            }}
          />
        ) : (
          <h3
            onClick={() => setEditingId(node.id)}
            style={{ cursor: "pointer", textAlign: "left", marginRight: 10 }}
          >
            {sectionIndex + 1}.{subsectionIndex + 1} {node.title}
          </h3>
        )}

        <button
          onClick={() => deleteNodeById(node.id)}
          style={{
            background: "red",
            color: "white",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer"
          }}
        >
          Delete Subsection
        </button>
      </div>

      {node.children.map((child: any) => (
        <Paragraph
          key={child.id}
          node={child}
          editingId={editingId}
          setEditingId={setEditingId}
          updateTextById={updateTextById}
        />
      ))}
    </div>
  );
}

/* -----------------------------
   SECTION
----------------------------- */
function SortableSection({
  node,
  index,
  editingId,
  setEditingId,
  updateTextById,
  updateSectionTitle,
  addSubsection,
  addTable,
  addFigure,
  updateFigurePosition,
  updateFigureSize,
  updateTableCell,
  deleteTableColumn,
  deleteNodeById,
  addTableRow,
  deleteTableRow,
  addTableColumn
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: node.id });

  let subsectionCounter = 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: 20,
        padding: 16,
        border: "1px solid #eee",
        background: "white",
        position: "relative",
        minHeight: 400,
        textAlign: "left"
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          fontSize: 12,
          color: "#888",
          marginBottom: 8
        }}
      >
        ☰ Drag Section
      </div>

      {editingId === node.id ? (
        <input
          autoFocus
          value={node.title}
          onChange={(e) => updateSectionTitle(node.id, e.target.value)}
          onBlur={() => setEditingId(null)}
          style={{
            fontSize: 22,
            fontWeight: 700,
            width: "100%",
            border: "none",
            outline: "none",
            textAlign: "left"
          }}
        />
      ) : (
        <h2
          onClick={() => setEditingId(node.id)}
          style={{ cursor: "pointer" }}
        >
          {index + 1} {node.title}
        </h2>
      )}

      <button onClick={() => addSubsection(node.id)}>+ Subsection</button>
      <button onClick={() => addTable(node.id)} style={{ marginLeft: 8 }}>
        + Table
      </button>
      <button onClick={() => addFigure(node.id)} style={{ marginLeft: 8 }}>
        + Figure
      </button>
      <button onClick={() => deleteNodeById(node.id)} style={{ marginLeft: 8 }}>
        Delete Section
      </button>

      <div style={{ marginTop: 12 }}>
        {node.children.map((child: any) => {
          if (child.type === "paragraph") {
            return (
              <Paragraph
                key={child.id}
                node={child}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
              />
            );
          }

          if (child.type === "subsection") {
            return (
              <Subsection
                key={child.id}
                node={child}
                sectionIndex={index}
                subsectionIndex={subsectionCounter++}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
                updateSectionTitle={updateSectionTitle}
                deleteNodeById={deleteNodeById}
              />
            );
          }

          if (child.type === "table") {
            return (
              <TableBlock
                key={child.id}
                node={child}
                updateTableCell={updateTableCell}
                deleteTableColumn={deleteTableColumn}
                deleteNodeById={deleteNodeById}
                addTableRow={addTableRow}
                deleteTableRow={deleteTableRow}
                addTableColumn={addTableColumn}
              />
            );
          }

          if (child.type === "figure") {
            return (
              <FigureBlock
                key={child.id}
                node={child}
                updateFigurePosition={updateFigurePosition}
                updateFigureSize={updateFigureSize}
                deleteNodeById={deleteNodeById}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

/* -----------------------------
   DOCUMENT ROOT
----------------------------- */
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: "document-root" });

  const {
    node,
    editingId,
    setEditingId,
    updateTextById,
    updateSectionTitle,
    addSubsection,
    addTable,
    addFigure,
    updateFigurePosition,
    updateFigureSize,
    updateTableCell,
    deleteTableColumn,
    deleteNodeById,
    addTableRow,
    deleteTableRow,
    addTableColumn
  } = props;

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 200,
        position: "relative"
      }}
    >
      <SortableContext
        items={node.children.map((c: any) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {node.children.map((c: any, index: number) => (
          <SortableSection
            key={c.id}
            node={c}
            index={index}
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
            deleteTableColumn={deleteTableColumn}
            deleteNodeById={deleteNodeById}
            addTableRow={addTableRow}
            deleteTableRow={deleteTableRow}
            addTableColumn={addTableColumn}
          />
        ))}
      </SortableContext>
    </div>
  );
}
