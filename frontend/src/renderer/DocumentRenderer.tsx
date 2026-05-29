import { useDroppable } from "@dnd-kit/core";
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
function FigureBlock({ node, deleteNodeById }: any) {
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
          style={{ width: "100%", height: "auto" }}
        />
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
    addTableColumn
  } = props;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => addTableRow(node.id)}>+ Row</button>
        <button onClick={() => deleteTableRow(node.id)}>– Row</button>
        <button onClick={() => addTableColumn(node.id)}>+ Column</button>
        <button onClick={() => deleteTableColumn(node.id)}>– Column</button>
        <button onClick={() => deleteNodeById(node.id)}>Delete</button>
      </div>

      <table style={{ width: "100%" }}>
        <tbody>
          {node.rows.map((row: string[], r: number) => (
            <tr key={r}>
              {row.map((cell: string, c: number) => (
                <td key={c}>
                  <input
                    value={cell}
                    onChange={(e) =>
                      updateTableCell(node.id, r, c, e.target.value)
                    }
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
            {sectionIndex + 1}.{subsectionIndex + 1} {node.title}
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
function Section({
  node,
  index,
  editingId,
  setEditingId,
  updateSectionTitle,
  addSubsection,
  addTable,
  addFigure,
  deleteNodeById,
  moveSection,
  children
}: any) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center" }}>

        {/* MOVE BUTTONS */}
        <div style={{ display: "flex", gap: 6, marginRight: 10 }}>
          <button onClick={() => moveSection(node.id, -1)}>↑</button>
          <button onClick={() => moveSection(node.id, 1)}>↓</button>
        </div>

        {editingId === node.id ? (
          <input
            value={node.title}
            onChange={(e) => updateSectionTitle(node.id, e.target.value)}
            onBlur={() => setEditingId(null)}
          />
        ) : (
          <h2 onClick={() => setEditingId(node.id)}>
            {index + 1} {node.title}
          </h2>
        )}

        <button onClick={() => addSubsection(node.id)}>+ Subsection</button>
        <button onClick={() => addTable(node.id)}>+ Table</button>
        <button onClick={() => addFigure(node.id)}>+ Figure</button>

        <button
          onClick={() => deleteNodeById(node.id)}
          style={{ marginLeft: 10, background: "red", color: "white" }}
        >
          Delete Section
        </button>
      </div>

      {children}
    </div>
  );
}

/* -----------------------------
   DOCUMENT ROOT
----------------------------- */
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: "document-root" });

  return (
    <div ref={setNodeRef}>
      {props.node.children.map((c: any, index: number) => (
        <Section
          key={c.id}
          node={c}
          index={index}
          editingId={props.editingId}
          setEditingId={props.setEditingId}
          updateSectionTitle={props.updateSectionTitle}
          addSubsection={props.addSubsection}
          addTable={props.addTable}
          addFigure={props.addFigure}
          deleteNodeById={props.deleteNodeById}
          moveSection={props.moveSection}
          moveSubsection={props.moveSubsection}
        >
          {(() => {
            let subsectionCounter = 0;

            return c.children.map((child: any) => {
              if (child.type === "paragraph") {
                return (
                  <Paragraph
                    key={child.id}
                    node={child}
                    editingId={props.editingId}
                    setEditingId={props.setEditingId}
                    updateTextById={props.updateTextById}
                    lineHeight={props.lineHeight}
                    fontSize={props.fontSize}
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
                  editingId={props.editingId}
                  setEditingId={props.setEditingId}
                  updateSectionTitle={props.updateSectionTitle}
                  deleteNodeById={props.deleteNodeById}
                  moveSubsection={props.moveSubsection}
                  lineHeight={props.lineHeight}
                  fontSize={props.fontSize}
                >
                  {child.children.map((p: any) => (
                    <Paragraph
                      key={p.id}
                      node={p}
                      editingId={props.editingId}
                      setEditingId={props.setEditingId}
                      updateTextById={props.updateTextById}
                      lineHeight={props.lineHeight}
                      fontSize={props.fontSize}
                    />
                  ))}
                </Subsection>
              );
            }

            if (child.type === "table") {
              return (
                <TableBlock
                  key={child.id}
                  {...props}
                  node={child}
                />
              );
            }

            if (child.type === "figure") {
              return <FigureBlock key={child.id} node={child} deleteNodeById={props.deleteNodeById} />;
            }

            return null;
          });
         })()}
        </Section>
      ))}
    </div>
  );
}