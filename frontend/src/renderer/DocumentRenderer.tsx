import { Fragment, useRef, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Chunk } from "../utils/paginateDocument";
import { isContainerType } from "../utils/paginateDocument";
import type { Mark, Fmt } from "../utils/marks";
import { formatAt, sliceMarks, spliceMarks, normalizeMarks, marksEqual } from "../utils/marks";
import { symbolFor, wordAround } from "../utils/greek";
import { arrowAutocorrect } from "../utils/arrows";

// A DOM Range spanning characters [a, b) of a contentEditable element, walking
// its text nodes (skipping non-text like footnote markers).
function rangeForChars(el: HTMLElement, a: number, b: number): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let sNode: Node | null = null, sOff = 0, eNode: Node | null = null, eOff = 0, n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    if (sNode === null && a <= acc + len) { sNode = n; sOff = a - acc; }
    if (b <= acc + len) { eNode = n; eOff = b - acc; break; }
    acc += len;
  }
  if (!sNode || !eNode) return null;
  const r = document.createRange();
  try { r.setStart(sNode, sOff); r.setEnd(eNode, eOff); } catch { return null; }
  return r;
}
import { useDroppable, useDraggable, useDndContext } from "@dnd-kit/core";
import { TrashIcon } from "../components/TrashIcon";
import "mathlive";
import "katex/dist/katex.min.css";

// True while dragging an image — either a sidebar upload (`image::`) or one
// already placed in the document (`docimg::`).
export const isImageDragId = (id: unknown) => {
  const s = String(id ?? "");
  return s.startsWith("image::") || s.startsWith("docimg::");
};

