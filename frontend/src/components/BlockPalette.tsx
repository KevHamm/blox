export function BlockPalette() {
  function onDragStart(
    e: React.DragEvent,
    blockType: "section" | "paragraph"
  ) {
    e.dataTransfer.setData(
      "application/blox-block",
      blockType
    );
  }

  return (
    <div
      style={{
        width: 220,
        borderLeft: "1px solid #ddd",
        padding: 16,
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        background: "#fafafa"
      }}
    >
      <h3 style={{ marginBottom: 12 }}>
        Blocks
      </h3>

      {/* SECTION BLOCK */}
      <div
        draggable
        onDragStart={(e) =>
          onDragStart(e, "section")
        }
        style={{
          padding: 12,
          marginBottom: 10,
          border: "1px solid #ccc",
          background: "white",
          cursor: "grab",
          borderRadius: 6
        }}
      >
        <strong>Section</strong>
        <div
          style={{
            fontSize: 12,
            color: "#666"
          }}
        >
          Container for paragraphs
        </div>
      </div>

      {/* PARAGRAPH BLOCK */}
      <div
        draggable
        onDragStart={(e) =>
          onDragStart(e, "paragraph")
        }
        style={{
          padding: 12,
          border: "1px solid #ccc",
          background: "white",
          cursor: "grab",
          borderRadius: 6
        }}
      >
        <strong>Paragraph</strong>
        <div
          style={{
            fontSize: 12,
            color: "#666"
          }}
        >
          Editable text block
        </div>
      </div>
    </div>
  );
}