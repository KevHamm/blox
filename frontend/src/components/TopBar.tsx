import type { CSSProperties } from "react";
import { isContainerType } from "../utils/paginateDocument";
import { COLUMN_GAP } from "../utils/pageConfig";

// Tall enough to hold the mini page preview — roughly half a sidebar's width.
export const TOPBAR_HEIGHT = 140;

type Heights = Record<string, number>;
type Bar = { kind: string; h: number };

// Flatten one column's chunks into stacked wireframe bars (height from the
// measured layout, so the preview is roughly to scale).
function columnBars(col: any[], leafH: Heights, headerH: Heights): Bar[] {
  const out: Bar[] = [];
  const walk = (chunk: any) => {
    const id = chunk.node.id;
    const t = chunk.node.type;
    if (isContainerType(t) || t === "frame") {
      if (chunk.header) out.push({ kind: "head", h: headerH[id] ?? 22 });
      (chunk.children ?? []).forEach(walk);
    } else {
      out.push({ kind: t, h: leafH[id] ?? (chunk.slice ? 48 : 70) });
    }
  };
  col.forEach(walk);
  return out;
}

function barStyle(kind: string, h: number): CSSProperties {
  const height = Math.max(h, 2);
  if (kind === "head") return { height, background: "#9097a6", borderRadius: 1, flex: "0 0 auto" };
  if (kind === "table" || kind === "figure" || kind === "math")
    return { height, background: "#cdd2db", border: "0.5px solid #b7bdc8", borderRadius: 1, flex: "0 0 auto" };
  return { height, background: "#dfe3ea", borderRadius: 1, flex: "0 0 auto" };
}

function MiniPage({ cols, layout, leafH, headerH, scale }: any) {
  const pageW = layout.pageWidth * scale;
  const pageH = layout.pageHeight * scale;
  const blockW =
    Math.min(layout.textWidth, layout.pageWidth - layout.padLeft - layout.padRight) * scale;
  return (
    <div
      style={{
        width: pageW,
        height: pageH,
        flex: "0 0 auto",
        background: "#fff",
        borderRadius: 2,
        boxShadow: "0 1px 4px rgba(20,20,50,0.18)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: layout.padTop * scale,
          bottom: layout.padBottom * scale,
          left: (pageW - blockW) / 2,
          width: blockW,
          display: "flex",
          gap: COLUMN_GAP * scale
        }}
      >
        {cols.map((col: any[], ci: number) => (
          <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: Math.max(1, scale) }}>
            {columnBars(col, leafH, headerH).map((b, i) => (
              <div key={i} style={barStyle(b.kind, b.h * scale)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function IconButton({ onClick, disabled, title, children }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.7)",
        color: disabled ? "#c0c0c6" : "#333",
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease"
      }}
    >
      {children}
    </button>
  );
}

export function TopBar({
  onBack, onUndo, onRedo, canUndo, canRedo, visible,
  pages, layout, leafHeights, headerHeights
}: any) {
  const miniH = TOPBAR_HEIGHT - 44;
  const scale = miniH / layout.pageHeight;

  return (
    <div
      className="ui-panel"
      style={{
        position: "relative",
        flex: "0 0 auto",
        height: TOPBAR_HEIGHT,
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        zIndex: 5,
        overflow: "hidden"
      }}
    >
      {/* Centered mini preview of the whole document; grows outward both ways. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          zIndex: 1,
          pointerEvents: "none"
        }}
      >
        {pages.map((cols: any[], i: number) => (
          <MiniPage key={i} cols={cols} layout={layout} leafH={leafHeights} headerH={headerHeights} scale={scale} />
        ))}
      </div>

      {/* Left controls, on a solid strip so the preview never shows through. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: "100%",
          paddingRight: 24,
          background:
            "linear-gradient(to right, rgba(251,251,253,0.95) 78%, rgba(251,251,253,0))"
        }}
      >
        <IconButton onClick={onBack} title="Back to templates">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </IconButton>

        <div
          style={{
            fontFamily: "var(--ui-font)",
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: "-0.02em",
            color: "var(--ui-text)",
            userSelect: "none"
          }}
        >
          BL<span style={{ color: "var(--ui-blue)" }}>o</span>X
        </div>

        <span style={{ width: 1, height: 26, background: "rgba(0,0,0,0.12)", margin: "0 2px" }} />

        <IconButton onClick={onUndo} disabled={!canUndo} title="Undo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4" />
            <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" />
          </svg>
        </IconButton>
        <IconButton onClick={onRedo} disabled={!canRedo} title="Redo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 14 20 9 15 4" />
            <path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h6" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
