import React from "react";

interface DocumentSectionProps {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
  pageBreak?: boolean;
}

interface DocumentClauseProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

export function DocumentSection({ id, number, title, children, pageBreak = false }: DocumentSectionProps) {
  return (
    <section id={id} className={`document-section${pageBreak ? " document-section--page-break" : ""}`}>
      <h2>
        <span>{number}</span>
        <span>{title}</span>
      </h2>
      <div>{children}</div>
    </section>
  );
}

export function DocumentClause({ number, title, children }: DocumentClauseProps) {
  return (
    <article className="document-clause">
      <h3>
        <span>{number}</span>
        <span>{title}</span>
      </h3>
      <div>{children}</div>
    </article>
  );
}

export default DocumentSection;
