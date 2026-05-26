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
function Paragraph({
  node,
  editingId,
  setEditingId,
  updateTextById
}: any) {
  const isEditing = editingId === node.id;

  return (
    <div
      style={{
        padding: 6,
        marginBottom: 6,
        background: "transparent"
      }}
    >
      {isEditing ? (
        <textarea
          autoFocus
          value={node.text}
          onChange={(e) =>
            updateTextById(node.id, e.target.value)
          }
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
          style={{
            color: "#333",
            margin: 0,
            textAlign: "left",
            cursor: "pointer"
          }}
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
function TableBlock({ node, updateTableCell }: any) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: 16,
        marginBottom: 16
      }}
    >
      <tbody>
        {node.rows.map((row: string[], rowIndex: number) => (
          <tr key={rowIndex}>
            {row.map((cell: string, colIndex: number) => (
              <td
                key={colIndex}
                style={{
                  border: "1px solid #ccc",
                  padding: 8
                }}
              >
                <input
                  value={cell}
                  onChange={(e) =>
                    updateTableCell(
                      node.id,
                      rowIndex,
                      colIndex,
                      e.target.value
                    )
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
  );
}

/* -----------------------------
   FIGURE
----------------------------- */
function FigureBlock({
  node,
  updateFigurePosition,
  updateFigureSize
}: any) {
  return (
    <Rnd
      size={{ width: node.width, height: node.height }}
      position={{ x: node.x, y: node.y }}
      bounds="parent"
      onDragStop={(e, d) =>
        updateFigurePosition(node.id, d.x, d.y)
      }
      onResizeStop={(e, dir, ref, delta, position) => {
        updateFigureSize(
          node.id,
          parseInt(ref.style.width),
          parseInt(ref.style.height),
          position.x,
          position.y
        );
      }}
      style={{
        border: "1px solid #ccc",
        background: "white",
        overflow: "hidden",
        zIndex: 20
      }}
    >
      <img
        src={node.src}
        alt=""
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
  updateSectionTitle
}: any) {
  return (
    <div style={{ marginTop: 20, marginLeft: 20 }}>
      {editingId === node.id ? (
        <input
          autoFocus
          value={node.title}
          onChange={(e) =>
            updateSectionTitle(node.id, e.target.value)
          }
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
          style={{
            cursor: "pointer",
            textAlign: "left",
            color: "#333"
          }}
        >
          {sectionIndex + 1}.{subsectionIndex + 1} {node.title}
        </h3>
      )}

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
  deleteNodeById
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
        marginBottom: 16,
        padding: 12,
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
          onChange={(e) =>
            updateSectionTitle(node.id, e.target.value)
          }
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
          style={{ cursor: "pointer", color: "#333" }}
        >
          {index + 1} {node.title}
        </h2>
      )}

      <button onClick={() => addSubsection(node.id)}>
        + Add subsection
      </button>

      <button onClick={() => addTable(node.id)} style={{ marginLeft: 8 }}>
        + Add table
      </button>

      <button onClick={() => addFigure(node.id)} style={{ marginLeft: 8 }}>
        + Add figure
      </button>

      <button
        onClick={() => deleteNodeById(node.id)}
        style={{ marginLeft: 8 }}
      >
        Delete section
      </button>

      <div style={{ marginTop: 12 }}>
        {node.children.map((child: any, i: number) => {
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
              />
            );
          }

          if (child.type === "table") {
            return (
              <TableBlock
                key={child.id}
                node={child}
                updateTableCell={updateTableCell}
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
export function DocumentRenderer({
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
  deleteNodeById
}: any) {
  const { setNodeRef } = useDroppable({
    id: "document-root"
  });

  return (
    <div ref={setNodeRef} style={{ minHeight: 200 }}>
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
            deleteNodeById={deleteNodeById}
          />
        ))}
      </SortableContext>
    </div>
  );
}