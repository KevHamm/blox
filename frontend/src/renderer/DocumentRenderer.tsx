import type { DocumentNode } from "../types/document";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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
        border: "1px solid #ddd",
        background: "white"
      }}
    >
      {isEditing ? (
        <input
          autoFocus
          value={node.text}
          onChange={(e) =>
            updateTextById(node.id, e.target.value)
          }
          onBlur={() => setEditingId(null)}
          style={{
            width: "100%",
            textAlign: "left"
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{
            color: "#333",
            margin: 0,
            textAlign: "left"
          }}
        >
          {node.text}
        </p>
      )}
    </div>
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
    <div
      style={{
        marginTop: 20,
        marginLeft: 20
      }}
    >
      {/* SUBSECTION TITLE */}
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
            color: "#333",
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
            color: "#333",
            cursor: "pointer",
            textAlign: "left"
          }}
        >
          {sectionIndex + 1}.{subsectionIndex + 1}{" "}
          {node.title}
        </h3>
      )}

      {/* SUBSECTION PARAGRAPHS */}
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
  deleteNodeById
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: node.id
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: 16,
        padding: 12,
        border: "1px solid #eee",
        background: "white"
      }}
    >
      {/* DRAG HANDLE */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          paddingBottom: 8,
          fontSize: 12,
          color: "#888"
        }}
      >
        ☰ Drag Section
      </div>

      {/* SECTION TITLE */}
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
            color: "#333",
            width: "100%",
            border: "none",
            outline: "none",
            textAlign: "left"
          }}
        />
      ) : (
        <h2
          onClick={() => setEditingId(node.id)}
          style={{
            color: "#333",
            cursor: "pointer",
            textAlign: "left"
          }}
        >
          {index + 1} {node.title}
        </h2>
      )}

      <button onClick={() => addSubsection(node.id)}>
        + Add subsection
      </button>

      <button onClick={() => deleteNodeById(node.id)}>
        Delete section
      </button>

      {/* SECTION CONTENT */}
      <div style={{ marginTop: 12 }}>
        {node.children.map((child: any, childIndex: number) => {
          // paragraph directly inside section
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

          // subsection
          if (child.type === "subsection") {
            return (
              <Subsection
                key={child.id}
                node={child}
                sectionIndex={index}
                subsectionIndex={childIndex}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
                updateSectionTitle={updateSectionTitle}
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
  deleteNodeById
}: any) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: "document-root"
  });

  return (
    <div
      ref={setDropRef}
      style={{ minHeight: 200 }}
    >
      <SortableContext
        items={node.children.map((c: any) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
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
              deleteNodeById={deleteNodeById}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}