import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import "katex/dist/katex.min.css";

// SORTABLE WRAPPER FOR CHILDREN
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
        marginBottom: 12
      }}
    >
      {children}
    </div>
  );
}

// PARAGRAPH
function Paragraph({ node, editingId, setEditingId, updateTextById, lineHeight}: any) {
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
            resize: "vertical",
            padding: 8,
            border: "1px solid #ddd",
            outline: "none",
            textAlign: "left",
            lineHeight: lineHeight ?? 1.6
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{
            margin: 0,
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            lineHeight: lineHeight ?? 1.6
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
    <div style={{ marginTop: 20 }}>
      {/* CONTROL BAR */}
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
          borderCollapse: "collapse"
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
   FIGURE (BLOCK ELEMENT)
----------------------------- */
function FigureBlock({ node, deleteNodeById }: any) {
  return (
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
          padding: "2px 6px",
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
          height: "auto",
          objectFit: "contain",
          display: "block",
          marginTop: 8
        }}
      />
    </div>
  );
}

// SUBSECTION

function Subsection({
  node,
  sectionIndex,
  subsectionIndex,
  editingId,
  setEditingId,
  updateTextById,
  updateSectionTitle,
  deleteNodeById,
  lineHeight
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
              outline: "none"
            }}
          />
        ) : (
          <h3
            onClick={() => setEditingId(node.id)}
            style={{
              cursor: "pointer",
              marginRight: 10,
              textAlign: "left",
              width: "100%"
            }}
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
          lineHeight={lineHeight}
        />
      ))}
    </div>
  );
}

// SECTION
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
  updateTableCell,
  deleteTableColumn,
  deleteNodeById,
  addTableRow,
  deleteTableRow,
  addTableColumn,
  lineHeight
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
        padding: 16
      }}
    >
      {/* drag handle */}
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

      {/* title */}
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
            outline: "none"
          }}
        />
      ) : (
        <h2
          onClick={() => setEditingId(node.id)}
          style={{
            cursor: "pointer",
            textAlign: "left",
            width: "100%"
          }}
        >
          {index + 1} {node.title}
        </h2>
      )}

      {/* buttons */}
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

      {/* SORTABLE CHILDREN */}
      <SortableContext
        items={node.children.map((c: any) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {node.children.map((child: any) => (
          <SortableItem key={child.id} id={child.id}>
            {child.type === "paragraph" && (
              <Paragraph
                node={child}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
                lineHeight={lineHeight}
              />
            )}

            {child.type === "subsection" && (
              <Subsection
                node={child}
                sectionIndex={index}
                subsectionIndex={subsectionCounter++}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
                updateSectionTitle={updateSectionTitle}
                deleteNodeById={deleteNodeById}
                lineHeight={lineHeight}
              />
            )}

            {child.type === "table" && (
              <TableBlock
                node={child}
                updateTableCell={updateTableCell}
                deleteTableColumn={deleteTableColumn}
                deleteNodeById={deleteNodeById}
                addTableRow={addTableRow}
                deleteTableRow={deleteTableRow}
                addTableColumn={addTableColumn}
              />
            )}

            {child.type === "figure" && (
              <FigureBlock
                node={child}
                deleteNodeById={deleteNodeById}
              />
            )}
          </SortableItem>
        ))}
      </SortableContext>
    </div>
  );
}

// DOCUMENT ROOT
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: "document-root" });

  return (
    <div ref={setNodeRef} style={{ minHeight: 200 }}>
      <SortableContext
        items={props.node.children.map((c: any) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {props.node.children.map((c: any, index: number) => (
          <SortableSection
            key={c.id}
            node={c}
            index={index}
            editingId={props.editingId}
            setEditingId={props.setEditingId}
            updateTextById={props.updateTextById}
            updateSectionTitle={props.updateSectionTitle}
            addSubsection={props.addSubsection}
            addTable={props.addTable}
            addFigure={props.addFigure}
            updateTableCell={props.updateTableCell}
            deleteTableColumn={props.deleteTableColumn}
            deleteNodeById={props.deleteNodeById}
            addTableRow={props.addTableRow}
            deleteTableRow={props.deleteTableRow}
            addTableColumn={props.addTableColumn}
            lineHeight={props.lineHeight}
          />
        ))}
      </SortableContext>
    </div>
  );
}