import React from "react";

interface DocumentNoticeProps {
  title: string;
  children: React.ReactNode;
  variant?: "note" | "warning";
}

export function DocumentNotice({ title, children, variant = "note" }: DocumentNoticeProps) {
  return (
    <aside className={variant === "warning" ? "document-warning" : "document-note"}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}

export default DocumentNotice;
