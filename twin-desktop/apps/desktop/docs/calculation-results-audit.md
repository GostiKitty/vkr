# Аудит расчётов и результатов

## 1. Найденные расчётные контуры

### 1.1. Базовый теплотехнический расчёт / RC solver
- Файл/модуль: `src/core/thermal/solver.ts`, `src/core/thermal/metrics.ts`, `src/core/thermal/thermalSimulationExport.ts`.
- Функция запуска: `runThermalSimulation(building, options, adjacency?)`.
- Где запускается: `src/features/runs/SimulationPanel.tsx`, а также повторно внутри `src/core/uncertainty/thermalMonteCarlo.ts`; для demo-выгрузки может быть вызван из `src/features/reports/exports/prepareExportReportInput.ts`.
- Входные данные: `BuildingModel`, `ThermalSimulationOptions`, `AdjacencyResult`; сценарий прикладывается через `applyScenarioToBuilding(...)` и `buildThermalOptionsFromWorkflow(...)`.
- Выходные данные: `ThermalSimulationResult` с `timeline`, `rooms`, `summary`, `diagnostics`, `modelWarnings`.
- Store/state: `useTwinStore.setSimulationResult(...)` пишет `simulationFrames`, `thermalGraph`, `lastThermalResult`, `simulationDataSource`; `useWorkflowStore.pushScenarioRunSnapshot(...)` сохраняет историю запусков.
- Где отображается в UI: `ResultsWorkspacePage`, `ResultsPanel`, `MetricsResultsTab`, `SpaceList`, `SpaceDetails`, `SpaceViewer3D`.
- График/таблица: есть. Используются `ThermalTimeSeriesChart`, `BuildingLossChart`, `LossShareChart`, `RoomLossStackedChart`, `RoomHeatmapMatrix`, `RoomScatterPlot`, таблица по помещениям.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: да, это основной источник текущих результатов.

### 1.2. Квазистационарный / инженерный статический контур
- Файл/модуль: `src/core/thermal/engineering/analysis.ts`.
- Функция запуска: `runEngineeringThermalAnalysis(model, adjacency, options, simulationResult)`.
- Где запускается: `src/features/build/components/ThermalSimulationPanel.tsx`.
- Входные данные: `BuildingModel`, `AdjacencyResult`, `ThermalSimulationOptions`, базовый `ThermalSimulationResult`.
- Выходные данные: `EngineeringAnalysisResult` с `balance`, `envelope`, `gains`, `rooms`, `fastField`, `detailedField`, `comfort`, `scenarios`, `sensitivity`, `sp50`, `presentation`.
- Store/state: отдельного глобального store нет; результат живёт в local state `engineeringResult` внутри `ThermalSimulationPanel`.
- Где отображается в UI: только legacy `/build` viewport результатов.
- График/таблица: есть. Там же живут тепловая карта, инженерные breakdown-таблицы, рекомендации, связка со `SP50`.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: нет.
- Вывод: это реальный отдельный контур, но он не переехал в новый route-level `Results`.

### 1.3. Расчёт по СП / нормативный расчёт
- Файл/модуль: `src/core/thermal/sp50/analysis.ts`, `src/features/reports/calculationPassportData.ts`.
- Функции запуска: `runSP50Compliance(...)`, `runSp50ComplianceAnalysis(...)`, вспомогательно `buildSp50Report(...)`.
- Где запускается: из `runEngineeringThermalAnalysis(...)` в `/build`; из `buildSp50Report(...)` в новом отчётном/паспортном контуре.
- Входные данные: `BuildingModel`, климатические входы `SP50`, опционально envelope results и default indoor/outdoor temperatures.
- Выходные данные: `Sp50ComplianceReport` с блоками `constructions`, `building`, `temperature`, `transient`, `airPermeability`, `moistureProtection`, `floor`, `energy`, `recommendations`, `materialEfficiency`, `missingData`.
- Store/state: в `/build` живёт внутри `engineeringResult.sp50`; в новом `Results` строится по требованию внутри report/passport-контура, без отдельного глобального store.
- Где отображается в UI: `Sp50Panel` и `ExpertiseReportExport` в `/build`; в новом `Results` через `ProjectDocumentationPage` и export pipeline.
- График/таблица: да, но это в основном паспортные/экспортные таблицы, а не результатовые KPI-чарты.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: да, но только косвенно через вкладку `passport` и экспортные документы.

