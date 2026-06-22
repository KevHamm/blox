import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Logo, ThemeToggle } from "./chrome";
import type { InsertPos } from "./PageImportModal";

// Outline group types that are body content — the only ones the user can
// reorder or insert a page next to (cover / TOC / bibliography are pinned by
// pagination, so they're never drag/insert anchors).
const CONTENT_TYPES = new Set(["section", "frame", "designpage"]);

// Tall enough to hold the mini page preview — roughly half a sidebar's width.
export const TOPBAR_HEIGHT = 140;
// Collapsed height: just tall enough for the logo / undo-redo / export controls.
// Hiding the bar shrinks it to this (only the document preview disappears).
export const TOPBAR_COLLAPSED_HEIGHT = 56;

type Layout = {
  pageWidth: number;
  pageHeight: number;
};

// Smooth-scroll the document area to page `i`.
function jumpToPage(i: number) {
  const docArea = document.querySelector<HTMLElement>(".doc-area");
  if (!docArea) return;
  const page = docArea.querySelectorAll<HTMLElement>(".blox-page")[i];
  if (!page) return;
  const top =
    docArea.scrollTop + (page.getBoundingClientRect().top - docArea.getBoundingClientRect().top) - 24;
  docArea.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

// A live, scaled-down clone of one rendered `.blox-page`. The clone is stripped
// of editing hooks so it can't interfere with the editor's measurement / caret
// logic; it re-clones whenever pagination (`dep`) changes.
function MiniPage({
  index, scale, w, h, dep, onClick, title
}: { index: number; scale: number; w: number; h: number; dep: any; onClick?: () => void; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.innerHTML = "";
    const real = document.querySelectorAll<HTMLElement>(".doc-area .blox-page")[index];
    if (!real) return;
    const clone = real.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[contenteditable]").forEach((e) => e.setAttribute("contenteditable", "false"));
    clone.querySelectorAll("[data-para-id],[data-leaf-id],[data-head-id]").forEach((e) => {
      e.removeAttribute("data-para-id");
      e.removeAttribute("data-leaf-id");
      e.removeAttribute("data-head-id");
    });
    clone.style.margin = "0";
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = "top left";
    clone.style.pointerEvents = "none";
    slot.appendChild(clone);
  }, [index, scale, w, h, dep]);

  return (
    <div
      onClick={onClick}
      title={title}
      className="outline-page"
      style={{
        width: w, height: h, flex: "0 0 auto", borderRadius: 3, overflow: "hidden",
        cursor: onClick ? "pointer" : "default", background: "#fff",
        boxShadow: "0 1px 5px rgba(20,20,50,0.22)"
      }}
    >
      <div ref={ref} style={{ width: w, height: h }} />
    </div>
  );
}

// A "pile" representing a multi-page group: the first page on top, a couple of
// offset cards behind it, and a page-count badge.
function StackedPages({
  firstIndex, count, scale, w, h, dep, onClick, title
}: { firstIndex: number; count: number; scale: number; w: number; h: number; dep: any; onClick?: () => void; title?: string }) {
  const off = 4;
  return (
    <div
      onClick={onClick}
      title={title}
      className="outline-page"
      style={{ position: "relative", width: w + off * 2, height: h + off * 2, flex: "0 0 auto", cursor: "pointer" }}
    >
      {[2, 1].map((k) => (
        <div key={k} style={{
          position: "absolute", left: k * off, top: k * off, width: w, height: h,
          background: "#fff", borderRadius: 3, boxShadow: "0 1px 4px rgba(20,20,50,0.18)"
        }} />
      ))}
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <MiniPage index={firstIndex} scale={scale} w={w} h={h} dep={dep} />
      </div>
      <span style={{
        position: "absolute", right: -6, top: -6, minWidth: 16, height: 16, padding: "0 4px",
        borderRadius: 8, background: "var(--ui-accent-fill)", color: "#fff", fontSize: 10, fontWeight: 700,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--ui-font)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)"
      }}>{count}</span>
    </div>
  );
}

