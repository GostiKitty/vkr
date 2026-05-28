interface ProjectDocumentStampProps {
  documentCode: string;
  title: string;
  objectName: string;
  stage: string;
  customer: string;
  developedBy: string;
  checkedBy: string;
  normControl: string;
  chiefEngineer: string;
}

export function ProjectDocumentStamp({
  documentCode,
  title,
  objectName,
  stage,
  customer,
  developedBy,
  checkedBy,
  normControl,
  chiefEngineer,
}: ProjectDocumentStampProps) {
  return (
    <div className="document-stamp" aria-label="Основная надпись документа">
      <div className="document-stamp__row">
        <div className="document-stamp__cell document-stamp__cell--wide">
          <span>Обозначение документа</span>
          <strong>{documentCode}</strong>
        </div>
        <div className="document-stamp__cell">
          <span>Стадия</span>
          <strong>{stage}</strong>
        </div>
        <div className="document-stamp__cell">
          <span>Лист</span>
          <strong className="document-stamp__page-number">1</strong>
        </div>
      </div>

      <div className="document-stamp__row">
        <div className="document-stamp__cell document-stamp__cell--wide">
          <span>Наименование</span>
          <strong>{title}</strong>
        </div>
        <div className="document-stamp__cell document-stamp__cell--wide">
          <span>Объект</span>
          <strong>{objectName}</strong>
        </div>
      </div>

      <div className="document-stamp__row">
        <div className="document-stamp__cell document-stamp__cell--wide">
          <span>Заказчик</span>
          <strong>{customer}</strong>
        </div>
        <div className="document-stamp__cell">
          <span>Разработал</span>
          <strong>{developedBy}</strong>
        </div>
        <div className="document-stamp__cell">
          <span>Проверил</span>
          <strong>{checkedBy}</strong>
        </div>
      </div>

      <div className="document-stamp__row">
        <div className="document-stamp__cell document-stamp__cell--wide">
          <span>Нормоконтроль</span>
          <strong>{normControl}</strong>
        </div>
        <div className="document-stamp__cell document-stamp__cell--wide">
          <span>ГИП</span>
          <strong>{chiefEngineer}</strong>
        </div>
      </div>
    </div>
  );
}

export default ProjectDocumentStamp;