const clampFrac = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/* -----------------------------
   DROP INDICATOR (insertion line)
----------------------------- */
const DROP_LINE = "#0071e3";

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
function VInsertionLine() {
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

function DropZone({ id, containerType }: any) {
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
function FigureDropZone({ id }: any) {
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
function TrashButton({ onClick, label, className }: any) {
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
function ChevronButton({ dir, onClick, title }: any) {
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
function headingStyle(base: number, mult: number) {
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

/* -----------------------------
   PARAGRAPH
----------------------------- */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Trailing punctuation a footnote marker should sit *in front of* (e.g. the
// comma in "word,") — split a token into its core and that trailing run.
const TRAILING_PUNCT = /[.,;:!?)\]}'"»]+$/;
function splitTrailingPunct(tok: string): [string, string] {
  const m = tok.match(TRAILING_PUNCT);
  if (!m) return [tok, ""];
  const punct = m[0];
  return [tok.slice(0, tok.length - punct.length), punct];
}

// Opening / closing tags for a format set. Always nested in the same order so
// runs can be closed and reopened cleanly at any boundary.
const fmtOpen = (f: Fmt) => (f.b ? "<b>" : "") + (f.i ? "<i>" : "") + (f.u ? "<u>" : "");
const fmtClose = (f: Fmt) => (f.u ? "</u>" : "") + (f.i ? "</i>" : "") + (f.b ? "</b>" : "");

// Render the paragraph body as HTML: escaped text wrapped in b/i/u runs from
// `marks`, with non-editable superscript footnote markers inserted after their
// target word (but before any trailing punctuation on that word).
function buildParagraphHtml(
  text: string,
  footnotes: any[],
  footnoteNumbers: Record<string, number> | undefined,
  marks: Mark[] = []
): string {
  // Footnote markers keyed by their anchor character offset. Unconnected
  // footnotes (their word was deleted) have no marker.
  const fnAt = new Map<number, any[]>();
  for (const f of footnotes) {
    if (f.unconnected || f.offset == null) continue;
    const at = Math.min(Math.max(f.offset, 0), text.length);
    fnAt.set(at, (fnAt.get(at) ?? []).concat(f));
  }

  // Nothing to decorate → the original fast path.
  if (!marks.length && fnAt.size === 0) return escapeHtml(text);

  let html = "";
  let cur: Fmt = { b: false, i: false, u: false };
  for (let p = 0; p <= text.length; p++) {
    const fns = fnAt.get(p);
    if (fns) {
      // Footnote markers sit outside any format run.
      html += fmtClose(cur);
      cur = { b: false, i: false, u: false };
      for (const f of fns)
        html +=
          `<sup data-fn="${f.id}" contenteditable="false" ` +
          `style="font-size:0.7em;vertical-align:super;">${footnoteNumbers?.[f.id] ?? 0}</sup>`;
    }
    if (p === text.length) break;
    const f = formatAt(marks, p);
    if (f.b !== cur.b || f.i !== cur.i || f.u !== cur.u) { html += fmtClose(cur); cur = f; html += fmtOpen(cur); }
    html += escapeHtml(text[p]);
  }
  html += fmtClose(cur);
  return html;
}

// Read the contentEditable back out as plain text plus formatting marks: footnote
// markers are dropped, <br> becomes a newline, and each text node's b/i/u state
// (from its ancestor tags / inline styles) becomes a mark range.
function readEditableRich(el: HTMLElement): { text: string; marks: Mark[]; fnMarkers: { id: string; offset: number }[] } {
  let text = "";
  const runs: Mark[] = [];
  const fnMarkers: { id: string; offset: number }[] = [];

  const fmtOfNode = (node: Node | null): Fmt => {
    let b = false, i = false, u = false;
    let n: Node | null = node;
    while (n && n !== el) {
      if (n.nodeType === 1) {
        const e = n as HTMLElement;
        const tag = e.nodeName;
        if (tag === "B" || tag === "STRONG") b = true;
        if (tag === "I" || tag === "EM") i = true;
        if (tag === "U") u = true;
        const st = e.style;
        if (st) {
          const fw = st.fontWeight;
          if (fw === "bold" || fw === "bolder" || parseInt(fw, 10) >= 600) b = true;
          if (st.fontStyle === "italic") i = true;
          const td = st.textDecoration || (st as any).textDecorationLine || "";
          if (td.includes("underline")) u = true;
        }
      }
      n = n.parentNode;
    }
    return { b, i, u };
  };

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const t = child.textContent ?? "";
        if (!t) continue;
        const f = fmtOfNode(child.parentNode);
        const s = text.length;
        text += t;
        runs.push({ start: s, end: text.length, b: f.b, i: f.i, u: f.u });
      } else if (child.nodeType === 1) {
        const e = child as HTMLElement;
        if (e.hasAttribute("data-fn")) {
          // The marker isn't text; record where it currently sits so the
          // footnote's anchor can follow the edit.
          fnMarkers.push({ id: e.getAttribute("data-fn")!, offset: text.length });
          continue;
        }
        if (e.nodeName === "BR") { text += "\n"; continue; }
        walk(e);
      }
    }
  };
  walk(el);
  return { text, marks: normalizeMarks(runs), fnMarkers };
}

// A small superscript footnote marker (used in the footnote word-picker view).
function FootnoteMark({ n }: { n: number }) {
  return (
    <sup style={{ fontSize: "0.7em", lineHeight: 0, verticalAlign: "super", color: "var(--text)" }}>
      {n}
    </sup>
  );
}

// The caret's character offset within a contentEditable element.
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  try { pre.setEnd(range.endContainer, range.endOffset); } catch { return 0; }
  return pre.toString().length;
}

// The normal paragraph: an always-editable, inline rich text region (no popup).
// Typing edits in place; Enter inserts a line break. A long paragraph is split
// across pages into character slices; each slice edits its portion of the full
// text and commits on every keystroke so pagination stays live (overflowing
// words flow to the next page). The DOM is always kept in sync with this slice's
// text and the caret is restored from a recorded full-text offset, so a slice
// never shows more than its share (which would duplicate it across pages).
function EditableParagraph({
  node, updateRichText, onTyping, onCaret,
  lineHeight, fontSize, firstChild, footnoteNumbers,
  sliceStart, sliceEnd, blockParagraphs
}: any) {
  const ref = useRef<HTMLParagraphElement>(null);
  const text: string = node.text ?? "";
  const footnotes: any[] = node.footnotes ?? [];
  const marks: Mark[] = node.marks ?? [];

  const start: number = sliceStart ?? 0;
  const end: number = sliceEnd ?? text.length;
  const isSlice = start !== 0 || end !== text.length;
  const sliceText = isSlice ? text.slice(start, end) : text;

  // Symbol suggestion: when the caret sits on a word that spells a Greek letter
  // or a math symbol command, a small clickable glyph hovers as a superscript of
  // its last letter. Offsets are slice-local; `x`/`y` are viewport coords.
  const [greek, setGreek] = useState<
    { symbol: string; ls: number; le: number; x: number; y: number } | null
  >(null);

  const detectGreek = () => {
    const el = ref.current;
    if (!el || document.activeElement !== el) { setGreek(null); return; }
    const localText = readEditableRich(el).text;
    const caret = getCaretOffset(el);
    const w = wordAround(localText, caret);
    const sym = w && symbolFor(w.word);
    if (!w || !sym) { setGreek(null); return; }
    const r = rangeForChars(el, w.end - 1, w.end);
    if (!r) { setGreek(null); return; }
    const rect = r.getBoundingClientRect();
    setGreek({ symbol: sym, ls: w.start, le: w.end, x: rect.right, y: rect.top });
  };

  const html = useMemo(
    () => (isSlice
      ? buildParagraphHtml(sliceText, [], footnoteNumbers, sliceMarks(marks, start, end))
      : buildParagraphHtml(text, footnotes, footnoteNumbers, marks)),
    [text, sliceText, isSlice, footnotes, footnoteNumbers, marks, start, end]
  );

  // Always keep the DOM equal to this slice's content. The caret is collapsed by
  // the assignment but the Editor's restore effect puts it back (and follows the
  // text onto the next page when a word overflows).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [html]);

  const onInput = () => {
    const el = ref.current;
    if (!el) return;
    // Reconstruct this slice's plain text and its formatting, then splice both
    // back into the whole node (so b/i/u applied to a selection persists, and a
    // page-split paragraph keeps its formatting too).
    const { text: domText, marks: sliceRuns, fnMarkers } = readEditableRich(el);
    const localCaret = getCaretOffset(el);

    // ASCII arrow autocorrect (-> ← => <= <-> <=> |-> |-->) within this slice.
    let outText = domText, outRuns = sliceRuns, outCaret = localCaret;
    const conv = arrowAutocorrect(domText, localCaret);
    if (conv) {
      outText = domText.slice(0, conv.from) + conv.symbol + domText.slice(conv.to);
      outRuns = spliceMarks(sliceRuns, conv.from, conv.to, [], conv.symbol.length);
      outCaret = conv.from + conv.symbol.length + (localCaret - conv.to);
    }

    // Reconcile footnotes against the markers still present in the DOM. A marker
    // that survived keeps the footnote connected (its anchor offset follows the
    // edit); a marker the user deleted along with its word disconnects it.
    let nextFootnotes = footnotes;
    if (footnotes.length) {
      const present = new Map(fnMarkers.map((m) => [m.id, m.offset]));
      nextFootnotes = footnotes.map((f: any) =>
        present.has(f.id)
          ? { ...f, offset: start + (present.get(f.id) as number), unconnected: false }
          : f.unconnected
            ? f
            : { ...f, unconnected: true, text: `UNCONNECTED FOOTNOTE ${f.text ?? ""}` }
      );
    }

    const full = text.slice(0, start) + outText + text.slice(end);
    const nextMarks = spliceMarks(marks, start, end, outRuns, outText.length);
    onCaret?.(node.id, start + outCaret);
    onTyping?.(node.id);
    if (full !== text || !marksEqual(marks, nextMarks) || nextFootnotes !== footnotes)
      updateRichText(node.id, full, nextMarks, nextFootnotes);
    detectGreek();
  };

  // Replace the typed Greek-letter word with its glyph, keeping marks/footnote
  // word indices coherent (one word in, one word out) and the caret after it.
  const insertGreek = () => {
    if (!greek) return;
    const fs = start + greek.ls, fe = start + greek.le;
    const full = text.slice(0, fs) + greek.symbol + text.slice(fe);
    const nextMarks = spliceMarks(marks, fs, fe, [], greek.symbol.length);
    onCaret?.(node.id, fs + greek.symbol.length);
    onTyping?.(node.id);
    updateRichText(node.id, full, nextMarks);
    setGreek(null);
  };

  // Centered paragraphs have no first-line indent; otherwise the letter class is
  // block-style (no indent) and other classes indent all but the first paragraph
  // (or a split continuation).
  const centered = node.align === "center";
  const indent = centered ? 0 : blockParagraphs ? 0 : firstChild || start > 0 ? 0 : "1.5em";

  return (
    <>
      <p
        ref={ref}
        className="blox-editable"
        contentEditable
        suppressContentEditableWarning
        data-para-id={node.id}
        data-slice-start={start}
        data-slice-end={end}
        onFocus={() => onTyping?.(node.id)}
        onInput={onInput}
        onBlur={() => { onTyping?.(null); setGreek(null); }}
        // Re-check the Greek suggestion after the caret moves (clicks / arrows).
        onKeyUp={detectGreek}
        onMouseUp={detectGreek}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setGreek(null); return; }
          if (e.key === "Enter") {
            e.preventDefault();
            // While a symbol suggestion is showing, Enter inserts that symbol;
            // otherwise Enter is a line break.
            if (greek) insertGreek();
            else document.execCommand("insertText", false, "\n");
          }
        }}
        style={{
          margin: 0,
          cursor: "text",
          outline: "none",
          textAlign: centered ? "center" : "justify",
          hyphens: "auto",
          WebkitHyphens: "auto",
          whiteSpace: "pre-wrap",
          textIndent: indent,
          lineHeight,
          fontSize,
          color: "var(--text)"
        }}
      />
      {greek && (
        <span
          className="greek-suggest"
          title={`Insert ${greek.symbol}`}
          // Keep the paragraph focused/selected so the swap can read the caret.
          onMouseDown={(e) => { e.preventDefault(); insertGreek(); }}
          style={{
            position: "fixed",
            left: greek.x,
            top: greek.y,
            transform: "translateY(-100%)",
            zIndex: 50,
            fontFamily: "var(--sans)",
            fontSize: Math.max(11, (fontSize ?? 13) * 0.9),
            lineHeight: 1,
            padding: "2px 6px",
            borderRadius: 8,
            background: "#fff",
            color: "var(--ui-blue)",
            border: "1px solid rgba(0,0,0,0.12)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          {greek.symbol}
        </span>
      )}
    </>
  );
}

