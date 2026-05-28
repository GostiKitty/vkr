# Аудит вкладки «Студия»

## 1. Текущий маршрут и главный компонент

- Главный route вкладки `Студия` описан в `apps/desktop/src/app/routes.tsx`.
- Route:
  - `id: "studio"`
  - `path: "/"`
  - `component: TwinPage`
- Главный компонент: `apps/desktop/src/features/twin/TwinPage.tsx`.
- Внутри `TwinPage` нет вложенного роутера. Переключение разделов `Геометрия -> Ограждения -> Сценарий -> Расчёт -> Неопределённости -> Результаты` делается через `useWorkflowStore.currentStep`.
- Порядок шагов задаёт `workflowOrder` из `apps/desktop/src/entities/workflow/workflow.store.ts`.

Дополнительно важно:

- `apps/desktop/src/app/App.tsx` всегда рендерит вокруг текущего route:
  - `TopBar`
  - `EngineConfigBanner`
  - `NotificationPanel`
  - `FormulaDrawer`
  - `DebugConsole`
  - `ReportExportListener`
- Поэтому визуально и поведенчески `Студия` зависит не только от `TwinPage`, но и от глобальных компонентов, которые не находятся внутри него.

### Все `navigate(...)`, влияющие на текущую вкладку

| Файл | Откуда вызывается | Куда ведёт | Что это значит для миграции |
| --- | --- | --- | --- |
| `apps/desktop/src/features/twin/TwinPage.tsx` | `Открыть в конструкторе` | `/build` | Геометрия из Twin переводится в Build Mode через `buildModelFromTwin`. |
| `apps/desktop/src/features/twin/TwinPage.tsx` | `Открыть демонстрационный дом` | `/build` | Демо-дом загружается сразу в Build Mode, а не остаётся внутри `TwinPage`. |
| `apps/desktop/src/features/model/ModelPage.tsx` | после IFC-импорта | `/` | Импорт возвращает пользователя в `Студию`. |
| `apps/desktop/src/features/model/QuickImportButton.tsx` | после быстрого IFC-импорта | `/` | Быстрый импорт тоже возвращает в `Студию`. |
| `apps/desktop/src/app/TopBar.tsx` | переключение workspace modes и project commands | `/build` | Верхняя панель до сих пор считает `/build` основной рабочей средой. |
| `apps/desktop/src/app/TopBar.tsx` | кнопка `Формулы и допущения` | `/formulas` | Формульный экран отдельный route. |
| `apps/desktop/src/app/TopBar.tsx` | кнопка `Настройки` | `/settings` | Настройки отдельный route. |
| `apps/desktop/src/app/EngineConfigBanner.tsx` | баннер движка | `/settings` | Ошибки движка уводят в глобальные настройки. |
| `apps/desktop/src/features/model/ModelPage.tsx` | кнопка `Открыть настройки` | `/settings` | IFC-импорт зависит от настроек движка. |
| `apps/desktop/src/features/formulas/components/FormulaHint.tsx` | inline formula hints | `/formulas#formula-...` | Часть инженерных подсказок уводит с `Студии` на отдельный route. |

### Вывод по маршрутизации

- На сегодня `Студия` — это один route `/` и одна большая state-machine на `currentStep`, а не набор отдельных routes.
- Одновременно существует второй крупный рабочий контур `/build`, куда уже ведут ключевые CTA и верхняя панель.
- При переносе на новые верхнеуровневые разделы основной риск не в JSX-раскладке, а в том, что сейчас шаги живут в store, а не в URL.

## 2. Карта интерфейса TwinPage

### Общая структура

`TwinPage` собирает интерфейс из:

- route-level header с номером шага, названием, описанием, loading/error и project chip;
- условного блока быстрого старта с демо-домом;
- условного блока ручного подключения engine-проекта по ID;
- общего diagnostics/checklist banner для текущего шага;
- step content, зависящего от `useWorkflowStore.currentStep`;
- footer-навигации `Назад / Далее`.

### Карта блоков

