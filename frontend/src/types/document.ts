export type DocumentNode =
  | {
      id: string;
      type: "document";
      children: DocumentNode[];
    }
  | {
      id: string;
      type: "section";
      title: string;
      children: DocumentNode[];
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
    };