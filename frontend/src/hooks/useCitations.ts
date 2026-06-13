import { useMemo, useState } from "react";
import {
  bibEntryNumbers,
  getBib,
  newBibEntry,
  ensureBibliography,
  addBibEntry,
  addCitationAtOffset,
  updateBibEntry,
  removeBibEntry,
  setBibStyleTree
} from "../utils/docTree";
import { newEntryTemplate } from "../components/citations";

type SetDoc = (updater: (prev: any) => any) => void;

// The BibTeX editor modal: "new" captures where a fresh citation will be
// inserted; "edit" targets an existing entry. null = closed.
type CiteEditorState =
  | { mode: "new"; paragraphId: string; offset: number; raw: string }
  | { mode: "edit"; entryId: string; raw: string }
  | null;

/**
 * Citations + bibliography: the entry-number map for in-text [n] markers, the
 * BibTeX editor modal state, and the create / edit / delete / restyle actions.
 */
export function useCitations(doc: any, setDoc: SetDoc) {
  // entryId → its 1-based reference number (position in the bibliography).
  const bibNumbers = useMemo(() => bibEntryNumbers(doc), [doc]);
  const [citeEditor, setCiteEditor] = useState<CiteEditorState>(null);

  // Selection-toolbar "Quote" → open the editor for a new citation here.
  function openQuoteForSelection(paragraphId: string, offset: number) {
    setCiteEditor({ mode: "new", paragraphId, offset, raw: newEntryTemplate });
  }
  // Clicking an in-text [n] opens its entry to edit.
  function openCiteEditorForEntry(entryId: string) {
    const entry = getBib(doc).entries.find((e: any) => e.id === entryId);
    if (entry) setCiteEditor({ mode: "edit", entryId, raw: entry.raw });
  }
  // Commit the editor: a new entry creates the bibliography (if absent), the
  // entry, and the inline citation in one history step; an edit just updates it.
  function saveCiteEditor(raw: string) {
    if (!citeEditor) return;
    if (citeEditor.mode === "new") {
      const { paragraphId, offset } = citeEditor;
      setDoc((prev) => {
        const entry = newBibEntry(raw);
        let next = ensureBibliography(prev);
        next = addBibEntry(next, entry);
        next = addCitationAtOffset(next, paragraphId, offset, crypto.randomUUID(), entry.id);
        return next;
      });
    } else {
      const { entryId } = citeEditor;
      setDoc((prev) => updateBibEntry(prev, entryId, raw));
    }
    setCiteEditor(null);
  }
  function deleteCiteEntry(entryId: string) {
    setDoc((prev) => removeBibEntry(prev, entryId));
    setCiteEditor(null);
  }
  function setBibStyle(style: string) {
    setDoc((prev) => setBibStyleTree(prev, style));
  }

  return {
    bibNumbers,
    citeEditor,
    setCiteEditor,
    openQuoteForSelection,
    openCiteEditorForEntry,
    saveCiteEditor,
    deleteCiteEntry,
    setBibStyle
  };
}
