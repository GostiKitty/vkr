# Backlog правок по расчётам

Дата: 2026-05-16

Связанный аудит:

- [calculation-audit-2026-05-16.md](/abs/path/c:/Users/Liza/vkr/twin-desktop/apps/desktop/docs/calculation-audit-2026-05-16.md)

## Цель

Этот backlog переводит аудит расчётов в конкретный план правок без переписывания расчётного ядра.

Главный принцип текущего этапа:

- не менять физическую модель и solver без отдельного согласования;
- сначала убрать путаницу между расчётными контурами;
- честно показать пользователю, какие формулы и результаты реально относятся к какому контуру;
- затем добавить безопасные UI-таблицы, настройки и диагностические предупреждения.

## Ограничения

Пока не менять без отдельного тестового пакета и явного согласования:

- `src/core/thermal/solver.ts`
- `src/core/thermal/model.ts`
- `src/core/thermal/physics.ts`
- `src/core/thermal/engineering/analysis.ts`
- `src/core/thermal/transient/finiteDifference1D.ts`
- `src/core/uncertainty/thermalMonteCarlo.ts`
- `src/core/thermal/sp50/analysis.ts`

## P0 — критично для корректности и понятности

## P0.1 Разделить в UI расчётные контуры

### Задача

Явно подписать и развести в UI пять расчётных контуров:

1. RC-модель помещения
2. инженерный квазистационарный баланс
3. проверка по СП 50
4. 1D transient расчёт конструкции
5. legacy report / Monte Carlo path

### Почему это P0

Сейчас пользователь может воспринимать результаты как единый расчёт, хотя в проекте реально несколько независимых движков.

### Что менять

- `src/features/reports/ResultsPanel.tsx`
- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/formulas/FormulasPage.tsx`
- `src/features/reports/ReportGenerator.tsx`
- `src/features/reports/reportUtils.ts`
- при необходимости:
  - `src/features/build/components/ThermalSimulationPanel.tsx`
  - `src/features/twin/TwinPage.tsx`

### Что показать пользователю

- короткий бейдж или блок “Уровень расчёта”
- источник каждого раздела результатов
- предупреждение, если пользователь смотрит legacy-путь, а не основной builder-path

### Критерии приёмки

- в результатах и формулах видно, к какому контуру относится формула или метрика;
- legacy path не выглядит как основной расчёт по зданию;
- RC, инженерный баланс, СП 50 и transient не смешиваются в одном заголовке без пояснения.

## P0.2 Исправить статусы формул на странице “Формулы и допущения”

### Задача

Заменить грубую шкалу статусов формул на более точную:

- `используется в расчёте`
- `используется в инженерном балансе`
- `используется в СП 50`
- `используется только в legacy path`
- `справочная формула / пока не участвует`

### Почему это P0

Сейчас статусы частично расходятся с реальным кодом и вводят пользователя в заблуждение.

### Что менять

- `src/features/formulas/FormulasPage.tsx`
- `src/entities/formulas/registry.ts`

### Непосредственные правки по статусам

1. `ventilation_loss`
   - убрать статус “доступно как допущение”
   - поставить `используется в инженерном балансе`

2. `envelope_infiltration`
   - оставить как реально используемую формулу

3. `radiator_heat_output`
4. `coolant_flow_rate`
   - пометить как `справочная формула / пока не участвует`
   - или точнее: `подготовлена для следующего этапа модели оборудования`

5. формулы legacy-report path
   - явно пометить как `используется только в legacy path`

### Критерии приёмки

- пользователь не видит формулу теплоносителя как будто она уже управляет комнатной температурой;
- формула вентиляционных потерь не занижается до “допущения”, если реально участвует в инженерном балансе;
- статусы соответствуют расчётным контурам из аудита.

## P0.3 Добавить в результаты таблицу активных расчётных допущений

### Задача

Показать пользователю фактические входные параметры текущего расчёта:

- `ACH`
- `effectiveMassFactor`
- `indoor setpoint`
- `outdoor temperature scenario`
- `simulation duration`
- `time step`
- внутренние теплопоступления
- параметры Monte Carlo, если запускался

### Почему это P0

Сейчас пользователь видит итоговые числа без компактной таблицы активных допущений.

### Что менять

- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/reports/ResultsPanel.tsx`
- `src/features/build/thermal/defaultThermalOptions.ts`
- `src/features/build/thermal/workflowThermalOptions.ts`
- `src/entities/workflow/workflow.store.ts`
- при необходимости добавить новый UI-компонент:
  - `src/features/reports/ActiveAssumptionsTable.tsx`

