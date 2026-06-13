import { TrashButton } from "./shared";
import { formatBibEntry } from "../utils/docTree";

/* -----------------------------
   SPECIAL PAGE (cover / TOC / bibliography) — header only for now.
----------------------------- */
const PAGE_TITLES: Record<string, string> = {
  coverpage: "Cover Page",
  toc: "Table of Contents",
  bibliography: "Bibliography"
};

export function PageBlock({ node, deleteNodeById, bibEntries, citeNumbers, onEditBibEntry, onDeleteBibEntry }: any) {
  const isBib = node.type === "bibliography";
  const entries: any[] = isBib ? bibEntries ?? [] : [];
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

      {isBib && (
        <div style={{ marginTop: 18, fontSize: 14, color: "var(--text)", fontFamily: "var(--sans)" }}>
          {entries.length === 0 ? (
            <p style={{ color: "#9a9aa2", fontStyle: "italic", margin: 0 }}>
              No references yet. Select text in a paragraph and use the Quote button to add one.
            </p>
          ) : (
            entries.map((e: any) => (
              <div
                key={e.id}
                className="bib-entry"
                style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10, lineHeight: 1.45 }}
              >
                <span style={{ flex: "0 0 auto", color: "var(--text)" }}>[{citeNumbers?.[e.id] ?? "?"}]</span>
                <span
                  className="bib-entry-text"
                  title="Edit this reference"
                  onClick={() => onEditBibEntry?.(e.id)}
                  style={{ flex: 1, cursor: "pointer" }}
                >
                  {formatBibEntry(e.raw)}
                </span>
                <TrashButton onClick={() => onDeleteBibEntry?.(e.id)} label="Delete reference" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
