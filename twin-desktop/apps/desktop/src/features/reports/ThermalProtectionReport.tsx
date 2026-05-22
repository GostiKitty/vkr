import React from "react";
import type { ThermalProtectionReportData } from "./buildThermalProtectionReportData";
import DocumentNotice from "./DocumentNotice";
import EnergyPassportAppendix from "./EnergyPassportAppendix";
import DynamicRcAppendix from "./DynamicRcAppendix";
import EnvelopeElementsAppendix from "./EnvelopeElementsAppendix";
import ProjectDocumentSection, { ProjectDocumentClause } from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";
import ProjectDocumentTitlePage from "./ProjectDocumentTitlePage";
import ProjectDocumentToc from "./ProjectDocumentToc";

interface ThermalProtectionReportProps {
  data: ThermalProtectionReportData;
  sheetRef?: React.Ref<HTMLDivElement>;
}

export function ThermalProtectionReport({
  data,
  sheetRef,
}: ThermalProtectionReportProps) {
  return (
    <div className="document-page">
      <div ref={sheetRef} className="document-sheet">
        <ProjectDocumentTitlePage data={data} />

        {data.warnings.length ? (
          <DocumentNotice title="Примечание" variant="note">
            <ul>
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </DocumentNotice>
        ) : null}

        <ProjectDocumentToc items={data.toc} />

        <ProjectDocumentSection id="report-section-1" number="1" title="Общие положения">
          {data.generalParagraphs.map((paragraph) => (
            <p key={paragraph} className="document-paragraph">
              {paragraph}
            </p>
          ))}
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-2" number="2" title="Исходные данные">
          <ProjectDocumentTable
            title="Исходные данные расчета"
            columns={[
              { label: "Показатель", width: "55%" },
              { label: "Ед. изм.", width: "15%" },
              { label: "Значение", align: "right" },
            ]}
            rows={data.sourceDataRows.map((row) => ({
              key: row.key,
              cells: [row.label, row.unit || "—", row.value],
            }))}
          />
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-3" number="3" title="Краткая характеристика здания">
          <ProjectDocumentTable
            title="Сводные характеристики здания"
            columns={[
              { label: "Показатель", width: "55%" },
              { label: "Ед. изм.", width: "15%" },
              { label: "Значение", align: "right" },
            ]}
            rows={data.buildingSummaryRows.map((row) => ({
              key: row.key,
              cells: [row.label, row.unit || "—", row.value],
            }))}
          />
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-4" number="4" title="Климатические и эксплуатационные параметры">
          <ProjectDocumentTable
            title="Климатические и эксплуатационные параметры"
            columns={[
              { label: "Показатель", width: "34%" },
              { label: "Обозначение", width: "14%" },
              { label: "Ед. изм.", width: "12%" },
              { label: "Значение", align: "right" },
              { label: "Источник / примечание", width: "20%" },
            ]}
            rows={data.climateRows.map((row) => ({
              key: row.key,
              cells: [row.label, row.symbol ?? "—", row.unit || "—", row.value, row.note ?? "—"],
            }))}
          />
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-5" number="5" title="Методика расчета">
          <ul>
            {data.methodologyLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ProjectDocumentSection>

        <ProjectDocumentSection
          id="report-section-6"
          number="6"
          title="Теплотехнические характеристики ограждающих конструкций"
          pageBreak
        >
          {data.envelopeGroupRows.length ? (
            <ProjectDocumentTable
              title="Сводная таблица по типам конструкций"
              columns={[
                { label: "Тип конструкции", width: "28%" },
                { label: "Количество элементов", align: "right" },
                { label: "Площадь, м²", align: "right" },
                { label: "Rфакт", align: "right" },
                { label: "Rнорм", align: "right" },
                { label: "U", align: "right" },
                { label: "Статус", width: "16%" },
              ]}
              rows={data.envelopeGroupRows.map((row) => ({
                key: row.key,
                cells: [
                  row.typeLabel,
                  row.elementCount,
                  row.area,
                  row.actualResistance,
                  row.requiredResistance,
                  row.uValue,
                  row.status,
                ],
              }))}
              note="Подробный перечень элементов приведен в приложении Б."
            />
          ) : (
            <p>Сводная таблица по ограждающим конструкциям не сформирована.</p>
          )}
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-7" number="7" title="Проверка сопротивления теплопередаче">
          <ProjectDocumentClause title="Сводная проверка">
            <p className="document-paragraph">{data.conclusions.normative}</p>
          </ProjectDocumentClause>

          {data.criticalEnvelopeRows.length ? (
            <ProjectDocumentTable
              title="Наиболее критичные элементы"
              columns={[
                { label: "Элемент", width: "24%" },
                { label: "Тип", width: "16%" },
                { label: "Площадь, м²", align: "right" },
                { label: "Rфакт", align: "right" },
                { label: "Rнорм", align: "right" },
                { label: "Статус", width: "16%" },
                { label: "Примечание", width: "20%" },
              ]}
              rows={data.criticalEnvelopeRows.map((row) => ({
                key: row.key,
                cells: [
                  row.elementName,
                  row.typeLabel,
                  row.area,
                  row.actualResistance,
                  row.requiredResistance,
                  row.status,
                  row.note,
                ],
              }))}
              note="Полный перечень элементов с результатами проверки приведен в приложении Б."
            />
          ) : (
            <p>Критичные элементы по сопротивлению теплопередаче не выделены.</p>
          )}
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-8" number="8" title="Удельная теплозащитная характеристика здания">
          <ProjectDocumentTable
            title="Сводные показатели теплозащиты здания"
            columns={[
              { label: "Показатель", width: "55%" },
              { label: "Ед. изм.", width: "15%" },
              { label: "Значение", align: "right" },
            ]}
            rows={data.thermalProtectionSummaryRows.map((row) => ({
              key: row.key,
              cells: [row.label, row.unit || "—", row.value],
            }))}
          />
          <p className="document-paragraph">{data.thermalProtectionConclusion}</p>
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-9" number="9" title="Энергетическая характеристика и расход тепловой энергии">
          {data.energyAvailable ? (
            <ProjectDocumentTable
              title="Энергетическая характеристика здания"
              columns={[
                { label: "Показатель", width: "55%" },
                { label: "Ед. изм.", width: "15%" },
                { label: "Значение", align: "right" },
              ]}
              rows={data.energyRows.map((row) => ({
                key: row.key,
                cells: [row.label, row.unit || "—", row.value],
              }))}
            />
          ) : (
            <p>Энергетическая характеристика не может быть показана из-за недостатка исходных данных.</p>
          )}
          {data.energyNote ? <p className="document-paragraph">{data.energyNote}</p> : null}
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-10" number="10" title="Дополнительная динамическая оценка теплового режима">
          <p className="document-paragraph">{DYNAMIC_NOTE}</p>
          {data.dynamicAvailable ? (
            <>
              <ProjectDocumentTable
                title="Сводные показатели RC-модели"
                columns={[
                  { label: "Показатель", width: "55%" },
                  { label: "Ед. изм.", width: "15%" },
                  { label: "Значение", align: "right" },
                ]}
                rows={data.dynamicRows.map((row) => ({
                  key: row.key,
                  cells: [row.label, row.unit || "—", row.value],
                }))}
              />
              <ProjectDocumentTable
                title="Структура расчетных потерь"
                columns={[
                  { label: "Показатель", width: "32%" },
                  { label: "Значение, Вт", align: "right" },
                  { label: "Примечание", width: "42%" },
                ]}
                rows={data.dynamicLossRows.map((row) => ({
                  key: row.key,
                  cells: [row.label, row.value, row.note],
                }))}
              />
            </>
          ) : (
            <p>Динамическая RC-оценка не выполнена.</p>
          )}
          {data.dynamicProblemZones.length ? (
            <>
              <p className="document-paragraph">Проблемные зоны по RC-модели:</p>
              <ul>
                {data.dynamicProblemZones.map((zone) => (
                  <li key={zone}>{zone}</li>
                ))}
              </ul>
            </>
          ) : null}
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-11" number="11" title="Выводы">
          <ProjectDocumentClause number="а)" title="По нормативной теплозащите">
            <p className="document-paragraph">{data.conclusions.normative}</p>
          </ProjectDocumentClause>
          <ProjectDocumentClause number="б)" title="По энергетическим показателям">
            <p className="document-paragraph">{data.conclusions.energy}</p>
          </ProjectDocumentClause>
          <ProjectDocumentClause number="в)" title="По динамической температурной оценке">
            <p className="document-paragraph">{data.conclusions.dynamic}</p>
          </ProjectDocumentClause>
          <ProjectDocumentClause number="г)" title="По недостающим исходным данным">
            <p className="document-paragraph">{data.conclusions.missing}</p>
          </ProjectDocumentClause>
        </ProjectDocumentSection>

        <ProjectDocumentSection id="report-section-12" number="12" title="Перечень недостающих исходных данных">
          {data.missingData.length ? (
            <ul>
              {data.missingData.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>Недостающие исходные данные, критичные для сводного отчета, не выявлены.</p>
          )}
        </ProjectDocumentSection>

        <EnergyPassportAppendix rows={data.appendices.energyPassportRows} />
        <EnvelopeElementsAppendix rows={data.appendices.envelopeRows} />
        <DynamicRcAppendix
          summaryRows={data.appendices.rcSummaryRows}
          zoneRows={data.appendices.rcZoneRows}
        />

        <div className="document-signature">
          <div>
            <span>Разработал</span>
            <strong>______________________________</strong>
            <p className="document-signature__name">{data.metadata.developedBy}</p>
          </div>
          <div>
            <span>Проверил</span>
            <strong>______________________________</strong>
            <p className="document-signature__name">{data.metadata.checkedBy}</p>
          </div>
          <div>
            <span>ГИП</span>
            <strong>______________________________</strong>
            <p className="document-signature__name">{data.metadata.chiefEngineer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const DYNAMIC_NOTE = "Справочный расчет. Не заменяет нормативную проверку по СП 50.";

export default ThermalProtectionReport;
