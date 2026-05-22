import type { DocumentNode } from "../types/document";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/* -----------------------------
   SECTION (ONLY DRAGGABLE UNIT)
----------------------------- */
function SortableSection({
  node,
  editingId,
  setEditingId,
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
      {/* Drag handle ONLY for section */}
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
            outline: "none"
          }}
        />
      ) : (
        <h2
          onClick={() => setEditingId(node.id)}
          style={{ color: "#333", cursor: "pointer" }}
        >
          {node.title}
        </h2>
      )}

      <button onClick={() => addParagraph(node.id)}>
        + Add paragraph
      </button>

      <button onClick={() => deleteNodeById(node.id)}>
        Delete section
      </button>

      {/* PARAGRAPHS (NOT DRAGGABLE ANYMORE) */}
      <div style={{ marginTop: 12 }}>
        {node.children.map((c: any) => (
          <div
            key={c.id}
            style={{
              padding: 6,
              marginBottom: 6,
              border: "1px solid #ddd",
              background: "white"
            }}
          >
            <p style={{ color: "#333", margin: 0 }}>
              {c.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -----------------------------
   ROOT DOCUMENT
----------------------------- */
export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateSectionTitle,
  addParagraph,
  deleteNodeById,
  reorderSections
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
          {node.children.map((c: any) => (
            <SortableSection
              key={c.id}
              node={c}
              editingId={editingId}
              setEditingId={setEditingId}
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