### 1.4. Monte Carlo / вероятностный анализ
- Файл/модуль: `src/core/uncertainty/thermalMonteCarlo.ts`.
- Функции запуска: `runThermalMonteCarlo(options)`, `runThermalMonteCarloAsync(options)`.
- Где запускается: `src/features/scenarios/UncertaintyPanel.tsx`, legacy `/build` `ThermalMonteCarloPanel.tsx`.
- Входные данные: `model`, `baseOptions`, `runs`, `seed`, `adjacency`, `heatingThresholdKW`, `varLevel`, `correlationMatrix`.
- Выходные данные: `ThermalMonteCarloResult` с `samples`, `peakLoad`, `totalEnergy`, `dailyEnergy`, `annualEnergy`, `discomfort`, `scenarioSeries`, `underheatingBelow20CProbability`, `sensitivity`, `roomRiskSummary`, `exceedanceProbability`, `varLevel`.
- Store/state: `useWorkflowStore.monteCarloResult`.
- Где отображается в UI: `UncertaintyPanel`, `ResultsWorkspacePage`, `ResultsPanel`, `MonteCarloResultsSection`, `ProjectDocumentationPage`.
- График/таблица: есть. Используются histogram, comparison table, sensitivity bar chart, risk table, room-level risk table.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: да, отдельная вкладка `probabilistic`.
- Ключевой вывод: это не отдельный статический расчёт. Каждый сценарий Monte Carlo повторно вызывает тот же нестационарный `runThermalSimulation(...)`.

### 1.5. Экономический блок
- Файл/модуль: `src/core/economics/analysis.ts`, `src/core/economics/types.ts`, `src/core/economics/index.ts`.
- Функции запуска: `buildDefaultEconomicScenario(report)`, `runEconomicAssessment(report, scenario)`.
- Где запускается: `EconomicAssessmentPanelV2` в `src/features/build/components/ThermalSimulationPanel.tsx`.
- Входные данные: `Sp50ComplianceReport` и `EconomicScenario` с тарифами, горизонтом расчёта, discount rate, annual tariff growth, source, regional factor, measures.
- Выходные данные: `EconomicAssessmentResult` с `summary`, `zones`, `measureResults`, `recommendations`, `engineeringConclusion`, `exportData`, `warnings`.
- Store/state: отдельного глобального store нет; сценарий и результат держатся локально внутри `EconomicAssessmentPanelV2`.
- Где отображается в UI: только `/build` results viewport.
- График/таблица: да. Есть KPI, графики по зонам/окупаемости, таблицы мероприятий и warning-списки.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: нет.
- Ключевой вывод: код экономики не удалён; он не подключён к новому route-level `Results`.

### 1.6. Отчётные расчёты для экспертизы
- Файл/модуль: `src/features/build/reports/ExpertiseReportExport.tsx`, `src/features/reports/ProjectDocumentationPage.tsx`, `src/features/reports/exports/exportReportDocument.ts`, `src/features/reports/exports/prepareExportReportInput.ts`.
- Функции запуска: `prepareExportReportInput(...)`, `exportReportDocument(...)`, `downloadAllReportDocuments(...)`, `ExpertiseReportExport`.
- Где запускается: через вкладку `passport`, глобальный `ReportExportListener`, build-only `ExpertiseReportExport`.
- Входные данные: model, `scenarioConfig`, `thermalResult`, `monteCarloResult`, report meta, expertise inputs; для demo допускается авто-RC в `prepareExportReportInput(...)`.
- Выходные данные: подготовленные export datasets, HTML-документы, PDF/print payload.
- Store/state: рассчитываются поверх текущих store (`build`, `twin`, `workflow`, `project`, `workspace`) и form-store `expertiseInputs`; собственного solver-state не имеют.
- Где отображается в UI: `ProjectDocumentationPage` в новом `Results`, `ExpertiseReportExport` в `/build`.
- График/таблица: это документный контур, а не интерактивный dashboard.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: да, но как контур документации и экспорта.
- Ключевой вывод: экспертные отчёты уже есть; новый отдельный Monte Carlo export не нужен.

### 1.7. Расчёты в `/build`, которые отличаются от Studio / Results
- Файл/модуль: `src/features/build/BuildPage.tsx`, `src/features/build/components/ThermalSimulationPanel.tsx`, `src/features/build/thermal/usePreparedThermalAnalysis.ts`, `src/core/thermal/transient/analysis.ts`, `src/core/thermal/transient/uncertainty.ts`.
- Функции запуска:
  - `runEngineeringThermalAnalysis(...)`
  - `runTransientConstructionAnalysis(...)`
  - `runTransientMonteCarlo(...)`
  - `usePreparedThermalAnalysis(...)`
- Входные данные: текущая build-модель, выбранная конструкция, transient-сценарий, текущий thermal frame, field options.
- Выходные данные:
  - `EngineeringAnalysisResult`
  - `TransientCalculationResult`
  - `TransientMonteCarloResult`
  - prepared thermal field overlays
