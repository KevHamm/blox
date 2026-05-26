import type { DocumentNode } from "../types/document";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/* -----------------------------
   SECTION (DRAGGABLE)
----------------------------- */
function SortableSection({
  node,
  index,
  editingId,
  setEditingId,
  updateTextById,
  updateSectionTitle,
  addParagraph,
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
            fontSize: 20,
            fontWeight: 600,
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

      <button onClick={() => addParagraph(node.id)}>
        + Add paragraph
      </button>

      <button onClick={() => deleteNodeById(node.id)}>
        Delete section
      </button>

      {/* PARAGRAPHS */}
      <div style={{ marginTop: 12 }}>
        {node.children.map((c: any) => {
          const isEditing = editingId === c.id;

          return (
            <div
              key={c.id}
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
                  value={c.text}
                  onChange={(e) =>
                    updateTextById(c.id, e.target.value)
                  }
                  onBlur={() => setEditingId(null)}
                  style={{
                    width: "100%",
                    textAlign: "left"
                  }}
                />
              ) : (
                <p
                  onClick={() => setEditingId(c.id)}
                  style={{
                    color: "#333",
                    margin: 0,
                    textAlign: "left"
                  }}
                >
                  {c.text}
                </p>
              )}
            </div>
          );
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
  addParagraph,
  deleteNodeById
}: any) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: "document-root"
  });

  return (
    <div ref={setDropRef} style={{ minHeight: 200 }}>
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
              addParagraph={addParagraph}
              deleteNodeById={deleteNodeById}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}