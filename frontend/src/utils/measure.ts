// DOM measurement helpers that drive pagination and caret restoration. These are
// pure (no React), reading layout geometry off rendered elements, so they live
// apart from the editor component.

// Gather every footnote whose target paragraph lands on this page (paragraphs
// are never split across pages), ordered by their global number.
export function collectPageFootnotes(
  cols: any[],
  footnoteNumbers: Record<string, number>
): { paragraphId: string; fn: any; number: number }[] {
  const out: { paragraphId: string; fn: any; number: number }[] = [];
  const walk = (chunk: any) => {
    const n = chunk.node;
    if (n.type === "paragraph" && n.footnotes?.length) {
      n.footnotes.forEach((fn: any) =>
        out.push({ paragraphId: n.id, fn, number: footnoteNumbers[fn.id] ?? 0 })
      );
    }
    (chunk.children ?? []).forEach(walk);
  };
  cols.forEach((col: any[]) => col.forEach(walk));
  return out.sort((a, b) => a.number - b.number);
}

// Measure each rendered line of a paragraph: where it starts (char offset) and
// its cumulative bottom (px) from the element's top.
//
// Line geometry comes from Range.getClientRects() (one rect per wrapped line),
// which is layout-derived and therefore correct even for lines scrolled out of
// view or clipped by an overflow:hidden page. The per-line *start offset* is then
// found by binary-searching character positions with getBoundingClientRect —
// deliberately NOT caretRangeFromPoint, which returns null for any point outside
// the viewport and so silently collapsed every off-screen line to offset 0,
// breaking the split of long (multi-page) paragraphs.
export function measureParagraphLines(p: HTMLElement): { offset: number; bottom: number }[] {
  const total = (p.textContent ?? "").length;
  if (!total) return [];
  const pTop = p.getBoundingClientRect().top;

  // Merge the raw client rects into one entry per visual line (by top).
  const range = document.createRange();
  range.selectNodeContents(p);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
  const lineRects: { top: number; bottom: number }[] = [];
  let prevTop = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.top > prevTop + 1) { lineRects.push({ top: r.top, bottom: r.bottom }); prevTop = r.top; }
    else { const L = lineRects[lineRects.length - 1]; L.bottom = Math.max(L.bottom, r.bottom); }
  }
  if (!lineRects.length) return [];

  // Contiguous text-node segments, so a global char offset can be turned into a
  // Range (footnote markers and other non-text nodes are skipped).
  const segs: { node: Node; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let acc = 0, n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    segs.push({ node: n, start: acc, end: acc + len });
    acc += len;
  }
  const charRange = (a: number, b: number): Range | null => {
    let sN: Node | null = null, sO = 0, eN: Node | null = null, eO = 0;
    for (const s of segs) {
      if (sN === null && a < s.end) { sN = s.node; sO = a - s.start; }
      if (b <= s.end) { eN = s.node; eO = b - s.start; break; }
    }
    if (!sN || !eN) return null;
    const r = document.createRange();
    try { r.setStart(sN, sO); r.setEnd(eN, eO); } catch { return null; }
    return r;
  };
  // Top (viewport y) of the single character starting at global offset `o`.
  const topOfChar = (o: number): number | null => {
    const r = charRange(o, o + 1);
    if (!r) return null;
    const cr = r.getBoundingClientRect();
    return cr.height ? cr.top : null;
  };

  // First line always starts at 0; each later line's start is the first char
  // whose rect sits on (or below) that line's top.
  const out: { offset: number; bottom: number }[] = [{ offset: 0, bottom: lineRects[0].bottom - pTop }];
  for (let i = 1; i < lineRects.length; i++) {
    const targetTop = lineRects[i].top;
    let lo = out[i - 1].offset + 1, hi = total - 1, ans = total;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = topOfChar(mid);
      if (t != null && t >= targetTop - 1) { ans = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    out.push({ offset: ans, bottom: lineRects[i].bottom - pTop });
  }
  return out;
}

// Vertical space a flow element really occupies, including its own vertical
// margins AND any child margin that collapses *through* it (a wrapper with no
// padding/border on that side does not contain the child's margin, so
// getBoundingClientRect misses it). LaTeX adds these spaces rather than
// collapsing them, so counting the full footprint keeps pagination from
// overfilling a page — the measured height now matches what is actually drawn.
export function flowHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const num = (v: string) => parseFloat(v || "0") || 0;
  let h = el.getBoundingClientRect().height + num(cs.marginTop) + num(cs.marginBottom);
  if (num(cs.paddingTop) === 0 && num(cs.borderTopWidth) === 0) {
    const fc = el.firstElementChild as HTMLElement | null;
    if (fc) h += Math.max(0, num(getComputedStyle(fc).marginTop));
  }
  if (num(cs.paddingBottom) === 0 && num(cs.borderBottomWidth) === 0) {
    const lc = el.lastElementChild as HTMLElement | null;
    if (lc) h += Math.max(0, num(getComputedStyle(lc).marginBottom));
  }
  return h;
}

export type LineMap = Record<string, { offset: number; bottom: number }[]>;

export function lineDataUnchanged(prev: LineMap, next: LineMap): boolean {
  const pk = Object.keys(prev), nk = Object.keys(next);
  if (pk.length !== nk.length) return false;
  for (const k of nk) {
    const a = prev[k], b = next[k];
    if (!a || a.length !== b.length) return false;
    for (let i = 0; i < b.length; i++) {
      if (a[i].offset !== b[i].offset || Math.abs(a[i].bottom - b[i].bottom) > 1) return false;
    }
  }
  return true;
}

// Place the caret at a character offset inside a contentEditable element.
export function placeCaretAt(el: HTMLElement, offset: number) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset, target: Text | null = null, local = 0, n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    if (remaining <= len) { target = n as Text; local = remaining; break; }
    remaining -= len;
  }
  const range = document.createRange();
  if (target) { range.setStart(target, local); range.collapse(true); }
  else { range.selectNodeContents(el); range.collapse(false); }
  sel.removeAllRanges();
  sel.addRange(range);
}