- Store/state: локальный state `ThermalSimulationPanel` и `BuildPage`; глобальный `Results` об этом не знает.
- Где отображается в UI: только `/build` results viewport.
- График/таблица: есть 2D `HeatmapPanel`, 3D heatmap overlays, transient curves, transient Monte Carlo statistics.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: нет.
- Ключевой вывод: часть наиболее наглядной визуализации осталась только в `/build`.

### 1.8. Legacy расчёты, которые ещё используются
- Файл/модуль: `src/core/uncertainty/monteCarloEngine.ts`, `src/features/reports/reportUtils.ts`, `src/features/reports/ReportGenerator.tsx`.
- Функция запуска: `runMonteCarlo(options)` из `generateMonteCarloAnalytics(twin)`.
- Входные данные: упрощённый Twin-derived сценарий, набор uncertain parameters, optional surrogate.
- Выходные данные: `MonteCarloResult` с `runSummaries`, `peakHeatingLoad`, `annualEnergy`, optional Morris sensitivity.
- Store/state: живёт только внутри legacy PDF generation.
- Где отображается в UI: `ReportGenerator` под `ResultsPanel`.
- График/таблица: интерактивного UI нет; используется только для legacy PDF.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: да, но только как legacy export helper.
- Ключевой вывод: legacy Monte Carlo не должен смешиваться с текущим RC Monte Carlo и не должен становиться основой нового раздела `Результаты`.

### 1.9. Дополнительный build-only контур: калибровка
- Файл/модуль: `src/core/calibration/calibrator.ts`, `src/features/build/components/ThermalCalibrationPanel.tsx`.
- Функция запуска: `calibrateParameters(...)`.
- Используется сейчас в `ResultsWorkspacePage / ResultsPanel`: нет.
- Это не главный результатовый контур для текущей задачи, но он тоже остался только в `/build`.

## 2. Где хранятся результаты

| Где хранится | Что хранится | Кто пишет | Кто читает |
| --- | --- | --- | --- |
| `useTwinStore` | `simulationFrames`, `thermalGraph`, `lastThermalResult`, `simulationDataSource` | `syncBuildSimulationToStudio(...)` | `ResultsWorkspacePage`, `ResultsPanel`, `MetricsResultsTab`, `ProjectDocumentationPage`, Twin/3D UI |
| `useWorkflowStore` | `scenarioConfig`, `uncertaintyConfig`, `monteCarloResult`, `scenarioRunHistory` | `SimulationPanel`, `UncertaintyPanel` | `ResultsWorkspacePage`, `ResultsPanel`, `MetricsResultsTab`, `MonteCarloResultsSection`, export/report pages |
| Local state `ThermalSimulationPanel` | `engineeringResult`, `transientResult`, `transientMonteCarloResult`, `transientWarnings`, `heatmap`-related state, local economic scenario | `/build` `ThermalSimulationPanel` | Только `/build` results viewport |
| Local state `EconomicAssessmentPanelV2` | economic scenario inputs и пересчитанный `assessment` | `EconomicAssessmentPanelV2` | Только `/build` economy UI |
| `expertiseInputs.store` + report meta | пользовательские данные для экспертизы, титульные реквизиты | `ProjectDocumentationPage`, `ExpertiseReportExport` | export/report pipeline |

Ключевое наблюдение:
- В глобальных store есть RC-результат и Monte Carlo.
- В глобальных store нет `economicResult`, `sp50Result`, `engineeringResult`, `transientResult`.
- Поэтому новый `ResultsWorkspacePage` может показать RC + Monte Carlo, но не показывает build-only экономику и инженерные экраны, пока их явно не подключить.

## 3. Где результаты отображаются в UI

### 3.1. Текущие вкладки `ResultsPanel`

Сейчас в `src/features/reports/ResultsPanel.tsx` есть вкладки:
- `overview` / «Помещения»
- `metrics` / «Показатели»
- `probabilistic` / «Вероятностный анализ»
- `view3d` / «Карта и связи»
- `passport` / «Справка по ПП РФ №87»

По `git diff` до редизайна/последней миграции в `ResultsPanel` были:
- `overview`
- `metrics`
- `view3d`
- `passport`

Отдельной вкладки `probabilistic` раньше не было; `MonteCarloResultsSection` раньше был встроен внутрь `MetricsResultsTab`.

### 3.2. Привязка ключевых визуализаций

