import { downloadBlob, safeFilename } from "./persistence";
import type { DesignPage } from "../types/design";

// True when any image element carries a real (data-URL) source — those exports
// go through /export-cover-zip so the decoded image ships next to the .tex.
function hasImages(design: DesignPage): boolean {
  return (design.elements ?? []).some(
    (e) => e.kind === "image" && typeof e.src === "string" && e.src.startsWith("data:")
  );
}

// Post the design page to the backend, which renders it as a one-page, compilable
// LaTeX titlepage (a tikz overlay positions every element absolutely).
export async function exportCover(design: DesignPage, title: string) {
  const zip = hasImages(design);
  const endpoint = zip ? "export-cover-zip" : "export-cover";

  const res = await fetch(`http://localhost:8000/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ design, title })
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);

  const blob = await res.blob();
  downloadBlob(blob, `${safeFilename(title)}.${zip ? "zip" : "tex"}`);
}
