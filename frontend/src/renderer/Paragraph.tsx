import { Fragment, useRef, useState, useMemo, useLayoutEffect } from "react";
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
  marks: Mark[] = [],
  citations: any[] = [],
  citeNumbers: Record<string, number> | undefined = undefined
): string {
  // Footnote markers keyed by their anchor character offset. Unconnected
  // footnotes (their word was deleted) have no marker.
  const fnAt = new Map<number, any[]>();
  for (const f of footnotes) {
    if (f.unconnected || f.offset == null) continue;
    const at = Math.min(Math.max(f.offset, 0), text.length);
    fnAt.set(at, (fnAt.get(at) ?? []).concat(f));
  }
  // Citation markers keyed by their anchor offset (same machinery as footnotes).
  const citeAt = new Map<number, any[]>();
  for (const c of citations) {
    if (c.offset == null) continue;
    const at = Math.min(Math.max(c.offset, 0), text.length);
    citeAt.set(at, (citeAt.get(at) ?? []).concat(c));
  }

  // A block with white-space:pre-wrap does not render its final newline (the
  // empty last line has no content to give it height), so a single trailing
  // Enter looks like nothing happened until a second one is pressed. Append a
  // "bogus" <br> to give that empty line height. It carries data-bogus so
  // readEditableRich drops it again and it never round-trips into the text.
  const trailingBr = text.endsWith("\n") ? '<br data-bogus="1">' : "";

  // Nothing to decorate → the original fast path.
  if (!marks.length && fnAt.size === 0 && citeAt.size === 0) return escapeHtml(text) + trailingBr;

  let html = "";
  let cur: Fmt = { b: false, i: false, u: false };
  for (let p = 0; p <= text.length; p++) {
    const fns = fnAt.get(p);
    const cites = citeAt.get(p);
    if (fns || cites) {
      // Footnote / citation markers sit outside any format run.
      html += fmtClose(cur);
      cur = { b: false, i: false, u: false };
      for (const f of fns ?? [])
        html +=
          `<sup data-fn="${f.id}" contenteditable="false" ` +
          `style="font-size:0.7em;vertical-align:super;">${footnoteNumbers?.[f.id] ?? 0}</sup>`;
      for (const c of cites ?? [])
        html +=
          `<span data-cite="${c.id}" contenteditable="false" class="cite-marker" ` +
          `title="Edit citation">[${citeNumbers?.[c.entryId] ?? "?"}]</span>`;
    }
    if (p === text.length) break;
    const f = formatAt(marks, p);
    if (f.b !== cur.b || f.i !== cur.i || f.u !== cur.u) { html += fmtClose(cur); cur = f; html += fmtOpen(cur); }
    html += escapeHtml(text[p]);
  }
  html += fmtClose(cur);
  return html + trailingBr;
}

// Read the contentEditable back out as plain text plus formatting marks: footnote
// markers are dropped, <br> becomes a newline, and each text node's b/i/u state
// (from its ancestor tags / inline styles) becomes a mark range.
function readEditableRich(el: HTMLElement): {
  text: string; marks: Mark[];
  fnMarkers: { id: string; offset: number }[];
  citeMarkers: { id: string; offset: number }[];
} {
  let text = "";
  const runs: Mark[] = [];
  const fnMarkers: { id: string; offset: number }[] = [];
  const citeMarkers: { id: string; offset: number }[] = [];

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
        if (e.hasAttribute("data-cite")) {
          citeMarkers.push({ id: e.getAttribute("data-cite")!, offset: text.length });
          continue;
        }
        // The rendered trailing "bogus" <br> (see buildParagraphHtml) only
        // gives the empty last line height; it isn't part of the text.
        if (e.nodeName === "BR") { if (!e.hasAttribute("data-bogus")) text += "\n"; continue; }
        walk(e);
      }
    }
  };
  walk(el);
  return { text, marks: normalizeMarks(runs), fnMarkers, citeMarkers };
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
  lineHeight, fontSize, firstChild, footnoteNumbers, citeNumbers, onCiteClick,
  sliceStart, sliceEnd, blockParagraphs
}: any) {
  const ref = useRef<HTMLParagraphElement>(null);
  const text: string = node.text ?? "";
  const footnotes: any[] = node.footnotes ?? [];
  const marks: Mark[] = node.marks ?? [];
  const citations: any[] = node.citations ?? [];

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
      : buildParagraphHtml(text, footnotes, footnoteNumbers, marks, citations, citeNumbers)),
    [text, sliceText, isSlice, footnotes, footnoteNumbers, marks, citations, citeNumbers, start, end]
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
    const { text: domText, marks: sliceRuns, fnMarkers, citeMarkers } = readEditableRich(el);
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

    // Reconcile citations against their surviving markers (same as footnotes).
    // Only when the whole paragraph is rendered — split slices carry no markers,
    // so the citations are passed through untouched.
    let nextCitations = citations;
    if (!isSlice && citations.length) {
      const present = new Map(citeMarkers.map((m) => [m.id, m.offset]));
      const rebuilt = citations
        .filter((c: any) => present.has(c.id))
        .map((c: any) => ({ ...c, offset: present.get(c.id) as number }));
      const changed =
        rebuilt.length !== citations.length ||
        rebuilt.some((c: any, i: number) => c.offset !== citations[i]?.offset || c.id !== citations[i]?.id);
      if (changed) nextCitations = rebuilt;
    }

    const full = text.slice(0, start) + outText + text.slice(end);
    const nextMarks = spliceMarks(marks, start, end, outRuns, outText.length);
    onCaret?.(node.id, start + outCaret);
    onTyping?.(node.id);
    if (full !== text || !marksEqual(marks, nextMarks) || nextFootnotes !== footnotes || nextCitations !== citations)
      updateRichText(node.id, full, nextMarks, nextFootnotes, nextCitations);
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
            // While a symbol suggestion is showing, Enter inserts that symbol.
            if (greek) { insertGreek(); return; }
            // Otherwise insert a newline deterministically into the model (not
            // via execCommand, whose contentEditable behaviour is inconsistent
            // and left the caret on the previous line). The caret is recorded
            // just after the new "\n" so the restore effect drops it onto the
            // fresh line — so one Enter = one new line with the cursor in it.
            const el = ref.current;
            if (!el) return;
            const fullCaret = start + getCaretOffset(el);
            const newFull = text.slice(0, fullCaret) + "\n" + text.slice(fullCaret);
            const nextMarks = spliceMarks(marks, fullCaret, fullCaret, [], 1);
            const nextFootnotes = footnotes.map((f: any) =>
              !f.unconnected && f.offset != null && f.offset >= fullCaret
                ? { ...f, offset: f.offset + 1 }
                : f
            );
            const nextCitations = citations.map((c: any) =>
              c.offset != null && c.offset >= fullCaret ? { ...c, offset: c.offset + 1 } : c
            );
            onCaret?.(node.id, fullCaret + 1);
            onTyping?.(node.id);
            updateRichText(node.id, newFull, nextMarks, nextFootnotes, nextCitations);
          }
        }}
        onClick={(e) => {
          // Clicking an inline [n] marker opens its bibliography entry to edit.
          const marker = (e.target as HTMLElement)?.closest?.("[data-cite]") as HTMLElement | null;
          if (!marker) return;
          const cid = marker.getAttribute("data-cite");
          const c = citations.find((x: any) => x.id === cid);
          if (c) { e.preventDefault(); onCiteClick?.(c.entryId); }
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

export function Paragraph(props: any) {
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