| Что нужно найти | Где сейчас показывается | Компонент / файл | Примечание |
| --- | --- | --- | --- |
| График температуры | Вкладка `metrics` | `ThermalTimeSeriesChart` в `MetricsResultsTab.tsx` | График строится по `result.rooms[roomId].timeline` |
| График мощности | Вкладка `metrics` | тот же `ThermalTimeSeriesChart` | Температура и `heatingPowerW` идут на одном графике |
| 3D карта | Вкладка `view3d`; также маленький preview в `metrics` | `SpaceViewer3D` | Есть в новом `Results` |
| 2D карта | В новом `Results` не найдена | legacy `HeatmapPanel` в `/build` `ThermalSimulationPanel.tsx` | Это одна из пропавших визуализаций |
| Тепловой граф | Вкладка `view3d` | `GraphPanel` внутри `ResultsPanel.tsx` | Есть в новом `Results` |
| Monte Carlo histogram | Вкладка `probabilistic` | `MonteCarloChart.tsx` | Уже показывает `totalEnergy` + P10/P50/P90 + Base |
| Sensitivity | Вкладка `probabilistic` | `BarChart` внутри `MonteCarloResultsSection.tsx` | Данные уже есть |
| Room-level deterministic results | Вкладка `metrics` и `overview` | `SpaceList`, `SpaceDetails`, `RoomLossStackedChart`, `RoomHeatmapMatrix`, `RoomScatterPlot`, room table | Есть |
| Room-level risk | Вкладка `probabilistic` | room risk table в `MonteCarloResultsSection.tsx` | Есть, но это агрегат, не time-series |
| Economic block | В новом `Results` не показывается | только `EconomicAssessmentPanelV2` в `/build` | Пропал из нового маршрута |
| Нормативный / паспортный результат | Вкладка `passport` | `ProjectDocumentationPage.tsx` | Это report/passport UI, а не единый dashboard результатов |

## 4. Что пропало после редизайна

По коду и `git diff` видно следующее:

1. Сам solver не пропал. Базовый RC и текущий Monte Carlo по-прежнему используются.
2. Monte Carlo не удалён, а вынесен из `MetricsResultsTab` в отдельную вкладку `Вероятностный анализ`.
3. Экономический блок не переехал в новый `Results`. Он остался только в `/build` рядом с `SP50`.
4. 2D тепловая карта и часть более «инженерных» build-only визуализаций не попали в route-level `Results`.
5. Квазистационарный/engineering breakdown (`runEngineeringThermalAnalysis`) не подключён к новому `Results`.
6. 1D transient construction analysis и transient Monte Carlo остались только в `/build`.
7. Экспертные выгрузки не исчезли, но были сдвинуты в `passport`/export menu; из нового `Results` они уже не выглядят как часть основного dashboard.
8. Route-level миграция скрыла старую `studio`-страницу из навигации и ввела новый `/results`; пользователь перестал попадать на старый богатый `/build`-экран, где и находилась экономика.

Главная причина ощущения, что «часть визуализации пропала»: новый `ResultsWorkspacePage` оборачивает только `ResultsPanel`, а не legacy `ThermalSimulationPanel` из `/build`.

## 5. Экономический блок: где находится и как вернуть

### 5.1. Где раньше был экономический блок

Экономический блок сейчас находится в старом build-only экране результатов:
- `src/features/build/components/ThermalSimulationPanel.tsx`
- в ветке с `engineeringResult.sp50` рядом с:
  - `ExpertiseReportExport`
  - `Sp50Panel`
  - `EconomicAssessmentPanelV2`

Фактические места монтирования:
- `EconomicAssessmentPanelV2 report={engineeringResult.sp50}`.
- demo-ветки с `demoSp50Result.report`.

### 5.2. Какие файлы за него отвечают

- Логика:
  - `src/core/economics/analysis.ts`
  - `src/core/economics/types.ts`
  - `src/core/economics/index.ts`
- UI:
  - `src/features/build/components/ThermalSimulationPanel.tsx`
  - компонент `EconomicAssessmentPanelV2`

### 5.3. Какие данные он использует

Базовый источник данных:
- `Sp50ComplianceReport`

Поверх него пользовательская экономика:
- `EconomicScenario`
- `heatTariffRubPerGcal`
- `electricityTariffRubPerKwh`
- `heatingEnergySource`
- `regionalCostFactor`
- `discountRate`
- `annualTariffGrowthPercent`
- `annualMaintenanceCost_RUB`
- `analysisPeriod_years`

Выход:
- `EconomicAssessmentResult`
- package summary
- payback / NPV / recommendations
- ranking мероприятий

### 5.4. Почему сейчас его не видно

Причина не в удалении кода, а в разрыве UI-связи:

1. Новый `ResultsWorkspacePage` читает только:
   - `useTwinStore.lastThermalResult`
   - `useWorkflowStore.monteCarloResult`
