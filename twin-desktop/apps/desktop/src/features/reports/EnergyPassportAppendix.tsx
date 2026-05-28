import type { ThermalProtectionMetricRow } from "./buildThermalProtectionReportData";
import ProjectDocumentSection from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";

interface EnergyPassportAppendixProps {
  rows: ThermalProtectionMetricRow[];
}

export function EnergyPassportAppendix({ rows }: EnergyPassportAppendixProps) {
  return (
    <ProjectDocumentSection id="appendix-a" title="Приложение А. Энергетический паспорт" pageBreak>
      {rows.length ? (
        <ProjectDocumentTable
          title="Энергетический паспорт расчетной модели"
          columns={[
            { label: "Показатель", width: "52%" },
            { label: "Ед. изм.", width: "16%" },
            { label: "Значение", align: "right" },
          ]}
          rows={rows.map((row) => ({
            key: row.key,
            cells: [row.label, row.unit || "—", row.value],
          }))}
          note="Фактические эксплуатационные значения заполняются после уточнения исходных данных и проектных параметров."
        />
      ) : (
        <p>Недостаточно данных для формирования энергетического паспорта.</p>
      )}
    </ProjectDocumentSection>
  );
}

export default EnergyPassportAppendix;