| Блок в UI | Компонент | Файл | Что делает | Что читает | Что изменяет | Stores | Кнопки/действия | Переходы |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Заголовок шага | `TwinPage` | `apps/desktop/src/features/twin/TwinPage.tsx` | Показывает текущий шаг, описание, loading/error, текущий проект | `workflow.currentStep`, `useTwin(...).loading/error`, `project.projectId`, `project.projectKind` | ничего | `useWorkflowStore`, `useProjectStore`, `useTwinStore` через `useTwin` | нет | нет |
| Project chip | `TwinPage` | тот же файл | Показывает label текущего проекта или demo-дома | `project.projectId`, `build.model`, `isVideoDemoProjectModel(...)` | ничего | `useProjectStore`, `useBuildStore` | нет | нет |
| Быстрый старт / демо-дом | inline block в `TwinPage` | тот же файл | Предлагает открыть заранее подготовленный demo model | `twin`, `build.model.rooms/walls/roofs/floorSlabs`, `project.projectId` | `project.setProjectId`, `build.setProjectKey`, `build.loadModelSnapshot`, `workflow.setCurrentStep` | `useProjectStore`, `useBuildStore`, `useWorkflowStore` | `Открыть демонстрационный дом` | `navigate("/build")` |
| Ввод ID проекта | engine project form внутри `TwinPage` | тот же файл | Позволяет вручную ввести `projectId` для engine-проекта | local state `projectIdInput`, `loading`, `project.projectKind` | `project.setProjectId(trimmed, "engine")` или `null/"local"` | `useProjectStore`, `useTwinStore` через `useTwin` | `Применить` | прямого route-change нет |
| Diagnostics banner | inline checklist banner | тот же файл | Показывает missing items для текущего шага | `evaluateWorkflowDiagnostics(...)`, `currentStep`, `scenarioConfig`, `uncertaintyConfig`, `solveCompleted`, `simulationFrames`, `twin`, `buildModel` | косвенно может принудительно вернуть на первый blocking step | `useWorkflowStore`, `useTwinStore`, `useBuildStore` | нет | нет |
| Геометрия: быстрый импорт | `QuickImportButton` | `apps/desktop/src/features/model/QuickImportButton.tsx` | Shortcut IFC-импорта в engine | `engine.baseUrl`, internal import state | `project.setProjectId` после успешного импорта | `useProjectStore`, `useEngineSettingsStore` | выбор файла, импорт | `navigate("/")` |
| Геометрия: импорт IFC с историей | `ModelPage` | `apps/desktop/src/features/model/ModelPage.tsx` | Полный IFC import UI: выбор файла, название проекта, прогресс, история, debug drawer | import state, engine URL, last result/history/debugInfo | `project.setProjectId` после успешного импорта | `useProjectStore`, `useEngineSettingsStore` | `Импортировать IFC`, `Сбросить выбор`, `Отладка запроса`, `Открыть настройки` | `navigate("/")`, `navigate("/settings")` |
| Геометрия: импортированная геометрия | `SpaceList` внутри панели `TwinPage` | `apps/desktop/src/features/twin/SpaceList.tsx` | Список помещений из `twin.spaces`, фильтр/сортировка, выбор текущего помещения | `twin.spaces`, `selectedSpaceId`, `simulationFrames`, `timeIndex`, `loading` | `twin.selectSpace(...)` | `useTwinStore` | поиск, сортировка по площади, выбор помещения | нет |
| Геометрия: empty state | `EmptyState` | shared UI | Появляется, если `twin` отсутствует | `twin` | ничего | нет прямого store | нет | нет |
| Геометрия: `Открыть в конструкторе` | handler внутри `TwinPage` | `TwinPage.tsx` + `build/import/fromTwin.ts` | Конвертирует `Twin` в редактируемую `BuildingModel` | `twin`, `project.projectId` | `build.loadModelSnapshot`, `project.setProjectId(...)` | `useBuildStore`, `useProjectStore` | `Открыть в конструкторе` | `navigate("/build")` |
| Ограждения: статус engine-данных | `EnvelopeStatusPanel` | локальный компонент в `TwinPage.tsx` | Показывает наличие envelope из Twin | `twin.envelope.length` | ничего | входные props из `TwinPage` | нет | нет |
| Ограждения: статус локальной модели | `EnvelopeStatusPanel` | тот же файл | Показывает число локальных стен, готовность материалов и thermal graph | `build.model.walls`, `wallsWithoutAssembly`, `thermalGraph` | ничего | `useBuildStore`, `useTwinStore` через props | нет | нет |
| Ограждения: empty state | `EmptyState` | shared UI | Появляется при отсутствии `twin.envelope` | `twin.envelope` | ничего | нет прямого store | нет | нет |
| Сценарий | `ScenarioSetupPanel` | `apps/desktop/src/features/scenarios/ScenarioSetupPanel.tsx` | Настройка климата, уставок, внутренних теплопоступлений, занятости, вентиляции | `workflow.scenarioConfig` | `workflow.setScenarioConfig(...)` | `useWorkflowStore` | `Сохранить сценарий` | нет |
| Расчёт | `SimulationPanel` | `apps/desktop/src/features/runs/SimulationPanel.tsx` | Локальный RC-расчёт и отдельный engine-run UI | `build.model`, `workflow.scenarioConfig`, `projectId`, `projectKind` | local run пишет в `useTwinStore` через `syncBuildSimulationToStudio`; engine run пишет только в local state панели; плюс `workflow.pushScenarioRunSnapshot(...)`, `TwinPage.markSolveCompleted(true)` | `useBuildStore`, `useWorkflowStore`, `useTwinStore` косвенно | `Запустить расчёт`, `Запросить расчёт на движке` | нет |
| Неопределённости | `UncertaintyPanel` | `apps/desktop/src/features/scenarios/UncertaintyPanel.tsx` | Настройка Monte Carlo и запуск вероятностного анализа | `workflow.uncertaintyConfig`, `workflow.scenarioConfig`, `build.model` | `workflow.setUncertaintyConfig(...)`, `workflow.setMonteCarloResult(...)`, `workflow.setCurrentStep("results")` | `useWorkflowStore`, `useBuildStore` | `Сбросить к умолчанию`, `Сохранить настройки`, `Запустить Monte Carlo` | route-change нет, переключает только `currentStep` |
| Результаты: wrapper | `ResultsPanel` | `apps/desktop/src/features/reports/ResultsPanel.tsx` | Главный экран результатов после расчёта | `simulationFrames`, `thermalGraph`, `lastThermalResult`, `simulationDataSource`, `build.model`, `workflow.scenarioConfig`, `workflow.monteCarloResult`, `workspace.command` | `twin.setTimeIndex`, `twin.selectSpace`, `workflow.setCurrentStep`, `workspace.consumeProjectCommand` | `useTwinStore`, `useBuildStore`, `useWorkflowStore`, `useWorkspaceStore` | таймлайн, play/pause, tab-switching, `Показать на модели`, `Открыть вероятностный анализ`, `Настроить Monte Carlo` | внутри `TwinPage` route не меняется |
| Результаты: вкладка `Помещения` | `SpaceList` + `SpaceDetails` | `apps/desktop/src/features/twin/SpaceList.tsx`, `SpaceDetails.tsx` | Список помещений и карточка выбранного помещения | `twin.spaces`, `selectedSpaceId`, `simulationFrames`, `timeIndex` | `twin.selectSpace(...)` | `useTwinStore` | поиск, сортировка, выбор помещения | нет |
| Результаты: вкладка `Показатели` | `MetricsResultsTab` | `apps/desktop/src/features/reports/MetricsResultsTab.tsx` | KPI, графики, breakdown, compare runs, embedded 3D, active assumptions | `twin.lastThermalResult`, `twin.simulationDataSource`, `workflow.scenarioConfig`, `workflow.uncertaintyConfig`, `workflow.monteCarloResult`, `workflow.scenarioRunHistory` | `twin.selectSpace(...)`, callback `onRecalculate`, callback `onEditUncertainty` | `useTwinStore`, `useWorkflowStore` | `Перейти к настройке Monte Carlo`, `Пересчитать`, room view tabs | не меняет route |
| Результаты: вкладка `Вероятностный анализ` | `MonteCarloResultsSection` | `apps/desktop/src/features/reports/MonteCarloResultsSection.tsx` | Показывает Monte Carlo summary, risk matrix, sensitivity, room risk, markdown export | `workflow.monteCarloResult`, `twin.lastThermalResult`, `build.model`, `scenarioConfig -> options` | только local UI state и markdown download | `useWorkflowStore` и props из `ResultsPanel` | `Сформировать отчёт`, `Изменить вручную`, `Открыть шаг неопределённости` | не меняет route |
| Результаты: вкладка `Карта и связи` | `SpaceViewer3D` + `GraphPanel` | `apps/desktop/src/features/twin/SpaceViewer3D.tsx`, локальный `GraphPanel` в `ResultsPanel.tsx` | 3D температура по зонам и граф тепловых связей | `spaceInstances`, `simulationFrames`, `timeIndex`, `selectedSpaceId`, `thermalGraph` | `twin.selectSpace(...)`, `twin.setTimeIndex(...)` | `useTwinStore` | fit camera, slider, click on space/node | не меняет route |
| Результаты: вкладка `Справка по ПП РФ №87` | `ProjectDocumentationPage` | `apps/desktop/src/features/reports/ProjectDocumentationPage.tsx` | Документный/экспортный экран с readiness, completeness, inputs panel, print/PDF | `build.model`, `build.projectKey`, `twin.lastThermalResult`, `workflow.scenarioConfig`, `workflow.monteCarloResult`, `workspace.applyDemoDefaults`, report meta, expertise inputs | `workspace.dispatchProjectCommand(...)`, `useExpertiseInputsStore` mutations | `useBuildStore`, `useTwinStore`, `useWorkflowStore`, `useWorkspaceStore`, `useExpertiseInputsStore` | `Исходные данные для экспертизы`, `Проверить комплектность`, `Скачать выбранный документ`, `Скачать комплект документов`, `Печать / PDF` | route не меняется |
| Legacy PDF ниже вкладок результатов | `ReportGenerator` | `apps/desktop/src/features/reports/ReportGenerator.tsx` | Генерирует отдельный legacy PDF по Twin API | `twin`, `simulationFrames`, `workflow.uncertaintyConfig` | только local status/message и download | `useTwinStore`, `useWorkflowStore` | `Сформировать legacy PDF` | route не меняется |
| Нижняя навигация шагов | footer в `TwinPage` | `TwinPage.tsx` | Назад/Далее между шагами `currentStep` | `workflow.currentStep`, `workflowOrder`, diagnostics | `workflow.setCurrentStep(...)` | `useWorkflowStore` | `Назад`, `Далее`, disabled `Все шаги пройдены` | route не меняется |
| Disabled tooltip для `Далее` | `Tooltip` | shared UI | Показывает причины блокировки следующего шага | `nextBlockingReasons` | ничего | нет прямого store | hover | нет |

