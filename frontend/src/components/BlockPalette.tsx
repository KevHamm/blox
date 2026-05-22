import { useDraggable } from "@dnd-kit/core";

function DraggableBlock({
  type,
  label,
  description
}: {
  type: "section";
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

  const style: React.CSSProperties = {
    padding: 12,
    marginBottom: 10,
    border: "1px solid #ccc",
    background: "white",
    borderRadius: 6,
    cursor: "grab",
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    touchAction: "none"
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
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
        <h3>Blocks</h3>

        <DraggableBlock
          type="section"
          label="Section"
          description="A section with paragraph."
        />
      </div>

      <div style={{ marginTop: "auto" }}>
        <hr />
        <button onClick={onReset} style={{ width: "100%" }}>
          Reset
        </button>
      </div>
    </div>
  );
}