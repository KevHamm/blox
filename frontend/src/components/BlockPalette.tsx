export function BlockPalette({
  onReset
}: {
  onReset: () => void;
}) {
  return (
    <div
      style={{
        width: 220,
        borderRight: "1px solid #0000000",
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
        <h3 style={{ marginBottom: 12 }}>
          Blocks
        </h3>

        {/* SECTION BLOCK */}
        <div
          style={{
            padding: 12,
            marginBottom: 10,
            border: "1px solid #000000",
            background: "white",
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
            Sortable container
          </div>
        </div>

        {/* PARAGRAPH BLOCK */}
        <div
          style={{
            padding: 12,
            border: "1px solid #000000",
            background: "white",
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
            Editable text
          </div>
        </div>
      </div>

      {/* BOTTOM AREA */}
      <div
        style={{
          marginTop: "auto"
        }}
      >
        <hr
          style={{
            margin: "16px 0"
          }}
        />

        <button
          onClick={onReset}
          style={{
            width: "100%",
            padding: 10
          }}
        >
          Reset Document
        </button>
      </div>
    </div>
  );
}