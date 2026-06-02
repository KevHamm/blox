// src/utils/exportLatex.ts

export function exportLatex(doc: any) {
  let tex = `
\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{booktabs}

\\begin{document}
`;

  for (const section of doc.children) {
    tex += `\\section{${section.title}}\n`;

    for (const child of section.children) {
      if (child.type === "paragraph") {
        tex += `${child.text}\n\n`;
      }

      if (child.type === "subsection") {
        tex += `\\subsection{${child.title}}\n`;

        for (const p of child.children) {
          tex += `${p.text}\n\n`;
        }
      }

      if (child.type === "table") {
        tex += `% table export here\n`;
      }

      if (child.type === "figure") {
        tex += `
\\begin{figure}[h]
\\centering
% image export here
\\caption{${child.caption || ""}}
\\end{figure}
`;
      }
    }
  }

  tex += "\\end{document}";

  const blob = new Blob([tex], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "document.tex";
  a.click();

  URL.revokeObjectURL(url);
}