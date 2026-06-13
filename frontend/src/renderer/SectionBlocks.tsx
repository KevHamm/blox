import { HeadingInput, TrashButton, ChevronButton, headingStyle } from "./shared";

/* -----------------------------
   SUBSECTION (NO DND)
----------------------------- */
export function Subsection({
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
export function Subsubsection({
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
export function Section({ node, showHeader = true, ...rest }: any) {
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
