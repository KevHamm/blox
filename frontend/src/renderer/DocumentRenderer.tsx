import type { DocumentNode } from "../types/document";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";

import { CSS } from "@dnd-kit/utilities";

function SortableParagraph({
  node,
  editingId,
  setEditingId,
  updateTextById,
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
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        padding: 6,
        marginBottom: 6,
        border: "1px solid #ddd",
        background: "white",
        cursor: "grab"
      }}
    >
      {editingId === node.id ? (
        <input
          autoFocus
          value={node.text}
          onChange={(e) =>
            updateTextById(node.id, e.target.value)
          }
          onBlur={() => setEditingId(null)}
          style={{ width: "100%" }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{ color: "#333", margin: 0 }}
        >
          {node.text}
        </p>
      )}

      <button onClick={() => deleteNodeById(node.id)}>
        Delete
      </button>
    </div>
  );
}

function SortableSection({
  node,
  editingId,
  setEditingId,
  updateTextById,
  updateSectionTitle,
  addParagraph,
  deleteNodeById,
  reorderSectionChildren
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
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: 16,
        padding: 12,
        border: "1px solid #eee",
        background: "white",
        cursor: "grab"
      }}
    >
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

      {/* PARAGRAPHS ROOT (IMPORTANT DROPPABLE SURFACE) */}
      <div style={{ minHeight: 20, marginTop: 12 }}>
        <SortableContext
          items={node.children.map((c: any) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {node.children.map((c: any) => (
            <SortableParagraph
              key={c.id}
              node={c}
              editingId={editingId}
              setEditingId={setEditingId}
              updateTextById={updateTextById}
              deleteNodeById={deleteNodeById}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById,
  updateSectionTitle,
  addParagraph,
  deleteNodeById,
  reorderSections,
  reorderSectionChildren
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
          {node.children.map((c: any) => (
            <SortableSection
              key={c.id}
              node={c}
              editingId={editingId}
              setEditingId={setEditingId}
              updateTextById={updateTextById}
              updateSectionTitle={updateSectionTitle}
              addParagraph={addParagraph}
              deleteNodeById={deleteNodeById}
              reorderSectionChildren={reorderSectionChildren}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}