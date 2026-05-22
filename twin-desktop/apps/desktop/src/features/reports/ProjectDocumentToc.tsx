import React from "react";

interface ProjectDocumentTocProps {
  items: Array<{ id: string; label: string }>;
}

export function ProjectDocumentToc({ items }: ProjectDocumentTocProps) {
  return (
    <nav className="document-toc" aria-label="Содержание">
      <strong>Содержание</strong>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default ProjectDocumentToc;
