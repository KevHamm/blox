import { useRef, useState, useLayoutEffect } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { TrashIcon } from "../components/TrashIcon";

// True while dragging an image — either a sidebar upload (`image::`) or one
// already placed in the document (`docimg::`).
export const isImageDragId = (id: unknown) => {
  const s = String(id ?? "");
  return s.startsWith("image::") || s.startsWith("docimg::");
};

export const clampFrac = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/* -----------------------------
   DROP INDICATOR (insertion line)
----------------------------- */
// Fixed ink indigo (not a theme var): these accents paint onto the document
// paper, which stays white even in dark mode.
export const DROP_LINE = "#5048e5";

/* A thin horizontal insertion line shaped like  |>-----------------<|  drawn as
   an overlay so it never pushes the surrounding content apart. Rendered around a
   zero-height anchor centered on the drop gap. */
function InsertionLine() {
  const cap = (side: "left" | "right") => (
    <>
      {/* vertical end bar | */}
      <div
        style={{
          position: "absolute",
          [side]: 0,
          top: -5,
          width: 2,
          height: 10,
          background: DROP_LINE,
          borderRadius: 1
        }}
      />
      {/* inward-pointing arrow > / < */}
      <div
        style={{
          position: "absolute",
          [side]: 4,
          top: -4,
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          ...(side === "left"
            ? { borderLeft: `5px solid ${DROP_LINE}` }
            : { borderRight: `5px solid ${DROP_LINE}` })
        }}
      />
    </>
  );
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 9,
          right: 9,
          top: -1,
          height: 2,
          background: DROP_LINE,
          borderRadius: 1
        }}
      />
      {cap("left")}
      {cap("right")}
    </>
  );
}

/* Vertical sibling of the insertion line, for the slots between side-by-side
   images inside a figure. */
export function VInsertionLine() {
  const cap = (side: "top" | "bottom") => (
    <>
      <div
        style={{
          position: "absolute",
          [side]: 0,
          left: -5,
          height: 2,
          width: 10,
          background: DROP_LINE,
          borderRadius: 1
        }}
      />
      <div
        style={{
          position: "absolute",
          [side]: 4,
          left: -4,
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          ...(side === "top"
            ? { borderTop: `5px solid ${DROP_LINE}` }
            : { borderBottom: `5px solid ${DROP_LINE}` })
        }}
      />
    </>
  );
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 9,
          bottom: 9,
          left: -1,
          width: 2,
          background: DROP_LINE,
          borderRadius: 1
        }}
      />
      {cap("top")}
      {cap("bottom")}
    </>
  );
}

export function DropZone({ id, containerType }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();

  // Only reveal a zone where the dragged thing can actually go:
  //   • section block       → document level + next to any heading
  //   • subsection block    → only inside a section
  //   • subsubsection block → only inside a subsection
  //   • images / tables / math → any container (not the document level)
  //   • page blocks         → never (they drop anywhere, no zone)
  const activeId = String(active?.id ?? "");
  const isDoc = containerType === "document";
  let eligible: boolean;
  // Sections, abstracts, footnotes and pages have no insertion lines — they are
  // dropped anywhere and auto-placed.
  if (
    activeId === "block::section" ||
    activeId === "block::abstract" ||
    activeId === "block::footnote" ||
    activeId.startsWith("block::page::")
  ) eligible = false;
  else if (activeId === "block::subsection") eligible = containerType === "section";
  else if (activeId === "block::subsubsection") eligible = containerType === "subsection";
  else if (isImageDragId(activeId)) eligible = !isDoc;
  else eligible = activeId.startsWith("block::") && !isDoc; // table / math

  if (!eligible) {
    // Not a target for this drag: zero-height, never affects layout.
    return <div ref={setNodeRef} style={{ height: 0 }} />;
  }

  // Zero-height anchor. The hit band + line are absolutely positioned so the
  // surrounding content is never pushed apart. The line only appears on hover.
  // The hit band is a generous ±18px grace zone so it's easy to target.
  return (
    <div style={{ position: "relative", height: 0 }}>
      <div
        ref={setNodeRef}
        style={{ position: "absolute", left: 0, right: 0, top: -18, height: 36, zIndex: 6 }}
      />
      {isOver && (
        <div
          style={{
            position: "absolute",
            left: 28,
            right: 28,
            top: 0,
            height: 0,
            zIndex: 7,
            pointerEvents: "none"
          }}
        >
          <InsertionLine />
        </div>
      )}
    </div>
  );
}