function Paragraph(props: any) {
  const { node, lineHeight, fontSize, firstChild = false, pendingFootnote = false, onWordClick, footnoteNumbers, blockParagraphs = false } = props;

  // Footnote "pick a word" mode: a read-only view where each word is clickable.
  if (pendingFootnote) {
    const footnotes: any[] = node.footnotes ?? [];
    const text: string = node.text ?? "";
    const tokens = text.split(/(\s+)/);
    let wordIdx = -1, pos = 0;
    const out: any[] = [];
    tokens.forEach((tok: string, i: number) => {
      if (tok === "") return;
      if (/^\s+$/.test(tok)) { out.push(tok); pos += tok.length; return; }
      wordIdx++;
      const w = wordIdx;
      // Existing footnotes anchored at this word's marker position.
      const coreEnd = pos + tok.replace(TRAILING_PUNCT, "").length;
      const wordFns = footnotes.filter((f) => !f.unconnected && f.offset === coreEnd);
      const [core, punct] = wordFns.length ? splitTrailingPunct(tok) : [tok, ""];
      out.push(
        <span key={i} className="fn-word" onClick={() => onWordClick?.(node.id, w)}>
          {core}
        </span>
      );
      wordFns.forEach((f) => out.push(<FootnoteMark key={`${i}-${f.id}`} n={footnoteNumbers?.[f.id] ?? 0} />));
      if (punct) out.push(<Fragment key={`${i}-p`}>{punct}</Fragment>);
      pos += tok.length;
    });
    return (
      <p
        style={{
          margin: 0,
          cursor: "default",
          hyphens: "auto",
          WebkitHyphens: "auto",
          whiteSpace: "pre-wrap",
          textAlign: node.align === "center" ? "center" : "justify",
          textIndent: node.align === "center" || blockParagraphs ? 0 : firstChild ? 0 : "1.5em",
          lineHeight,
          fontSize
        }}
      >
        {out}
      </p>
    );
  }

  return <EditableParagraph {...props} />;
}

/* -----------------------------
   ABSTRACT — a singleton block after the title, before the first section.
----------------------------- */
function AbstractBlock({ node, editingId, setEditingId, updateTextById, deleteNodeById, fontSize = 13, lineHeight = 1.2 }: any) {
  const isEditing = editingId === node.id;
  return (
    <div data-leaf-id={node.id} style={{ width: "80%", margin: "0 auto", marginTop: fontSize * 2, marginBottom: fontSize * 1.5 }}>
      {/* article abstract: \small body, centered \bfseries "Abstract" heading. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: fontSize * 0.4 }}>
        <div style={{ fontWeight: 700, fontSize: fontSize * 0.9, fontFamily: "var(--sans)", color: "var(--text)" }}>Abstract</div>
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete abstract" />
      </div>
      {isEditing ? (
        <textarea
          autoFocus
          value={node.text}
          onChange={(e) => updateTextById(node.id, e.target.value)}
          onBlur={() => setEditingId(null)}
          style={{
            width: "100%", minHeight: 90, padding: 8, border: "1px solid #ddd",
            lineHeight, fontSize: fontSize * 0.9, fontFamily: "var(--sans)", color: "var(--text)"
          }}
        />
      ) : (
        <p
          onClick={() => setEditingId(node.id)}
          style={{
            margin: 0, cursor: "pointer", textAlign: "justify",
            hyphens: "auto", WebkitHyphens: "auto",
            lineHeight, fontSize: fontSize * 0.9
          }}
        >
          {node.text}
        </p>
      )}
    </div>
  );
}

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

function MathBlock({ node, updateMathItem, deleteMathItem, deleteNodeById, equationNumber }: any) {
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

/* -----------------------------
   FIGURE — a container of one or more equally-sized images that share a
   single caption. A single image is centered; resizing controls how wide each
   image is (and therefore whether another image can fit beside it).
----------------------------- */
function DocImage({ figureId, image, deleteFigureImage }: any) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `docimg::${figureId}::${image.id}`
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        flex: 1,
        minWidth: 0,
        position: "relative",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1
      }}
    >
      {/* per-image trash; stops the pointer from starting a drag */}
      <button
        onClick={() => { if (window.confirm("Delete this image?")) deleteFigureImage(figureId, image.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        title="Delete image"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "inline-flex",
          padding: 3,
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          zIndex: 2
        }}
      >
        <TrashIcon size={14} />
      </button>

      <img
        src={image.src}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none" }}
      />
    </div>
  );
}