### Источники данных

1. RC solver options
2. workflow scenario config
3. engineering defaults
4. Monte Carlo result

### Критерии приёмки

- в результатах есть компактная таблица “Активные допущения расчёта”;
- если запущен Monte Carlo, видно:
  - число прогонов
  - варьируемые параметры
  - уровень риска / percentile scope

## P0.4 Зафиксировать предупреждение о different-path результатах

### Задача

Если какая-либо страница или PDF использует legacy `reportUtils.ts` path, пользователь должен видеть это явно.

### Что менять

- `src/features/reports/ReportGenerator.tsx`
- `src/features/reports/reportUtils.ts`

### Формулировка

Пример:

- “Этот отчёт использует legacy Twin-path и не полностью совпадает с локальным builder-расчётом.”

### Критерии приёмки

- отчётный путь не выдаётся за основной расчёт здания;
- различие между legacy и builder-path видно без чтения исходников.

## P1 — важно для инженерной полноты

## P1.1 Добавить разложение теплопотерь в “Результаты”

### Задача

Вывести:

1. по помещениям
2. по ограждениям
3. отдельно:
   - вентиляция
   - инфильтрация
4. суммарную тепловую нагрузку
5. пиковую нагрузку
6. среднюю и минимальную температуру

### Почему это P1

Эти данные уже во многом считаются в коде, но не раскрыты пользователю как инженерная таблица.

### Что менять

- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/reports/ResultsPanel.tsx`
- возможные новые компоненты:
  - `src/features/reports/EnvelopeLossTable.tsx`
  - `src/features/reports/RoomBalanceTable.tsx`
  - `src/features/reports/ThermalAssumptionWarnings.tsx`

### Источники данных

- `EnvelopeElementResult[]`
- `RoomBalanceResult[]`
- `balance` из инженерного анализа
- `result.summary`
- `result.diagnostics`

### Критерии приёмки

- пользователь видит не только общий peak и energy, но и инженерную декомпозицию;
- потери по ограждениям и воздухообмену читаются отдельно;
- температуры выводятся без необходимости смотреть только график.

## P1.2 Добавить предупреждение об ideal heater в основном RC solver

### Задача

Явно объяснить, что основной RC solver:

- использует идеальный догрев до уставки;
- не является полной моделью радиатора/котла по теплоносителю.

### Почему это P1

Это главный инженерный нюанс интерпретации результирующей мощности.

### Что менять

- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/formulas/FormulasPage.tsx`
- возможно:
  - `src/features/runs/SimulationPanel.tsx`

### Критерии приёмки

- пользователь не принимает peak load за результат гидравлического расчёта;
- в результатах есть честное пояснение уровня модели.

## P1.3 Оставить формулу теплоносителя в разделе формул, но с честным статусом

### Задача

Оставить:

- `Q = ṁ · c_p · (T_supply - T_return)`

но подписать её так:

- “пока не используется в основном зональном отоплении; рекомендуется для следующего этапа модели оборудования”

### Что менять

- `src/entities/formulas/registry.ts`
- `src/features/formulas/FormulasPage.tsx`

### Критерии приёмки

- формула не пропадает из инженерного продукта;
- но пользователь понимает, что это future-state модели, а не текущий working path.

## P1.4 Вынести важные параметры в настройки

### Задача

Добавить в пользовательские настройки:

- `ventilationACH`
- `supplyAirTemperatureC`
- `effectiveMassFactor`
- `lightingGain_W_m2`
- `occupancyGain_W_m2`
- `equipmentGainMultiplier`

Текущий безопасный статус этапа:

- уже вынесены в UI следующего builder-расчёта:
  - `ventilationACH`
  - `effectiveMassFactor`
  - `lightingGain_W_m2`
  - `occupancyGain_W_m2`
  - `equipmentGainMultiplier`
- пока не вынесены в отдельный UI и остаются TODO:
  - `supplyAirTemperatureC`
  - Monte Carlo `heatingThresholdKW`
  - Monte Carlo `varLevel`

