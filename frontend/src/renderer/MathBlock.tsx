import { Fragment, useRef, useEffect } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { VInsertionLine, TrashButton } from "./shared";
import "mathlive";
import "katex/dist/katex.min.css";

/* -----------------------------
   MATH — a single directly-editable equation (MathLive). Dropping another math
   block beside it merges their LaTeX into one equation.
----------------------------- */
// MathLive's <math-field> custom element (typed loosely for JSX).
const MathFieldTag = "math-field" as any;

// Editable math field; renders the equation and edits it visually in place.
function MathField({ value, onChange }: any) {
  const ref = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep the field's value in sync without disturbing the caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (el && el.value !== value) el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.value = value;
    // Don't pop the on-screen keyboard on desktop.
    el.mathVirtualKeyboardPolicy = "manual";

    const onInput = () => onChangeRef.current(el.value);
    el.addEventListener("input", onInput);

    // Insert "<" / ">" literally instead of MathLive's "\lt"/"\gt" command flow.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "<" || e.key === ">") {
        e.preventDefault();
        e.stopPropagation();
        el.insert(e.key, { focus: true });
      }
    };
    el.addEventListener("keydown", onKeyDown, true);

    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MathFieldTag
      ref={ref}
      style={{
        fontSize: "1.3em",
        padding: "2px 4px",
        background: "transparent",
        color: "#000"
      }}
    />
  );
}

// Drop slot to the left/right of an equation; appears while dragging a math
// block from the palette, so equations can be merged together.
function MathSlot({ id }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();
  const dragging = String(active?.id ?? "").startsWith("block::math::");

  if (!dragging) return <div ref={setNodeRef} style={{ width: 0 }} />;

  return (
    <div style={{ position: "relative", width: 0, alignSelf: "stretch", minHeight: 40 }}>
      <div
        ref={setNodeRef}
        style={{ position: "absolute", top: 0, bottom: 0, left: -16, width: 32, zIndex: 6 }}
      />
      {isOver && (
        <div
          style={{
            position: "absolute",
            top: 8,
            bottom: 8,
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

export function MathBlock({ node, updateMathItem, deleteMathItem, deleteNodeById, equationNumber }: any) {
  // Support the container model (and any legacy single-latex node).
  const items: any[] =
    node.items ?? (node.latex != null ? [{ id: `${node.id}-0`, latex: node.latex }] : []);
  // A generic \begin{equation} block is numbered and is removed only via its
  // delete button, so clearing its last part leaves an empty equation rather
  // than deleting the whole block.
  const display = !!node.display;

  return (
    <div className="hover-target" style={{ margin: "12px 0", position: "relative" }}>
      {/* parts sit flush so it reads as one equation; slots between them open
          up while dragging a math block so you can insert anywhere. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MathSlot id={`mathdz::${node.id}::0`} />
        {items.map((it, i) => (
          <Fragment key={it.id}>
            <MathField
              value={it.latex}
              onChange={(v: string) => {
                if (v.trim() === "") {
                  if (display && items.length <= 1) updateMathItem(node.id, it.id, "");
                  else deleteMathItem(node.id, it.id);   // cleared → remove this part
                } else updateMathItem(node.id, it.id, v);
              }}
            />
            <MathSlot id={`mathdz::${node.id}::${i + 1}`} />
          </Fragment>
        ))}
      </div>

      {/* Equation number, LaTeX-style, at the right margin. */}
      {display && equationNumber != null && (
        <span
          style={{
            position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
            fontFamily: "var(--sans)", color: "var(--text)", fontSize: 15
          }}
        >
          ({equationNumber})
        </span>
      )}

      {/* Delete the whole math block (e.g. a standalone matrix) — on hover. */}
      <div className="hover-tools" style={{ position: "absolute", top: -2, right: display ? 40 : 0 }}>
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete equation" />
      </div>
    </div>
  );
}
