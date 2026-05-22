import type { DocumentNode } from "../types/document";

import {
  DndContext,
  closestCenter
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
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

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById,
  addParagraph,
  deleteNodeById,
  reorderSectionChildren
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
}) {
  switch (node.type) {
    case "document":
      return (
        <div>
          {node.children.map((c) => (
            <DocumentRenderer
              key={c.id}
              node={c}
              editingId={editingId}
              setEditingId={setEditingId}
              updateTextById={updateTextById}
              addParagraph={addParagraph}
              deleteNodeById={deleteNodeById}
              reorderSectionChildren={
                reorderSectionChildren
              }
            />
          ))}
        </div>
      );

    case "section":
      return (
        <div
          style={{
            marginBottom: 16,
            padding: 8,
            border: "1px solid #eee"
          }}
        >
          <h2>{node.title}</h2>

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

          <DndContext
            collisionDetection={
              closestCenter
            }
            onDragEnd={(event) => {
              const {
                active,
                over
              } = event;

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
                (c) => c.id
              )}
              strategy={
                verticalListSortingStrategy
              }
            >
              <div
                style={{
                  marginTop: 8
                }}
              >
                {node.children.map(
                  (c) => (
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

    default:
      return null;
  }
}