### Отдельно по requested special checks

- Ввод ID проекта:
  - есть в `TwinPage`, но показывается только при `projectKind === "engine"`;
  - из чистого локального состояния форма скрыта.
- Загрузка проекта:
  - фактически происходит через `setProjectId(...)` + `useTwin(...)` + `fetchTwin(...)`;
  - после загрузки `useTwin` строит `spaceInstances`, `thermalGraph` и demo frames.
- Демо-дом:
  - есть в `TwinPage` и отдельно дублируется в `/build` через `TopBar -> open-demo`.
- Сводка здания:
  - отдельного блока `Сводка здания` внутри `TwinPage` сейчас нет;
  - ближайшие аналоги: project chip в header и документные summary внутри `ProjectDocumentationPage`/паспортов.
- Workflow steps:
  - реализованы через `currentStep`, а не через route.
- Геометрия:
  - `QuickImportButton`, `ModelPage`, `SpaceList`, `Открыть в конструкторе`.
- Ограждения:
  - `EnvelopeStatusPanel`.
- Сценарий:
  - `ScenarioSetupPanel`.
- Расчёт:
  - `SimulationPanel`.
- Неопределённости:
  - `UncertaintyPanel`.
- Результаты:
  - `ResultsPanel` с 5 внутренними вкладками и отдельным `ReportGenerator` ниже.
- Кнопка `Открыть в конструкторе`:
  - конвертирует `Twin -> BuildingModel -> /build`.
- Кнопка `Открыть демонстрационный дом`:
  - загружает локальную demo model и уводит в `/build`.
- Кнопки `Назад / Далее`:
  - только меняют `workflow.currentStep`.
- Предупреждения / diagnostics:
  - централизованы через `evaluateWorkflowDiagnostics(...)` и `SimulationPanel.result.diagnostics`.
- Empty states:
  - есть в геометрии, ограждениях, списке помещений, деталях помещения, 3D viewer, Results/MonteCarlo tabs и legacy report.

## 3. Используемые компоненты

### Компоненты, входящие в `TwinPage` напрямую

- `ModelPage`
  - Файл: `apps/desktop/src/features/model/ModelPage.tsx`
  - Роль: большой IFC-import экран с названием проекта, прогрессом, историей попыток и debug drawer.
  - Читает: engine URL, import history/state.
  - Пишет: `useProjectStore.setProjectId(...)`.
  - Переходы: после успешного импорта делает `navigate("/")`, из ошибки настройки ведёт в `/settings`.
  - Важное наблюдение: по названию выглядит как экран модели, но фактически это проектный intake в engine.

- `QuickImportButton`
  - Файл: `apps/desktop/src/features/model/QuickImportButton.tsx`
  - Роль: компактный shortcut к IFC-импорту.
  - Читает: engine URL, import progress.
  - Пишет: `useProjectStore.setProjectId(...)`.
  - Переходы: `navigate("/")` после успешного импорта.

- `SimulationPanel`
  - Файл: `apps/desktop/src/features/runs/SimulationPanel.tsx`
  - Роль: расчётный шаг Studio.
  - Читает: `build.model`, `workflow.scenarioConfig`, `projectId`, `projectKind`.
  - Пишет:
    - local path: через `syncBuildSimulationToStudio(...)` обновляет `useTwinStore.simulationFrames`, `thermalGraph`, `lastThermalResult`, `simulationDataSource`, `twin`, `spaceInstances`;
    - workflow: `pushScenarioRunSnapshot(...)`;
    - parent callback: `markSolveCompleted(true)`.
  - Важное наблюдение: server/engine run хранится только во внутреннем state панели и не попадает в `ResultsPanel`.

- `ResultsPanel`
  - Файл: `apps/desktop/src/features/reports/ResultsPanel.tsx`
  - Роль: единый results shell Studio.
  - Читает: `useTwinStore`, `useBuildStore.model`, `workflow.scenarioConfig`, `workflow.monteCarloResult`, `workspace.command`.
  - Пишет: `useTwinStore.setTimeIndex/selectSpace`, `useWorkflowStore.setCurrentStep`, `useWorkspaceStore.consumeProjectCommand`.
  - Внутренние подэкраны: `SpaceList`, `SpaceDetails`, `MetricsResultsTab`, `MonteCarloResultsSection`, `SpaceViewer3D`, `ProjectDocumentationPage`, `ReportGenerator`.

- `UncertaintyPanel`
  - Файл: `apps/desktop/src/features/scenarios/UncertaintyPanel.tsx`
  - Роль: настройка и запуск Monte Carlo на шаге Studio.
  - Читает: `build.model`, `workflow.scenarioConfig`, `workflow.uncertaintyConfig`.
  - Пишет: `workflow.setUncertaintyConfig(...)`, `workflow.setMonteCarloResult(...)`, `workflow.setCurrentStep("results")`.
  - Важное наблюдение: не пишет базовый deterministic result в `useTwinStore.lastThermalResult`.