// A page-sized "+" button used to import a page (in the overview's leftmost slot
// and at the left of an expanded deck).
function PlusPage({ w, h, onClick, title }: { w: number; h: number; onClick: () => void; title: string }) {
  return (
    <button
      className="outline-plus"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{ width: w, height: h, flex: "0 0 auto" }}
    >
      <svg width={Math.round(Math.min(w, h) * 0.42)} height={Math.round(Math.min(w, h) * 0.42)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

// Caption under a preview / stack.
function OutlineLabel({ children, width }: { children: any; width: number }) {
  return (
    <span style={{
      maxWidth: Math.max(width + 12, 64), fontFamily: "var(--ui-font)", fontSize: 11,
      lineHeight: 1.2, color: "var(--ui-2nd)", textAlign: "center",
      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }}>{children}</span>
  );
}

// Horizontal strip that centres content when it fits and scrolls when it does
// not; the vertical mouse wheel scrolls it left/right. It now stretches to the
// full width of its (centre) container — i.e. the whole document field — and
// keeps vertical breathing room so the page-count badge is never clipped.
function ScrollRow({ children }: { children: any }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="outline-swap"
      onWheel={(e) => { if (ref.current && e.deltaY) ref.current.scrollLeft += e.deltaY; }}
      style={{
        // flex-start keeps every page / stack flush along the top.
        display: "flex", alignItems: "flex-start", gap: 14,
        justifyContent: "safe center", overflowX: "auto", overflowY: "hidden",
        width: "100%", padding: "12px 6px"
      }}
    >
      {children}
    </div>
  );
}

const DECK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const STAGE_PAD_TOP = 8;   // breathing room above the pages (so the count badge isn't clipped)
const STAGE_OFF = 4;       // per-card offset of a piled stack
const STAGE_GAP = 16;      // gap between section stacks in the overview
const DECK_GAP = 14;       // gap between fanned-out pages
const BACK_LEFT = 6;       // x of the back button
const DECK_LEFT = 46;      // leftmost allowed page position (clears the back button)

type OutlineGroup = { key: string; type: string; label: string; pages: number[]; first: number };

// The expanded (non-collapsed) outline, laid out in a single absolute coordinate
// space so the overview ⇆ expanded transition is spatially continuous:
//
//  • Click a stack → its top page slides to the leftmost allowed slot and the
//    following pages unstack left → right, while every other section stack
//    slides off-screen (those before it leave left, those after leave right).
//  • Click Back → the pages restack into a pile, that pile slides back to the
//    section's own slot, and the other stacks slide back into view.
//
// Only the expanded section ever clones all of its pages; every other section is
// a single lightweight stack preview, so the overview stays cheap.
function OutlineStage({
  outline, scale, w, h, pages, onRequestImport, onReorder
}: {
  outline: OutlineGroup[]; scale: number; w: number; h: number; pages: any[];
  onRequestImport?: (pos: InsertPos) => void;
  onReorder?: (fromId: string, beforeId: string | null) => void;
}) {
  const labelH = 18;
  const stageH = STAGE_PAD_TOP + h + STAGE_OFF * 2 + labelH + 6;

  // `expandedKey` is the section being shown expanded; `spread` drives the
  // fan-out (false = piled at its slot, true = fanned at the left). Expanding
  // flips spread true on the next frame; collapsing flips it false, then drops
  // the expansion once the animation settles.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [spread, setSpread] = useState(false);
  const [scrollX, setScrollX] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);

  // Manual pointer-drag reorder of content groups in the overview. `drag` holds
  // the live drag (the dragged group's key, the pointer delta, and the resolved
  // drop target); `dragStart`/`justDragged` disambiguate a drag from a tap so a
  // small movement still expands/jumps via the inner click.
  const [drag, setDrag] = useState<
    { key: string; dx: number; dropBeforeId: string | null; dropX: number } | null
  >(null);
  const dragStart = useRef<{ x: number; key: string; draggable: boolean } | null>(null);
  const justDragged = useRef(false);
  const DRAG_THRESH = 6;

  // Track the stage's own width (drives centering + the off-screen slide
  // targets). A ResizeObserver catches the initial size and every later layout
  // change — the welcome→editor morph, sidebar collapses, window resizes —
  // which a bare window "resize" listener would miss.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.clientWidth);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Drop a stale expansion if the section disappears under a re-pagination.
  useEffect(() => {
    if (expandedKey && !outline.some((g) => g.key === expandedKey)) { setExpandedKey(null); setSpread(false); }
  }, [outline, expandedKey]);

  // The overview reserves a leading page-sized slot (at x = 0) for the "+"
  // import button; the section slots follow it.
  const plusW = w;
  const slotW = (g: OutlineGroup) => (g.pages.length === 1 ? w : w + STAGE_OFF * 2);
  let acc = plusW + STAGE_GAP;
  const slotX = outline.map((g) => { const x = acc; acc += slotW(g) + STAGE_GAP; return x; });
  const overviewTotal = Math.max(plusW, acc - STAGE_GAP);
  const overviewOrigin = overviewTotal <= stageW ? (stageW - overviewTotal) / 2 : 8;
  const maxScroll = Math.max(0, overviewTotal - stageW + 16);
  const sx = Math.min(Math.max(scrollX, 0), maxScroll);

  const eIndex = expandedKey ? outline.findIndex((g) => g.key === expandedKey) : -1;
  const expandedGroup = eIndex >= 0 ? outline[eIndex] : null;
  const n = expandedGroup ? expandedGroup.pages.length : 0;

  // The fanned-out deck is centred in the stage rather than left-aligned, so a
  // section's pages sit under the middle of the top bar. It leads with a "+"
  // slot (to insert a page into this section) and is clamped left so it never
  // slides under the back button; long decks extend to the right.
  const deckW = n > 0 ? (n + 1) * w + n * DECK_GAP : 0;
  const deckStart = Math.max(DECK_LEFT, (stageW - deckW) / 2);

  // ── Drag-to-reorder helpers (overview only) ──
  const isDraggable = (g: OutlineGroup) => !expandedKey && CONTENT_TYPES.has(g.type) && !!onReorder;

  // Resolve the pointer x to a drop target: the content group to insert before
  // (null = end), plus the x for the insertion indicator.
  function computeDrop(clientX: number, dragKey: string): { beforeId: string | null; dropX: number } {
    const rect = stageRef.current?.getBoundingClientRect();
    const localX = clientX - (rect?.left ?? 0);
    const others = outline
      .map((g, i) => ({ g, i }))
      .filter((x) => CONTENT_TYPES.has(x.g.type) && x.g.key !== dragKey);
    let count = 0;
    for (const x of others) {
      const cx = overviewOrigin + slotX[x.i] - sx + slotW(x.g) / 2;
      if (cx < localX) count++;
    }
    if (count < others.length) {
      const ti = others[count].i;
      return { beforeId: others[count].g.key, dropX: overviewOrigin + slotX[ti] - sx - STAGE_GAP / 2 };
    }
    if (others.length) {
      const li = others[others.length - 1];
      return { beforeId: null, dropX: overviewOrigin + slotX[li.i] - sx + slotW(li.g) + STAGE_GAP / 2 };
    }
    return { beforeId: null, dropX: overviewOrigin };
  }

  function onGroupPointerDown(e: React.PointerEvent, g: OutlineGroup) {
    if (e.button !== 0) return;
    dragStart.current = { x: e.clientX, key: g.key, draggable: isDraggable(g) };
    if (isDraggable(g)) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer not capturable */ }
    }
  }
  function onGroupPointerMove(e: React.PointerEvent, g: OutlineGroup) {
    const s = dragStart.current;
    if (!s || s.key !== g.key || !s.draggable) return;
    const dx = e.clientX - s.x;
    if (!drag && Math.abs(dx) <= DRAG_THRESH) return;
    const { beforeId, dropX } = computeDrop(e.clientX, g.key);
    setDrag({ key: g.key, dx, dropBeforeId: beforeId, dropX });
  }
  function onGroupPointerUp(_e: React.PointerEvent, g: OutlineGroup) {
    const s = dragStart.current;
    dragStart.current = null;
    if (drag && drag.key === g.key) {
      // Swallow only the click the browser fires right after this gesture; clear
      // the flag on the next tick so a later, unrelated click isn't suppressed.
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 0);
      if (drag.dropBeforeId !== g.key) onReorder?.(g.key, drag.dropBeforeId);
      setDrag(null);
      return;
    }
    if (s) justDragged.current = false;
  }

  // Mount the deck piled at its slot, let it paint, then flip to the fanned-out
  // layout so the change animates. A short timeout (rather than rAF) keeps this
  // reliable even when the tab isn't actively painting.
  function expand(key: string) {
    setExpandedKey(key);
    window.setTimeout(() => setSpread(true), 30);
  }
  function collapse() {
    setSpread(false);
    window.setTimeout(() => setExpandedKey(null), 460);
  }

  return (
    <div
      ref={stageRef}
      className="outline-swap"
      onWheel={(e) => { if (!expandedKey && e.deltaY) setScrollX((s) => Math.min(Math.max(0, s + e.deltaY), maxScroll)); }}
      style={{ position: "relative", width: "100%", height: stageH, overflow: "hidden" }}
    >
      {/* Back button — fades in once a deck is expanded. */}
      {expandedGroup && (
        <button
          className="outline-collapse"
          title="Back to overview"
          onClick={collapse}
          style={{
            position: "absolute", left: BACK_LEFT, top: STAGE_PAD_TOP + (h - 28) / 2, zIndex: 30,
            opacity: spread ? 1 : 0, transform: spread ? "scale(1)" : "scale(0.8)",
            transition: `opacity 0.3s ease, transform 0.3s ${DECK_EASE}`,
            pointerEvents: spread ? "auto" : "none"
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Leftmost "+" — import a page at the start of the document. Slides off to
          the left while a deck is expanded (a deck-local "+" takes over). */}
      {onRequestImport && (
        <div
          style={{
            position: "absolute",
            left: !expandedKey ? overviewOrigin - sx : spread ? -plusW - 80 : overviewOrigin - sx,
            top: STAGE_PAD_TOP, width: plusW,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            opacity: expandedKey ? 0 : 1,
            pointerEvents: expandedKey ? "none" : "auto",
            transition: `left 0.46s ${DECK_EASE}, opacity 0.3s ease`
          }}
        >
          <PlusPage w={plusW} h={h} title="Import a page" onClick={() => onRequestImport({ kind: "start" })} />
          <OutlineLabel width={plusW}>Import</OutlineLabel>
        </div>
      )}

      {/* Insertion indicator while dragging a stack to a new slot. */}
      {drag && (
        <div
          style={{
            position: "absolute", left: drag.dropX - 1, top: STAGE_PAD_TOP - 2,
            width: 2, height: h + 4, borderRadius: 2,
            background: "var(--ui-accent-fill)", zIndex: 25, pointerEvents: "none"
          }}
        />
      )}

      {/* One lightweight stack preview per section. The expanded section's preview
          is hidden (its pages are drawn by the deck below); the others slide to
          their overview slots, or off-screen while a deck is open. */}
      {outline.map((g, i) => {
        const isExp = g.key === expandedKey;
        const isDragged = drag?.key === g.key;
        let left: number;
        if (!expandedKey) left = overviewOrigin + slotX[i] - sx;
        else if (isExp) left = overviewOrigin + slotX[i] - sx;          // hidden anyway
        else if (spread) left = i < eIndex ? -slotW(g) - 80 : stageW + 80; // slide off-screen
        else left = overviewOrigin + slotX[i] - sx;                     // back in view
        return (
          <div
            key={g.key}
            onPointerDown={(e) => onGroupPointerDown(e, g)}
            onPointerMove={(e) => onGroupPointerMove(e, g)}
            onPointerUp={(e) => onGroupPointerUp(e, g)}
            // Swallow the click the browser fires right after a drag gesture so it
            // doesn't expand/jump; a real tap (no drag) passes through.
            onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); justDragged.current = false; } }}
            style={{
              position: "absolute", left, top: STAGE_PAD_TOP, width: slotW(g),
              opacity: isExp ? 0 : isDragged ? 0.9 : 1,
              pointerEvents: isExp ? "none" : "auto",
              cursor: isDraggable(g) ? (isDragged ? "grabbing" : "grab") : "pointer",
              touchAction: "none",
              zIndex: isDragged ? 40 : 1,
              transform: isDragged ? `translateX(${drag!.dx}px)` : undefined,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              transition: isDragged ? "none" : `left 0.46s ${DECK_EASE}`
            }}
          >
            {g.pages.length === 1 ? (
              <MiniPage index={g.first} scale={scale} w={w} h={h} dep={pages} onClick={() => jumpToPage(g.first)} title={g.label} />
            ) : (
              <StackedPages
                firstIndex={g.first} count={g.pages.length} scale={scale} w={w} h={h} dep={pages}
                onClick={() => expand(g.key)} title={`${g.label} — ${g.pages.length} pages`}
              />
            )}
            <OutlineLabel width={w}>{g.label}</OutlineLabel>
          </div>
        );
      })}

      {/* Deck-local "+" — insert a page before this section. Sits at the left of
          the fanned deck (before page 1) and fades in with the spread. */}
      {expandedGroup && onRequestImport && (
        <div
          style={{
            position: "absolute", left: spread ? deckStart : overviewOrigin + slotX[eIndex] - sx,
            top: STAGE_PAD_TOP, width: w,
            opacity: spread ? 1 : 0, pointerEvents: spread ? "auto" : "none",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            zIndex: 11,
            transition: `left 0.46s ${DECK_EASE}, opacity 0.3s ease`
          }}
        >
          <PlusPage w={w} h={h} title={`Insert a page before ${expandedGroup.label}`} onClick={() => onRequestImport({ kind: "before", id: expandedGroup.key })} />
          <span style={{ fontFamily: "var(--ui-font)", fontSize: 11, color: "var(--ui-2nd)", opacity: spread ? 1 : 0, transition: "opacity 0.25s ease 0.12s" }}>Insert</span>
        </div>
      )}

      {/* The expanded section's pages: piled at its slot, fanning to the left
          (shifted one slot right to clear the deck-local "+"). */}
      {expandedGroup && expandedGroup.pages.map((pi, j) => {
        const pileLeft = overviewOrigin + slotX[eIndex] - sx + Math.min(j, 3) * STAGE_OFF;
        const left = spread ? deckStart + (j + 1) * (w + DECK_GAP) : pileLeft;
        const top = spread ? STAGE_PAD_TOP : STAGE_PAD_TOP + Math.min(j, 3) * STAGE_OFF;
        // Stagger the fan-out left → right (and the restack right → left) so the
        // pages visibly unspool one after another.
        const delay = spread ? j * 0.02 : (n - 1 - j) * 0.012;
        return (
          <div
            key={pi}
            style={{
              position: "absolute", left, top, zIndex: spread ? 10 : n - j,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              transition: `left 0.46s ${DECK_EASE} ${delay}s, top 0.46s ${DECK_EASE} ${delay}s`
            }}
          >
            <MiniPage index={pi} scale={scale} w={w} h={h} dep={pages} onClick={() => jumpToPage(pi)} title={`Go to page ${pi + 1}`} />
            <span
              style={{
                fontFamily: "var(--ui-font)", fontSize: 11, color: "var(--ui-2nd)",
                opacity: spread ? 1 : 0,
                transition: `opacity 0.25s ease ${spread ? "0.12s" : "0s"}`
              }}
            >
              p.&nbsp;{pi + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// The document outline shown in the top bar.
//  • collapsed bar → just the section names, as clickable jump-to tabs.
//  • expanded bar  → the live OutlineStage (stacks that fan out on click).
function DocOutline({
  outline, layout, collapsed, pages, onRequestImport, onReorder
}: {
  outline: OutlineGroup[]; layout: Layout; collapsed: boolean; pages: any[];
  onRequestImport?: (pos: InsertPos) => void;
  onReorder?: (fromId: string, beforeId: string | null) => void;
}) {
  const pageH = 74;
  const scale = pageH / layout.pageHeight;
  const w = Math.round(layout.pageWidth * scale);
  const h = pageH;

  if (collapsed) {
    return (
      <ScrollRow key="tabs">
        {outline.map((g) => (
          <button key={g.key} className="outline-tab" title={g.label} onClick={() => jumpToPage(g.first)}>
            {g.label}
          </button>
        ))}
      </ScrollRow>
    );
  }

  return <OutlineStage outline={outline} scale={scale} w={w} h={h} pages={pages} onRequestImport={onRequestImport} onReorder={onReorder} />;
}

function IconButton({ onClick, disabled, title, children }: any) {
  return (
    <button
      className="ui-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: disabled ? "var(--ui-disabled)" : "var(--ui-text)",
        cursor: disabled ? "default" : "pointer"
      }}
    >
      {children}
    </button>
  );
}

// A group of controls on the same translucent strip as a sidebar, so the bar
// reads as one continuous panel with the sidebars below it.
function ControlGroup({ children }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 2 }}>
      {children}
    </div>
  );
}

