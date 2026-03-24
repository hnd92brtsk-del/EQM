import type { ReactNode } from "react";

export type HelpAnchor = {
  id: string;
  title: string;
};

export type HelpSearchEntry = {
  id: string;
  title: string;
  body: string;
  keywords: string[];
  anchorId?: string;
  sectionId?: string;
};

export type HelpSection = {
  id: string;
  title: string;
  content: ReactNode;
  searchEntries: HelpSearchEntry[];
  anchors?: HelpAnchor[];
};
