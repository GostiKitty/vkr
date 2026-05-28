import type { ThermalProtectionMetricRow, ThermalProtectionRcZoneRow } from "./buildThermalProtectionReportData";
import ProjectDocumentSection from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";

interface DynamicRcAppendixProps {
  summaryRows: ThermalProtectionMetricRow[];
  zoneRows: ThermalProtectionRcZoneRow[];
}

export function DynamicRcAppendix({ summaryRows, zoneRows }: DynamicRcAppendixProps) {
  return (
    <ProjectDocumentSection id="appendix-c" title="Приложение В. Подробные результаты RC-модели" pageBreak>
      <p className="document-paragraph">
        Справочный расчет. Не заменяет нормативную проверку по СП 50.
      </p>

      {summaryRows.length ? (
        <ProjectDocumentTable
          title="Сводные показатели динамической RC-модели"
          columns={[
            { label: "Показатель", width: "52%" },
            { label: "Ед. изм.", width: "16%" },
            { label: "Значение", align: "right" },
          ]}
          rows={summaryRows.map((row) => ({
            key: row.key,
            cells: [row.label, row.unit || "—", row.value],
          }))}
        />
      ) : null}

      {zoneRows.length ? (
        <ProjectDocumentTable
          title="Показатели по помещениям"
          columns={[
            { label: "Помещение", width: "28%" },
            { label: "Температура, °C", align: "right" },
            { label: "Дискомфорт, ч", align: "right" },
            { label: "Пик, Вт/м²", align: "right" },
            { label: "Энергия, кВт·ч/м²", align: "right" },
            { label: "Статус", width: "16%" },
          ]}
          rows={zoneRows.map((row) => ({
            key: row.key,
            cells: [
              row.zoneName,
              row.temperature,
              row.discomfortHours,
              row.peakSpecificLoad,
              row.specificEnergy,
              row.status,
            ],
          }))}
        />
      ) : (
        <p>Подробные результаты RC-модели не сформированы.</p>
      )}
    </ProjectDocumentSection>
  );
}

export default DynamicRcAppendix;
