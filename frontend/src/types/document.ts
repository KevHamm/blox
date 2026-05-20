export type DocumentNode =
  | {
      type: "document";
      children: DocumentNode[];
    }
  | {
      type: "section";
      title: string;
      children: DocumentNode[];
    }
  | {
      type: "paragraph";
      text: string;
    };