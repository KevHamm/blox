import { DocumentNode } from "../types/document";

export const sampleDocument: DocumentNode = {
  type: "document",
  children: [
    {
      type: "section",
      title: "Introduction",
      children: [
        {
          type: "paragraph",
          text: "This is the introduction paragraph."
        }
      ]
    }
  ]
};