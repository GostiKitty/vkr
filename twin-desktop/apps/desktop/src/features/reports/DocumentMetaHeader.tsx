interface DocumentMetaHeaderProps {
  status: string;
  documentType: string;
  version: string;
  generatedAtLabel: string;
  projectName: string;
  calculationName: string;
}

export function DocumentMetaHeader({
  status,
  documentType,
  version,
  generatedAtLabel,
  projectName,
  calculationName,
}: DocumentMetaHeaderProps) {
  const items = [
    { label: "Статус документа", value: status },
    { label: "Тип документа", value: documentType },
    { label: "Версия", value: version },
    { label: "Дата формирования", value: generatedAtLabel },
    { label: "Объект", value: projectName },
    { label: "Расчет", value: calculationName },
  ];

  return (
    <div className="document-header">
      <div className="document-status">Сформировано автоматически</div>
      <h1 className="document-title">Паспорт расчетной модели</h1>
      <div className="document-meta">
        {items.map((item) => (
          <div key={item.label} className="document-meta__item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocumentMetaHeader;
