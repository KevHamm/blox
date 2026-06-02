def strip_prefix(title: str):
    import re
    return re.sub(r"^\d+(\.\d+)*\s*", "", title)


def document_to_latex(doc):
    latex = []

    for i, section in enumerate(doc["children"], start=1):
        title = strip_prefix(section.get("title", "Section"))

        latex.append(f"\\section{{{i} {title}}}")

        for j, child in enumerate(section.get("children", []), start=1):

            if child["type"] == "subsection":
                sub_title = strip_prefix(child.get("title", "Subsection"))
                latex.append(f"\\subsection{{{i}.{j} {sub_title}}}")

            if child["type"] == "paragraph":
                latex.append(child.get("text", "") + "\n")

    return "\n\n".join(latex)