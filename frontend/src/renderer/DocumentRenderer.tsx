import type { DocumentNode } from "../types/document";

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById,
  addParagraph,
  deleteNodeById,
  moveNode,
  dropTarget,
  setDropTarget
}: {
  node: DocumentNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  updateTextById: (id: string, value: string) => void;
  addParagraph: (sectionId: string) => void;
  deleteNodeById: (id: string) => void;
  moveNode: (draggedId: string, targetId: string, position?: "above" | "below") => void;
  dropTarget: {
    id: string | null;
    position: "above" | "below" | null;
  };
  setDropTarget: (v: any) => void;
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
              moveNode={moveNode}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
            />
          ))}
        </div>
      );

    case "section":
      return (
        <div style={{ marginBottom: 16, padding: 8, border: "1px solid #eee" }}>
          <h2>{node.title}</h2>

          <button onClick={() => addParagraph(node.id)}>
            + Add paragraph
          </button>

          <button
            onClick={() => deleteNodeById(node.id)}
            style={{ marginLeft: 8 }}
          >
            Delete section
          </button>

          <div style={{ marginTop: 8 }}>
            {node.children.map((c) => (
              <DocumentRenderer
                key={c.id}
                node={c}
                editingId={editingId}
                setEditingId={setEditingId}
                updateTextById={updateTextById}
                addParagraph={addParagraph}
                deleteNodeById={deleteNodeById}
                moveNode={moveNode}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
              />
            ))}
          </div>
        </div>
      );

    case "paragraph": {
      const isEditing = editingId === node.id;

      return (
        <div
          draggable={!isEditing}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", node.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();

            const rect =
              (e.currentTarget as HTMLElement).getBoundingClientRect();

            const mid = rect.top + rect.height / 2;

            const position =
              e.clientY < mid ? "above" : "below";

            setDropTarget({
              id: node.id,
              position
            });
          }}
          onDrop={(e) => {
            const draggedId =
              e.dataTransfer.getData("text/plain");

            if (draggedId !== node.id) {
              moveNode(
                draggedId,
                node.id,
                dropTarget.position
              );
            }

            setDropTarget({
              id: null,
              position: null
            });
          }}
          style={{
            padding: 6,
            marginBottom: 6,
            border: "1px solid #ddd",
            background: "white",
            cursor: "grab"
          }}
        >
          {/* INSERTION INDICATOR (ABOVE) */}
          {dropTarget.id === node.id &&
            dropTarget.position === "above" && (
              <div
                style={{
                  height: 2,
                  background: "blue",
                  marginBottom: 4
                }}
              />
            )}

          {isEditing ? (
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
            <p onClick={() => setEditingId(node.id)}>
              {node.text}
            </p>
          )}

          <button onClick={() => deleteNodeById(node.id)}>
            Delete
          </button>

          {/* INSERTION INDICATOR (BELOW) */}
          {dropTarget.id === node.id &&
            dropTarget.position === "below" && (
              <div
                style={{
                  height: 2,
                  background: "blue",
                  marginTop: 4
                }}
              />
            )}
        </div>
      );
    }

    default:
      return null;
  }
}