/* Vertical insertion slot between images inside a figure container. */
export function FigureDropZone({ id }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();
  const dragging = isImageDragId(active?.id);

  if (!dragging) {
    return <div ref={setNodeRef} style={{ width: 0 }} />;
  }

  return (
    <div style={{ position: "relative", width: 0, alignSelf: "stretch" }}>
      <div
        ref={setNodeRef}
        style={{ position: "absolute", top: 0, bottom: 0, left: -16, width: 32, zIndex: 6 }}
      />
      {isOver && (
        <div
          style={{
            position: "absolute",
            top: 12,
            bottom: 12,
            left: 0,
            width: 0,
            zIndex: 7,
            pointerEvents: "none"
          }}
        >
          <VInsertionLine />
        </div>
      )}
    </div>
  );
}

/* -----------------------------
   TRASH BUTTON (right-aligned)
----------------------------- */
export function TrashButton({ onClick, label, className }: any) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={className}
      style={{
        marginLeft: "auto",          // push to the far right of the line
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
        background: "transparent",
        border: "none",
        color: "#c0392b",
        cursor: "pointer"
      }}
    >
      <TrashIcon />
    </button>
  );
}

/* Up/down move control (dir = -1 up, 1 down). */
export function ChevronButton({ dir, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 22,
        height: 22,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        border: "1px solid #ddd",
        borderRadius: 4,
        color: "#555",
        cursor: "pointer"
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {dir < 0 ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
    </button>
  );
}

// LaTeX heading metrics relative to the body font size:
//   \section = \Large (1.44×) bold, \subsection = \large (1.2×) bold,
//   \subsubsection = \normalsize (1×) bold — all Computer Modern Bold.
export function headingStyle(base: number, mult: number) {
  return {
    margin: 0,
    fontFamily: "var(--sans)",
    fontWeight: 700,
    fontSize: Math.round(base * mult * 100) / 100,
    lineHeight: 1.15,
    letterSpacing: "normal",
    color: "var(--text)"
  } as const;
}

/* An always-editable, auto-growing inline title field (like the document title).
   No click-to-edit popup. Titles are single-line — Enter is ignored (the field
   still soft-wraps long titles). Shows a faint placeholder when empty. */
export function HeadingInput({ value, onChange, style, ariaLabel, placeholder }: any) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(grow, [value, style?.fontSize]);

  // Re-fit when the field's width changes (e.g. the text-width slider).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined" || !el.parentElement) return;
    const ro = new ResizeObserver(grow);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      className="heading-input"
      value={value ?? ""}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      style={{
        ...style,
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        resize: "none",
        overflow: "hidden",
        border: "none",
        outline: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}
    />
  );
}

// A LaTeX-style caption line: the bold tag (e.g. "Figure 1:") and the editable
// text sit centered on one line whose width shrinks to the caption itself. A
// hidden mirror span measures the text so the input — and its underline — is
// exactly as wide as its content rather than a fixed fraction of the figure.
export function CaptionField({ tag, value, onChange }: { tag: string; value: string; onChange: (v: string) => void }) {
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(40);
  const placeholder = "caption…";
  useLayoutEffect(() => {
    if (sizerRef.current) setW(Math.ceil(sizerRef.current.getBoundingClientRect().width) + 2);
  }, [value]);
  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        justifyContent: "center",
        alignItems: "baseline",
        gap: 5,
        flexWrap: "wrap",
        maxWidth: "100%",
        fontSize: 14,
        fontFamily: "var(--sans)",
        color: "var(--text)"
      }}
    >
      <strong style={{ whiteSpace: "nowrap" }}>{tag}</strong>
      <span style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
        {/* hidden mirror: same font, sizes the input to its content */}
        <span
          ref={sizerRef}
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            visibility: "hidden",
            whiteSpace: "pre",
            fontSize: 14,
            fontFamily: "var(--sans)"
          }}
        >
          {value || placeholder}
        </span>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: w,
            maxWidth: "100%",
            minWidth: 24,
            border: "none",
            borderBottom: "1px solid var(--cap-rule)",
            outline: "none",
            textAlign: "center",
            fontSize: 14,
            fontFamily: "var(--sans)",
            background: "transparent",
            color: "var(--text)",
            padding: 0
          }}
        />
      </span>
    </div>
  );
}
