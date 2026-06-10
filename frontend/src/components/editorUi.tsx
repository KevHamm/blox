import { useState, useEffect } from "react";
import { useDraggable, useDroppable, useDndContext } from "@dnd-kit/core";
import { TrashIcon } from "./TrashIcon";
import { clamp } from "../utils/docTree";
import { BlockBox } from "./blocks";

/* A sidebar image the user can drag into the document or delete. */
export function DraggableImage({ img, onDelete }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `image::${img.id}`
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        position: "relative",
        textAlign: "center",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1
      }}
    >
      <button
        onClick={() => onDelete(img.id)}
        onPointerDown={(e) => e.stopPropagation()}
        title="Delete image"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "inline-flex",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "none",
          borderRadius: 4,
          padding: 3,
          cursor: "pointer",
          zIndex: 1
        }}
      >
        <TrashIcon size={14} />
      </button>

      <img
        src={img.src}
        alt={img.name}
        draggable={false}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: 4,
          border: "1px solid #ddd",
          display: "block",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: "#444",
          wordBreak: "break-word"
        }}
      >
        {img.name}
      </div>
    </div>
  );
}

/* The scrollable document area. It becomes a drop target only while a Section
   block is being dragged, so a section can be dropped anywhere in the document
   (no visible drop zone) without interfering with image "drop outside to
   remove" behaviour. */
export function DroppableDocArea({ children, visible = true }: any) {
  const { active } = useDndContext();
  const aid = String(active?.id ?? "");
  // These blocks have no visible insertion line — dropping anywhere in the
  // document auto-places them (sections, abstract, special pages) or starts a
  // word-pick (footnote).
  const dropAnywhere =
    aid.startsWith("block::page::") ||
    aid === "block::section" ||
    aid === "block::abstract" ||
    aid === "block::footnote";
  const { setNodeRef } = useDroppable({ id: "doc-drop", disabled: !dropAnywhere });
  return (
    <div
      ref={setNodeRef}
      className="doc-area"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 40,
        overflowY: "auto",
        overscrollBehavior: "contain",
        // Hidden (but still laid out, so the morph overlay can measure the
        // page) until the editor is revealed.
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease"
      }}
    >
      {children}
    </div>
  );
}

/* A draggable Blox item. `compact` shows just the glyph (math-symbol grid). */
export function DraggableBlock({ id, compact }: { id: string; compact?: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
    >
      <BlockBox id={id} compact={compact} />
    </div>
  );
}

/* A collapsible sidebar group with a clickable header. */
export function Collapsible({ title, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <h3
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
          margin: "0 0 8px"
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.1s ease"
          }}
        >
          ▶
        </span>
        {title}
      </h3>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* A labelled slider paired with a typed number input. Both edit the same
   value and are clamped to [min, max]. */
export function NumberControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  // Local text so the user can type freely; committed (and clamped) on blur.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
    else setText(String(value));
  };

  return (
    <div>
      <label>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0 }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
          style={{ width: 64 }}
        />
        {unit && <span style={{ fontSize: 12, color: "#666" }}>{unit}</span>}
      </div>
    </div>
  );
}