2. `ResultsPanel` не импортирует ни `runEconomicAssessment`, ни `EconomicAssessmentPanelV2`.
3. В глобальном store нет ни `sp50Result`, ни `economicResult`.
4. Экономика в старом `/build` строится из локального `engineeringResult.sp50`, а новый `Results` такого состояния не имеет.

Итог:
- Блок не удалён.
- Блок не переименован.
- Блок не сломан на уровне расчёта.
- Блок просто не подключён к новому `ResultsWorkspacePage / ResultsPanel`.

### 5.5. Как безопасно вернуть экономику в раздел «Результаты»

Без переписывания экономики безопасный путь такой:

1. Не трогать `src/core/economics/*`.
2. Не вводить новый формат отчёта и не делать отдельный Monte Carlo export.
3. В новом `Results` добавить вкладку `Экономика`, которая:
   - получает `Sp50ComplianceReport` из уже существующего report/passport-контура;
   - использует тот же `runEconomicAssessment(report, scenario)`;
   - использует тот же UI `EconomicAssessmentPanelV2` или его вынесенную tab-обёртку.
4. На первом этапе не сохранять `EconomicAssessmentResult` в глобальный store:
   - достаточно пересчитывать его на рендере из `Sp50ComplianceReport + EconomicScenario`.
5. Если позже понадобится persistence пользовательских настроек экономики между маршрутами:
   - добавить только `economicScenario`/`economyUiState`;
   - не дублировать расчётный код и не копировать `EconomicAssessmentResult` в несколько store.

Вывод:
- Экономику можно вернуть без переписывания расчётов.
- Нужен только мост из нового `Results` к уже существующему `Sp50ComplianceReport` и существующему `EconomicAssessmentPanelV2`.

## 6. Monte Carlo как вероятностный нестационарный расчёт

Текущее поведение по коду:
- `runThermalMonteCarlo(...)` многократно вызывает `runThermalSimulation(...)`.
- В каждом прогоне применяется новый sampled набор входов.
- Значит Monte Carlo уже реализован как вероятностный запуск нестационарной RC-модели, а не как отдельный статический расчёт.

Что сохраняется сейчас:
- `samples` по входным параметрам
- распределения `peakLoad`, `totalEnergy`, `dailyEnergy`, `annualEnergy`, `discomfort`
- `scenarioSeries.peakLoadKW`
- `scenarioSeries.totalEnergyKWh`
- `scenarioSeries.discomfortHours`
- `scenarioSeries.minimumIndoorTemperatureC`
- `roomRiskSummary` с агрегатами по помещениям

Что не сохраняется сейчас:
- временной ряд температуры по каждому сценарию Monte Carlo
- временной ряд мощности по каждому сценарию Monte Carlo
- percentile bands по времени
- trajectories per scenario

Следствие:
- текущее Monte Carlo уже корректно трактовать как probabilistic transient RC;
- но UI пока может показывать только агрегаты по сценариям, а не fan chart во времени.

## 7. Какие данные уже есть для P10/P50/P90

| Показатель | Есть сейчас | Источник |
| --- | --- | --- |
| P10/P50/P90 по `totalEnergyKWh` | да | `monteCarloResult.totalEnergy` |
| P10/P50/P90 по `peakLoadKW` | да | `monteCarloResult.peakLoad` |
| P10/P50/P90 по `discomfortHours` | да | `monteCarloResult.discomfort` |
| Histogram `totalEnergyKWh` | да | `monteCarloResult.totalEnergy.histogram` |
| Base vs P10/P50/P90 table | да | `baseResult.summary` + `monteCarloResult.*` |
| Sensitivity chart | да | `monteCarloResult.sensitivity` |
| Scatter input vs output | да, можно построить без изменений данных | `monteCarloResult.samples` + `monteCarloResult.scenarioSeries.totalEnergyKWh` |
| Room-level risk | да, в агрегированном виде | `monteCarloResult.roomRiskSummary` |
| P10/P50/P90 по времени | нет | time-series по сценариям не сохраняются |
| Fan chart по времени | нет | нет trajectories/percentilesByTime |

По room-level risk уже есть:
- `temperatureP50C`
- `minimumTemperatureP10C`
- `underheatingRisk`

То есть на уровне помещений уже можно строить risk table и ranking помещений, но ещё нельзя строить room-by-time percentile bands.

## 8. Чего не хватает для fan chart по времени

Сейчас для fan chart не хватает самих временных траекторий Monte Carlo.

Минимально возможные варианты доработки данных в будущем:

### Вариант 1. Сохранять trajectories per scenario