- `ScenarioSetupPanel`
  - Файл: `apps/desktop/src/features/scenarios/ScenarioSetupPanel.tsx`
  - Роль: настройка climate/setpoints/gains/occupancy/ventilation.
  - Читает: `workflow.scenarioConfig`.
  - Пишет: `workflow.setScenarioConfig(...)`.

- `SpaceList`
  - Файл: `apps/desktop/src/features/twin/SpaceList.tsx`
  - Роль: список помещений, используется и в геометрии, и в результатах.
  - Читает: `twin.spaces`, `selectedSpaceId`, `simulationFrames`, `timeIndex`, `loading`.
  - Пишет: `twin.selectSpace(...)`.

- `EmptyState`
  - shared UI, используется как fallback в геометрии и ограждениях.

- `Tooltip`
  - shared UI, используется для disabled `Далее`.

### Дочерние компоненты результатов, важные для переноса

- `SpaceDetails`
  - Файл: `apps/desktop/src/features/twin/SpaceDetails.tsx`
  - Роль: карточка выбранного помещения.
  - Читает: `selectedSpaceId`, `twin`, `simulationFrames`, `timeIndex`, `loading`.
  - Ничего не пишет.

- `SpaceViewer3D`
  - Файл: `apps/desktop/src/features/twin/SpaceViewer3D.tsx`
  - Роль: 3D визуализация зон и температур.
  - Читает: `spaceInstances`, `selectedSpaceId`, `simulationFrames`, `timeIndex`.
  - Пишет: `selectSpace(...)`, `setTimeIndex(...)`.
  - Участвует минимум в двух местах:
    - `ResultsPanel` вкладка `Карта и связи`;
    - `MetricsResultsTab` встроенный 3D-блок.

- `MetricsResultsTab`
  - Файл: `apps/desktop/src/features/reports/MetricsResultsTab.tsx`
  - Роль: KPI, charts, breakdown, compare runs, active assumptions.
  - Читает: `useTwinStore.lastThermalResult`, `useTwinStore.simulationDataSource`, `workflow.scenarioConfig`, `workflow.uncertaintyConfig`, `workflow.monteCarloResult`, `workflow.scenarioRunHistory`.
  - Пишет: только `selectSpace(...)` и callback-навигацию обратно на шаги.

- `MonteCarloResultsSection`
  - Файл: `apps/desktop/src/features/reports/MonteCarloResultsSection.tsx`
  - Роль: новый инженерный экран Monte Carlo.
  - Требует одновременно:
    - `workflow.monteCarloResult`;
    - `useTwinStore.lastThermalResult`;
    - `build.model`.
  - Важное наблюдение: без базового RC-result показывает empty state, даже если Monte Carlo уже рассчитан.

- `ProjectDocumentationPage`
  - Файл: `apps/desktop/src/features/reports/ProjectDocumentationPage.tsx`
  - Роль: документный экран с комплектностью, формами экспертизы, print/PDF и export commands.
  - Читает:
    - `build.model`, `build.projectKey`;
    - `useTwinStore.lastThermalResult`;
    - `workflow.scenarioConfig`, `workflow.monteCarloResult`;
    - `workspace.applyDemoDefaults`;
    - report meta / expertise inputs по `projectKey`.
  - Пишет:
    - `workspace.dispatchProjectCommand(...)`;
    - `useExpertiseInputsStore`.

- `ReportGenerator`
  - Файл: `apps/desktop/src/features/reports/ReportGenerator.tsx`
  - Роль: отдельный legacy PDF на Twin API.
  - Читает: `twin`, `simulationFrames`, `workflow.uncertaintyConfig`.
  - Не связан с export-комплектом для экспертизы.
  - Важное наблюдение: это отдельный, устаревший контур отчёта, который уже дублирует `ProjectDocumentationPage` и `ReportExportListener`.

### Глобальные компоненты, видимые поверх `Студии`

- `EngineConfigBanner`
  - Файл: `apps/desktop/src/app/EngineConfigBanner.tsx`
  - Видимость: глобально над любым route, в том числе над `Студией`.
  - Читает: `useEngineSettingsStore.baseUrl`, `probeEngineHealth()`.
  - Переходы: `navigate("/settings")`.
  - Влияние: меняет UX расчёта/импорта, но не принадлежит `TwinPage`.

- `DebugConsole`
  - Файл: `apps/desktop/src/features/debug/DebugConsole.tsx`
  - Видимость: глобальный drawer.
  - Читает: `useDebugConsoleStore`, `useNetworkLogStore`, `useProjectStore`.
  - Пишет: `clear()` network log, `close()`.
  - Влияние: помогает отлаживать import/fetch flows, но логически не относится к будущим разделам.

- `FormulaDrawer`
  - Файл: `apps/desktop/src/features/formulas/FormulaDrawer.tsx`
  - Видимость: глобальный drawer.
  - Читает: `useFormulaDrawerStore`, formula registry.
  - Пишет: `togglePin`, `close`, `focus`.
  - Влияние: доступен из `FormulaHint`/`Tooltip` на экранах расчёта и результатов.

## 4. Используемые stores и состояние

### `useProjectStore`

Файл: `apps/desktop/src/entities/project/project.store.ts`

Фактические поля:

- `projectId: string | null`
- `projectKind: "local" | "engine"`
- `setProjectId(projectId, kind?)`
- `clearProjectId()`

Что важно:

- persist в `localStorage` ключом `twinstudio.project`;
- `projectKind` влияет на видимость engine project form в `TwinPage`;
- `projectKind` также переключает поведение `useTwin(...)` и `SimulationPanel`.

### `useTwinStore`

Файл: `apps/desktop/src/entities/twin/twin.store.ts`

Фактические поля:

- `twin`
- `selectedSpaceId`
- `loading`
- `error`
- `spaceInstances`
- `thermalGraph`
- `simulationFrames`
- `timeIndex`
- `lastThermalResult`
- `simulationDataSource`
- setters: `setTwin`, `selectSpace`, `setSpaceInstances`, `setThermalGraph`, `setSimulationFrames`, `setSimulationResult`, `setTimeIndex`, `clearSimulation`, `reset`

Сравнение с requested audit points:

- `twin`: есть
- `thermalGraph`: есть
- `simulationFrames`: есть
- `selectedSpaceId`: есть
- `timeIndex`: есть
- `Monte Carlo result`: нет, в `useTwinStore` не хранится
- Дополнительно есть:
  - `lastThermalResult`
  - `simulationDataSource`
  - `spaceInstances`
  - `loading/error`

Что важно:

- deterministic результат Studio хранится не в `workflow`, а в `useTwinStore.lastThermalResult`;
- `ResultsPanel` и `MonteCarloResultsSection` завязаны именно на `lastThermalResult`;
- `clearSimulation()` сбрасывает граф, кадры, timeIndex, lastThermalResult и source.

