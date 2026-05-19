# Инвентаризация расчётных формул от 2026-05-18

## Executive summary

- В проекте действительно сосуществуют несколько независимых расчётных контуров: основной зональный RC solver, инженерный квазистационарный баланс, нормативная проверка по СП 50, отдельный 1D transient по конструкции и legacy/Monte Carlo path. Их нельзя смешивать в одном выводе без явной пометки контура.
- Базовые формулы `R = d / λ`, `R_total = Rsi + Σ(d / λ) + Rse`, `U = 1 / R`, `Q = U · A · ΔT`, `L = ACH · V / 3600`, `Q_vent`, `Q_inf`, `GSOP` и гидравлические derived-formulas теперь имеют единый helper-layer в `src/core/thermal/formulas.ts`.
- Формула `Q = ṁ · c_p · (T_supply - T_return)` пока используется как инженерная derived-only оценка оборудования. В основной zonal RC solver она не подключена.
- В контуре СП 50 есть рабочая проверка ограждений и GSOP, но энергетический блок пока остаётся частичным: `betaV`, `Lvent`, `Ginf`, `nVent`, `nInf`, `c` помечены как placeholder.
- В контуре room physics математического double counting вентиляции и инфильтрации не найдено, но семантика полей ранее была неоднозначной. Сейчас нужно в UI честно разделять `инфильтрацию`, `механическую вентиляцию` и `суммарные потери воздухообмена`.

## Матрица формул

