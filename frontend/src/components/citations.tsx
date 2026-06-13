import { useEffect, useRef, useState } from "react";

// ── Floating selection toolbar ───────────────────────────────────────────
// Appears above the end of a text selection inside a paragraph. It sits at a
// low opacity until hovered (so it doesn't fight the text), then reveals the
// formatting / footnote / quote actions.

// The paragraph element a selection lives in, or null.
function selectionParagraph(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const focus = sel.focusNode;
  const base = focus && focus.nodeType === 1 ? (focus as HTMLElement) : focus?.parentElement ?? null;
  return (base?.closest?.(".blox-editable[data-para-id]") as HTMLElement | null) ?? null;
}

// The model-text offset (markers excluded, <br> counted as a newline — matching
// readEditableRich) from the paragraph start to the selection's end.
function modelOffsetAtSelectionEnd(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const end = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  try { pre.setEnd(end.endContainer, end.endOffset); } catch { return 0; }
  const div = document.createElement("div");
  div.appendChild(pre.cloneContents());
  div.querySelectorAll("[data-fn],[data-cite]").forEach((n) => n.remove());
  div.querySelectorAll("br").forEach((b) =>
    b.hasAttribute("data-bogus") ? b.remove() : b.replaceWith("\n")
  );
  // Add the slice's own offset so a page-split paragraph anchors into the whole.
  const sliceStart = Number(el.dataset.sliceStart ?? 0);
  return sliceStart + (div.textContent ?? "").length;
}

type ToolbarProps = {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onFootnote: (paragraphId: string, offset: number) => void;
  onQuote: (paragraphId: string, offset: number) => void;
};

export function SelectionToolbar({ onBold, onItalic, onUnderline, onFootnote, onQuote }: ToolbarProps) {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      const el = selectionParagraph();
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) { setPos(null); return; }
      const rects = sel.getRangeAt(0).getClientRects();
      const last = rects[rects.length - 1];
      if (!last) { setPos(null); return; }
      // Anchor above the END of the selection (the last highlighted word); flip
      // below when there isn't room above.
      const below = last.top < 64;
      setPos({ x: last.right, y: below ? last.bottom : last.top, below });
    };
    const schedule = () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(update);
    };
    // Finishing a drag-select or a shift-arrow select are the moments a fresh
    // selection settles — update immediately then (rAF is only a throttle for
    // the noisier selectionchange / scroll stream).
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("mouseup", update);
    document.addEventListener("keyup", update);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("mouseup", update);
      document.removeEventListener("keyup", update);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (!pos) return null;

  // Resolve the paragraph + offset live at click time (the selection is still
  // alive because each button cancels its mousedown to keep focus/selection).
  const withTarget = (fn: (pid: string, off: number) => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = selectionParagraph();
    if (!el?.dataset.paraId) return;
    fn(el.dataset.paraId, modelOffsetAtSelectionEnd(el));
  };
  const fmt = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  return (
    <div
      className="sel-toolbar"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: pos.below ? "translate(-50%, 10px)" : "translate(-50%, calc(-100% - 10px))"
      }}
      // Don't let clicks inside the bar clear the selection.
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="sel-btn" title="Bold" onMouseDown={fmt(onBold)}><b>B</b></button>
      <button className="sel-btn" title="Italic" onMouseDown={fmt(onItalic)}><i>I</i></button>
      <button className="sel-btn" title="Underline" onMouseDown={fmt(onUnderline)}><u>U</u></button>
      <span className="sel-sep" />
      <button className="sel-btn" title="Footnote" onMouseDown={withTarget(onFootnote)}>
        <span style={{ fontSize: 13 }}>F<sup style={{ fontSize: 8 }}>1</sup></span>
      </button>
      <button className="sel-btn" title="Quote / cite" onMouseDown={withTarget(onQuote)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 7h4v6c0 2.2-1.6 3.7-4 4v-2c1.1-.3 1.8-1 1.9-2H7V7zm7 0h4v6c0 2.2-1.6 3.7-4 4v-2c1.1-.3 1.8-1 1.9-2H14V7z" />
        </svg>
      </button>
    </div>
  );
}

// ── BibTeX entry editor ──────────────────────────────────────────────────
// A modal for writing / editing a single BibTeX entry. "Save" commits the raw
// text (the cite key is parsed from it); "Delete" (edit mode) removes the entry
// and every citation pointing at it.

const NEW_ENTRY_TEMPLATE =
  "@article{key2026,\n" +
  "  author  = {Last, First and Other, A.},\n" +
  "  title   = {Title of the work},\n" +
  "  journal = {Journal Name},\n" +
  "  year    = {2026}\n" +
  "}";

export const newEntryTemplate = NEW_ENTRY_TEMPLATE;

type CiteEditorProps = {
  initial: string;
  isEdit: boolean;
  onSave: (raw: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export function CiteEditor({ initial, isEdit, onSave, onCancel, onDelete }: CiteEditorProps) {
  const [raw, setRaw] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    // Esc closes; Ctrl/Cmd+Enter saves.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(raw); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [raw, onSave, onCancel]);

  return (
    <div className="confirm-backdrop" onPointerDown={onCancel}>
      <div className="ui-panel confirm-card cite-card" role="dialog" aria-modal="true" onPointerDown={(e) => e.stopPropagation()}>
        <div className="confirm-title">{isEdit ? "Edit citation" : "New citation"}</div>
        <div className="confirm-message" style={{ marginBottom: 10 }}>
          Write a BibTeX entry. The cite key (after the opening brace) links the
          in-text number to this reference.
        </div>
        <textarea
          ref={ref}
          className="cite-textarea"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="confirm-actions" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <span>
            {isEdit && onDelete && (
              <button className="ui-btn danger" onClick={onDelete}>Delete</button>
            )}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            <button className="ui-btn" onClick={onCancel}>Cancel</button>
            <button className="ui-btn primary" onClick={() => onSave(raw)}>Save</button>
          </span>
        </div>
      </div>
    </div>
  );
}