### `useBuildStore`

Файл: `apps/desktop/src/features/build/build.store.ts`

Для текущего аудита критичны поля:

- `projectKey`
- `model`
- `loadModelSnapshot(model)`
- `setProjectKey(key)`
- `saveSnapshot()`
- `restoreSnapshot()`
- `resetModel()`
- огромный набор редакторских mutation methods по rooms/walls/roofs/floorSlabs/doors/windows/pipes/ducts/equipment/sensors/scenarios/events

Сравнение с requested audit points:

- `model`: есть
- `loadModelSnapshot`: есть
- `setProjectKey`: есть
- Дополнительно:
  - `projectKey`
  - `hasSnapshot`
  - `history/future`
  - `roomProblems`, `roomLoops`

Что важно:

- основной persist идёт в `localStorage` под префиксом `twinstudio.build.${projectKey}`;
- snapshot — отдельный ключ `twinstudio.build.${projectKey}.snapshot`;
- `setProjectKey(...)` не просто меняет label: он подгружает новый persisted state и фактически заменяет текущую model;
- перенос route-структуры не должен менять способ вычисления `projectKey`.

### `useWorkflowStore`

Файл: `apps/desktop/src/entities/workflow/workflow.store.ts`

Фактические поля:

- `currentStep`
- `scenarioConfig`
- `uncertaintyConfig`
- `solveCompleted`
- `monteCarloResult`
- `scenarioRunHistory`
- `setCurrentStep(...)`
- `setScenarioConfig(...)`
- `setUncertaintyConfig(...)`
- `markSolveCompleted(...)`
- `setMonteCarloResult(...)`
- `pushScenarioRunSnapshot(...)`
- `resetWorkflow()`

Сравнение с requested audit points:

- `currentStep`: есть
- `scenarioConfig`: есть
- `uncertaintyConfig`: есть
- `solveCompleted`: есть
- `monteCarloResult`: есть
- `setMonteCarloResult`: есть
- `setCurrentStep`: есть
- `resetWorkflow`: есть
- `markSolveCompleted`: есть
- Дополнительно:
  - `scenarioRunHistory`

Что важно:

- store не имеет собственного persist;
- `resetWorkflow()` сбрасывает:
  - `currentStep -> "geometry"`
  - `scenarioConfig -> null`
  - `uncertaintyConfig -> null`
  - `solveCompleted -> false`
  - `monteCarloResult -> null`
  - `scenarioRunHistory -> []`
- `TwinPage` вызывает `resetWorkflow()` на каждом изменении `storedProjectId`.

### Дополнительные persist/state слои, которые нельзя игнорировать

- `useWorkspaceStore`
  - Файл: `apps/desktop/src/entities/workspace/workspace.store.ts`
  - Поля: `mode`, `command`, `commandNonce`, `applyDemoDefaults`
  - Зачем важно: export/menu actions проходят не через route, а через command bus.

- `useSnapshots(projectKey)`
  - Файл: `apps/desktop/src/features/build/snapshots/useSnapshots.ts`
  - Persist: `twinstudio.snapshots.${projectKey}`
  - Хранит snapshots вида и snapshots проекта.

- `thermalPanelPersistence`
  - Файл: `apps/desktop/src/features/build/thermal/thermalPanelPersistence.ts`
  - Persist: `build.thermal-panel.${projectKey}`
  - Хранит отдельный results state Build Mode (`ThermalSimulationPanel`).

- `reportMetaPersistence`
  - Файл: `apps/desktop/src/features/build/reports/reportMetaPersistence.ts`
  - Persist: `twin-desktop.expertise-report-meta:${projectKey}`

- `useExpertiseInputsStore`
  - Файл: `apps/desktop/src/features/reports/exports/store/expertiseInputs.store.ts`
  - Persist: `twin-desktop.expertise-report-inputs:${projectKey}`
  - Хранит форму исходных данных для экспертных выгрузок.

## 5. Цепочки данных

### А. Загрузка проекта по ID

Фактическая цепочка:

1. Пользователь вводит ID в form внутри `TwinPage`.
2. `handleSubmit` вызывает `useProjectStore.setProjectId(trimmed, "engine")`.
3. Срабатывают эффекты `TwinPage`:
   - `setProjectKey(storedProjectId ?? "local-project")`
   - `resetWorkflow()`
   - `clearSimulation()`
4. `useTwin(storedProjectId, projectKind)` видит `projectKind === "engine"` и:
   - проверяет `engine.baseUrl`;
   - делает `fetchTwin(projectId)`;
   - на success вызывает `setTwin(data)`, `clearSimulation()`, `setError(null)`, `setLoading(false)`.
5. Второй эффект `useTwin` строит demo-представление по `twin`:
   - `buildSpaceInstances(...)`
   - `buildThermalGraph(...)`
   - `simulateThermalGraph(...)`
   - `setSimulationResult({ source: "demo" })`
6. UI получает:
   - project chip в header;
   - `SpaceList` на шаге `Геометрия`;
   - envelope counts на шаге `Ограждения`;
   - demo frames/results source на шаге `Результаты`.

Ограничение:

- отдельного блока `сводка здания` здесь нет;
- ручная форма видна только при `projectKind === "engine"`, то есть из чистого локального состояния она скрыта.

### Б. Открытие демо-дома

Цепочка в `TwinPage`:

1. Кнопка `Открыть демонстрационный дом`.
2. `handleOpenVideoDemo()`:
   - при необходимости показывает `window.confirm(...)`;
   - вызывает `buildVideoDemoProjectModel()`;
   - `setProjectId(VIDEO_DEMO_PROJECT_ID, "local")`;
   - `setProjectKey(VIDEO_DEMO_PROJECT_ID)`;
   - `loadModelSnapshot(demoModel)`;
   - `setCurrentStep("geometry")`.
3. Затем `navigate("/build")`.

Дублирующий путь:

- верхняя панель `TopBar -> open-demo` в `/build` вызывает почти тот же сценарий через `BuildPage.handleOpenDemoProject()`.

### В. Открытие модели в конструкторе

Цепочка:

1. Кнопка `Открыть в конструкторе` на шаге `Геометрия`.
2. `handleOpenInBuild()` в `TwinPage`:
   - `buildModelFromTwin(twin, storedProjectId ?? null)`;
   - `loadModelSnapshot(editableModel)`;
   - `setProjectId(storedProjectId ?? localTimestamp, storedProjectId ? "engine" : "local")`;
3. `navigate("/build")`.

Дополнительно:

- в `BuildPage` есть авто-импорт Twin в локальную model для engine-проектов:
  - если `projectKind === "engine"` и есть `twin`, а локальная geometry ещё не подготовлена;
  - `BuildPage` сам вызывает `buildModelFromTwin(...)` и `loadModelSnapshot(...)`.

### Г. Настройка сценария

Цепочка:

1. `ScenarioSetupPanel` держит локальный form state.
2. При submit вызывает `workflow.setScenarioConfig(...)`.
3. `SimulationPanel` читает `workflow.scenarioConfig` и строит:
   - `buildThermalOptionsFromWorkflow(scenarioConfig)`
   - `applyScenarioToBuilding(buildModel, scenarioConfig)`
4. Те же `scenarioConfig` далее читают:
   - `UncertaintyPanel`
   - `ResultsPanel`
   - `MetricsResultsTab`
   - `ProjectDocumentationPage`
   - export/report generators

### Д. Базовый расчёт

#### Локальный path

1. `SimulationPanel.handleRunLocal()`.
2. Строит `adjacency = buildAdjacencyGraph(buildModel)`.
3. Строит `modelForSim = applyScenarioToBuilding(buildModel, scenarioConfig)`.
4. Запускает `runThermalSimulation(modelForSim, simulationOptions, adjacency)`.
5. Вызывает `syncBuildSimulationToStudio(modelForSim, simulation, adjacency)`.
6. `syncBuildSimulationToStudio(...)` пишет в `useTwinStore`:
   - `setSimulationResult({ frames, graph, result, source: "computed" })`
   - `setTwin(buildModelToTwin(modelForSim))`
   - `setSpaceInstances(...)`
7. `SimulationPanel` дополнительно пишет `workflow.pushScenarioRunSnapshot(...)`.
8. Через callback `onSolveComplete` `TwinPage` вызывает `markSolveCompleted(true)`.
9. `ResultsPanel` начинает видеть:
   - `simulationFrames`
   - `thermalGraph`
   - `lastThermalResult`
   - `simulationDataSource = "computed"`.

#### Engine/server path

1. `SimulationPanel.handleRunEngine()`.
2. Вызывает `runEngineSimulation(projectId)`.
3. Ответ кладётся только во внутренний state `engineResult` самой панели.
4. При наличии metrics строится `fallbackSummary`, который идёт только в callback `onSolveComplete`.
5. `TwinPage` вызывает `markSolveCompleted(true)`.

Критичное ограничение:

- server result не записывается в `useTwinStore.lastThermalResult`;
- server result не попадает в `simulationFrames` / `thermalGraph`;
- после ухода со шага `Расчёт` `ResultsPanel` не умеет показать этот engine result как основной results source.

### Е. Monte Carlo

Цепочка Studio:

1. `UncertaintyPanel` читает `build.model` и `workflow.scenarioConfig`.
2. `handleRunMonteCarlo()`:
   - `buildAdjacencyGraph(buildModel)`
   - `buildThermalOptionsFromWorkflow(scenarioConfig)`
   - `runThermalMonteCarlo(...)`
3. Затем пишет:
   - `workflow.setMonteCarloResult(result)`
   - `workflow.setUncertaintyConfig({ runs, evaluationMode })`
   - `workflow.setCurrentStep("results")`
4. `ResultsPanel` автоматически открывает вкладку `probabilistic`, если `monteCarloResult` появился.

Критичное ограничение:

- `UncertaintyPanel` не обновляет `useTwinStore.lastThermalResult`;
- `MonteCarloResultsSection` требует и `monteCarloResult`, и базовый `lastThermalResult`;
- поэтому Monte Carlo может быть рассчитан, но results screen всё равно покажет empty state для probabilistic comparison.

Дублирующий path вне Studio:

- в `/build` существует отдельный `ThermalMonteCarloPanel`, который не пишет в `workflow.monteCarloResult`.

### Ж. Результаты

Фактическая агрегация данных в `ResultsPanel`:

- `simulationFrames` + `timeIndex` -> time slider, `SpaceList`, `SpaceDetails`, `SpaceViewer3D`
- `thermalGraph` -> `GraphPanel`
- `lastThermalResult` -> `MetricsResultsTab`, `MonteCarloResultsSection`, `ProjectDocumentationPage`
- `monteCarloResult` -> probabilistic tab, document generators
- `build.model` -> probabilistic interpretation, passport/export context
- `scenarioConfig` -> charts labels, options, export context
- `scenarioRunHistory` -> compare runs table в `MetricsResultsTab`
- report meta / expertise inputs по `projectKey` -> `ProjectDocumentationPage`

Отдельно:

- `ReportGenerator` под `ResultsPanel` использует только `twin`, `simulationFrames`, `uncertaintyConfig`;
- это legacy Twin API PDF, а не основной export flow.

## 6. Дубли и проблемные места

1. Есть два независимых results-контура: `TwinPage -> SimulationPanel/UncertaintyPanel/ResultsPanel` и `/build -> ThermalSimulationPanel/ThermalMonteCarloPanel/...`.
2. Build results-контур хранится отдельно в `build.thermal-panel.${projectKey}` и не синхронизирован с `useTwinStore.lastThermalResult` и `workflow.monteCarloResult`.
3. Engine/server расчёт внутри Studio не сохраняется в общий store результатов. После перехода на шаг `Результаты` основной `ResultsPanel` не видит server metrics как полноценный result.
4. Monte Carlo в Studio хранится в `workflow.monteCarloResult`, но базовый deterministic result хранится в `useTwinStore.lastThermalResult`. Это два разных источника, и они могут расходиться.
5. `MonteCarloResultsSection` может оказаться пустым даже после успешного Monte Carlo, если базовый RC-result не попал в `useTwinStore.lastThermalResult`.
6. Шаг `Геометрия` визуально работает от `twin`, а шаги `Сценарий/Расчёт/Неопределённости` работают от `build.model`. Это split-brain между Twin и Build.
7. `workflow.diagnostics` считает шаги готовыми по `twinSpaces/twinEnvelope`, даже если `build.model` ещё пустой. Из-за этого пользователь может пройти до `Сценария` и `Расчёта`, но застрять на `Monte Carlo`, потому что `UncertaintyPanel` требует `build.model.rooms.length > 0`.
8. Отдельного блока `Сводка здания` внутри `TwinPage` нет. Если планировать перенос в раздел `Проект`, этот блок сначала придётся либо выделить, либо честно признать отсутствующим.
9. Форма ручного ввода project ID скрыта при `projectKind === "local"`. Из чистого локального состояния у пользователя нет очевидного способа вручную включить engine mode через сам `TwinPage`.
10. Верхняя панель до сих пор считает `/build` основной рабочей средой:
   - project commands ведут в `/build`;
   - export-report тоже отталкивается от `/build`.
