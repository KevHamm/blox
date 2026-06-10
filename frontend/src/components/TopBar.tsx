import { useLayoutEffect, useRef } from "react";

// Tall enough to hold the mini page preview — roughly half a sidebar's width.
export const TOPBAR_HEIGHT = 140;
// Collapsed height: just tall enough for the logo / undo-redo / export controls.
// Hiding the bar shrinks it to this (only the document preview disappears).
export const TOPBAR_COLLAPSED_HEIGHT = 56;

type Layout = {
  pageWidth: number;
  pageHeight: number;
};

// A live, scaled-down preview of the real document pages. Each page is a clone
// of the rendered `.blox-page`, so it shows the actual content; clicking a page
// scrolls the document to it.
function MiniPreview({ pages, layout }: { pages: any[]; layout: Layout }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const miniH = TOPBAR_HEIGHT - 48;
  const scale = miniH / layout.pageHeight;
  const slotW = layout.pageWidth * scale;
  const slotH = layout.pageHeight * scale;

  // Re-clone the real pages whenever the document (and therefore pagination)
  // changes. Clones are stripped of editing hooks so they can't interfere with
  // the editor's measurement / caret logic.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const real = document.querySelectorAll<HTMLElement>(".doc-area .blox-page");
    const slots = container.querySelectorAll<HTMLElement>(".mini-slot-inner");
    slots.forEach((slot, i) => {
      slot.innerHTML = "";
      const page = real[i];
      if (!page) return;
      const clone = page.cloneNode(true) as HTMLElement;
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
    });
  }, [pages, scale]);

  const jump = (i: number) => {
    const docArea = document.querySelector<HTMLElement>(".doc-area");
    if (!docArea) return;
    const page = docArea.querySelectorAll<HTMLElement>(".blox-page")[i];
    if (!page) return;
    const top =
      docArea.scrollTop + (page.getBoundingClientRect().top - docArea.getBoundingClientRect().top) - 24;
    docArea.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <div ref={containerRef} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {pages.map((_, i) => (
        <div
          key={i}
          onClick={() => jump(i)}
          title={`Go to page ${i + 1}`}
          style={{
            width: slotW,
            height: slotH,
            flex: "0 0 auto",
            borderRadius: 3,
            overflow: "hidden",
            cursor: "pointer",
            background: "#fff",
            boxShadow: "0 1px 5px rgba(20,20,50,0.22)",
            transition: "box-shadow 0.15s ease, transform 0.1s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,113,227,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 5px rgba(20,20,50,0.22)"; }}
        >
          <div className="mini-slot-inner" style={{ width: slotW, height: slotH }} />
        </div>
      ))}
    </div>
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
  pages, layout
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
      {/* Centered, live mini preview of the whole document — hidden when the bar
          is collapsed (only the controls stay visible). */}
      <div
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          zIndex: 1,
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? "none" : "auto",
          transition: "opacity 0.25s ease"
        }}
      >
        {!collapsed && <MiniPreview pages={pages} layout={layout} />}
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
