import { useLayoutEffect, useRef, useState, useEffect } from "react";

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
        borderRadius: 8, background: "var(--ui-blue)", color: "#fff", fontSize: 10, fontWeight: 700,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--ui-font)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)"
      }}>{count}</span>
    </div>
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
// not; the vertical mouse wheel scrolls it left/right.
function ScrollRow({ children }: { children: any }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onWheel={(e) => { if (ref.current && e.deltaY) ref.current.scrollLeft += e.deltaY; }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        justifyContent: "safe center", overflowX: "auto", overflowY: "hidden",
        width: "min(1080px, calc(100vw - 460px))", padding: "2px 0"
      }}
    >
      {children}
    </div>
  );
}

type OutlineGroup = { key: string; type: string; label: string; pages: number[]; first: number };

// The document outline shown in the top bar: a row of per-section previews.
//  • collapsed bar  → just the labels, as clickable tabs.
//  • single-page    → one preview; click jumps to it.
//  • multi-page     → a stack; click spreads the pages out (first page flush
//                     left, a collapse button to its left); click a page to jump.
function DocOutline({
  outline, layout, collapsed, pages
}: { outline: OutlineGroup[]; layout: Layout; collapsed: boolean; pages: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { if (collapsed) setExpanded(null); }, [collapsed]);
  useEffect(() => {
    if (expanded && !outline.some((g) => g.key === expanded)) setExpanded(null);
  }, [outline, expanded]);

  const pageH = 84;
  const scale = pageH / layout.pageHeight;
  const w = Math.round(layout.pageWidth * scale);
  const h = pageH;

  if (collapsed) {
    return (
      <ScrollRow>
        {outline.map((g) => (
          <button key={g.key} className="outline-tab" title={g.label} onClick={() => jumpToPage(g.first)}>
            {g.label}
          </button>
        ))}
      </ScrollRow>
    );
  }

  const expandedGroup = expanded ? outline.find((g) => g.key === expanded) : null;

  if (expandedGroup) {
    return (
      <ScrollRow>
        <button
          className="outline-collapse"
          title="Back to overview"
          onClick={() => setExpanded(null)}
          style={{ alignSelf: "center" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {expandedGroup.pages.map((pi) => (
          <div key={pi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <MiniPage index={pi} scale={scale} w={w} h={h} dep={pages} onClick={() => jumpToPage(pi)} title={`Go to page ${pi + 1}`} />
            <OutlineLabel width={w}>p.&nbsp;{pi + 1}</OutlineLabel>
          </div>
        ))}
      </ScrollRow>
    );
  }

  return (
    <ScrollRow>
      {outline.map((g) => (
        <div key={g.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {g.pages.length === 1 ? (
            <MiniPage index={g.first} scale={scale} w={w} h={h} dep={pages} onClick={() => jumpToPage(g.first)} title={g.label} />
          ) : (
            <StackedPages
              firstIndex={g.first} count={g.pages.length} scale={scale} w={w} h={h} dep={pages}
              onClick={() => setExpanded(g.key)} title={`${g.label} — ${g.pages.length} pages`}
            />
          )}
          <OutlineLabel width={w}>{g.label}</OutlineLabel>
        </div>
      ))}
    </ScrollRow>
  );
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
        color: disabled ? "#bdbdc4" : "var(--ui-text)",
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

// One flipping letter of the logo: shows `front` normally, `back` on hover.
function FlipLetter({ front, back, delay, frontBlue, backBlue }: any) {
  const blue = { color: "var(--ui-blue)" };
  return (
    <span className="logo-flip" style={{ transitionDelay: delay }}>
      <span className="logo-face logo-front" style={frontBlue ? blue : undefined}>{front}</span>
      <span className="logo-face logo-back" style={backBlue ? blue : undefined}>{back}</span>
    </span>
  );
}

// The logo doubles as the back button: hovering rotates "LoX" → "aCK" so it
// reads "BaCK", and clicking it returns to the template chooser.
function Logo({ onBack }: any) {
  return (
    <div className="blox-logo" onClick={onBack} title="Back to templates">
      <span>B</span>
      <FlipLetter front="L" back="a" delay="0s" backBlue />
      <FlipLetter front="o" back="C" delay="0.05s" frontBlue />
      <FlipLetter front="X" back="K" delay="0.1s" />
    </div>
  );
}

export function TopBar({
  onBack, onUndo, onRedo, onExport, canUndo, canRedo, visible, collapsed,
  pages, outline, layout
}: any) {
  return (
    <div
      className="ui-panel"
      style={{
        position: "relative",
        flex: "0 0 auto",
        height: "100%",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        zIndex: 5,
        overflow: "hidden"
      }}
    >
      {/* Centered, live document outline. Expanded: per-section page previews /
          stacks. Collapsed: just the section names, as jump-to tabs. */}
      <div
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          zIndex: 1
        }}
      >
        <DocOutline outline={outline ?? []} layout={layout} collapsed={!!collapsed} pages={pages} />
      </div>

      {/* Left: logo (doubles as back), undo/redo. */}
      <ControlGroup>
        <Logo onBack={onBack} />

        <span style={{ width: 1, height: 24, background: "rgba(0,0,0,0.1)", margin: "0 6px 0 2px" }} />

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

      {/* Right: export. */}
      <ControlGroup>
        <button className="ui-btn primary" onClick={onExport}>Export LaTeX</button>
      </ControlGroup>
    </div>
  );
}
