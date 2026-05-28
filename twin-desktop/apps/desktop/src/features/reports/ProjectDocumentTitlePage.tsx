import type { ThermalProtectionReportData } from "./buildThermalProtectionReportData";
import ProjectDocumentStamp from "./ProjectDocumentStamp";

interface ProjectDocumentTitlePageProps {
  data: ThermalProtectionReportData;
}

export function ProjectDocumentTitlePage({ data }: ProjectDocumentTitlePageProps) {
  const { metadata } = data;

  return (
    <section className="title-page">
      <div className="title-page__head">
        {metadata.organization !== "не задано" ? <p className="title-page__org">{metadata.organization}</p> : null}
      </div>

      <div className="title-page__body">
        <p className="title-page__type">{metadata.documentType}</p>
        <h1 className="title-page__title">{metadata.title}</h1>
        <p className="title-page__object">{metadata.objectName}</p>
        {metadata.address !== "не задано" ? <p className="title-page__address">{metadata.address}</p> : null}
        <p className="title-page__section">{metadata.sectionTitle}</p>
        <p className="title-page__subsection">{metadata.subsectionTitle}</p>
        <div className="title-page__meta">
          <span>Стадия {metadata.stage}</span>
          <span>{metadata.year}</span>
        </div>
      </div>

      <div className="title-page__footer">
        <ProjectDocumentStamp
          documentCode={metadata.documentCode}
          title={metadata.title}
          objectName={metadata.objectName}
          stage={metadata.stage}
          customer={metadata.customer}
          developedBy={metadata.developedBy}
          checkedBy={metadata.checkedBy}
          normControl={metadata.normControl}
          chiefEngineer={metadata.chiefEngineer}
        />
      </div>
    </section>
  );
}

export default ProjectDocumentTitlePage;
