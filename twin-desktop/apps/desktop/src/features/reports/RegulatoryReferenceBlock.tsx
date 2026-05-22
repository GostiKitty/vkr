import React from "react";
import { DocumentClause, DocumentSection } from "./DocumentSection";
import DocumentNotice from "./DocumentNotice";

interface RegulatoryReferenceBlockProps {
  referenceText: string;
}

export function RegulatoryReferenceBlock({ referenceText }: RegulatoryReferenceBlockProps) {
  return (
    <DocumentSection id="passport-section-8" number="8" title="Справочная связь с проектной документацией РФ" pageBreak>
      <DocumentClause number="8.1" title="Раздел 1 проектной документации — пояснительная записка">
        <p>Расчетный паспорт может использоваться как краткая пояснительная записка к цифровой расчетной модели и ее исходным данным.</p>
      </DocumentClause>
      <DocumentClause number="8.2" title="Раздел 3 — объемно-планировочные и архитектурные решения">
        <p>Сведения о помещениях, уровнях, площади, объеме и пространственных связях соотносятся с объемно-планировочной частью модели.</p>
      </DocumentClause>
      <DocumentClause number="8.3" title="Раздел 4 — конструктивные решения">
        <p>Состав ограждающих конструкций, слои, теплопроводность материалов, сопротивление теплопередаче и коэффициенты U относятся к конструктивной части модели.</p>
      </DocumentClause>
      <DocumentClause number="8.4" title="Раздел 5 — сведения об инженерном оборудовании и инженерных системах">
        <p>Расчетный тепловой режим, вентиляция, инфильтрация, внутренние теплопоступления и расчетная тепловая нагрузка используются как инженерные расчетные сведения.</p>
      </DocumentClause>
      <DocumentClause number="8.5" title="Раздел 10 — требования к безопасной эксплуатации объекта">
        <p>Вероятностный анализ и инженерные ограничения могут применяться как вспомогательные материалы при оценке эксплуатационных рисков и проверке допущений модели.</p>
      </DocumentClause>

      <DocumentNotice title="Справочный статус" variant="note">
        <p>{referenceText}</p>
        <p>Расчетный паспорт не является официальной проектной документацией, но может использоваться как вспомогательный расчетно-аналитический материал для подготовки инженерных решений.</p>
      </DocumentNotice>
    </DocumentSection>
  );
}

export default RegulatoryReferenceBlock;
