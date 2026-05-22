import type { DocumentNode } from "../types/document";

import {
  DndContext,
  closestCenter
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

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

  const style = {
    transform: CSS.Transform.toString(
      transform
    ),
    transition,
    padding: 6,
    marginBottom: 6,
    border: "1px solid #ddd",
    background: "white",
    cursor: "grab"
  };

  const isEditing =
    editingId === node.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {isEditing ? (
        <input
          autoFocus
          value={node.text}
          onChange={(e) =>
            updateTextById(
              node.id,
              e.target.value
            )
          }
          onBlur={() =>
            setEditingId(null)
          }
          style={{ width: "100%" }}
        />
      ) : (
        <p
          onClick={() =>
            setEditingId(node.id)
          }
          style={{ color : "333", margin: 0}}
        >
          {node.text}
        </p>
      )}

      <button
        onClick={() =>
          deleteNodeById(node.id)
        }
      >
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

  const style = {
    transform: CSS.Transform.toString(
      transform
    ),
    transition,
    marginBottom: 16,
    padding: 12,
    border: "1px solid #eee",
    background: "white",
    cursor: "grab"
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >

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
            style={{ color: "#333", cursor: "pointer"}}
          >
            {node.title}
          </h2>
        )}

      <button
        onClick={() =>
          addParagraph(node.id)
        }
      >
        + Add paragraph
      </button>

      <button
        onClick={() =>
          deleteNodeById(node.id)
        }
        style={{ marginLeft: 8 }}
      >
        Delete section
      </button>

      {/* PARAGRAPH SORTING */}
      <DndContext
        collisionDetection={
          closestCenter
        }
        onDragEnd={(event) => {
          const { active, over } =
            event;

          if (
            over &&
            active.id !== over.id
          ) {
            const oldIndex =
              node.children.findIndex(
                (c: any) =>
                  c.id === active.id
              );

            const newIndex =
              node.children.findIndex(
                (c: any) =>
                  c.id === over.id
              );

            reorderSectionChildren(
              node.id,
              oldIndex,
              newIndex
            );
          }
        }}
      >
        <SortableContext
          items={node.children.map(
            (c: any) => c.id
          )}
          strategy={
            verticalListSortingStrategy
          }
        >
          <div
            style={{
              marginTop: 12
            }}
          >
            {node.children.map(
              (c: any) => (
                <SortableParagraph
                  key={c.id}
                  node={c}
                  editingId={
                    editingId
                  }
                  setEditingId={
                    setEditingId
                  }
                  updateTextById={
                    updateTextById
                  }
                  deleteNodeById={
                    deleteNodeById
                  }
                />
              )
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById,
  addParagraph,
  deleteNodeById,
  reorderSectionChildren,
  reorderSections
}: {
  node: DocumentNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;

  updateTextById: (
    id: string,
    value: string
  ) => void;

  addParagraph: (
    sectionId: string
  ) => void;

  deleteNodeById: (
    id: string
  ) => void;

  reorderSectionChildren: (
    sectionId: string,
    oldIndex: number,
    newIndex: number
  ) => void;

  reorderSections: (
    oldIndex: number,
    newIndex: number
  ) => void;

  updateSectionTitle: (
    id: string,
    value: string
  ) => void;
}) {
  if (node.type !== "document") {
    return null;
  }

  return (
    <DndContext
      collisionDetection={
        closestCenter
      }
      onDragEnd={(event) => {
        const { active, over } =
          event;

        if (
          over &&
          active.id !== over.id
        ) {
          const oldIndex =
            node.children.findIndex(
              (c: any) =>
                c.id === active.id
            );

          const newIndex =
            node.children.findIndex(
              (c: any) =>
                c.id === over.id
            );

          reorderSections(
            oldIndex,
            newIndex
          );
        }
      }}
    >
      <SortableContext
        items={node.children.map(
          (c: any) => c.id
        )}
        strategy={
          verticalListSortingStrategy
        }
      >
        <div>
          {node.children.map(
            (c: any) => (
              <SortableSection
                key={c.id}
                node={c}
                editingId={editingId}
                setEditingId={
                  setEditingId
                }
                updateTextById={
                  updateTextById
                }
                addParagraph={
                  addParagraph
                }
                deleteNodeById={
                  deleteNodeById
                }
                reorderSectionChildren={
                  reorderSectionChildren
                }
              />
            )
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}