| Формула | Файл | Функция | Расчётный контур | Источник | Статус | Риск | Действие |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R = d / λ` | `src/core/thermal/formulas.ts`; `src/entities/material/types.ts`; `src/core/thermal/sp50/calculations.ts` | `layerResistance`; `computeWallProperties`; `calculateLayerResistance` | инженерный, СП 50 | нормативная: СП 50.13330.2024; инженерная: Богословский, Фокин, Исаченко | используется корректно | низкий | сохранить единый helper-layer |
| `R_total = Rsi + Σ(d / λ) + Rse` | `src/core/thermal/formulas.ts`; `src/entities/material/types.ts`; `src/core/thermal/sp50/calculations.ts` | `assemblyResistance`; `computeWallProperties`; `calculateConstructionResistance` | инженерный, СП 50 | нормативная: СП 50.13330.2024 | используется корректно | низкий | использовать helper и не дублировать сборку вручную |
| `U = 1 / R` | `src/core/thermal/formulas.ts`; `src/entities/material/types.ts`; `src/core/thermal/sp50/calculations.ts` | `uValue`; `computeWallProperties`; `calculateHeatTransferCoefficient` | инженерный, СП 50 | нормативная: СП 50.13330.2024; инженерная: Фокин | используется корректно | низкий | сохранить как единый helper |
| `Q = U · A · ΔT` | `src/core/thermal/formulas.ts`; `src/core/thermal/engineering/analysis.ts`; `src/core/thermal/sp50/analysis.ts` | `transmissionLoss`; `buildEnvelopeResults`; `buildEnvelopeResultFromSurface` | инженерный, СП 50 | нормативная: СП 50.13330.2024; инженерная: Исаченко | используется корректно | низкий | оставить базовой формулой теплопередачи |
| `L = ACH · V / 3600` | `src/core/thermal/formulas.ts`; `src/core/thermal/engineering/units.ts`; `src/core/thermal/model.ts` | `airflowFromACH`; `airflowFromAch`; `buildZone` | RC, инженерный | инженерная: СП 60.13330.2020 как контекст воздухообмена; Богословский | используется корректно | низкий | использовать helper везде, не дублировать локальные пересчёты |
| `Q_vent = ρ · c_p · L · ΔT` | `src/core/thermal/formulas.ts`; `src/core/thermal/engineering/units.ts`; `src/core/thermal/engineering/analysis.ts`; `src/core/thermal/physics.ts` | `ventilationLoss`; `ventilationHeatLossW`; `buildBalanceSummary`; `solveRoomBalances` | инженерный, physics diagnostics | инженерная: СП 60.13330.2020; Исаченко | используется частично | средний | явно помечать как sensible-only и не выдавать за нормативный расчёт воздухообмена по помещениям |
| `Q_inf = ρ · c_p · L_inf · ΔT` | `src/core/thermal/formulas.ts`; `src/core/thermal/model.ts`; `src/core/thermal/physics.ts`; `src/core/thermal/solver.ts` | `infiltrationLoss`; `buildZone`; `solveRoomBalances`; `simulateThermalNetwork` | RC, инженерный | инженерная: СП 60.13330.2020; Богословский | используется корректно | средний | сохранять раздельно от механической вентиляции в diagnostics |
| `GSOP = (t_indoor - t_heating_period) · z_heating_period` | `src/core/thermal/formulas.ts`; `src/core/thermal/sp50/analysis.ts` | `gsop`; `resolveSourceData` | СП 50 | нормативная: СП 131.13330.2020/2025, СП 50.13330.2024 | используется частично | средний | фиксировать, что в коде сейчас базовая логика опирается на редакцию 2020; нужна сверка с 2025 |
| RC energy balance `C_i ΔT_i/Δt = ΣG(T_j-T_i) + G_inf(T_n-T_i) + Q_int + Q_heat` | `src/core/thermal/solver.ts`; `src/core/thermal/thermalDiagnostics.ts` | `simulateThermalNetwork`; `buildThermalDiagnosticsEngineering` | основной zonal RC solver | инженерная: lumped-capacitance model; Богословский, Исаченко | используется корректно | средний | не переписывать; менять только с regression tests |
| ideal heater logic | `src/core/thermal/solver.ts` | `simulateThermalNetwork` | основной zonal RC solver | инженерная эвристика расчётного режима | используется корректно | средний | оставлять default; честно маркировать как ideal heater |
| 1D transient по конструкции | `src/core/thermal/transient/finiteDifference1D.ts` | `runFiniteDifference1D` и вспомогательные функции | отдельный transient contour | инженерная: Исаченко; численная схема | используется корректно | средний | не смешивать с RC и СП 50 |
| Monte Carlo / uncertainty | `src/core/uncertainty/thermalMonteCarlo.ts`; `src/core/uncertainty/monteCarloEngine.ts` | `runThermalMonteCarlo`; legacy Monte Carlo helpers | основной RC uncertainty + legacy path | инженерная/статистическая | используется частично | средний | явно разделять current RC Monte Carlo и legacy path |
| СП 50 energy check | `src/core/thermal/sp50/analysis.ts` | `buildEnergyCheck` | СП 50 | нормативная, но частично реализованная | placeholder / частичная нормативная реализация | высокий | не заявлять полное соответствие; заменить placeholder входы на реальные данные |
| `Q_hydronic = ṁ · c_p · (T_supply - T_return)` | `src/core/thermal/formulas.ts`; `src/core/thermal/engineering/analysis.ts`; `src/entities/formulas/registry.ts` | `calculateHydronicHeatPower`; `buildHydronicAssessment`; registry only | derived-only engineering helper | инженерная: СП 60.13330.2020 как системный контекст; учебники ТГВ/теплотехники | derived-only | средний | использовать только как оценку доступной мощности до отдельного hydronic_cap этапа |
| `ṁ = Q / (c_p · ΔT)` | `src/core/thermal/formulas.ts`; `src/core/thermal/engineering/analysis.ts`; `src/entities/formulas/registry.ts` | `calculateRequiredHydronicMassFlow`; `buildHydronicAssessment`; registry only | derived-only engineering helper | инженерная: учебники теплотехники | derived-only | низкий | оставить как helper, не выдавать за solver path |
| `Vdot = 3600 · ṁ / ρ` | `src/core/thermal/formulas.ts`; `src/core/thermal/engineering/analysis.ts` | `calculateRequiredHydronicVolumeFlowM3H`; `buildHydronicAssessment` | derived-only engineering helper | инженерная | derived-only | низкий | оставить в результатах оборудования |
| equipment passive gains | `src/core/thermal/physics.ts` | `resolvePassiveEquipmentGainW`; `resolveEquipmentPassiveEmissionBaseW` | physics / инженерная диагностика | эвристика | используется, но требует уточнения | высокий | не маркировать как нормативную формулу |
| pipe gains | `src/core/thermal/physics.ts` | `resolveRoomPipeGainW`; `buildThermalNetworkContext` | physics / инженерная диагностика | эвристика | используется, но требует уточнения | высокий | сохранить как heuristic и покрыть кейсами |

## Вентиляция и инфильтрация

### Где считается вентиляция

- `src/core/thermal/formulas.ts` → `ventilationLoss(...)`
- `src/core/thermal/engineering/units.ts` → `ventilationHeatLossW(...)`
- `src/core/thermal/physics.ts` → `scheduledVentilationUA_W_K`, `mechanicalSupplyUA_W_K`, `mechanicalVentilationLossW`
- `src/core/thermal/engineering/analysis.ts` → сводный баланс

### Где считается инфильтрация

- `src/core/thermal/formulas.ts` → `infiltrationLoss(...)`
- `src/core/thermal/model.ts` → эквивалентная проводимость по ACH
- `src/core/thermal/physics.ts` → `infiltrationUA_W_K`, `infiltrationLossW`
- `src/core/thermal/solver.ts` → RC-баланс через `G_inf`

### Где агрегат уже включает оба канала

- `src/core/thermal/physics.ts`: `airExchangeLossW = infiltrationLossW + mechanicalVentilationLossW`
- `src/core/thermal/physics.ts`: legacy-совместимое поле `ventilationLossW` сейчас фактически хранит суммарные потери воздухообмена

### Вывод по double counting

- В самом расчёте double counting не найден.
- Риск был в интерпретации UI, если `ventilationLossW` читать как «только вентиляция».
- Корректная подпись для legacy aggregate: `суммарные потери воздухообмена`.

## Legacy / отдельные контуры

- Основной RC solver: `src/core/thermal/solver.ts`
- Инженерный баланс: `src/core/thermal/engineering/analysis.ts`
- СП 50: `src/core/thermal/sp50/analysis.ts`
- 1D transient: `src/core/thermal/transient/finiteDifference1D.ts`
- Legacy path:
  - `src/core/thermal/thermalModel.ts`
  - `src/core/uncertainty/monteCarloEngine.ts`
  - `src/features/reports/reportUtils.ts`

## Формальный статус документов на 2026-05-18

### СП 50.13330.2024

- В проекте уже есть явная привязка к редакции 2024: `norms/sp50_2024/*`.
- Для ограждающих конструкций и поверхностных сопротивлений именно эта редакция сейчас является формальной базой расчёта.

### СП 60.13330.2020

- Актуальная доступная редакция в справочных системах идёт как `СП 60.13330.2020 ... (с Поправкой, с Изменениями № 1-5)`.
- В коде нет встроенного machine-readable слоя редакций/изменений СП 60; нормы используются как нормативный контекст для вентиляции, отопления и hydronic-формул.
- Пометка для проекта: используется СП 60.13330.2020 как базовый нормативный источник, но без формализованной трассировки по отдельным изменениям № 1-5.

### СП 131.13330.2020 vs СП 131.13330.2025

- `СП 131.13330.2025` действует. По карточке Росстандарта: утверждён приказом Минстроя `08.08.2025 № 470/пр`, введён в действие `09.09.2025`, взамен `СП 131.13330.2020`.
- В проекте фактически используется логика, совместимая с `СП 131.13330.2020`, поскольку явного набора климатических таблиц/параметров 2025 в коде нет.
- Обязательная пометка для проекта: `климатический контур и GSOP сейчас требуют сравнения с СП 131.13330.2025`.

### ГОСТ 30494-2011

- Доступная актуальная редакция: `ГОСТ 30494-2011 ... (с Поправкой, с Изменением № 1)`.
- Изменение № 1 введено в действие с `01.02.2023`.
- В проекте ГОСТ используется как reference-база для параметров микроклимата, но не как полноценный rule-engine по категориям помещений.

## Где проект ссылается на устаревающую редакцию или требует явной пометки

- `GSOP` и климатические входы:
  - сейчас требуется подпись `используется логика СП 131.13330.2020/данные пользователя; нужна сверка с СП 131.13330.2025`.
- Вентиляция/инфильтрация:
  - не заявлять автоматическое соответствие СП 60 по нормируемому воздухообмену без типологии помещений и режимов.
- Микроклимат:
  - не заявлять полное соответствие ГОСТ 30494-2011 без классификации помещений и проверок по допустимым/оптимальным параметрам.

## Рекомендуемые действия

1. Сохранить единый helper-layer как единственный источник базовых SI-формул.
2. Не подключать `Q_hydronic` в solver без отдельного этапа `hydronic_cap`.
3. Продолжить маркировку derived-only, heuristic и placeholder формул в UI и отчётах.
4. В отдельном этапе сверить климатический слой и GSOP с `СП 131.13330.2025`.
5. Для СП 50 energy-check заменить placeholder-параметры реальными исходными данными или оставить честную пометку `частичная нормативная проверка`.