export function TopBar({
  onBack, onUndo, onRedo, onExport, onSave, canUndo, canRedo, visible, collapsed,
  pages, outline, layout, dark, onToggleTheme, onRequestImport, onReorder
}: any) {
  // Side regions stack vertically when the bar is expanded and fall back to a
  // compact row when it collapses to the short control strip.
  const sideDir = collapsed ? "row" : "column";
  return (
    <div
      className="ui-panel"
      style={{
        position: "relative",
        flex: "0 0 auto",
        height: "100%",
        borderBottom: "1px solid var(--ui-hairline)",
        display: "flex",
        alignItems: "stretch",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        zIndex: 5,
        overflow: "hidden"
      }}
    >
      {/* LEFT — aligned to the left sidebar: big centered logo with undo/redo
          beneath it (a compact row while collapsed). */}
      <div
        style={{
          width: 280, flex: "0 0 auto", boxSizing: "border-box",
          display: "flex", flexDirection: sideDir,
          alignItems: "center", justifyContent: "center",
          gap: collapsed ? 12 : 12, padding: "0 16px"
        }}
      >
        <Logo onClick={onBack} large={!collapsed} />
        <ControlGroup>
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
        </ControlGroup>
      </div>

      {/* CENTER — the live document outline, spanning the full width of the
          document field between the two sidebars. */}
      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <DocOutline outline={outline ?? []} layout={layout} collapsed={!!collapsed} pages={pages} onRequestImport={onRequestImport} onReorder={onReorder} />
      </div>

      {/* RIGHT — aligned to the right sidebar: dark-mode toggle above Export. */}
      <div
        style={{
          width: 260, flex: "0 0 auto", boxSizing: "border-box",
          display: "flex", flexDirection: sideDir,
          alignItems: "center", justifyContent: "center",
          gap: 10, padding: "0 16px"
        }}
      >
        <ThemeToggle dark={!!dark} onToggle={onToggleTheme} />
        <ControlGroup>
          <button className="ui-btn" onClick={onSave} title="Download this project as a .blox file">
            Save
          </button>
          <button className="ui-btn primary" onClick={onExport}>Export LaTeX</button>
        </ControlGroup>
      </div>
    </div>
  );
}