Добавить в Monte Carlo результат, например:
- `scenarioTrajectories[]`
- для каждого прогона:
  - `timeHours[]`
  - `totalHeatingPowerW[]`
  - `rooms[roomId].temperatureC[]`
  - опционально `rooms[roomId].heatingPowerW[]`

Плюсы:
- можно строить любой fan chart потом
- можно делать room-level risk по времени

Минусы:
- самый тяжёлый по памяти

### Вариант 2. Сохранять агрегированные `percentilesByTime`

Добавить только percentiles:
- `totalHeatingPowerPercentilesByTime[] = { timeHours, p10, p50, p90 }`
- `outdoor/temperature` bands для выбранных сущностей
- при необходимости `roomPercentilesByTime[roomId][]`

Плюсы:
- меньше объём
- достаточно для fan chart

Минусы:
- потом нельзя построить произвольные scatter/diagnostics по траекториям

### Минимальный practically safe scope

Если цель только fan chart в `Results`, достаточно:
- `percentilesByTime` для total heating power
- `percentilesByTime` для selected room temperature

Если цель включает room-level risk и дальнейшую аналитику, лучше хранить:
- building-level trajectories
- room-level temperatures per time step хотя бы для top-risk rooms

## 9. Предлагаемая структура единой вкладки «Результаты»

Ниже структура без нового отчёта и без отдельного Monte Carlo export. Экспертные выгрузки остаются в `passport` / export menu.

### 9.1. Обзор

- Использовать существующие компоненты:
  - `EngineeringMetricTile`
  - comparison-table pattern из `MonteCarloResultsSection`
  - room summary из `SpaceList` / `SpaceDetails`
- Данные:
  - `lastThermalResult.summary`
  - `lastThermalResult.diagnostics.building`
  - `monteCarloResult.totalEnergy`, `peakLoad`, `discomfort`
  - `roomRiskSummary`
- Графики:
  - короткая summary-полоска KPI
  - компактный preview долей потерь
  - компактная preview-гистограмма Monte Carlo или summary-chip P10/P50/P90
- Таблицы:
  - Base vs P10/P50/P90 по энергии, пику, дискомфорту
  - Top risky rooms
- Tooltip-формулы:
  - энергия
  - пик
  - дискомфорт
  - P50/P10/P90

### 9.2. Тепловой расчёт

- Использовать существующие компоненты:
  - `ThermalTimeSeriesChart`
  - `BuildingLossChart`
  - `LossShareChart`
  - scenario compare panel из `MetricsResultsTab`
- Данные:
  - `lastThermalResult`
  - `scenarioRunHistory`
  - active thermal options из `buildThermalOptionsFromWorkflow`
- Графики:
  - температура и мощность по времени
  - потери по компонентам
  - доли потерь
  - сравнение прогонов
- Таблицы:
  - ограничения данных / missing fields
  - активные допущения расчёта
- Tooltip-формулы:
  - `E = Σ Q̇_heat · Δt / 3 600 000`
  - `Q_peak = max_t Σ Q̇_heat,z(t)`
  - `Q_inf = ρ · c_p · ACH · V · ΔT / 3600`
  - `Q = U · A · ΔT`

### 9.3. Вероятностный анализ

- Использовать существующие компоненты:
  - `MonteCarloChart`
  - comparison table из `MonteCarloResultsSection`
  - sensitivity `BarChart`
  - risk table
  - room risk table
- Данные:
  - `monteCarloResult`
  - `baseResult`
  - `samples`
  - `scenarioSeries`
  - `roomRiskSummary`
- Графики:
  - histogram `totalEnergyKWh` + P10/P50/P90/Base
  - sensitivity bar chart
  - scatter plot `input -> totalEnergyKWh` на данных `samples + scenarioSeries`
  - fan chart по времени только после добавления trajectories / `percentilesByTime`
- Таблицы:
  - Base vs P10/P50/P90
  - risk matrix
  - room-level risk
- Tooltip-формулы:
  - P10/P50/P90
  - underheating risk
  - sensitivity

### 9.4. Экономика

- Использовать существующие компоненты:
  - `EconomicAssessmentPanelV2` или вынесенную таб-обёртку на его основе
- Данные:
  - `Sp50ComplianceReport`
  - economic scenario controls
- Графики:
  - zone loss distribution
  - payback chart
- Таблицы:
  - ranking мероприятий
  - summary package
  - warnings
- Tooltip-формулы:
  - `T_payback = CAPEX / annualSaving`
  - `NPV = Σ CF_t / (1 + r)^t - CAPEX`
  - annual saving / tariff assumptions
- Важно:
  - не делать здесь новый export;
  - не дублировать экспертные документы.

### 9.5. Помещения

