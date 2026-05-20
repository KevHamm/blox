import type { DocumentNode } from "../types/document";

export const sampleDocument: DocumentNode = {
  id: "root",
  type: "document",
  children: [
    {
      id: "sec-1",
      type: "section",
      title: "Intro",
      children: [
        {
          id: "p1",
          type: "paragraph",
          text: "Hello world"
        }
      ]
    }
  ]
};