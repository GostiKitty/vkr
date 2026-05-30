import type { Selection } from "../../build/build.store";

export type IssueSeverity = "error" | "warning";

export interface BuildIssue {
  id: string;
  message: string;
  severity: IssueSeverity;
  target?: Selection;
  fix?: IssueFix;
}

export interface IssueFix {
  label: string;
  action: "auto-close-room" | "merge-colinear-walls" | "remove-tiny-segments";
}
