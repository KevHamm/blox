export async function exportLatex(doc: any) {
  const res = await fetch("http://localhost:8000/export-latex", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: doc })
  });

  const latex = await res.text();

  const blob = new Blob([latex], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "document.tex";
  a.click();

  URL.revokeObjectURL(url);
}