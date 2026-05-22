import React from "react";

interface ProjectDocumentSectionProps {
  id: string;
  number?: string;
  title: string;
  children: React.ReactNode;
  pageBreak?: boolean;
}

interface ProjectDocumentClauseProps {
  number?: string;
  title: string;
  children: React.ReactNode;
}

export function ProjectDocumentSection({
  id,
  number,
  title,
  children,
  pageBreak = false,
}: ProjectDocumentSectionProps) {
  return (
    <section id={id} className={`document-section${pageBreak ? " document-section--page-break" : ""}`}>
      <h2>
        {number ? <span>{number}</span> : null}
        <span>{title}</span>
      </h2>
      <div>{children}</div>
    </section>
  );
}

export function ProjectDocumentClause({
  number,
  title,
  children,
}: ProjectDocumentClauseProps) {
  return (
    <article className="document-clause">
      <h3>
        {number ? <span>{number}</span> : null}
        <span>{title}</span>
      </h3>
      <div>{children}</div>
    </article>
  );
}

export default ProjectDocumentSection;
