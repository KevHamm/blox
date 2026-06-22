import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DesignElement } from "../../types/design";
import { DOC_FONTS, docFontCss } from "../../utils/fonts";
import { TrashIcon } from "../TrashIcon";

const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Quick colour presets (text / fill / stroke) shown in element toolbars.
const COLOR_PRESETS = ["#111111", "#ffffff", "#7c3aed", "#e0392b", "#0071e3", "#1f9d55", "#f5a623"];

type Geom = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";
const HANDLE_CURSOR: Record<Corner, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize"
};

export function DesignElementView({
  el, selected, pageWidth, pageHeight, onSelect, onCommitGeom, onPatch, onDelete
}: {
  el: DesignElement;
  selected: boolean;
  pageWidth: number;
  pageHeight: number;
  onSelect: () => void;
  onCommitGeom: (g: Geom) => void;        // end of a move/resize gesture (1 history entry)
  onPatch: (patch: Partial<DesignElement>) => void; // discrete style/text change
  onDelete: () => void;
}) {
  // Live geometry while a gesture is in flight (kept local so history is touched
  // only once, on release).
  const [live, setLive] = useState<Geom | null>(null);
  const g: Geom = live ?? { x: el.x, y: el.y, w: el.w, h: el.h };
  // Live rotation while the rotate handle is dragged (committed once on release).
  const [liveRot, setLiveRot] = useState<number | null>(null);
  const rot = liveRot ?? el.rotation ?? 0;
  // Text elements toggle into an editing mode on double-click.
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isText = el.kind === "text";
  const isLine = el.kind === "line";
  const minSize = isLine ? 0 : 12;

  // Keep the editable DOM in sync with the model whenever it isn't being typed in.
  useEffect(() => {
    const node = textRef.current;
    if (node && document.activeElement !== node) {
      const t = el.text ?? "";
      if (node.innerText !== t) node.innerText = t;
    }
  }, [el.text, editing]);

  // Focus + caret-to-end when entering edit mode.
  useEffect(() => {
    if (!editing) return;
    const node = textRef.current;
    if (!node) return;
    node.focus();
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [editing]);

  function commitText() {
    setEditing(false);
    const t = textRef.current?.innerText ?? "";
    if (t !== (el.text ?? "")) onPatch({ text: t });
  }
  // Leaving the selection (click-away / Delete elsewhere) also ends editing.
  useEffect(() => {
    if (!selected && editing) commitText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function startMove(e: React.PointerEvent) {
    if (editing) return;
    e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY;
    const o = { x: el.x, y: el.y, w: el.w, h: el.h };
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
      if (nx !== o.x || ny !== o.y) onCommitGeom({ ...o, x: nx, y: ny });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent, corner: Corner) {
    e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY;
    const o = { x: el.x, y: el.y, w: el.w, h: el.h };
    const compute = (ev: PointerEvent): Geom => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = o;
      if (corner.includes("e")) w = o.w + dx;
      if (corner.includes("s")) h = o.h + dy;
      if (corner.includes("w")) { w = o.w - dx; x = o.x + dx; }
      if (corner.includes("n")) { h = o.h - dy; y = o.y + dy; }
      if (w < minSize) { if (corner.includes("w")) x = o.x + (o.w - minSize); w = minSize; }
      if (h < minSize) { if (corner.includes("n")) y = o.y + (o.h - minSize); h = minSize; }
      x = clampNum(x, 0, pageWidth); y = clampNum(y, 0, pageHeight);
      w = clampNum(w, minSize, pageWidth - x); h = clampNum(h, minSize, pageHeight - y);
      return { x, y, w, h };
    };
    const move = (ev: PointerEvent) => setLive(compute(ev));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(compute(ev));
      onCommitGeom(compute(ev));
      setLive(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Free rotation about the element's centre. The unrotated wrapper's bounding
  // box gives a stable centre (rotation is body-only, so the centre never moves);
  // angles snap to the 90° marks within 4°.
  function startRotate(e: React.PointerEvent) {
    e.stopPropagation();
    onSelect();
    const rect = wrapRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const start = el.rotation ?? 0;
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx);
    const compute = (ev: PointerEvent) => {
      let deg = start + (Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180 / Math.PI;
      deg = ((Math.round(deg) % 360) + 360) % 360;
      for (const s of [0, 90, 180, 270, 360]) if (Math.abs(deg - s) <= 4) deg = s % 360;
      return deg;
    };
    const move = (ev: PointerEvent) => setLiveRot(compute(ev));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const deg = compute(ev);
      setLiveRot(null);
      if (deg !== (el.rotation ?? 0)) onPatch({ rotation: deg || undefined });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPatch({ src: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const W = Math.max(g.w, 1), H = Math.max(g.h, 1);
  const toolbarBelow = g.y < 56;

  // ── The element body (the drawn content + its drag surface) ───────────
  let body: React.ReactNode = null;
  if (isText) {
    const style: CSSProperties = {
      width: "100%", height: "100%", boxSizing: "border-box",
      fontFamily: docFontCss(el.fontFamily ?? "cm"),
      fontSize: el.fontSize ?? 24,
      fontWeight: el.bold ? 700 : 400,
      fontStyle: el.italic ? "italic" : "normal",
      textDecoration: el.underline ? "underline" : "none",
      color: el.color ?? "#111111",
      textAlign: (el.align ?? "left") as CSSProperties["textAlign"],
      lineHeight: 1.2, whiteSpace: "pre-wrap", wordBreak: "break-word",
      overflow: "hidden", outline: "none",
      cursor: editing ? "text" : "move",
      userSelect: editing ? "text" : "none",
      pointerEvents: "auto"
    };
    body = (
      <div
        ref={textRef}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        style={style}
        onPointerDown={startMove}
        onDoubleClick={() => { onSelect(); setEditing(true); }}
        onBlur={commitText}
      />
    );
  } else if (el.kind === "image") {
    body = (
      <div style={{ width: "100%", height: "100%", cursor: "move", pointerEvents: "auto", transform: rot ? `rotate(${rot}deg)` : undefined, transformOrigin: "center" }} onPointerDown={startMove}>
        {el.src
          ? <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontFamily: "var(--ui-font)", fontSize: 12, background: "rgba(0,0,0,0.04)" }}>No image</div>}
      </div>
    );
  } else if (el.kind === "rect") {
    body = (
      <div
        onPointerDown={startMove}
        style={{
          width: "100%", height: "100%", cursor: "move", pointerEvents: "auto",
          background: el.fill ?? "transparent",
          border: (el.strokeWidth ?? 0) > 0 ? `${el.strokeWidth}px solid ${el.stroke ?? "#111111"}` : "none",
          boxSizing: "border-box"
        }}
      />
    );
  } else {
    // line — drawn across the box's diagonal; a fat invisible stroke is the grab target.
    const sw = el.strokeWidth ?? 2;
    body = (
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <line x1={0} y1={0} x2={W} y2={H} stroke={el.stroke ?? "#111111"} strokeWidth={sw} strokeLinecap="round" />
        <line x1={0} y1={0} x2={W} y2={H} stroke="transparent" strokeWidth={Math.max(14, sw + 8)}
              strokeLinecap="round" style={{ pointerEvents: "stroke", cursor: "move" }} onPointerDown={startMove} />
      </svg>
    );
  }

  return (
    <div ref={wrapRef} data-design-el style={{ position: "absolute", left: g.x, top: g.y, width: W, height: H, pointerEvents: "none" }}>
      {body}

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

          {/* rotate handle (images) — a knob on a short stem above the box */}
          {el.kind === "image" && (
            <>
              <div style={{ position: "absolute", left: "50%", top: -26, width: 1, height: 26, background: "var(--ui-blue)", transform: "translateX(-50%)", pointerEvents: "none" }} />
              <div
                title="Rotate"
                onPointerDown={startRotate}
                style={{
                  position: "absolute", left: "50%", top: -37, width: 14, height: 14, marginLeft: -7,
                  borderRadius: "50%", background: "#fff", border: "1.5px solid var(--ui-blue)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)", cursor: "grab", pointerEvents: "auto", touchAction: "none"
                }}
              />
            </>
          )}

          {/* per-kind floating toolbar */}
          <div
            data-design-toolbar
            onPointerDown={(e) => e.stopPropagation()}
            className="design-toolbar"
            style={{ position: "absolute", left: 0, top: toolbarBelow ? H + 12 : -46 }}
          >
            {isText && (
              <>
                <select
                  className="ui-select design-font"
                  value={el.fontFamily ?? "cm"}
                  onChange={(e) => onPatch({ fontFamily: e.target.value })}
                  title="Font"
                >
                  {DOC_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <span className="design-div" />
                <button className="shape-step" title="Smaller" onClick={() => onPatch({ fontSize: clampNum((el.fontSize ?? 24) - 2, 6, 200) })}>−</button>
                <span className="design-num">{el.fontSize ?? 24}</span>
                <button className="shape-step" title="Larger" onClick={() => onPatch({ fontSize: clampNum((el.fontSize ?? 24) + 2, 6, 200) })}>+</button>
                <span className="design-div" />
                <button className={`design-tg${el.bold ? " on" : ""}`} title="Bold" style={{ fontWeight: 800 }} onClick={() => onPatch({ bold: !el.bold })}>B</button>
                <button className={`design-tg${el.italic ? " on" : ""}`} title="Italic" style={{ fontStyle: "italic" }} onClick={() => onPatch({ italic: !el.italic })}>I</button>
                <button className={`design-tg${el.underline ? " on" : ""}`} title="Underline" style={{ textDecoration: "underline" }} onClick={() => onPatch({ underline: !el.underline })}>U</button>
                <span className="design-div" />
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} className={`design-tg${(el.align ?? "left") === a ? " on" : ""}`} title={`Align ${a}`} onClick={() => onPatch({ align: a })}>
                    <AlignIcon a={a} />
                  </button>
                ))}
                <span className="design-div" />
                <ColorControl value={el.color ?? "#111111"} title="Text colour" onChange={(c) => onPatch({ color: c })} />
              </>
            )}

            {el.kind === "image" && (
              <>
                <button className="design-tg wide" title="Replace image" onClick={() => fileRef.current?.click()}>Replace</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onReplaceFile} />
                <span className="design-div" />
                <span className="design-lbl">Rotate</span>
                <button className="shape-step" title="Rotate 90° left" onClick={() => onPatch({ rotation: (((el.rotation ?? 0) - 90 + 360) % 360) || undefined })}>⟲</button>
                <span className="design-num">{Math.round(rot)}°</span>
                <button className="shape-step" title="Rotate 90° right" onClick={() => onPatch({ rotation: (((el.rotation ?? 0) + 90) % 360) || undefined })}>⟳</button>
                {rot ? <button className="shape-step" title="Reset rotation" onClick={() => onPatch({ rotation: undefined })}>✕</button> : null}
              </>
            )}

            {el.kind === "rect" && (
              <>
                <span className="design-lbl">Fill</span>
                <ColorControl value={el.fill ?? "#7c3aed"} title="Fill colour" onChange={(c) => onPatch({ fill: c })} />
                {el.fill && <button className="shape-step" title="No fill" onClick={() => onPatch({ fill: null })}>✕</button>}
                <span className="design-div" />
                <span className="design-lbl">Border</span>
                <ColorControl value={el.stroke ?? "#111111"} title="Border colour" onChange={(c) => onPatch({ stroke: c })} />
                <button className="shape-step" title="Thinner" onClick={() => onPatch({ strokeWidth: clampNum((el.strokeWidth ?? 0) - 1, 0, 40) })}>−</button>
                <span className="design-num">{el.strokeWidth ?? 0}</span>
                <button className="shape-step" title="Thicker" onClick={() => onPatch({ strokeWidth: clampNum((el.strokeWidth ?? 0) + 1, 0, 40) })}>+</button>
              </>
            )}

            {isLine && (
              <>
                <ColorControl value={el.stroke ?? "#111111"} title="Line colour" onChange={(c) => onPatch({ stroke: c })} />
                <span className="design-div" />
                <span className="design-lbl">Weight</span>
                <button className="shape-step" title="Thinner" onClick={() => onPatch({ strokeWidth: clampNum((el.strokeWidth ?? 2) - 1, 1, 40) })}>−</button>
                <span className="design-num">{el.strokeWidth ?? 2}</span>
                <button className="shape-step" title="Thicker" onClick={() => onPatch({ strokeWidth: clampNum((el.strokeWidth ?? 2) + 1, 1, 40) })}>+</button>
              </>
            )}

            <span className="design-div" />
            <button className="design-del" title="Delete" onClick={onDelete}><TrashIcon size={14} /></button>
          </div>
        </>
      )}
    </div>
  );
}

// Compact colour control: a row of presets plus a native custom-colour swatch.
function ColorControl({ value, title, onChange }: { value: string; title: string; onChange: (c: string) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {COLOR_PRESETS.map((c) => (
        <button
          key={c} title={c} onClick={() => onChange(c)}
          style={{
            width: 15, height: 15, borderRadius: "50%", background: c, cursor: "pointer", padding: 0,
            border: value.toLowerCase() === c ? "2px solid var(--ui-blue)" : "1px solid rgba(120,120,140,0.45)"
          }}
        />
      ))}
      <label title={title} style={{ display: "inline-flex", cursor: "pointer" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
               style={{ width: 18, height: 18, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
      </label>
    </span>
  );
}

function AlignIcon({ a }: { a: "left" | "center" | "right" }) {
  const lines = a === "left"
    ? ["M3 6h14", "M3 10h9", "M3 14h12"]
    : a === "center"
      ? ["M3 6h14", "M5 10h10", "M4 14h12"]
      : ["M3 6h14", "M8 10h9", "M5 14h12"];
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {lines.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