11. `import-ifc` и `open-project` в `TopBar` внутри `BuildPage` сводятся к одному и тому же `handleImportIfc()`. Это функциональный дубль.
12. `open-demo` дублируется:
   - в `TwinPage` как promo CTA;
   - в `TopBar`/`BuildPage` как project command.
13. `export-report` обслуживается сразу в нескольких местах:
   - `TopBar`
   - `TwinPage`
   - `ResultsPanel`
   - `BuildPage`
   - `ReportExportListener`
   Это legacy-совместимость, а не чистая схема.
14. `SpaceList` используется и в `Геометрии`, и в `Результатах`; `SpaceViewer3D` используется и во вкладке `Карта и связи`, и внутри `MetricsResultsTab`.
15. `ReportGenerator` делает legacy Twin API PDF, а `ProjectDocumentationPage` и `ReportExportListener` формируют другой документный контур. Это два разных отчётных path.
16. При смене `storedProjectId` `TwinPage` всегда вызывает `resetWorkflow()` и `clearSimulation()`. То есть пользователь теряет:
   - текущий шаг;
   - `scenarioConfig`;
   - `uncertaintyConfig`;
   - `monteCarloResult`;
   - `scenarioRunHistory`;
   - `lastThermalResult` и кадры.
17. Риск потерять demo/localStorage-данные высокий, если при переносе поменяется вычисление `projectKey`:
   - `twinstudio.build.${projectKey}`
   - `twinstudio.build.${projectKey}.snapshot`
   - `twinstudio.snapshots.${projectKey}`
   - `build.thermal-panel.${projectKey}`
   - `twin-desktop.expertise-report-meta:${projectKey}`
   - `twin-desktop.expertise-report-inputs:${projectKey}`
18. Логика demo defaults для exports привязана к `VIDEO_DEMO_PROJECT_ID` и `isVideoDemoProjectModel(...)`. Потеря этой связи сломает предзаполнение demo-документов.

## 7. Что переносить в новые разделы

### Раздел «Проект»

- Что подходит:
  - header/project chip/loading/error из `TwinPage`
  - demo CTA `Открыть демонстрационный дом`
  - engine project form `Подключить проект на движке`
  - `ModelPage`
  - `QuickImportButton`
- Зависимости:
  - `useProjectStore`
  - `useTwin(...)`
  - `useEngineSettingsStore`
  - notifications
  - `buildVideoDemoProjectModel`
- Что можно перенести безопасно:
  - как wrapper-страницу без переписывания самих компонентов;
  - store-логику `projectId/projectKind` лучше оставить общей.
- Риски:
  - `ModelPage` по имени выглядит как «Модель», но по смыслу это intake проекта в engine;
  - engine ID form сейчас условно скрыт;
  - верхняя панель всё ещё ведёт project actions в `/build`.

### Раздел «Модель»

- Что подходит:
  - шаг `Геометрия` после import/intake:
    - панель `Импортированная геометрия`
    - `SpaceList`
    - `Открыть в конструкторе`
  - шаг `Ограждения`:
    - `EnvelopeStatusPanel`
- Зависимости:
  - `useTwinStore.twin`
  - `useBuildStore.model`
  - `buildModelFromTwin`
  - `useProjectStore`
- Что можно перенести безопасно:
  - сначала как две wrapper-секции: `Геометрия` и `Ограждения` без изменения store contracts.
- Риски:
  - `twin` и `build.model` расходятся;
  - local/demo geometry может существовать в `build.model`, но `SpaceList` в Studio останется пустым, если `twin` не синхронизирован.

### Раздел «Сценарии»

- Что подходит:
  - `ScenarioSetupPanel`
- Зависимости:
  - `useWorkflowStore.scenarioConfig`
- Что можно перенести безопасно:
  - практически целиком, как есть.
- Риски:
  - downstream-панели расчёта и результатов читают те же поля напрямую из store, поэтому store contract менять рано.

### Раздел «Расчёт»

- Что подходит:
  - `SimulationPanel`
  - step-level diagnostics/checklist для solve
- Зависимости:
  - `useBuildStore.model`
  - `useWorkflowStore.scenarioConfig`
  - `useProjectStore.projectId/projectKind`
  - `useTwinStore` косвенно через `syncBuildSimulationToStudio`
- Что можно перенести безопасно:
  - локальный RC path можно вынести как есть.
- Риски:
  - engine path не передаёт результат в `ResultsPanel`;
  - `markSolveCompleted(true)` сейчас вызывается из parent `TwinPage`, а не из самой панели.

### Раздел «Вероятностный анализ»

- Что подходит:
  - `UncertaintyPanel`
  - позже `MonteCarloResultsSection`
- Зависимости:
  - `useBuildStore.model`
  - `useWorkflowStore.scenarioConfig`
  - `useWorkflowStore.uncertaintyConfig`
  - `useWorkflowStore.monteCarloResult`
  - `useTwinStore.lastThermalResult` для comparison/results layer
- Что можно перенести безопасно:
  - на первом этапе — `UncertaintyPanel` как page-обёртку;
  - results screen Monte Carlo лучше сначала оставить внутри `ResultsPanel`, а уже потом отделять.
- Риски:
  - probabilistic results завязаны на базовый deterministic result из другого store;
  - в `/build` уже существует второй Monte Carlo UI, не синхронизированный со Studio.

### Раздел «Результаты»

- Что подходит:
  - `ResultsPanel`
  - `SpaceList`
  - `SpaceDetails`
  - `MetricsResultsTab`
  - `SpaceViewer3D`
  - `ProjectDocumentationPage`
  - `ReportGenerator`
- Зависимости:
  - `useTwinStore.simulationFrames`
  - `useTwinStore.thermalGraph`
  - `useTwinStore.lastThermalResult`
  - `useBuildStore.model`
  - `useWorkflowStore.scenarioConfig`
  - `useWorkflowStore.monteCarloResult`
  - `useWorkflowStore.scenarioRunHistory`
  - `useWorkspaceStore`
  - report meta / expertise inputs persistence
- Что можно перенести безопасно:
  - сначала как wrapper вокруг текущего `ResultsPanel` целиком.
- Риски:
  - probabilistic tab сейчас встроен в `ResultsPanel`;
  - `ReportGenerator` — legacy path и может остаться рядом только как совместимость;
  - `export-report` и document actions используют global workspace command bus.

## 8. Риски переноса

### Какие файлы нельзя трогать на первом этапе

