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

// The expanded view of a multi-page group. It mounts in the same "pile" shape as
// the StackedPages it replaces, then fans the pages out left → right on the next
// frame. Clicking the back button restacks them (reversing the animation) and,
// once that settles, calls onCollapse to return to the overview.
function ExpandedDeck({
  group, scale, w, h, pages, onCollapse
}: { group: OutlineGroup; scale: number; w: number; h: number; pages: any[]; onCollapse: () => void }) {
  const gap = 14;
  const off = 5;                    // per-card offset while piled
  const [spread, setSpread] = useState(false);

  // Fan out on the frame after mount (so the entrance animates from the pile).
  useEffect(() => {
    const id = requestAnimationFrame(() => setSpread(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function back() {
    setSpread(false);               // restack…
    window.setTimeout(onCollapse, 430); // …then drop back to the overview
  }

  const n = group.pages.length;
  const pileSpan = Math.min(n - 1, 3) * off;     // how far the pile fans
  const spreadW = n * w + (n - 1) * gap;
  const labelH = 20;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        className="outline-collapse"
        title="Back to overview"
        onClick={back}
        style={{ flex: "0 0 auto" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div
        style={{
          position: "relative",
          width: spread ? spreadW : w + pileSpan,
          height: h + labelH,
          flex: "0 0 auto",
          transition: `width 0.43s ${DECK_EASE}`
        }}
      >
        {group.pages.map((pi, i) => {
          const pile = Math.min(i, 3) * off;
          return (
            <div
              key={pi}
              style={{
                position: "absolute",
                left: spread ? i * (w + gap) : pile,
                top: spread ? 0 : pile,
                zIndex: spread ? 1 : n - i,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transition: `left 0.43s ${DECK_EASE}, top 0.43s ${DECK_EASE}`
              }}
            >
              <MiniPage
                index={pi} scale={scale} w={w} h={h} dep={pages}
                onClick={() => jumpToPage(pi)} title={`Go to page ${pi + 1}`}
              />
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

  const expandedGroup = expanded ? outline.find((g) => g.key === expanded) : null;

  if (expandedGroup) {
    return (
      <ScrollRow key={`deck:${expandedGroup.key}`}>
        <ExpandedDeck
          group={expandedGroup} scale={scale} w={w} h={h} pages={pages}
          onCollapse={() => setExpanded(null)}
        />
      </ScrollRow>
    );
  }

  return (
    <ScrollRow key="overview">
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
// reads "BaCK", and clicking it returns to the template chooser. `large` blows
// it up to roughly half the sidebar width for the expanded top bar.
function Logo({ onBack, large }: any) {
  return (
    <div className={`blox-logo${large ? " large" : ""}`} onClick={onBack} title="Back to templates">
      <span>B</span>
      <FlipLetter front="L" back="a" delay="0s" backBlue />
      <FlipLetter front="o" back="C" delay="0.05s" frontBlue />
      <FlipLetter front="X" back="K" delay="0.1s" />
    </div>
  );
}

// An iOS-style switch that flips the editor chrome between light and dark.
function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      <span className="theme-track" data-on={dark ? "true" : "false"}>
        <span className="theme-thumb">
          {dark ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          )}
        </span>
      </span>
      <span className="theme-label">{dark ? "Dark" : "Light"}</span>
    </button>
  );
}

export function TopBar({
  onBack, onUndo, onRedo, onExport, canUndo, canRedo, visible, collapsed,
  pages, outline, layout, dark, onToggleTheme
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
        <Logo onBack={onBack} large={!collapsed} />
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
        <DocOutline outline={outline ?? []} layout={layout} collapsed={!!collapsed} pages={pages} />
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
        <button className="ui-btn primary" onClick={onExport}>Export LaTeX</button>
      </div>
    </div>
  );
}