function FigureBlock({
  node,
  updateFigureCaption,
  updateFigureWidth,
  deleteFigureImage,
  figureNumber
}: any) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const images: any[] = node.images ?? [];
  const width: number = node.width ?? 1;          // remembered per-image width
  const n = images.length || 1;
  // Cap the visible size so n images always fit; the stored width is preserved
  // so removing images restores the previous (wider) size.
  const perImage = Math.min(width, 1 / n);
  const containerFrac = n * perImage;

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const colW = wrapperRef.current?.offsetWidth || 1;
    const startX = e.clientX;
    const startW = perImage;   // start from the currently visible size

    function onMove(ev: MouseEvent) {
      const dw = (ev.clientX - startX) / (colW * n);
      updateFigureWidth(node.id, clampFrac(startW + dw, 0.1, 1));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div ref={wrapperRef} style={{ margin: "12px 0" }}>
      <div
        style={{
          width: `${containerFrac * 100}%`,
          margin: "0 auto",
          border: "1px solid #ccc",
          background: "white",
          padding: 8,
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* images, with a drop slot to the left/right of each one */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <FigureDropZone id={`figdz::${node.id}::0`} />
          {images.map((im, i) => (
            <Fragment key={im.id}>
              <DocImage
                figureId={node.id}
                image={im}
                deleteFigureImage={deleteFigureImage}
              />
              <FigureDropZone id={`figdz::${node.id}::${i + 1}`} />
            </Fragment>
          ))}
        </div>

        {/* drag the right edge to resize every image in the container */}
        <div
          onMouseDown={startResize}
          title="Resize"
          style={{
            position: "absolute",
            top: 0,
            right: -4,
            width: 8,
            height: "100%",
            cursor: "col-resize",
            zIndex: 2
          }}
        />

        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 14,
            fontFamily: "var(--sans)",
            color: "var(--text)"
          }}
        >
          <strong>Figure {figureNumber}:</strong>{" "}
          <input
            value={node.caption || ""}
            onChange={(e) => updateFigureCaption(node.id, e.target.value)}
            style={{
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              width: "70%",
              textAlign: "center",
              fontFamily: "var(--sans)",
              background: "transparent",
              color: "var(--text)"
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* Brush-shaped mouse cursor used in table paint mode. */
const BRUSH_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'%3E%3Cpath d='M14 3l7 7-8 8H7v-6z' fill='%23cdb4ff' stroke='%23333' stroke-width='1'/%3E%3Cpath d='M7 18c-1 1-2 3-4 3 0-2 2-3 3-4z' fill='%23333'/%3E%3C/svg%3E\") 2 20, crosshair";

/* Red-cross cursor used in table delete mode. */
const DELETE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5L5 19' stroke='%23d23f3f' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E\") 10 10, crosshair";

/* Auto-growing, multi-line table cell. Shift+Enter inserts a line break; a plain
   Enter is swallowed so it can't accidentally add one. Long / pasted text wraps,
   and the cell (and therefore the whole row) grows downward to fit. */
function CellTextarea({ value, readOnly, onChange, onEnter, onDelete, fontSize, widthKey, pointerNone }: any) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Re-fit when the text, font size, or column width changes.
  useLayoutEffect(grow, [value, fontSize, widthKey]);

  // Re-fit when the cell box is resized for any other reason.
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
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Shift+Enter = line break (textarea default). Plain Enter grows the
        // table: a new row (or a new column when in the header row).
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onEnter?.();
          return;
        }
        // Backspace / Delete in an empty cell may remove an empty row/column.
        if (
          (e.key === "Backspace" || e.key === "Delete") &&
          String(value ?? "").trim() === ""
        ) {
          if (onDelete?.()) e.preventDefault();
        }
      }}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        border: "none",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        padding: "4px 6px",
        margin: 0,
        background: "transparent",
        color: "#000",
        fontFamily: "var(--sans)",
        fontSize,
        lineHeight: 1.3,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        pointerEvents: pointerNone ? "none" : undefined
      }}
    />
  );
}

