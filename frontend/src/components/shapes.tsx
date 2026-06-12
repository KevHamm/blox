import { useState } from "react";
import type { Shape } from "../types/document";
import { TrashIcon } from "./TrashIcon";

const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// A few quick stroke-colour presets shown in the shape toolbar.
const COLOR_PRESETS = ["#1d1d1f", "#0071e3", "#e0392b", "#1f9d55", "#f5a623", "#8e44ad"];

type Geom = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";

// The vector graphic itself (stroke + optional fill / arrowhead).
function ShapeGraphic({ shape, w, h }: { shape: Shape; w: number; h: number }) {
  const sw = shape.strokeWidth;
  const color = shape.color;

  if (shape.kind === "rect") {
    const i = sw / 2;
    return (
      <rect
        x={i} y={i} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)}
        fill={shape.fill ?? "none"} stroke={color} strokeWidth={sw}
      />
    );
  }
  if (shape.kind === "circle") {
    return (
      <ellipse
        cx={w / 2} cy={h / 2} rx={Math.max(0, (w - sw) / 2)} ry={Math.max(0, (h - sw) / 2)}
        fill={shape.fill ?? "none"} stroke={color} strokeWidth={sw}
      />
    );
  }
  // line / arrow — drawn across the chosen diagonal of the box.
  const [x1, y1, x2, y2] = shape.flip ? [0, h, w, 0] : [0, 0, w, h];
  const markerId = `bloxarrow-${shape.id}`;
  return (
    <>
      {shape.kind === "arrow" && (
        <defs>
          <marker
            id={markerId} markerWidth="10" markerHeight="8" refX="7.5" refY="3"
            orient="auto" markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,3 L0,6 Z" fill={color} />
          </marker>
        </defs>
      )}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeLinecap="round"
        markerEnd={shape.kind === "arrow" ? `url(#${markerId})` : undefined}
      />
    </>
  );
}

// Transparent, easy-to-grab hit target (a fat invisible stroke for lines, the
// whole box for rect/circle) so even thin shapes are clickable.
function ShapeHit({ shape, w, h, onGrab }: { shape: Shape; w: number; h: number; onGrab: (e: React.PointerEvent) => void }) {
  if (shape.kind === "rect" || shape.kind === "circle") {
    return (
      <rect
        x={0} y={0} width={w} height={h} fill="transparent"
        style={{ pointerEvents: "all", cursor: "move" }} onPointerDown={onGrab}
      />
    );
  }
  const [x1, y1, x2, y2] = shape.flip ? [0, h, w, 0] : [0, 0, w, h];
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent"
      strokeWidth={Math.max(14, shape.strokeWidth + 8)} strokeLinecap="round"
      style={{ pointerEvents: "stroke", cursor: "move" }} onPointerDown={onGrab}
    />
  );
}

const HANDLE_CURSOR: Record<Corner, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize" };