- Использовать существующие компоненты:
  - `SpaceList`
  - `SpaceDetails`
  - `RoomLossStackedChart`
  - `RoomHeatmapMatrix`
  - `RoomScatterPlot`
  - room risk table из Monte Carlo
- Данные:
  - `result.rooms`
  - `result.diagnostics.zones`
  - room temperature stats
  - `roomRiskSummary`
- Графики:
  - stacked losses by room
  - matrix / heatmap
  - anomaly scatter
- Таблицы:
  - deterministic room KPI
  - probabilistic room risk
- Tooltip-формулы:
  - room power
  - room losses
  - min/mean temperature

### 9.6. Карта

- Использовать существующие компоненты:
  - `SpaceViewer3D`
  - `GraphPanel`
- Данные:
  - `simulationFrames`
  - `thermalGraph`
  - selected room
- Графики:
  - 3D heatmap
  - thermal graph
- Таблицы:
  - legend / selected node details
- Tooltip-формулы:
  - что означает цвет на карте
  - что означает граф связей
  - явная пометка «не CFD»

Если нужно вернуть 2D карту:
- брать не новый компонент, а адаптировать существующий build-only `HeatmapPanel`.
- Это отдельная задача после возврата экономики и стабилизации единого Results.

## 10. Tooltip-формулы для показателей

### 10.1. Предлагаемый общий компонент

Предлагаемый единый компонент:
- `FormulaTooltip`
- или `MetricInfoTooltip`

Назначение:
- KPI
- заголовки графиков
- строки таблиц
- labels в risk/sensitivity summary

Предлагаемая структура данных:

```ts
type MetricInfoTooltipData = {
  id: string;
  title: string;
  meaning: string;
  formula: string;
  inputs: Array<{ symbol: string; meaning: string; source: string }>;
  calculatedIn: Array<{ file: string; fn: string }>;
  notes?: string[];
};
```

### 10.2. Базовый набор tooltip-формул

| Показатель | Что означает | Формула | Где считается |
| --- | --- | --- | --- |
| Энергия отопления | Интеграл требуемой отопительной мощности по всем зонам за период расчёта | `E = Σ_t Σ_z Q̇_heat,z(t) · Δt / 3 600 000` | `src/core/thermal/metrics.ts`, `computeSimulationMetrics(...)` |
| Пиковая нагрузка | Максимум одновременной суммы требуемой мощности по зонам | `Q_peak = max_t Σ_z Q̇_heat,z(t)` | `src/core/thermal/metrics.ts`, `computeSimulationMetrics(...)` |
| Часы дискомфорта | Сумма времени, когда температура зоны ниже уставки более чем на 0.05 °C | `H_discomfort = Σ_t Σ_z I(T_z(t) + 0.05 < T_set,z(t)) · Δt / 3600` | `src/core/thermal/metrics.ts`, `computeSimulationMetrics(...)` |
| Инфильтрационные потери | Сенсибельные потери на воздухообмен через инфильтрацию | `Q_inf = ρ · c_p · ACH · V · ΔT / 3600` | `src/core/thermal/formulas.ts`, `infiltrationLoss(...)`; используется в `src/core/thermal/physics.ts` |
| Теплопередача через ограждение | Потери через ограждение при заданном `U`, площади и перепаде температур | `Q = U · A · ΔT` | `src/core/thermal/formulas.ts`, `transmissionLoss(...)` |
| Monte Carlo P50 | Медианное значение по всем сценариям вероятностного расчёта | `P50 = quantile(x, 0.50)` | `src/core/uncertainty/thermalMonteCarlo.ts`, `summarizeDistribution(...)` |
| Monte Carlo P10/P90 | Границы диапазона по выборке сценариев | `P10 = quantile(x, 0.10)`, `P90 = quantile(x, 0.90)` | `src/core/uncertainty/thermalMonteCarlo.ts`, `summarizeDistribution(...)` |
| Sensitivity | Нормированная сила связи входа с `totalEnergyKWh` | `S_i = |corr(x_i, y)| / Σ_j |corr(x_j, y)| · 100%` | `src/core/uncertainty/thermalMonteCarlo.ts`, `buildSensitivityFactors(...)` |
| Окупаемость | Простой срок окупаемости мероприятия | `T_payback = CAPEX / annualSaving` | `src/core/economics/analysis.ts`, `calculateSimplePayback_years(...)` |

### 10.3. Где обязательно ставить tooltips

- KPI-карточки в `Overview`
- заголовки `ThermalTimeSeriesChart`, `BuildingLossChart`, `MonteCarloChart`
- строки таблицы `Base vs P10/P50/P90`
- строки room-level risk
- поля экономики: payback, NPV, annual saving, tariffs

