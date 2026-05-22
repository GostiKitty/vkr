import React from "react";
import { formatNumber } from "../../shared/utils/format";
import type { CalculationPassportData, PassportMetricRow } from "./calculationPassportData";
import DocumentMetaHeader from "./DocumentMetaHeader";
import DocumentNotice from "./DocumentNotice";
import { DocumentClause, DocumentSection } from "./DocumentSection";
import DocumentTable from "./DocumentTable";
import EngineeringDocumentLayout from "./EngineeringDocumentLayout";
import RegulatoryReferenceBlock from "./RegulatoryReferenceBlock";

const NOT_SET = "не задано";
const NO_DATA = "нет данных";

interface CalculationPassportProps {
  data: CalculationPassportData;
  generatedAt: Date;
  actions?: React.ReactNode;
  sheetRef?: React.Ref<HTMLDivElement>;
}

export function CalculationPassport({ data, generatedAt, actions, sheetRef }: CalculationPassportProps) {
  const generatedAtLabel = formatDateTime(generatedAt);
  const summaryTableRows = metricRowsToTableRows(data.summaryMetricsTable);
  const resultTableRows = metricRowsToTableRows(data.resultMetricsTable).filter((row) => row.cells[1] !== NO_DATA);
  const monteCarloTableRows = metricRowsToTableRows(data.monteCarloMetricsTable).filter((row) => row.cells[1] !== NO_DATA);
  const roomTableRows = data.rooms.map((room) => ({
    key: room.id,
    cells: [
      room.roomName,
      room.levelName,
      formatNumeric(room.areaM2, 2),
      formatNumeric(room.volumeM3, 2),
    ],
  }));
  const materialTableRows = data.materials.map((material) => ({
    key: material.id,
    cells: [
      material.material,
      formatNumeric(material.conductivity_W_mK, 3),
      material.occurrences,
      material.thicknessesM.length
        ? uniqueThicknesses(material.thicknessesM).map((value) => formatNumeric(value, 3)).join(", ")
        : NO_DATA,
    ],
  }));
  const constructionTableRows = data.constructions.map((construction) => ({
    key: construction.id,
    cells: [
      construction.construction,
      construction.material,
      formatNumeric(construction.thicknessM, 3),
      formatNumeric(construction.conductivity_W_mK, 3),
      formatNumeric(construction.resistance_m2K_W, 3),
      formatNumeric(construction.uValue_W_m2K, 3),
    ],
  }));
  const tocItems = [
    { id: "passport-section-1", label: "1. Общие сведения об объекте" },
    { id: "passport-section-2", label: "2. Исходные данные" },
    { id: "passport-section-3", label: "3. Объемно-планировочная модель" },
    { id: "passport-section-4", label: "4. Конструктивные и теплотехнические параметры" },
    { id: "passport-section-5", label: "5. Инженерные системы и тепловой режим" },
    { id: "passport-section-6", label: "6. Вероятностный анализ" },
    { id: "passport-section-7", label: "7. Инженерное заключение" },
    { id: "passport-section-8", label: "8. Справочная связь с проектной документацией РФ" },
  ];

  return (
    <EngineeringDocumentLayout actions={actions} sheetRef={sheetRef}>
      <DocumentMetaHeader
        status={data.documentStatus}
        documentType="расчетный паспорт цифровой модели здания"
        version={data.documentVersion}
        generatedAtLabel={generatedAtLabel}
        projectName={data.projectName}
        calculationName={data.calculationPurpose}
      />

      <DocumentNotice title="Примечание" variant="note">
        <p>
          Расчетный паспорт сформирован автоматически на основании данных цифровой модели здания. Точность результатов
          зависит от полноты исходной геометрии, корректности заданных материалов, климатических параметров и
          эксплуатационных режимов.
        </p>
      </DocumentNotice>

      {data.warnings.length ? (
        <DocumentNotice title="Предупреждения по данным" variant="warning">
          <ul>
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </DocumentNotice>
      ) : null}

      <nav className="document-toc" aria-label="Содержание">
        <strong>Содержание</strong>
        <ol>
          {tocItems.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <DocumentSection id="passport-section-1" number="1" title="Общие сведения об объекте">
        <DocumentClause number="1.1" title="Наименование объекта">
          <p>{textOrFallback(data.projectName)}</p>
        </DocumentClause>
        <DocumentClause number="1.2" title="Дата формирования документа">
          <p>{generatedAtLabel}</p>
        </DocumentClause>
        <DocumentClause number="1.3" title="Версия расчетной модели">
          <p>{textOrFallback(data.modelVersion)}</p>
        </DocumentClause>
        <DocumentClause number="1.4" title="Назначение расчета">
          <p>{data.calculationPurpose}</p>
        </DocumentClause>
        <DocumentClause number="1.5" title="Основание формирования документа">
          <p>{data.calculationBasis}</p>
        </DocumentClause>
      </DocumentSection>

      <DocumentSection id="passport-section-2" number="2" title="Исходные данные">
        <DocumentClause number="2.1" title="Геометрическая модель здания">
          <p>
            В цифровой модели зарегистрировано уровней: <strong>{data.summary.levelCount}</strong>, помещений:{" "}
            <strong>{data.summary.roomCount}</strong>, стен: <strong>{data.summary.wallCount}</strong>, ограждающих
            конструкций: <strong>{data.summary.envelopeCount}</strong>.
          </p>
        </DocumentClause>

        <DocumentClause number="2.2" title="Состав помещений">
          {roomTableRows.length ? (
            <DocumentTable
              title="Помещения модели"
              columns={[
                { label: "Помещение", width: "34%" },
                { label: "Уровень", width: "22%" },
                { label: "Площадь, м²", align: "right" },
                { label: "Объем, м³", align: "right" },
              ]}
              rows={roomTableRows}
            />
          ) : (
            <p>{NO_DATA}</p>
          )}
        </DocumentClause>

        <DocumentClause number="2.3" title="Ограждающие конструкции">
          <p>
            Под раздел ограждающих конструкций в документе включены стены, окна, двери, покрытия и перекрытия, если
            соответствующие элементы присутствуют в модели и могут быть сопоставлены с теплотехническим контуром.
          </p>
        </DocumentClause>

        <DocumentClause number="2.4" title="Теплофизические характеристики материалов">
          {materialTableRows.length ? (
            <DocumentTable
              title="Материалы и теплофизические свойства"
              columns={[
                { label: "Материал", width: "40%" },
                { label: "λ, Вт/(м·К)", align: "right" },
                { label: "Применений", align: "right" },
                { label: "Толщины, м" },
              ]}
              rows={materialTableRows}
            />
          ) : (
            <p>{NO_DATA}</p>
          )}
        </DocumentClause>

        <DocumentClause number="2.5" title="Климатические параметры">
          <div className="document-kv">
            <p>
              <strong>а)</strong> Город / климатическая база: {textOrFallback(data.climate.city)}
            </p>
            <p>
              <strong>б)</strong> Расчетная наружная температура: {withUnit(data.climate.outdoorDesignTemperatureC, "°C")}
            </p>
            <p>
              <strong>в)</strong> Средняя температура отопительного периода:{" "}
              {withUnit(data.climate.outdoorHeatingAverageC, "°C")}
            </p>
            <p>
              <strong>г)</strong> Продолжительность отопительного периода:{" "}
              {withUnit(data.climate.heatingDurationDays, "сут.")}
            </p>
            <p>
              <strong>д)</strong> Зона влажности: {textOrFallback(data.climate.humidityZone)}
            </p>
          </div>
        </DocumentClause>

        <DocumentClause number="2.6" title="Эксплуатационные режимы">
          <div className="document-kv">
            <p>
              <strong>а)</strong> Дневная / ночная уставка: {withUnit(data.operation.daySetpointC, "°C")} /{" "}
              {withUnit(data.operation.nightSetpointC, "°C")}
            </p>
            <p>
              <strong>б)</strong> Инфильтрация / вентиляция: {withUnit(data.operation.infiltrationACH, "1/ч")} /{" "}
              {withUnit(data.operation.ventilationACH, "1/ч")}
            </p>
            <p>
              <strong>в)</strong> Внутренние теплопоступления: {withUnit(data.operation.internalGainDay_W_m2, "Вт/м²")} /{" "}
              {withUnit(data.operation.internalGainNight_W_m2, "Вт/м²")}
            </p>
            <p>
              <strong>г)</strong> Режим занятости: {formatFraction(data.operation.occupancyDayFraction)} /{" "}
              {formatFraction(data.operation.occupancyNightFraction)}
            </p>
            <p>
              <strong>д)</strong> Механическая вентиляция: {booleanLabel(data.operation.mechanicalVentilationEnabled)}
            </p>
          </div>
        </DocumentClause>
      </DocumentSection>

      <DocumentSection id="passport-section-3" number="3" title="Объемно-планировочная модель">
        <DocumentClause number="3.1" title="Количество уровней">
          <p>{data.summary.levelCount} шт.</p>
        </DocumentClause>
        <DocumentClause number="3.2" title="Количество помещений">
          <p>{data.summary.roomCount} шт.</p>
        </DocumentClause>
        <DocumentClause number="3.3" title="Общая площадь">
          <p>{withUnit(data.summary.totalAreaM2, "м²")}</p>
        </DocumentClause>
        <DocumentClause number="3.4" title="Общий объем">
          <p>{withUnit(data.summary.totalVolumeM3, "м³")}</p>
        </DocumentClause>
        <DocumentClause number="3.5" title="Пространственные связи между помещениями и конструкциями">
          <p>{data.adjacency.relationSummary}</p>
        </DocumentClause>

        <DocumentTable
          title="Таблица 1 — Общие показатели модели"
          columns={[
            { label: "Показатель", width: "55%" },
            { label: "Значение", align: "right" },
            { label: "Единица измерения" },
          ]}
          rows={summaryTableRows}
        />
      </DocumentSection>

      <DocumentSection
        id="passport-section-4"
        number="4"
        title="Конструктивные и теплотехнические параметры"
        pageBreak
      >
        <DocumentClause number="4.1" title="Состав ограждающих конструкций">
          <p>
            Детализированный состав ограждающих конструкций формируется по доступным данным модели и теплотехнического
            контура СП 50.
          </p>
        </DocumentClause>
        <DocumentClause number="4.2" title="Слои конструкций">
          <p>
            При наличии послойного описания в модели или в нормализованном теплотехническом контуре каждый слой
            отображается отдельной записью в таблице ниже.
          </p>
        </DocumentClause>
        <DocumentClause number="4.3" title="Толщина материалов">
          <p>Толщины материалов приводятся в метрах и заполняются только по фактически найденным слоям.</p>
        </DocumentClause>
        <DocumentClause number="4.4" title="Теплопроводность материалов">
          <p>Коэффициенты теплопроводности λ выводятся по уже сопоставленным материалам расчетной модели.</p>
        </DocumentClause>
        <DocumentClause number="4.5" title="Сопротивление теплопередаче">
          <p>Сопротивление теплопередаче R указывается по доступному теплотехническому расчету конструкции.</p>
        </DocumentClause>
        <DocumentClause number="4.6" title="Коэффициент теплопередачи">
          <p>Коэффициент теплопередачи U приводится для соответствующей конструкции без изменения расчетного ядра.</p>
        </DocumentClause>
        <DocumentClause number="4.7" title="Расчетные теплопотери">
          <div className="document-kv">
            <p>
              <strong>а)</strong> Непрозрачные элементы: {withUnit(data.thermalResults.totalOpaqueLossW, "Вт")}
            </p>
            <p>
              <strong>б)</strong> Окна: {withUnit(data.thermalResults.totalWindowLossW, "Вт")}
            </p>
            <p>
              <strong>в)</strong> Двери: {withUnit(data.thermalResults.totalDoorLossW, "Вт")}
            </p>
            <p>
              <strong>г)</strong> Инфильтрация: {withUnit(data.thermalResults.totalInfiltrationLossW, "Вт")}
            </p>
            <p>
              <strong>д)</strong> Вентиляция: {withUnit(data.thermalResults.totalVentilationLossW, "Вт")}
            </p>
          </div>
        </DocumentClause>

        {constructionTableRows.length ? (
          <DocumentTable
            title="Таблица 2 — Теплотехнические параметры"
            columns={[
              { label: "Конструкция", width: "30%" },
              { label: "Материал", width: "24%" },
              { label: "Толщина, м", align: "right" },
              { label: "λ", align: "right" },
              { label: "R", align: "right" },
              { label: "U", align: "right" },
            ]}
            rows={constructionTableRows}
            note="R — м²·К/Вт, U — Вт/(м²·К)."
          />
        ) : (
          <DocumentNotice title="Теплотехнические параметры" variant="warning">
            <p>Послойные теплотехнические данные по конструкциям отсутствуют или не могут быть безопасно сопоставлены с моделью.</p>
          </DocumentNotice>
        )}
      </DocumentSection>

      <DocumentSection id="passport-section-5" number="5" title="Инженерные системы и тепловой режим">
        <DocumentClause number="5.1" title="Расчетная внутренняя температура">
          <p>
            Уставка день / ночь: {withUnit(data.operation.daySetpointC, "°C")} / {withUnit(data.operation.nightSetpointC, "°C")}.
          </p>
        </DocumentClause>
        <DocumentClause number="5.2" title="Наружная температура">
          <p>
            Климатическая расчетная температура: {withUnit(data.climate.outdoorDesignTemperatureC, "°C")}. В расчетном
            диагностическом срезе: {withUnit(data.thermalResults.referenceOutdoorTemperatureC, "°C")}.
          </p>
        </DocumentClause>
        <DocumentClause number="5.3" title="Инфильтрация и вентиляция">
          <p>
            Инфильтрация: {withUnit(data.operation.infiltrationACH, "1/ч")}; вентиляция:{" "}
            {withUnit(data.operation.ventilationACH, "1/ч")}; рекуперация: {withUnit(data.operation.heatRecoveryFactor, "доля")}.
          </p>
        </DocumentClause>
        <DocumentClause number="5.4" title="Внутренние теплопоступления">
          <p>
            Дневные / ночные теплопоступления: {withUnit(data.operation.internalGainDay_W_m2, "Вт/м²")} /{" "}
            {withUnit(data.operation.internalGainNight_W_m2, "Вт/м²")}.
          </p>
        </DocumentClause>
        <DocumentClause number="5.5" title="Расчетная тепловая нагрузка">
          <p>
            Пиковая расчетная тепловая нагрузка: {withUnit(data.thermalResults.peakLoadKW, "кВт")}. Суммарная мощность в
            диагностическом срезе: {withUnit(data.thermalResults.totalHeatingW, "Вт")}.
          </p>
        </DocumentClause>
        <DocumentClause number="5.6" title="Температурное состояние помещений">
          <div className="document-kv">
            <p>
              <strong>а)</strong> Средняя температура: {withUnit(data.thermalResults.averageRoomTemperatureC, "°C")}
            </p>
            <p>
              <strong>б)</strong> Минимальная температура: {withUnit(data.thermalResults.minRoomTemperatureC, "°C")}
            </p>
            <p>
              <strong>в)</strong> Максимальная температура: {withUnit(data.thermalResults.maxRoomTemperatureC, "°C")}
            </p>
            <p>
              <strong>г)</strong> Часы дискомфорта: {withUnit(data.thermalResults.discomfortHours, "ч")}
            </p>
          </div>
        </DocumentClause>

        {resultTableRows.length ? (
          <DocumentTable
            title="Таблица 3 — Результаты расчета"
            columns={[
              { label: "Показатель", width: "55%" },
              { label: "Значение", align: "right" },
              { label: "Единица измерения" },
            ]}
            rows={resultTableRows}
          />
        ) : (
          <DocumentNotice title="Результаты расчета" variant="warning">
            <p>Нет данных теплотехнического расчета. Таблица результатов скрыта до появления расчетного результата.</p>
          </DocumentNotice>
        )}
      </DocumentSection>

      <DocumentSection id="passport-section-6" number="6" title="Вероятностный анализ" pageBreak>
        <DocumentClause number="6.1" title="Учет климатических неопределенностей">
          <p>{data.monteCarlo.climateFactors.length ? data.monteCarlo.climateFactors.join("; ") : NO_DATA}</p>
        </DocumentClause>
        <DocumentClause number="6.2" title="Учет эксплуатационных неопределенностей">
          <p>{data.monteCarlo.operationalFactors.length ? data.monteCarlo.operationalFactors.join("; ") : NO_DATA}</p>
        </DocumentClause>
        <DocumentClause number="6.3" title="Количество статистических испытаний">
          <p>{withUnit(data.monteCarlo.runs, "шт.")}</p>
        </DocumentClause>
        <DocumentClause number="6.4" title="Диапазоны расчетных значений">
          <p>
            Минимум / максимум пиковых значений: {withUnit(data.monteCarlo.minPeakLoadKW, "кВт")} /{" "}
            {withUnit(data.monteCarlo.maxPeakLoadKW, "кВт")}. Интервал P5-P95: {withUnit(data.monteCarlo.p5PeakLoadKW, "кВт")} /{" "}
            {withUnit(data.monteCarlo.p95PeakLoadKW, "кВт")}.
          </p>
        </DocumentClause>
        <DocumentClause number="6.5" title="Риск выхода параметров за допустимые пределы">
          <p>{withUnit(data.monteCarlo.exceedanceProbabilityPct, "%")}</p>
        </DocumentClause>
        <DocumentClause number="6.6" title="Интерпретация результатов Monte Carlo">
          {data.monteCarlo.interpretationLines.length ? (
            <ul>
              {data.monteCarlo.interpretationLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>Monte Carlo / вероятностный анализ не выполнен.</p>
          )}
        </DocumentClause>

        {monteCarloTableRows.length ? (
          <DocumentTable
            title="Таблица 4 — Вероятностный анализ"
            columns={[
              { label: "Показатель", width: "55%" },
              { label: "Значение", align: "right" },
              { label: "Единица измерения" },
            ]}
            rows={monteCarloTableRows}
          />
        ) : (
          <DocumentNotice title="Вероятностный анализ" variant="warning">
            <p>Таблица Monte Carlo не выводится, так как вероятностный расчет не сформирован или содержит неполные поля.</p>
          </DocumentNotice>
        )}
      </DocumentSection>

      <DocumentSection id="passport-section-7" number="7" title="Инженерное заключение">
        <DocumentClause number="7.1" title="Основные результаты расчета">
          {data.insightLines.length ? (
            <ul>
              {data.insightLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>Основные результаты расчета отсутствуют.</p>
          )}
        </DocumentClause>
        <DocumentClause number="7.2" title="Выявленные проблемные зоны">
          {data.problemZones.length ? (
            <ul>
              {data.problemZones.map((zone) => (
                <li key={zone}>{zone}</li>
              ))}
            </ul>
          ) : (
            <p>По доступной RC-диагностике критические проблемные зоны не выявлены.</p>
          )}
        </DocumentClause>
        <DocumentClause number="7.3" title="Ограничения применения результатов">
          <DocumentNotice title="Ограничения применения" variant="warning">
            <ul>
              {data.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </DocumentNotice>
        </DocumentClause>
        <DocumentClause number="7.4" title="Рекомендации по дальнейшей проверке">
          {data.recommendations.length ? (
            <ul>
              {data.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>Рекомендации не сформированы из-за отсутствия достаточного объема расчетных данных.</p>
          )}
        </DocumentClause>
        <DocumentClause number="7.5" title="Итоговый вывод">
          <div className="document-conclusion">
            <p>{data.finalConclusion}</p>
          </div>
        </DocumentClause>
      </DocumentSection>

      <RegulatoryReferenceBlock referenceText={data.regulatoryReferenceText} />

      <div className="document-signature">
        <div>
          <span>Ответственное лицо</span>
          <strong>______________________________</strong>
        </div>
        <div>
          <span>Подпись</span>
          <strong>__________________</strong>
        </div>
        <div>
          <span>Дата</span>
          <strong>__________________</strong>
        </div>
      </div>
    </EngineeringDocumentLayout>
  );
}

function metricRowsToTableRows(rows: PassportMetricRow[]) {
  return rows.map((row) => ({
    key: row.label,
    cells: [row.label, formatMetricValue(row.value), row.unit ?? NO_DATA],
  }));
}

function formatMetricValue(value: number | string | null) {
  if (typeof value === "string") {
    return value || NO_DATA;
  }
  return formatNumeric(value, 2);
}

function formatNumeric(value: number | null | undefined, digits = 2) {
  if (!Number.isFinite(value)) {
    return NO_DATA;
  }
  return formatNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: 0, fallback: NO_DATA });
}

function formatFraction(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  return `${formatNumber((value ?? 0) * 100, { maximumFractionDigits: 0, fallback: NO_DATA })} %`;
}

function withUnit(value: number | null | undefined, unit: string) {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  return `${formatNumeric(value, 2)} ${unit}`;
}

function textOrFallback(value: string | null | undefined) {
  return value && value.trim() ? value : NOT_SET;
}

function booleanLabel(value: boolean | null) {
  if (value === null) {
    return NOT_SET;
  }
  return value ? "да" : "нет";
}

function uniqueThicknesses(values: number[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toFixed(4);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default CalculationPassport;
