import type { DocumentNode } from "../types/document";

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById,
  addParagraph,
  deleteNodeById
}: {
  node: DocumentNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  updateTextById: (id: string, value: string) => void;
  addParagraph: (sectionId: string) => void;
  deleteNodeById: (id: string) => void;
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
            />
          ))}
        </div>
      );

    case "section":
      return (
        <div style={{ marginBottom: 16 }}>
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
              />
            ))}
          </div>
        </div>
      );

    case "paragraph":
      const isEditing = editingId === node.id;

      return isEditing ? (
        <div>
          <input
            autoFocus
            value={node.text}
            onChange={(e) => updateTextById(node.id, e.target.value)}
            onBlur={() => setEditingId(null)}
          />

          <button onClick={() => deleteNodeById(node.id)}>
            Delete
          </button>
        </div>
      ) : (
        <div>
          <p onClick={() => setEditingId(node.id)}>{node.text}</p>

          <button onClick={() => deleteNodeById(node.id)}>
            Delete
          </button>
        </div>
      );

    default:
      return null;
  }
}