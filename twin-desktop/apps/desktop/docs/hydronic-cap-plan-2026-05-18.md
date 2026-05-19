# План безопасной интеграции hydronic_cap от 2026-05-18

## Цель

Добавить optional режим ограничения мощности отопления по теплоносителю без ломки существующего zonal RC solver.

## Базовый принцип

- `heatingMode = "ideal" | "hydronic_cap"`
- `ideal` остаётся режимом по умолчанию и должен считать как раньше.
- `hydronic_cap` не заменяет RC-баланс. Он ограничивает доступную мощность отопления поверх уже существующего расчёта потребности.

## Логика режима hydronic_cap

1. Сначала считать существующую потребность:
   - `requiredHeatingPowerW = existing ideal-heater demand`
2. Отдельно считать доступную мощность по теплоносителю:
   - `availableHydronicPowerW = calculateHydronicHeatPower(...)`
3. Ограничивать подводимое отопление:
   - `appliedHeatingPowerW = min(requiredHeatingPowerW, availableHydronicPowerW)`
4. Фиксировать дефицит:
   - `heatingDeficitW = requiredHeatingPowerW - appliedHeatingPowerW`

## Минимальный diff

### Файлы

- `src/core/thermal/solver.ts`
- `src/core/thermal/engineering/types.ts`
- `src/core/thermal/engineering/analysis.ts`
- при необходимости `src/entities/workflow/workflow.store.ts`
- тесты:
  - `tests/thermal/singleZone.test.ts`
  - `tests/thermal/formulaHelpers.test.ts`
  - новый regression test на `hydronic_cap`

### Что менять в solver.ts

- Не менять сам RC-баланс по проводимостям и теплоёмкости.
- Не удалять current ideal heater.
- В точке вычисления `heatingPowerW`:
  - если `heatingMode !== "hydronic_cap"`: оставить текущее поведение.
  - если `heatingMode === "hydronic_cap"`:
    - вычислить ideal demand как сейчас;
    - вычислить `availableHydronicPowerW` из уже подготовленных hydronic inputs;
    - взять `Math.min(...)`;
    - записать applied power в timeline;
    - при дефиците оставить температуру ниже уставки, а не компенсировать скрыто.

### Что не нужно делать на этом этапе

- Не строить детальную модель радиатора.
- Не рассчитывать динамику теплоносителя по контурам.
- Не менять структуру тепловой сети.
- Не подмешивать pipe gains или equipment heuristics в available hydronic power.

## Источник hydronic inputs

Приоритет входов:

1. Явно заданный `massFlowKgS`
2. Явно заданный `volumeFlowM3H` с пересчётом через `ρ`
3. `T_supply`, `T_return`
4. `c_p`, `ρ`, `efficiency`
5. optional `maxPowerW`

Если расход не задан:

- solver не должен падать;
- режим `hydronic_cap` должен вернуть warning и вести себя предсказуемо;
- предпочтительный вариант: считать `availableHydronicPowerW = null`, не включать ограничение и явно предупреждать пользователя.

## Риски

### 1. Устойчивость solver

- Если ввести cap не в том месте цикла, можно случайно сломать сохранение backward compatibility.
- Ограничение должно применяться только к источнику `Q_heat`, а не к остальным членам баланса.

### 2. Тихая смена поведения default-режима

- Недопустимо.
- Все regression tests для `ideal` должны проходить без численных изменений.

### 3. Подмена derived-only режима рабочим solver path

- В UI и Results нужно явно различать:
  - `derived hydronic metrics`
  - `активный hydronic_cap mode`

### 4. Недостаточность входных данных

- Типовой риск: есть `T_supply` и `T_return`, но нет расхода.
- В этом случае нужно предупреждение, а не вымышленная мощность.

## Обязательные regression tests

1. `ideal` без hydronic inputs считает идентично текущему baseline.
2. Явный `heatingMode: "ideal"` совпадает с default-поведением.
3. `hydronic_cap` при большой доступной мощности совпадает с `ideal`.
4. `hydronic_cap` при малой доступной мощности ограничивает heating power.
5. При ограничении мощности температура зоны уходит ниже уставки предсказуемо, без NaN и без взрыва расчёта.
6. При `supplyTemperatureC <= returnTemperatureC` solver не падает и выдаёт warning.
7. При отсутствии расхода solver не падает и выдаёт warning.
8. При наличии `maxPowerW` cap учитывает верхнее ограничение.

## Warnings для Results

- `active heating mode: ideal`
- `active heating mode: hydronic_cap`
- `hydronic data missing`
- `supply <= return`
- `flow missing`
- `hydronic power is derived-only and does not limit solver`
- `hydronic cap active: available power below required demand`

## Критерий готовности к внедрению

Интеграцию в solver можно считать безопасной, если одновременно выполнены все условия:

1. helper-layer и tests уже зелёные;
2. derived hydronic metrics уже отображаются отдельно;
3. default `ideal` проходит регрессию без изменений;
4. в solver есть минимальный локальный diff только в узле расчёта `Q_heat`;
5. warnings в Results однозначно объясняют пользователю режим расчёта.

## Вывод

На текущем этапе разумно оставить `hydronic_cap` как следующий шаг. Helper-layer и derived metrics уже подготовлены, а дальнейшая интеграция реалистична небольшим diff в `solver.ts`, но только вместе с отдельными regression tests.
