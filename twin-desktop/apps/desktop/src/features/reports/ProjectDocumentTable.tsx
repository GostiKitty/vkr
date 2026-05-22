import React from "react";

export interface ProjectDocumentTableColumn {
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface ProjectDocumentTableRow {
  key: string;
  cells: React.ReactNode[];
}

interface ProjectDocumentTableProps {
  title: string;
  columns: ProjectDocumentTableColumn[];
  rows: ProjectDocumentTableRow[];
  note?: string;
}

export function ProjectDocumentTable({
  title,
  columns,
  rows,
  note,
}: ProjectDocumentTableProps) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="document-table">
      <div className="document-table__caption">
        <strong>{title}</strong>
        {note ? <span>{note}</span> : null}
      </div>
      <div className="document-table__wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={column.align ? `is-${column.align}` : undefined}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td
                    key={`${row.key}-${index}`}
                    className={columns[index]?.align ? `is-${columns[index].align}` : undefined}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectDocumentTable;