### Почему это P1

Часть параметров уже существует в коде, но остаётся скрытой или доступной только в отдельных инженерных слоях.

### Что менять

- `src/features/scenarios/ScenarioSetupPanel.tsx`
- `src/features/formulas/FormulasPage.tsx`
- `src/features/build/thermal/defaultThermalOptions.ts`
- `src/features/build/thermal/workflowThermalOptions.ts`
- `src/features/build/thermal/displayOptions.ts`
- `src/entities/workflow/workflow.store.ts`
- при необходимости:
  - `src/core/thermal/engineering/types.ts`
  - только для проброса уже существующих полей, без изменения ядра

### Критерии приёмки

- пользователь может управлять основными инженерными допущениями без правки кода;
- настройки отражаются в таблице активных допущений;
- изменение параметров не требует переписывания solver.

## P2 — улучшения следующего этапа

## P2.1 Убрать или объединить legacy report path

### Задача

Либо:

1. объединить `reportUtils.ts` с основным builder-path,

либо:

2. честно оставить его как legacy и визуально убрать с основного product-path.

### Что менять

- `src/features/reports/reportUtils.ts`
- `src/features/reports/ReportGenerator.tsx`
- `src/core/thermal/thermalModel.ts`
- `src/core/uncertainty/monteCarloEngine.ts`

### Риск

Высокий. Делать только после UI-прозрачности и тестов.

## P2.2 Проверить эвристические теплопоступления от оборудования и труб

### Задача

Проверить и затем при необходимости пересчитать:

- `resolvePassiveEquipmentGainW(...)`
- `resolveRoomPipeGainW(...)`

### Что менять позже

- `src/core/thermal/physics.ts`

### Риск

Высокий. Влияет на heat balance.

## P2.3 Уточнить placeholder-параметры в `buildEnergyCheck(...)` СП 50

### Задача

Проверить:

- `betaV`
- `Lvent`
- `nVent`
- `Ginf`
- `nInf`
- `c`

### Что менять позже

- `src/core/thermal/sp50/analysis.ts`

### Риск

Высокий. Это уже нормативный контур.

## P2.4 Добавить тесты на единицы и контрольные кейсы

### Задача

Сделать набор контрольных инженерных кейсов:

1. однослойная стена
2. многослойная стена
3. вентиляционные потери по ACH
4. RC-нагрев при фиксированной ёмкости
5. Monte Carlo summary sanity

### Что менять

- `tests/*`
- возможно `tests-dist/*`

## P2.5 Добавить полноценную модель отопительного прибора по теплоносителю

### Задача

На следующем этапе связать:

- расход теплоносителя
- подачу/обратку
- доступную тепловую мощность прибора
- влияние на температуру помещения

### Что менять позже

- `src/core/thermal/solver.ts`
- `src/core/thermal/physics.ts`
- `src/core/networks/heatingModel.ts`
- `src/core/thermal/engineering/analysis.ts`

### Риск

Очень высокий. Без тестов не начинать.

## Минимальный безопасный план реализации

## Этап 1

Только UI-прозрачность, без изменения ядра:

1. объяснение расчётных контуров в UI;
2. исправление статусов на странице “Формулы и допущения”;
3. таблица активных допущений в результатах;
4. warning для legacy-path;
5. warning для ideal RC heater.

### Файлы этапа 1

- `src/features/formulas/FormulasPage.tsx`
- `src/entities/formulas/registry.ts`
- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/reports/ResultsPanel.tsx`
- `src/features/reports/ReportGenerator.tsx`
- `src/features/reports/reportUtils.ts`
- `src/features/build/thermal/defaultThermalOptions.ts`
- `src/features/build/thermal/workflowThermalOptions.ts`
- `src/entities/workflow/workflow.store.ts`

### Риск

Низкий.

## Этап 2

Добавить инженерную декомпозицию и вынести параметры в настройки:

1. разложение теплопотерь;
2. средняя/минимальная температура;
3. расширенные настройки вентиляции и внутренних притоков;
4. тесты на контрольные формулы и вывод допущений.

### Файлы этапа 2

- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/reports/ResultsPanel.tsx`
- `src/features/scenarios/ScenarioSetupPanel.tsx`
- `src/features/formulas/FormulasPage.tsx`
- `src/features/build/thermal/displayOptions.ts`
- `src/features/build/thermal/workflowThermalOptions.ts`
- `src/features/build/thermal/defaultThermalOptions.ts`
- `src/entities/workflow/workflow.store.ts`
- новые UI-компоненты в `src/features/reports/*`

