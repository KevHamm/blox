import type { DocumentNode } from "../types/document";

export function DocumentRenderer({
  node,
  editingId,
  setEditingId,
  updateTextById
}: {
  node: DocumentNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  updateTextById: (id: string, value: string) => void;
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
            />
          ))}
        </div>
      );

    case "section":
      return (
        <div style={{ marginBottom: 16 }}>
          <h2>{node.title}</h2>

          {node.children.map((c) => (
            <DocumentRenderer
              key={c.id}
              node={c}
              editingId={editingId}
              setEditingId={setEditingId}
              updateTextById={updateTextById}
            />
          ))}
        </div>
      );

    case "paragraph":
      const isEditing = editingId === node.id;

      return isEditing ? (
        <input
          autoFocus
          value={node.text}
          onChange={(e) => updateTextById(node.id, e.target.value)}
          onBlur={() => setEditingId(null)}
        />
      ) : (
        <p onClick={() => setEditingId(node.id)}>{node.text}</p>
      );
  }
}