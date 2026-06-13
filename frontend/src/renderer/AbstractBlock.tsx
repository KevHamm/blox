import { TrashButton } from "./shared";

/* -----------------------------
   ABSTRACT — a singleton block after the title, before the first section.
----------------------------- */
export function AbstractBlock({ node, editingId, setEditingId, updateTextById, deleteNodeById, fontSize = 13, lineHeight = 1.2 }: any) {
  const isEditing = editingId === node.id;
  return (
    <div data-leaf-id={node.id} style={{ width: "80%", margin: "0 auto", marginTop: fontSize * 2, marginBottom: fontSize * 1.5 }}>
      {/* article abstract: \small body, centered \bfseries "Abstract" heading. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: fontSize * 0.4 }}>
        <div style={{ fontWeight: 700, fontSize: fontSize * 0.9, fontFamily: "var(--sans)", color: "var(--text)" }}>Abstract</div>
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete abstract" />
      </div>
      {isEditing ? (
        <textarea
          autoFocus
          value={node.text}
          onChange={(e) => updateTextById(node.id, e.target.value)}
          onBlur={() => setEditingId(null)}
          style={{
            width: "100%", minHeight: 90, padding: 8, border: "1px solid #ddd",
            lineHeight, fontSize: fontSize * 0.9, fontFamily: "var(--sans)", color: "var(--text)"
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{
            margin: 0, cursor: "pointer", textAlign: "justify",
            hyphens: "auto", WebkitHyphens: "auto",
            lineHeight, fontSize: fontSize * 0.9
          }}
        >
          {node.text}
        </p>
      )}
    </div>
  );
}
