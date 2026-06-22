import { DesignPreview } from "../components/welcome/DesignPreview";
import { TrashIcon } from "../components/TrashIcon";
import { pageSizeDiffers, pageSizeLabel } from "../types/design";

// An imported free-form design page, rendered full-bleed inside a document page.
//
// The wrapper is absolutely positioned over the whole `.blox-page` (which is the
// nearest positioned ancestor), so it covers the document's margins too —
// designs paint edge-to-edge and carry their own background. `DesignPreview`
// positions every element by % of the design's own width/height, so when the
// design's page size differs from the document's, it is stretched to fit (which
// can "break" the layout — hence the warning badge).
export function DesignPageBlock({
  node, docPageWidth, docPageHeight, deleteNodeById, readOnly
}: {
  node: any;
  docPageWidth: number;
  docPageHeight: number;
  deleteNodeById?: (id: string) => void;
  readOnly?: boolean;
}) {
  const design = node.design;
  if (!design) return null;

  const mismatch = pageSizeDiffers(design.pageWidth, design.pageHeight, docPageWidth, docPageHeight);

  return (
    <div
      data-leaf-id={node.id}
      className="designpage-layer"
      style={{ position: "absolute", inset: 0, background: design.bg, overflow: "hidden" }}
    >
      <DesignPreview design={design} />

      {/* Top-right controls: a size-mismatch warning and a delete button. They
          sit above the design and stay legible on any background. */}
      {!readOnly && (
        <div
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 5,
            display: "flex", alignItems: "center", gap: 8
          }}
        >
          {mismatch && (
            <span
              className="designpage-warn"
              title={`This page is ${pageSizeLabel(design.pageWidth, design.pageHeight)}, but the document is ${pageSizeLabel(docPageWidth, docPageHeight)}. The layout may be distorted.`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 9px", borderRadius: 999,
                background: "#fff7e6", color: "#92610a",
                border: "1px solid #f0c674",
                fontFamily: "var(--ui-font)", fontSize: 11, fontWeight: 600,
                boxShadow: "0 1px 4px rgba(0,0,0,0.15)"
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Size mismatch
            </span>
          )}
          {deleteNodeById && (
            <button
              onClick={() => deleteNodeById(node.id)}
              title="Delete page"
              aria-label="Delete page"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 7, cursor: "pointer",
                background: "rgba(255,255,255,0.92)", color: "#c0392b",
                border: "1px solid rgba(0,0,0,0.12)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.18)"
              }}
            >
              <TrashIcon size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
