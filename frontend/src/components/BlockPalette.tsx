import { useDraggable } from "@dnd-kit/core";

function DraggableBlock({
  type,
  label,
  description
}: {
  type: string;
  label: string;
  description: string;
}) {
  const { attributes, listeners, setNodeRef, transform } =
    useDraggable({
      id: `palette-${type}`,
      data: {
        type,
        isPaletteItem: true
      }
    });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        padding: 12,
        marginBottom: 10,
        border: "1px solid #ccc",
        background: "white",
        borderRadius: 6,
        cursor: "grab",
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined
      }}
    >
      <strong>{label}</strong>
      <div style={{ fontSize: 12, color: "#666" }}>
        {description}
      </div>
    </div>
  );
}

export function BlockPalette({
  onReset
}: {
  onReset: () => void;
}) {
  return (
    <div
      style={{
        width: 220,
        borderRight: "1px solid #ddd",
        padding: 16,
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        background: "#fafafa",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div>
        <h3 style={{ marginBottom: 12 }}>Blocks</h3>

        <DraggableBlock
          type="section"
          label="Section"
          description="Container for paragraphs"
        />

        <DraggableBlock
          type="paragraph"
          label="Paragraph"
          description="Editable text block"
        />
      </div>

      <div style={{ marginTop: "auto" }}>
        <hr style={{ margin: "16px 0" }} />

        <button onClick={onReset} style={{ width: "100%", padding: 10 }}>
          Reset
        </button>
      </div>
    </div>
  );
}