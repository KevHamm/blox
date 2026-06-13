import { HeadingInput, TrashButton, ChevronButton, headingStyle } from "./shared";

/* -----------------------------
   FRAME (beamer slide) — one frame == one page. The page padding already
   supplies the slide's content margins; the frame fills that area and never
   spills onto the next slide.
----------------------------- */
const BEAMER_BLUE = "#3b4ba0";

export function FrameBlock({
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
