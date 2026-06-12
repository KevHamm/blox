import { downloadBlob, safeFilename } from "./persistence";

// Editor state the exporter needs but that doesn't live in the doc tree.
export type ExportMeta = {
  cls: string;        // template class (article / report / letter / beamer / book / wip)
  title: string;
  columns: number;
  fontSizePx: number;
};

// True when any figure carries a real (data-URL) image — those exports go
// through /export-zip so the decoded image files ship next to the .tex.
function hasFigureImages(node: any): boolean {
  if (!node) return false;
  if (
    node.type === "figure" &&
    (node.images ?? []).some((im: any) => typeof im?.src === "string" && im.src.startsWith("data:"))
  ) {
    return true;
  }
  return (node.children ?? []).some(hasFigureImages);
}

export async function exportLatex(doc: any, meta: ExportMeta) {
  const zip = hasFigureImages(doc);
  const endpoint = zip ? "export-zip" : "export-latex";

  const res = await fetch(`http://localhost:8000/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: doc, meta })
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);

  const blob = await res.blob();
  downloadBlob(blob, `${safeFilename(meta.title)}.${zip ? "zip" : "tex"}`);
}