## 11. Рекомендуемый план восстановления визуализации

### Вариант A. Histogram `totalEnergyKWh` + P10/P50/P90/Base

- Данные нужны:
  - `monteCarloResult.totalEnergy.histogram`
  - `monteCarloResult.totalEnergy.p10/p50/p90`
  - `baseResult.summary.totalEnergyKWh`
- Что уже есть:
  - всё уже есть
  - `MonteCarloChart` уже реализует именно этот вариант
- Вывод:
  - это baseline-визуализация, её можно оставлять как основной первый экран Monte Carlo

### Вариант B. Fan chart по времени

- Данные нужны:
  - `P10/P50/P90` по каждому time step
  - для температуры или мощности
- Что есть сейчас:
  - нет
- Что минимально нужно:
  - либо `trajectories per scenario`
  - либо `percentilesByTime`
- Вывод:
  - визуально это самый правильный способ показать Monte Carlo как нестационарный расчёт;
  - но текущих данных для него ещё недостаточно.

### Вариант C. Scatter plot входной фактор -> `totalEnergyKWh`

- Данные нужны:
  - X: sampled input (`outdoorBiasC`, `infiltrationMultiplier`, `setpointOffsetC`, и т.д.)
  - Y: `scenarioSeries.totalEnergyKWh`
- Что есть сейчас:
  - всё уже есть в `samples` + `scenarioSeries.totalEnergyKWh`
- Что можно показать:
  - инфильтрация по X, `totalEnergyKWh` по Y
  - наружная температура по X, `totalEnergyKWh` по Y
  - уставка по X, `totalEnergyKWh` по Y
- Вывод:
  - можно добавить без переписывания solver и без изменения формата результата

### Вариант D. Sensitivity bar chart

- Данные нужны:
  - `monteCarloResult.sensitivity`
- Что есть сейчас:
  - уже есть
- Вывод:
  - это второй обязательный экран после histogram, потому что он объясняет разброс, а не просто показывает его

### Приоритет по Monte Carlo-визуализации

1. Оставить и усилить histogram `totalEnergyKWh` + Base/P10/P50/P90.
2. Оставить sensitivity bar chart.
3. Добавить scatter plot на существующих данных.
4. Fan chart делать только после расширения структуры данных Monte Carlo.

## 12. Рекомендуемый план восстановления раздела «Результаты»

1. Ничего не переписывать в `src/core/thermal/*`, `src/core/uncertainty/*`, `src/core/economics/*`.
2. Перестроить route-level `Results` вокруг шести вкладок:
   - `Обзор`
   - `Тепловой расчёт`
   - `Вероятностный анализ`
   - `Экономика`
   - `Помещения`
   - `Карта`
3. Экономику вернуть первой:
   - через существующий `Sp50ComplianceReport`
   - без нового store результата
   - без нового export
4. Вынести build-only визуализацию в отдельные адаптеры по мере необходимости:
   - сначала экономика
   - затем 2D heatmap
   - затем, если нужно, engineering/static breakdown
5. Monte Carlo трактовать и подписывать только как probabilistic transient RC:
   - без слов про «отдельный статический расчёт»
   - с P10/P50/P90 как главным способом подачи
6. Экспертные отчёты оставить там, где они уже есть:
   - `passport`
   - export menu
   - build-only expertise export
7. Не добавлять новый Monte Carlo report/export, потому что дублирование уже существующего экспертного контура только усилит путаницу.

## 13. Итоговый вывод

- В проекте реально существуют несколько независимых расчётных контуров: RC, engineering/static, SP50, Monte Carlo, transient construction, economics, legacy report path, calibration.
- Новый route-level `Results` сейчас показывает только часть этих контуров: RC, Monte Carlo, карту, room UI и report/passport layer.
- Экономический блок не удалён. Он остался в `/build`, но не подключён к новому `Results`.
- Текущий Monte Carlo уже является вероятностным запуском нестационарного RC solver и уже даёт корректные агрегаты для:
  - P10/P50/P90 по `totalEnergyKWh`
  - P10/P50/P90 по `peakLoadKW`
  - P10/P50/P90 по `discomfortHours`
  - histogram `totalEnergyKWh`
  - sensitivity chart
  - room-level risk table
- Для fan chart по времени данных пока не хватает: нужно сохранять trajectories per scenario или хотя бы `percentilesByTime`.
- Правильный следующий шаг перед дальнейшей визуализацией:
  - восстановить единый `Results` с отдельной вкладкой `Экономика`
  - не трогая расчётный код
  - не дублируя существующие экспертные отчёты
  - и не вводя новый Monte Carlo export.
