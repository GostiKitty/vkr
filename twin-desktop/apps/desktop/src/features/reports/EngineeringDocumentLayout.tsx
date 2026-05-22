import React from "react";

interface EngineeringDocumentLayoutProps {
  actions?: React.ReactNode;
  children: React.ReactNode;
  sheetRef?: React.Ref<HTMLDivElement>;
}

export function EngineeringDocumentLayout({ actions, children, sheetRef }: EngineeringDocumentLayoutProps) {
  return (
    <div className="document-page">
      {actions ? <div className="document-actions document-print-hidden">{actions}</div> : null}
      <div ref={sheetRef} className="document-sheet">
        {children}
      </div>
    </div>
  );
}

export default EngineeringDocumentLayout;