/* -----------------------------
   TABLE
----------------------------- */
function TableBlock(props: any) {
  const {
    node,
    updateTableCell,
    deleteNodeById,
    addTableRow,
    addTableColumn,
    updateTableColWidths,
    updateTableCaption,
    updateTableColors,
    deleteTableRowAt,
    deleteTableColumnAt,
    toggleTableBorder,
    toggleCellBorder,
    reorderTableColumn,
    reorderTableRow,
    tableNumbers,
    fontSize = 13
  } = props;

  const tableRef = useRef<HTMLTableElement>(null);
  // Active table tool: editing, painting, deleting, or editing grid separators.
  const [tool, setTool] = useState<"none" | "paint" | "delete" | "borders">("none");
  const [brushColor, setBrushColor] = useState("#ffe08a");
  const active = tool !== "none";

  // Live reorder indicator (a blue line showing where a row/column will land).
  const [marker, setMarker] = useState<{ axis: "col" | "row"; px: number } | null>(null);

  const colCount = node.rows[0]?.length || 0;
  const rowCount = node.rows.length;

  // Grid lines default to visible; either axis can be switched off globally, and
  // individual internal separators can be removed for custom tables.
  const bV = node.borders?.v !== false;
  const bH = node.borders?.h !== false;
  const sideBorder = (on: boolean) => (on ? "1px solid #ccc" : "none");
  const removedV: string[] = node.removedVBorders ?? [];
  const removedH: string[] = node.removedHBorders ?? [];
  const vGone = (r: number, c: number) => removedV.includes(`${r}:${c}`);
  const hGone = (r: number, c: number) => removedH.includes(`${r}:${c}`);
  // Per-cell border sides: outer frame follows the global toggles; internal
  // separators follow the per-edge removed sets (only one of each shared edge is
  // drawn, so border-collapse stays consistent).
  const cellBorders = (r: number, c: number) => ({
    borderLeft: c === 0 ? sideBorder(bV) : "none",
    borderTop: r === 0 ? sideBorder(bH) : "none",
    borderRight: c === colCount - 1 ? sideBorder(bV) : sideBorder(bV && !vGone(r, c)),
    borderBottom: r === rowCount - 1 ? sideBorder(bH) : sideBorder(bH && !hGone(r, c))
  });

  // Whole-row / whole-column emptiness (for backspace-to-remove).
  const isEmpty = (v: any) => String(v ?? "").trim() === "";
  const rowEmpty = (r: number) => node.rows[r].every(isEmpty);
  const colEmpty = (c: number) => node.rows.every((row: string[]) => isEmpty(row[c]));

  // ── Drag-to-reorder columns / rows ──────────────────────────────
  function startColReorder(from: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    let to = from;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    function onMove(ev: MouseEvent) {
      const cells = Array.from(table!.rows[0].cells) as HTMLElement[];
      const n = cells.length;
      const rects = cells.map((td) => td.getBoundingClientRect());
      const tableLeft = table!.getBoundingClientRect().left;
      let ins = rects.findIndex((r) => ev.clientX < r.left + r.width / 2);
      if (ins === -1) ins = n;
      to = ins > from ? ins - 1 : ins;
      const px = ins < n ? rects[ins].left - tableLeft : rects[n - 1].right - tableLeft;
      setMarker({ axis: "col", px });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      setMarker(null);
      if (to !== from) reorderTableColumn(node.id, from, to);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startRowReorder(from: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    let to = from;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    function onMove(ev: MouseEvent) {
      const rowsEls = Array.from(table!.rows) as HTMLElement[];
      const n = rowsEls.length;
      const rects = rowsEls.map((tr) => tr.getBoundingClientRect());
      const tableTop = table!.getBoundingClientRect().top;
      let ins = rects.findIndex((r) => ev.clientY < r.top + r.height / 2);
      if (ins === -1) ins = n;
      to = ins > from ? ins - 1 : ins;
      const px = ins < n ? rects[ins].top - tableTop : rects[n - 1].bottom - tableTop;
      setMarker({ axis: "row", px });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      setMarker(null);
      if (to !== from) reorderTableRow(node.id, from, to);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // A normalized colour grid (sized to the current rows; missing = null).
  const buildColors = () =>
    node.rows.map((row: string[], r: number) =>
      row.map((_: string, c: number) => node.colors?.[r]?.[c] ?? null)
    );
  const paintCell = (r: number, c: number) => {
    const cols = buildColors();
    cols[r][c] = brushColor;
    updateTableColors(node.id, cols);
  };
  const paintColumn = (c: number) => {
    const cols = buildColors();
    cols.forEach((row: any[]) => { row[c] = brushColor; });
    updateTableColors(node.id, cols);
  };
  const paintRow = (r: number) => {
    const cols = buildColors();
    cols[r] = cols[r].map(() => brushColor);
    updateTableColors(node.id, cols);
  };

  // Column widths are kept as fractions that always sum to 1, so the table
  // fills exactly the text-column width. Fall back to equal widths whenever
  // none are stored yet or a column was just added/removed.
  const widths: number[] =
    Array.isArray(node.colWidths) && node.colWidths.length === colCount
      ? node.colWidths
      : Array(colCount).fill(1 / colCount);

  const MIN = 0.05; // never let a column collapse completely

  function startResize(index: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const tableWidth = tableRef.current?.offsetWidth || 1;
    const startX = e.clientX;
    const startLeft = widths[index];
    const startRight = widths[index + 1];

    function onMove(ev: MouseEvent) {
      // Convert the pixel drag into a fraction, then trade width between this
      // column and its right neighbour so the total stays at 1 (no overflow).
      let delta = (ev.clientX - startX) / tableWidth;
      delta = Math.max(delta, MIN - startLeft);
      delta = Math.min(delta, startRight - MIN);

      const next = [...widths];
      next[index] = startLeft + delta;
      next[index + 1] = startRight - delta;
      updateTableColWidths(node.id, next);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="table-wrap" style={{ marginTop: 20 }}>
      <div style={{ position: "relative" }}>
      <table
        ref={tableRef}
        style={{
          width: "100%",
          tableLayout: "fixed",     // honour our column widths, never auto-grow
          borderCollapse: "collapse",
          color: "#000",
          fontFamily: "var(--sans)"
        }}
      >
        <colgroup>
          {widths.map((w, c) => (
            <col key={c} style={{ width: `${w * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {node.rows.map((row: string[], r: number) => (
            <tr key={r}>
              {row.map((cell: string, c: number) => (
                <td
                  key={c}
                  onClick={
                    tool === "paint"
                      ? () => paintCell(r, c)
                      : tool === "delete"
                      ? () => (c === 0 && r > 0 ? deleteTableRowAt(node.id, r) : deleteTableColumnAt(node.id, c))
                      : undefined
                  }
                  onDoubleClick={
                    tool === "paint"
                      ? () => {
                          if (r === 0) paintColumn(c);     // header → whole column
                          else if (c === 0) paintRow(r);   // first cell → whole row
                        }
                      : undefined
                  }
                  style={{
                    ...cellBorders(r, c),
                    padding: 0,
                    verticalAlign: "top",
                    position: "relative",
                    background: node.colors?.[r]?.[c] ?? undefined,
                    cursor:
                      tool === "paint" ? BRUSH_CURSOR : tool === "delete" ? DELETE_CURSOR : undefined
                  }}
                >
                  <CellTextarea
                    value={cell}
                    readOnly={active}
                    pointerNone={active}
                    fontSize={fontSize}
                    widthKey={widths[c]}
                    onChange={(v: string) => updateTableCell(node.id, r, c, v)}
                    onEnter={() =>
                      r === 0 ? addTableColumn(node.id) : addTableRow(node.id)
                    }
                    onDelete={() => {
                      // Header cell → drop an empty column; first cell of a data
                      // row → drop an empty row.
                      if (r === 0) {
                        if (colEmpty(c)) { deleteTableColumnAt(node.id, c); return true; }
                      } else if (c === 0) {
                        if (rowEmpty(r)) { deleteTableRowAt(node.id, r); return true; }
                      }
                      return false;
                    }}
                  />

                  {/* reorder grip above each column (top row only) */}
                  {!active && r === 0 && (
                    <div
                      className="tbl-grip"
                      title="Drag to reorder column"
                      onMouseDown={(e) => startColReorder(c, e)}
                      style={{
                        position: "absolute",
                        top: -15,
                        left: 1,
                        right: 1,
                        height: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "grab",
                        zIndex: 3
                      }}
                    >
                      <div style={{ width: "100%", maxWidth: 46, height: 7, borderRadius: 4, background: "#c2c8d2" }} />
                    </div>
                  )}

                  {/* reorder grip left of each row (first column only) */}
                  {!active && c === 0 && (
                    <div
                      className="tbl-grip"
                      title="Drag to reorder row"
                      onMouseDown={(e) => startRowReorder(r, e)}
                      style={{
                        position: "absolute",
                        left: -15,
                        top: 1,
                        bottom: 1,
                        width: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "grab",
                        zIndex: 3
                      }}
                    >
                      <div style={{ height: "100%", maxHeight: 46, width: 7, borderRadius: 4, background: "#c2c8d2" }} />
                    </div>
                  )}

                  {/* drag handle straddling the right edge of each column */}
                  {c < colCount - 1 && (
                    <div
                      onMouseDown={(e) => startResize(c, e)}
                      style={{
                        position: "absolute",
                        top: 0,
                        right: -3,
                        width: 6,
                        height: "100%",
                        cursor: "col-resize",
                        userSelect: "none",
                        zIndex: 1,
                        pointerEvents: active ? "none" : undefined
                      }}
                    />
                  )}

                  {/* border-edit tool: click a separator to remove / re-add it */}
                  {tool === "borders" && c < colCount - 1 && (
                    <div
                      className="tbl-border-edge"
                      title={vGone(r, c) ? "Add column separator" : "Remove column separator"}
                      onClick={() => toggleCellBorder(node.id, "v", r, c)}
                      style={{ position: "absolute", top: 0, bottom: 0, right: -4, width: 9, cursor: "pointer", zIndex: 5 }}
                    />
                  )}
                  {tool === "borders" && r < rowCount - 1 && (
                    <div
                      className="tbl-border-edge"
                      title={hGone(r, c) ? "Add row separator" : "Remove row separator"}
                      onClick={() => toggleCellBorder(node.id, "h", r, c)}
                      style={{ position: "absolute", left: 0, right: 0, bottom: -4, height: 9, cursor: "pointer", zIndex: 5 }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

        {/* live reorder indicator */}
        {marker && (
          <div
            style={{
              position: "absolute",
              pointerEvents: "none",
              zIndex: 5,
              background: DROP_LINE,
              borderRadius: 1,
              ...(marker.axis === "col"
                ? { left: marker.px - 1, top: 0, bottom: 0, width: 2 }
                : { top: marker.px - 1, left: 0, right: 0, height: 2 })
            }}
          />
        )}
      </div>

      {/* LaTeX-style caption */}
      <div
        style={{
          marginTop: 8,
          textAlign: "center",
          fontSize: 14,
          fontFamily: "var(--sans)",
          color: "var(--text)"
        }}
      >
        <strong>Table {tableNumbers?.[node.id]}:</strong>{" "}
        <input
          value={node.caption || ""}
          onChange={(e) => updateTableCaption(node.id, e.target.value)}
          style={{
            border: "none",
            borderBottom: "1px solid #ccc",
            outline: "none",
            width: "70%",
            textAlign: "center",
            fontFamily: "var(--sans)",
            background: "transparent",
            color: "var(--text)"
          }}
        />
      </div>

      {/* paint tool, grid-line toggles, delete-table — all one line */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <button
          className="tbl-btn"
          title="Paint cells (click a cell; double-click a header to fill a column, the first cell of a row to fill the row)"
          onClick={() => setTool((t) => (t === "paint" ? "none" : "paint"))}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tool === "paint" ? brushColor : "#eee",
            border: tool === "paint" ? "2px solid #333" : "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13
          }}
        >
          🖌
        </button>
        <input
          type="color"
          value={brushColor}
          onChange={(e) => setBrushColor(e.target.value)}
          title="Brush color"
          style={{
            width: 24,
            height: 24,
            padding: 0,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "none",
            cursor: "pointer"
          }}
        />

        <button
          className="tbl-btn"
          title="Delete tool: click a header to remove its column, the first cell of a row to remove that row"
          onClick={() => setTool((t) => (t === "delete" ? "none" : "delete"))}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tool === "delete" ? "#f5c6c6" : "#eee",
            border: tool === "delete" ? "2px solid #d23f3f" : "1px solid #ccc",
            borderRadius: 4,
            color: "#d23f3f",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700
          }}
        >
          ✕
        </button>

        <button
          className="tbl-btn"
          title="Border editor: click a grid line between cells to remove or re-add it"
          onClick={() => setTool((t) => (t === "borders" ? "none" : "borders"))}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tool === "borders" ? "#e8eefc" : "#eee",
            border: tool === "borders" ? `2px solid ${DROP_LINE}` : "1px solid #ccc",
            borderRadius: 4,
            color: tool === "borders" ? DROP_LINE : "#555",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          ⊞
        </button>

        {/* grid-line toggles */}
        <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 2px" }} />
        <button
          className="tbl-btn"
          title={bV ? "Hide vertical lines" : "Show vertical lines"}
          onClick={() => toggleTableBorder(node.id, "v")}
          style={{
            width: 24, height: 24, padding: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: bV ? "#e8eefc" : "#eee",
            border: bV ? `1px solid ${DROP_LINE}` : "1px solid #ccc",
            color: bV ? DROP_LINE : "#999",
            borderRadius: 4, cursor: "pointer", fontSize: 14
          }}
        >
          ▥
        </button>
        <button
          className="tbl-btn"
          title={bH ? "Hide horizontal lines" : "Show horizontal lines"}
          onClick={() => toggleTableBorder(node.id, "h")}
          style={{
            width: 24, height: 24, padding: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: bH ? "#e8eefc" : "#eee",
            border: bH ? `1px solid ${DROP_LINE}` : "1px solid #ccc",
            color: bH ? DROP_LINE : "#999",
            borderRadius: 4, cursor: "pointer", fontSize: 14
          }}
        >
          ▤
        </button>

        <TrashButton
          className="tbl-btn"
          onClick={() => deleteNodeById(node.id)}
          label="Delete table"
        />
      </div>
    </div>
  );
}

/* -----------------------------
   SUBSECTION (NO DND)
----------------------------- */
function Subsection({
  node,
  showHeader = true,
  updateSectionTitle,
  deleteNodeById,
  moveSubsection,
  fontSize = 13,
  children
}: any) {
  return (
    <div style={{ marginTop: showHeader ? fontSize * 1.4 : 0 }}>
      {showHeader && (
        <div className="hover-target" data-head-id={node.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: fontSize * 0.65 }}>
          <div style={{ display: "flex", gap: "0.4em", flex: 1, minWidth: 0 }}>
            {node.numberLabel && (
              <span style={{ ...headingStyle(fontSize, 1.2), whiteSpace: "nowrap" }}>{node.numberLabel}</span>
            )}
            <HeadingInput
              value={node.title}
              onChange={(v: string) => updateSectionTitle(node.id, v)}
              style={headingStyle(fontSize, 1.2)}
              ariaLabel="Subsection title"
              placeholder="Add subsection title here"
            />
          </div>

          {/* MOVE / DELETE — only visible while the heading is hovered */}
          <div className="hover-tools" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronButton dir={-1} title="Move up" onClick={() => moveSubsection(node.id, -1)} />
            <ChevronButton dir={1} title="Move down" onClick={() => moveSubsection(node.id, 1)} />
            <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete subsection" />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

/* -----------------------------
   SUBSUBSECTION (NO DND)
----------------------------- */
function Subsubsection({
  node,
  showHeader = true,
  updateSectionTitle,
  deleteNodeById,
  fontSize = 13,
  children
}: any) {
  return (
    <div style={{ marginTop: showHeader ? fontSize * 1.4 : 0 }}>
      {showHeader && (
        <div className="hover-target" data-head-id={node.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: fontSize * 0.65 }}>
          <div style={{ display: "flex", gap: "0.4em", flex: 1, minWidth: 0 }}>
            {node.numberLabel && (
              <span style={{ ...headingStyle(fontSize, 1), whiteSpace: "nowrap" }}>{node.numberLabel}</span>
            )}
            <HeadingInput
              value={node.title}
              onChange={(v: string) => updateSectionTitle(node.id, v)}
              style={headingStyle(fontSize, 1)}
              ariaLabel="Subsubsection title"
              placeholder="Add subsubsection title here"
            />
          </div>

          <div className="hover-tools" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete subsubsection" />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

/* -----------------------------
   SECTION (NO DND)
----------------------------- */
function Section({ node, showHeader = true, ...rest }: any) {
  const {
    updateSectionTitle,
    deleteNodeById, moveSection, children, fontSize = 13
  } = rest;

  return (
    <div style={{ marginTop: showHeader ? fontSize * 1.5 : 0 }}>

      {/* Header row; hidden on continuation columns/pages. */}
      {showHeader && (
        <div
          className="hover-target"
          data-head-id={node.id}
          style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: fontSize * 1.0 }}
        >
          <div style={{ display: "flex", gap: "0.4em", flex: 1, minWidth: 0 }}>
            {node.sectionNumber != null && (
              <span style={{ ...headingStyle(fontSize, 1.44), whiteSpace: "nowrap" }}>{node.sectionNumber}</span>
            )}
            <HeadingInput
              value={node.title}
              onChange={(v: string) => updateSectionTitle(node.id, v)}
              style={headingStyle(fontSize, 1.44)}
              ariaLabel="Section title"
              placeholder="Add section title here"
            />
          </div>

          {/* MOVE / DELETE — only visible while the heading is hovered */}
          <div className="hover-tools" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronButton dir={-1} title="Move up" onClick={() => moveSection(node.id, -1)} />
            <ChevronButton dir={1} title="Move down" onClick={() => moveSection(node.id, 1)} />
            <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete section" />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

/* -----------------------------
   SPECIAL PAGE (cover / TOC / bibliography) — header only for now.
----------------------------- */
const PAGE_TITLES: Record<string, string> = {
  coverpage: "Cover Page",
  toc: "Table of Contents",
  bibliography: "Bibliography"
};
function PageBlock({ node, deleteNodeById }: any) {
  return (
    <div
      style={{
        marginBottom: 30,
        padding: "20px 0",
        borderTop: "2px solid #e0e0e0",
        position: "relative"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 30 }}>
          {PAGE_TITLES[node.type] ?? node.title}
        </h1>
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete page" />
      </div>
    </div>
  );
}

/* -----------------------------
   RECURSIVE CHUNK RENDERING
----------------------------- */
// The drop zones + child elements inside a container chunk.
function containerInner(chunk: Chunk, props: any) {
  const node = chunk.node;
  const fullChildren = node.children ?? [];

  // Only show the trailing "append to this container" zone when the block
  // actually rendered last in this chunk is a leaf. If it's another container,
  // that container already renders its own end zone at this spot, so an outer
  // one would just stack up dead/redundant slots beneath the trailing
  // "+ …" buttons (e.g. a section-level zone under "+ Subsubsection").
  const lastRendered = chunk.children[chunk.children.length - 1];
  const showEndZone =
    chunk.isLast && (!lastRendered || !isContainerType(lastRendered.node.type));

  return (
    <>
      {chunk.children.map((ch) => {
        const absIndex = fullChildren.findIndex((c: any) => c.id === ch.node.id);
        const prev = fullChildren[absIndex - 1];
        // LaTeX: a paragraph is unindented when it's the first block or follows
        // a heading (so a section's body text stays flush even after a
        // subsection is dropped in front of it).
        const noIndent = absIndex === 0 || (prev && isContainerType(prev.type));
        // A section may be dropped only next to a heading (sub/subsubsection).
        const headingAdjacent =
          isContainerType(ch.node.type) || (prev && isContainerType(prev.type));
        return (
          <Fragment key={ch.node.id}>
            <DropZone
              id={`dz::${node.id}::${absIndex}`}
              containerType={node.type}
              headingAdjacent={headingAdjacent}
            />
            {renderChunk(ch, props, noIndent)}
          </Fragment>
        );
      })}
      {showEndZone && (
        <DropZone
          id={`dz::${node.id}::${fullChildren.length}`}
          containerType={node.type}
          headingAdjacent={
            fullChildren.length > 0 &&
            isContainerType(fullChildren[fullChildren.length - 1].type)
          }
        />
      )}
    </>
  );
}

/* -----------------------------
   LIST (itemize / enumerate)
----------------------------- */
// A single auto-growing list-item field. Enter starts a new item; Backspace in
// an empty item removes it (and focuses the previous one). Shift+Enter inserts a
// soft line break within the item.
function ListItemInput({ value, fontSize, lineHeight, autoFocus, onChange, onEnter, onEmptyBackspace }: any) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(grow, [value, fontSize]);

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(); }
        else if (e.key === "Backspace" && value === "") { e.preventDefault(); onEmptyBackspace(); }
      }}
      style={{
        flex: 1,
        minWidth: 0,
        display: "block",
        boxSizing: "border-box",
        border: "none",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        background: "transparent",
        color: "var(--text)",
        fontFamily: "var(--sans)",
        fontSize,
        lineHeight,
        padding: 0,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}
    />
  );
}

function ListBlock({
  node,
  updateListItem,
  addListItem,
  deleteListItem,
  setListStyle,
  deleteNodeById,
  fontSize = 13,
  lineHeight = 1.2
}: any) {
  const items: any[] = node.items ?? [];
  const style: string = node.listStyle ?? "dot";
  const [focusId, setFocusId] = useState<string | null>(null);

  const marker = (i: number) =>
    style === "number" ? `${i + 1}.` : style === "dash" ? "–" : "•";

  const styleBtn = (s: "dot" | "dash" | "number", label: string, glyph: string) => (
    <button
      className="tbl-btn"
      title={label}
      onClick={() => setListStyle(node.id, s)}
      style={{
        width: 24, height: 24, padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: style === s ? "#e8eefc" : "#eee",
        border: style === s ? `1px solid ${DROP_LINE}` : "1px solid #ccc",
        color: style === s ? DROP_LINE : "#555",
        borderRadius: 4, cursor: "pointer", fontSize: 13, lineHeight: 1
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div className="hover-target" data-leaf-id={node.id} style={{ margin: "10px 0" }}>
      <div style={{ paddingLeft: "1.5em" }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", lineHeight, fontSize }}>
            <span
              style={{
                minWidth: "1.5em",
                textAlign: "right",
                fontFamily: "var(--sans)",
                color: "var(--text)",
                userSelect: "none",
                fontSize,
                lineHeight
              }}
            >
              {marker(i)}
            </span>
            <ListItemInput
              value={it.text ?? ""}
              fontSize={fontSize}
              lineHeight={lineHeight}
              autoFocus={focusId === it.id}
              onChange={(v: string) => updateListItem(node.id, it.id, v)}
              onEnter={() => {
                const nid = crypto.randomUUID();
                addListItem(node.id, it.id, nid);
                setFocusId(nid);
              }}
              onEmptyBackspace={() => {
                if (items.length <= 1) return;
                const idx = items.findIndex((x) => x.id === it.id);
                const prev = items[idx - 1];
                deleteListItem(node.id, it.id);
                if (prev) setFocusId(prev.id);
              }}
            />
          </div>
        ))}
      </div>

      {/* style toggles + delete — only while the list is hovered */}
      <div className="hover-tools" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: "1.5em" }}>
        {styleBtn("dot", "Bullets (•)", "•")}
        {styleBtn("dash", "Dashes (–)", "–")}
        {styleBtn("number", "Numbers (1.)", "1.")}
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete list" />
      </div>
    </div>
  );
}

/* -----------------------------
   FRAME (beamer slide) — one frame == one page. The page padding already
   supplies the slide's content margins; the frame fills that area and never
   spills onto the next slide.
----------------------------- */
const BEAMER_BLUE = "#3b4ba0";

function FrameBlock({
  node, updateSectionTitle, deleteNodeById, moveSection,
  fontSize = 21, children
}: any) {
  // The title slide: everything centered in the middle of the slide.
  if (node.frameVariant === "title") {
    return (
      <div className="hover-target" style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: fontSize }}>
        <div className="hover-tools" style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 4 }}>
          <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete slide" />
        </div>
        <div style={{ width: "100%" }}>
          <HeadingInput
            value={node.title}
            onChange={(v: string) => updateSectionTitle(node.id, v)}
            style={{ ...headingStyle(fontSize, 1.7), color: BEAMER_BLUE, textAlign: "center" }}
            ariaLabel="Presentation title"
            placeholder="Presentation Title"
          />
        </div>
        <div style={{ width: "80%" }}>{children}</div>
      </div>
    );
  }

  // A normal slide: a coloured frametitle and a rule, then the body.
  return (
    <div className="hover-target" style={{ position: "relative", height: "100%" }}>
      <div data-head-id={node.id} style={{ marginBottom: fontSize * 0.7 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <HeadingInput
            value={node.title}
            onChange={(v: string) => updateSectionTitle(node.id, v)}
            style={{ ...headingStyle(fontSize, 1.3), color: BEAMER_BLUE }}
            ariaLabel="Frame title"
            placeholder="Frame title"
          />
          <div className="hover-tools" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronButton dir={-1} title="Move slide up" onClick={() => moveSection(node.id, -1)} />
            <ChevronButton dir={1} title="Move slide down" onClick={() => moveSection(node.id, 1)} />
            <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete slide" />
          </div>
        </div>
        <div style={{ height: 2, background: BEAMER_BLUE, opacity: 0.3, marginTop: fontSize * 0.25 }} />
      </div>
      {children}
    </div>
  );
}

function renderChunk(chunk: Chunk, props: any, firstChild = false): any {
  const node = chunk.node;

  if (node.type === "frame") {
    return (
      <FrameBlock node={node} {...props}>
        {containerInner(chunk, props)}
      </FrameBlock>
    );
  }

  if (node.type === "paragraph") {
    // A split paragraph renders as several slice pieces; only the whole-node
    // form carries data-leaf-id (split heights come from line geometry instead).
    const sliceProps = chunk.slice
      ? { sliceStart: chunk.slice.start, sliceEnd: chunk.slice.end }
      : {};
    // Block-style (letter) paragraphs are separated by vertical space instead of
    // an indent. The gap lives on the wrapper. It leads every paragraph except
    // the first; a split continuation (slice starting mid-paragraph) gets none.
    const atParaStart = !chunk.slice || chunk.slice.start === 0;
    const blockGap =
      props.blockParagraphs && !firstChild && atParaStart ? (props.fontSize ?? 13) * 0.9 : 0;
    return (
      <div {...(chunk.slice ? {} : { "data-leaf-id": node.id })} style={blockGap ? { paddingTop: blockGap } : undefined}>
        <Paragraph node={node} {...props} firstChild={firstChild} {...sliceProps} />
      </div>
    );
  }
  if (node.type === "abstract") {
    return <AbstractBlock node={node} {...props} />;
  }
  if (node.type === "list") {
    return <ListBlock node={node} {...props} />;
  }
  if (node.type === "table") {
    return (
      <div data-leaf-id={node.id}>
        <TableBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "math") {
    return (
      <div data-leaf-id={node.id}>
        <MathBlock node={node} {...props} equationNumber={props.equationNumbers?.[node.id]} />
      </div>
    );
  }
  if (node.type === "coverpage" || node.type === "toc" || node.type === "bibliography") {
    return (
      <div data-leaf-id={node.id}>
        <PageBlock node={node} {...props} />
      </div>
    );
  }
  if (node.type === "figure") {
    return (
      <div data-leaf-id={node.id}>
        <FigureBlock
          node={node}
          updateFigureCaption={props.updateFigureCaption}
          updateFigureWidth={props.updateFigureWidth}
          deleteFigureImage={props.deleteFigureImage}
          figureNumber={props.figureNumbers?.[node.id]}
        />
      </div>
    );
  }
  if (node.type === "subsection") {
    return (
      <Subsection node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
        {containerInner(chunk, props)}
      </Subsection>
    );
  }
  if (node.type === "subsubsection") {
    return (
      <Subsubsection node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
        {containerInner(chunk, props)}
      </Subsubsection>
    );
  }
  // section
  return (
    <Section node={node} showHeader={chunk.header} isLast={chunk.isLast} {...props}>
      {containerInner(chunk, props)}
    </Section>
  );
}

/* -----------------------------
   DOCUMENT ROOT (renders one column)
----------------------------- */
export function DocumentRenderer(props: any) {
  const { setNodeRef } = useDroppable({ id: props.droppableId ?? "document-root" });
  const column = props.column as Chunk[];

  return (
    <div ref={setNodeRef}>
      {column.map((chunk, i) => (
        <Fragment key={`${chunk.node.id}-${i}`}>
          {renderChunk(chunk, props, i === 0)}
        </Fragment>
      ))}
    </div>
  );
}