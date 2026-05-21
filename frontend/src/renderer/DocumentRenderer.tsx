import type { DocumentNode } from "../types/document";

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById,
  addParagraph,
  deleteNodeById,
  moveNode
}: {
  node: DocumentNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  updateTextById: (id: string, value: string) => void;
  addParagraph: (sectionId: string) => void;
  deleteNodeById: (id: string) => void;
  moveNode: (draggedId: string, targetId: string) => void;
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
            />
          ))}

          {/* APPEND DROP ZONE */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const draggedId =
                e.dataTransfer.getData("text/plain");

              moveNode(draggedId, "__END__");
            }}
            style={{
              height: 40,
              marginTop: 12,
              border: "2px dashed #ccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
        Drop here to move to bottom
      </div>
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
            e.dataTransfer.setData(
              "text/plain",
              node.id
            );
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const draggedId =
              e.dataTransfer.getData("text/plain");

            if (draggedId !== node.id) {
              moveNode(draggedId, node.id);
            }
          }}
          style={{
            padding: 6,
            marginBottom: 6,
            border: "1px solid #ddd",
            background: "white",
            cursor: "grab"
          }}
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
              onBlur={() => setEditingId(null)}
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

    default:
      return null;
  }
}