// One selectable / movable / resizable shape with its floating toolbar.
function ShapeView({
  shape, selected, pageWidth, pageHeight, onSelect, onCommit, onPatch, onDelete
}: {
  shape: Shape;
  selected: boolean;
  pageWidth: number;
  pageHeight: number;
  onSelect: () => void;
  onCommit: (patch: Geom) => void;     // end of a move/resize gesture (1 history entry)
  onPatch: (patch: Partial<Shape>) => void; // discrete style change
  onDelete: () => void;
}) {
  // Live geometry while a gesture is in flight (kept local so the document — and
  // therefore the undo history — is only touched once, on release).
  const [live, setLive] = useState<Geom | null>(null);
  const g: Geom = live ?? { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  const minSize = shape.kind === "line" || shape.kind === "arrow" ? 0 : 12;

  function startMove(e: React.PointerEvent) {
    e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY;
    const o = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    const move = (ev: PointerEvent) => {
      const nx = clampNum(o.x + (ev.clientX - sx), 0, pageWidth - o.w);
      const ny = clampNum(o.y + (ev.clientY - sy), 0, pageHeight - o.h);
      setLive({ ...o, x: nx, y: ny });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const nx = clampNum(o.x + (ev.clientX - sx), 0, pageWidth - o.w);
      const ny = clampNum(o.y + (ev.clientY - sy), 0, pageHeight - o.h);
      setLive(null);
      if (nx !== o.x || ny !== o.y) onCommit({ ...o, x: nx, y: ny });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent, corner: Corner) {
    e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY;
    const o = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    const compute = (ev: PointerEvent): Geom => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = o;
      if (corner.includes("e")) w = o.w + dx;
      if (corner.includes("s")) h = o.h + dy;
      if (corner.includes("w")) { w = o.w - dx; x = o.x + dx; }
      if (corner.includes("n")) { h = o.h - dy; y = o.y + dy; }
      if (w < minSize) { if (corner.includes("w")) x = o.x + (o.w - minSize); w = minSize; }
      if (h < minSize) { if (corner.includes("n")) y = o.y + (o.h - minSize); h = minSize; }
      // Keep the box inside the page.
      x = clampNum(x, 0, pageWidth); y = clampNum(y, 0, pageHeight);
      w = clampNum(w, minSize, pageWidth - x); h = clampNum(h, minSize, pageHeight - y);
      return { x, y, w, h };
    };
    const move = (ev: PointerEvent) => setLive(compute(ev));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const next = compute(ev);
      setLive(null);
      onCommit(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const W = Math.max(g.w, 1), H = Math.max(g.h, 1);
  const hasFill = shape.kind === "rect" || shape.kind === "circle";
  const isLine = shape.kind === "line" || shape.kind === "arrow";
  // Place the toolbar above the shape, or below it when it sits near the page top.
  const toolbarBelow = g.y < 52;

  return (
    <div data-shape style={{ position: "absolute", left: g.x, top: g.y, width: W, height: H, pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <ShapeGraphic shape={{ ...shape, ...g }} w={g.w} h={g.h} />
        <ShapeHit shape={shape} w={W} h={H} onGrab={startMove} />
      </svg>

      {selected && (
        <>
          {/* selection box */}
          <div style={{ position: "absolute", inset: -2, border: "1px dashed var(--ui-blue)", borderRadius: 2, pointerEvents: "none" }} />
          {/* corner resize handles */}
          {(["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
            <div
              key={c}
              onPointerDown={(e) => startResize(e, c)}
              style={{
                position: "absolute",
                left: c.includes("w") ? -5 : undefined,
                right: c.includes("e") ? -5 : undefined,
                top: c.includes("n") ? -5 : undefined,
                bottom: c.includes("s") ? -5 : undefined,
                width: 10, height: 10, borderRadius: 3,
                background: "#fff", border: "1.5px solid var(--ui-blue)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                cursor: HANDLE_CURSOR[c], pointerEvents: "auto", touchAction: "none"
              }}
            />
          ))}

          {/* toolbar */}
          <div
            data-shape-toolbar
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: 0,
              top: toolbarBelow ? H + 12 : -46,
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 10,
              background: "var(--panel-bg)",
              border: "1px solid var(--ui-hairline)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: "0 6px 20px rgba(20,20,50,0.18)",
              pointerEvents: "auto", whiteSpace: "nowrap", zIndex: 10,
              fontFamily: "var(--ui-font)"
            }}
          >
            {/* stroke colour presets + custom */}
            {COLOR_PRESETS.map((col) => (
              <button
                key={col}
                title={`Stroke ${col}`}
                onClick={() => onPatch({ color: col })}
                style={{
                  width: 16, height: 16, borderRadius: "50%", background: col, cursor: "pointer",
                  border: shape.color.toLowerCase() === col ? "2px solid var(--ui-blue)" : "1px solid rgba(0,0,0,0.25)",
                  padding: 0
                }}
              />
            ))}
            <label title="Custom stroke colour" style={{ display: "inline-flex", cursor: "pointer" }}>
              <input
                type="color"
                value={shape.color}
                onChange={(e) => onPatch({ color: e.target.value })}
                style={{ width: 18, height: 18, padding: 0, border: "none", background: "none", cursor: "pointer" }}
              />
            </label>

            <span style={{ width: 1, height: 18, background: "var(--divider)" }} />

            {/* thickness stepper */}
            <span style={{ fontSize: 11, color: "var(--ui-2nd)" }}>{isLine ? "Line" : "Wall"}</span>
            <button
              className="shape-step" title="Thinner"
              onClick={() => onPatch({ strokeWidth: clampNum(shape.strokeWidth - 1, 1, 40) })}
            >−</button>
            <span style={{ fontSize: 12, minWidth: 16, textAlign: "center", color: "var(--ui-text)" }}>{shape.strokeWidth}</span>
            <button
              className="shape-step" title="Thicker"
              onClick={() => onPatch({ strokeWidth: clampNum(shape.strokeWidth + 1, 1, 40) })}
            >+</button>

            {hasFill && (
              <>
                <span style={{ width: 1, height: 18, background: "var(--divider)" }} />
                <span style={{ fontSize: 11, color: "var(--ui-2nd)" }}>Fill</span>
                <label title="Fill colour" style={{ display: "inline-flex", cursor: "pointer" }}>
                  <input
                    type="color"
                    value={shape.fill ?? "#cccccc"}
                    onChange={(e) => onPatch({ fill: e.target.value })}
                    style={{ width: 18, height: 18, padding: 0, border: "none", background: "none", cursor: "pointer" }}
                  />
                </label>
                {shape.fill && (
                  <button className="shape-step" title="No fill" onClick={() => onPatch({ fill: null })}>✕</button>
                )}
              </>
            )}

            {isLine && (
              <>
                <span style={{ width: 1, height: 18, background: "var(--divider)" }} />
                <button className="shape-step" title="Flip diagonal" onClick={() => onPatch({ flip: !shape.flip })}>⤢</button>
              </>
            )}

            <span style={{ width: 1, height: 18, background: "var(--divider)" }} />
            <button
              title="Delete shape"
              onClick={onDelete}
              style={{ border: "none", background: "transparent", color: "var(--ui-danger-text)", cursor: "pointer", padding: 2, display: "inline-flex" }}
            >
              <TrashIcon size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// The overlay layer for a single page: renders that page's shapes. It is itself
// click-through (pointer-events: none); only the shapes opt back in.
export function ShapeLayer({
  pageIndex, pageWidth, pageHeight, shapes, selectedId, onSelect, onCommit, onPatch, onDelete
}: {
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  shapes: Shape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (id: string, patch: Geom) => void;
  onPatch: (id: string, patch: Partial<Shape>) => void;
  onDelete: (id: string) => void;
}) {
  const mine = shapes.filter((s) => s.page === pageIndex);
  if (!mine.length) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      {mine.map((s) => (
        <ShapeView
          key={s.id}
          shape={s}
          selected={selectedId === s.id}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          onSelect={() => onSelect(s.id)}
          onCommit={(patch) => onCommit(s.id, patch)}
          onPatch={(patch) => onPatch(s.id, patch)}
          onDelete={() => onDelete(s.id)}
        />
      ))}
    </div>
  );
}
