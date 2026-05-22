import React from "react";
import type { ThermalProtectionAppendixEnvelopeRow } from "./buildThermalProtectionReportData";
import ProjectDocumentSection from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";

interface EnvelopeElementsAppendixProps {
  rows: ThermalProtectionAppendixEnvelopeRow[];
}

export function EnvelopeElementsAppendix({ rows }: EnvelopeElementsAppendixProps) {
  return (
    <ProjectDocumentSection id="appendix-b" title="Приложение Б. Ведомость ограждающих конструкций" pageBreak>
      {rows.length ? (
        <ProjectDocumentTable
          title="Полная ведомость ограждающих конструкций"
          columns={[
            { label: "Элемент", width: "24%" },
            { label: "Тип", width: "16%" },
            { label: "Площадь, м²", align: "right" },
            { label: "Rфакт", align: "right" },
            { label: "Rнорм", align: "right" },
            { label: "U", align: "right" },
            { label: "Статус", width: "14%" },
            { label: "Примечание", width: "22%" },
          ]}
          rows={rows.map((row) => ({
            key: row.key,
            cells: [
              row.elementName,
              row.typeLabel,
              row.area,
              row.actualResistance,
              row.requiredResistance,
              row.uValue,
              row.status,
              row.note,
            ],
          }))}
          note="Элементы с конфликтом классификации или неполным послойным составом отмечены как требующие проверки."
        />
      ) : (
        <p>Ведомость ограждающих конструкций не сформирована.</p>
      )}
    </ProjectDocumentSection>
  );
}

export default EnvelopeElementsAppendix;