- `apps/desktop/src/entities/project/project.store.ts`
- `apps/desktop/src/entities/twin/twin.store.ts`
- `apps/desktop/src/entities/workflow/workflow.store.ts`
- `apps/desktop/src/features/build/build.store.ts`
- `apps/desktop/src/features/twin/useTwin.ts`
- `apps/desktop/src/core/thermal/thermalSimulationExport.ts`
- `apps/desktop/src/features/build/import/fromTwin.ts`
- `apps/desktop/src/features/build/demoVideoProject.ts`
- `apps/desktop/src/features/build/thermal/thermalPanelPersistence.ts`
- `apps/desktop/src/features/build/snapshots/useSnapshots.ts`
- `apps/desktop/src/features/build/reports/reportMetaPersistence.ts`
- `apps/desktop/src/features/reports/exports/**`

Причина:

- это не просто UI-файлы, а точки, где завязаны ключи `projectKey`, localStorage, импорт Twin, и документные выгрузки.

### Какие компоненты лучше переиспользовать как есть

- `ModelPage`
- `QuickImportButton`
- `ScenarioSetupPanel`
- `SimulationPanel`
- `UncertaintyPanel`
- `ResultsPanel`
- `SpaceList`
- `SpaceDetails`
- `SpaceViewer3D`
- `ProjectDocumentationPage`
- `EngineConfigBanner`
- `DebugConsole`
- `FormulaDrawer`

### Какие зависимости лучше оставить в store

- `useProjectStore`
  - `projectId`
  - `projectKind`
- `useTwinStore`
  - `selectedSpaceId`
  - `timeIndex`
  - `simulationFrames`
  - `thermalGraph`
  - `lastThermalResult`
- `useBuildStore`
  - `projectKey`
  - `model`
- `useWorkflowStore`
  - `scenarioConfig`
  - `uncertaintyConfig`
  - `solveCompleted`
  - `monteCarloResult`
  - `scenarioRunHistory`
  - временно и `currentStep`, пока старый `TwinPage` живёт
- `useWorkspaceStore`
  - `mode`
  - `command`
  - `commandNonce`
  - `applyDemoDefaults`

### Что нужно обязательно проверить после переноса

- сохранение и восстановление `projectId/projectKind` из `twinstudio.project`
- сохранение и восстановление `build.projectKey`
- загрузку demo-дома с тем же `VIDEO_DEMO_PROJECT_ID`
- открытие Twin в Build и обратный возврат
- local RC-result -> `ResultsPanel`
- engine/server result -> `ResultsPanel`
- Monte Carlo -> probabilistic results
- export-команды и inputs/meta по `projectKey`
- global overlays (`EngineConfigBanner`, `FormulaDrawer`, `DebugConsole`)

## 9. Рекомендуемый план миграции

### Этап 1

Создать новые routes и страницы-обёртки без удаления `TwinPage`.

- Добавить новые верхнеуровневые routes:
  - `/project`
  - `/model`
  - `/scenarios`
  - `/calculation`
  - `/uncertainty`
  - `/results`
- Внутри этих страниц сначала только собирать уже существующие компоненты.
- `TwinPage` пока оставить как compatibility shell.
- Не менять store contracts.

### Этап 2

Перенести «Проект» и «Модель».

- `ProjectPage`:
  - header/project chip/loading/error
  - demo CTA
  - engine project form
  - `ModelPage`
  - `QuickImportButton`
- `ModelPage` в новом смысле раздела:
  - `SpaceList` / imported geometry panel
  - `Открыть в конструкторе`
  - `EnvelopeStatusPanel`
- Старые кнопки пока можно оставить рабочими, даже если они всё ещё ведут в `/build`.

### Этап 3

Перенести «Сценарии» и «Расчёт».

- `ScenariosPage`:
  - `ScenarioSetupPanel`
- `CalculationPage`:
  - `SimulationPanel`
  - текущий checklist/diagnostics solve-step
- На этом этапе ещё не убирать `currentStep` из `workflow.store`.
- Цель этапа: добиться route-level доступа к тем же данным без переписывания solver flows.

### Этап 4

Перенести «Вероятностный анализ» и «Результаты».

- `UncertaintyPage`:
  - `UncertaintyPanel`
- `ResultsPage`:
  - сначала обёртка вокруг `ResultsPanel` целиком
- Отдельный `ProbabilisticAnalysisPage` лучше делать поверх тех же stores, но только после того, как:
  - deterministic result гарантированно пишется в общий store;
  - Monte Carlo перестаёт зависеть от скрытого соседнего state.
- До этого безопаснее временно терпеть встроенную probabilistic tab внутри `ResultsPanel`, чем дублировать её логикой routes.

### Этап 5

Удалить route `Студия` только после полной проверки функционального паритета.

- Перенаправить все `navigate("/")` и Studio-specific CTA на новые routes.
- Перенаправить Studio-specific `navigate("/build")`, где это уместно, на новые верхнеуровневые разделы.
- Убрать зависимость UI-навигации от `workflow.currentStep`.
- Оставить `TwinPage` как временный redirect или fallback на один цикл проверки, затем удалить.

## 10. Контрольный список проверки после переноса

- Открытие приложения с существующим `twinstudio.project` восстанавливает тот же проект.
- `ProjectPage` корректно показывает demo CTA, import UI и engine errors.
- Ручной ввод engine `projectId` доступен и работает из нового route.
- IFC import по `ModelPage` и `QuickImportButton` по-прежнему возвращает пользователя в рабочий поток.
- `build.projectKey` остаётся тем же, что и до миграции.
- Демо-дом открывается с тем же `VIDEO_DEMO_PROJECT_ID`, а export demo defaults продолжают определять его как demo.
- `Открыть в конструкторе` по-прежнему конвертирует `Twin -> BuildingModel`.
- Переключение между `Project/Model/Scenarios/Calculation/Uncertainty/Results` не сбрасывает данные неожиданно.
- Локальный RC-расчёт по-прежнему наполняет `simulationFrames`, `thermalGraph` и `lastThermalResult`.
- Engine/server расчёт виден не только внутри `SimulationPanel`, но и в общем разделе результатов.
- После Monte Carlo доступен и `workflow.monteCarloResult`, и экран вероятностного анализа не падает в empty state из-за отсутствия базового результата.
- `SpaceList`, `SpaceDetails` и `SpaceViewer3D` работают с тем же `selectedSpaceId` и `timeIndex`.
- `ProjectDocumentationPage` сохраняет `reportMeta` и `expertiseInputs` на тот же `projectKey`.
- Команды выгрузки (`download-*`, `export-*`, `download-all-exports`, `apply-demo-defaults`, `clear-demo-defaults`) продолжают работать через `useWorkspaceStore`.
- `EngineConfigBanner`, `FormulaDrawer` и `DebugConsole` остаются доступны глобально.