### Риск

Низкий/средний.

## Этап 3

Осторожная переработка отопительного оборудования и legacy path:

1. отделение или замена legacy report path;
2. проверка equipment/pipe gains;
3. осторожное внедрение модели теплоносителя;
4. уточнение СП 50 energy check placeholders.

### Файлы этапа 3

- `src/features/reports/reportUtils.ts`
- `src/core/thermal/thermalModel.ts`
- `src/core/uncertainty/monteCarloEngine.ts`
- `src/core/thermal/physics.ts`
- `src/core/thermal/solver.ts`
- `src/core/networks/heatingModel.ts`
- `src/core/thermal/sp50/analysis.ts`

### Риск

Высокий.

## Файлы, которые нужно менять в ближайших этапах

### Основные UI-файлы

- `src/features/formulas/FormulasPage.tsx`
- `src/entities/formulas/registry.ts`
- `src/features/reports/MetricsResultsTab.tsx`
- `src/features/reports/ResultsPanel.tsx`
- `src/features/reports/ReportGenerator.tsx`
- `src/features/reports/reportUtils.ts`
- `src/features/scenarios/ScenarioSetupPanel.tsx`
- `src/features/scenarios/UncertaintyPanel.tsx`
- `src/features/build/thermal/defaultThermalOptions.ts`
- `src/features/build/thermal/workflowThermalOptions.ts`
- `src/features/build/thermal/displayOptions.ts`
- `src/entities/workflow/workflow.store.ts`

### Возможные новые безопасные компоненты

- `src/features/reports/ActiveAssumptionsTable.tsx`
- `src/features/reports/CalculationScopePanel.tsx`
- `src/features/reports/EnvelopeLossTable.tsx`
- `src/features/reports/RoomBalanceTable.tsx`

## Файлы, которые нельзя менять без тестов

- `src/core/thermal/solver.ts`
- `src/core/thermal/model.ts`
- `src/core/thermal/physics.ts`
- `src/core/thermal/engineering/analysis.ts`
- `src/core/thermal/transient/finiteDifference1D.ts`
- `src/core/uncertainty/thermalMonteCarlo.ts`
- `src/core/thermal/sp50/analysis.ts`
- `src/core/networks/heatingModel.ts`

## Тесты, которые нужно добавить

## Для Этапа 1

1. `FormulasPage`
   - статусы формул соответствуют картине из аудита
   - `ventilation_loss` не помечен как просто допущение
   - `radiator_heat_output` и `coolant_flow_rate` имеют честный статус future/reference

2. `Results UI`
   - таблица активных допущений рендерит:
     - ACH
     - timestep
     - duration
     - setpoint
   - при наличии Monte Carlo рендерятся параметры прогонов

3. `Legacy warnings`
   - legacy report path имеет явную пометку

## Для Этапа 2

1. таблица ограждений
   - не ломается при пустых данных
   - корректно разделяет стены/окна/двери/пол/кровлю

2. таблица помещений
   - показывает room heat loss breakdown
   - не теряет единицы измерения

3. настройки
   - новые поля корректно сохраняются в workflow state
   - новые поля отражаются в active assumptions

## Для Этапа 3

1. контрольные инженерные кейсы на формулы
2. regression tests для heating capacity / passive gains
3. контрольные кейсы СП 50
4. разделение builder-path и legacy-path по источнику данных

## Проверки после каждого этапа

Запускать:

1. `npm test`
2. `npx tsc -p tsconfig.app.json --noEmit`
3. `npm run build`

Дополнительно для UI-этапов:

1. ручная проверка страницы “Формулы и допущения”
2. ручная проверка вкладки “Результаты”
3. ручная проверка Monte Carlo panel
4. ручная проверка report/export path

## Рекомендуемая последовательность

1. Сначала сделать Этап 1 полностью.
2. После этого обновить screenshots и проверить, исчезла ли путаница между расчётными контурами.
3. Только потом делать Этап 2.
4. К ядру отопления, СП 50 energy-check и legacy-path переходить только после появления тестов и контрольных кейсов.
