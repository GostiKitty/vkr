import React, { useMemo } from "react";
import { BlockMath, InlineMath } from "react-katex";
import type { Space } from "../../shared/api/types";
import { formatNumber } from "../../shared/utils/format";
import { useTwinStore } from "../../entities/twin/twin.store";
import type { SimulationFrame } from "../../entities/twin/types";
import { useWorkflowStore, type UncertaintyConfig } from "../../entities/workflow/workflow.store";
import {
  assumptions,
  formulaRegistry,
  type Formula,
  type Assumption,
  type FormulaVariable,
} from "../../entities/formulas/registry";
import { SummaryHero, SummaryHighlightGrid } from "../../shared/ui";

interface FormulaValueContext {
  selectedSpace: Space | null;
  frame: SimulationFrame | null;
  frames: SimulationFrame[];
  assumptionMap: Record<string, Assumption>;
  uncertaintyConfig: UncertaintyConfig | null;
}

interface ResolvedVariableValue {
  value: string;
  reason?: string;
}

type FormulaUsageStatus =
  | "используется в RC-модели"
  | "используется в инженерном балансе"
  | "используется в инженерной оценке оборудования"
  | "используется в hydronic mode"
  | "используется в проверке СП 50"
  | "используется в 1D transient"
  | "используется только в legacy path"
  | "справочная / пока не участвует в основном расчёте";

interface FormulaTopic {
  id: string;
  title: string;
  description: string;
  formulaIds: string[];
}

const formulaTopics: FormulaTopic[] = [
  {
    id: "twin-3d",
    title: "3D-граф двойника (эвристика)",
    description: "Упрощённые проводимости и теплоёмкости для визуализации цифрового двойника.",
    formulaIds: [
      "twin_graph_internal_conductance",
      "twin_graph_outdoor_conductance",
      "twin_node_capacitance_heuristic",
      "wall_conductance_adjacency_scale",
    ],
  },
  {
    id: "geometry",
    title: "Геометрия модели",
    description: "Площади, объёмы и удельные показатели по контуру помещений.",
    formulaIds: ["geom_polygon_area", "geom_volume", "geometry_heated_volume", "geometry_opening_area"],
  },
  {
    id: "envelope",
    title: "Теплопередача через ограждения",
    description: "R, U и тепловой поток через стены, окна, двери и многослойные конструкции.",
    formulaIds: [
      "layer_resistance",
      "assembly_resistance_series",
      "u_value_from_resistance",
      "total_resistance",
      "envelope_heat_loss",
      "transmission_loss",
      "wall_facade_weighted_u",
      "facade_weighted_u_conductance",
      "sp50_temperature_in_layer",
      "sp50_vapor_resistance",
      "sp50_thermal_inertia_D",
      "fragment_homogeneity_planar",
    ],
  },
  {
    id: "solver",
    title: "Зональный RC-решатель",
    description: "Основной нестационарный расчёт: теплоёмкость, проводимости, дискретный баланс и отопление.",
    formulaIds: [
      "rc_zone_discrete_balance",
      "rc_zone_capacitance",
      "rc_ventilation_conductance",
      "rc_heating_demand_step",
      "rc_lumped",
      "thermal_balance",
      "heating_capacity_limit",
      "setpoint_ramp_schedule",
      "rc_heating_energy_integral",
      "rc_unmet_load_energy",
      "discomfort_hours_split",
      "discomfort_seconds_threshold",
      "simulation_metrics_energy_integral",
    ],
  },
  {
    id: "engineering-preview",
    title: "Инженерный баланс предпросмотра",
    description: "Быстрый квазистационарный многозонный баланс до полного RC-прогона.",
    formulaIds: ["physics_multiroom_steady_balance", "thermal_balance_room"],
  },
  {
    id: "transient-1d",
    title: "1D нестационарный расчёт по толщине",
    description: "Явная FTCS-схема по слоям конструкции, устойчивость сетки и метод Монте-Карло по свойствам.",
    formulaIds: [
      "transient_1d_explicit_ftcs",
      "transient_interface_flux_fourier",
      "transient_mesh_stability_r",
      "fourier_stability_explicit",
      "heat_equation_1d",
      "temperature_profile_layers",
      "transient_monte_carlo_layers",
      "transient_mc_probability_below_comfort",
      "transient_mc_tsi_min_percentiles",
      "transient_lambda_multiplier",
      "transient_spearman_sensitivity",
      "transient_time_below_threshold",
    ],
  },
  {
    id: "ventilation",
    title: "Вентиляция и инфильтрация",
    description: "ACH, расход воздуха и чувствительные теплопотери на приток наружного воздуха.",
    formulaIds: [
      "envelope_infiltration",
      "ventilation_loss",
      "airflow_rate",
      "infiltration_envelope_leakage_flow",
      "infiltration_pressure_wind",
      "infiltration_pressure_stack",
      "infiltration_ach_from_flow",
      "envelope_leakage_power_law",
      "rc_infiltration_g",
      "ventilation_effective_ach",
      "scenario_infiltration_ach_resolve",
      "scenario_ventilation_ach_resolve",
    ],
  },
  {
    id: "gains",
    title: "Внутренние теплопоступления",
    description: "Люди, оборудование, освещение и расписания эксплуатации как входы RC-модели.",
    formulaIds: ["internal_gains"],
  },
  {
    id: "heating",
    title: "Отопительное оборудование",
    description: "Идеализированная мощность отопления и связь оборудования с балансом помещения.",
    formulaIds: [
      "thermal_peak_load",
      "radiator_heat_output",
      "coolant_flow_rate",
      "hydronic_heat_capacity",
      "derived_q_pipe",
      "networks_pipe_heat_loss_insulated",
      "networks_pipe_pressure_drop_hydraulic",
      "networks_pipe_velocity_mass_flow",
      "networks_branch_downstream_load",
      "networks_equipment_heat_by_room",
    ],
  },
  {
    id: "climate",
    title: "Климатический сценарий",
    description: "Синусоидальный профиль наружной температуры и период моделирования.",
    formulaIds: ["weather_sinusoid", "climate_gsop", "climate_resolve_sp131_city", "solar_declination_spencer"],
  },
  {
    id: "sp50-energy",
    title: "Энергетическая характеристика СП 50",
    description: "Нормативные k_ob, k_vent, q_от, поступления и годовой расход теплоты.",
    formulaIds: [
      "sp50_kob",
      "sp50_k_vent",
      "sp50_q_heating",
      "sp50_q_byt_internal_gains",
      "sp50_q_rad_solar_gains",
      "sp50_beta_gain_use_factor",
      "sp50_annual_heating_energy",
      "sp50_q_heating_characteristic",
      "sp50_air_specific_weight",
      "sp50_reduced_r",
      "sp50_pressure_difference_normative",
      "sp50_resistance_margin",
      "sp50_kob_compliance_margin",
      "sp50_air_permeability_resistance",
      "sp50_floor_absorption_y",
      "climate_average_air_density_sp50",
    ],
  },
  {
    id: "solar",
    title: "Солнце и затенение",
    description: "Положение солнца, доступ фасада и эффективное затенение окон.",
    formulaIds: [
      "solar_position_altitude_azimuth",
      "facade_solar_access_factor",
      "effective_shading_solar_combine",
      "model_shading_area_weighted",
      "opening_effective_g_value",
      "solar_gain_simplified",
    ],
  },
  {
    id: "bridges-sp230",
    title: "Мостики холода (СП 230)",
    description: "Rут/λо по слоям, табличные ψ/χ и агрегирование Hψ, Hχ по модели.",
    formulaIds: [
      "layer_bridge_R_ut_lambda_o",
      "envelope_enrich_linear_psi",
      "envelope_H_psi_H_chi_aggregate",
      "sp230_psi_window_jamb",
      "sp230_psi_convex_corner",
      "sp230_chi_disc_anchor",
      "sp230_psi_wall_roof",
      "sp230_psi_floor_ground_edge",
      "sp230_psi_pitched_rafter",
      "sp230_psi_pitched_ridge",
      "bridge_accounting_mode_resolve",
      "thermal_bridge_linear",
      "thermal_bridge_point",
      "thermal_bridge_heat_loss_sum",
    ],
  },
  {
    id: "engineering-systems",
    title: "Инженерные системы сценария",
    description: "Температуры подачи/обратки, расход, мощность и потери вентиляции по настройкам сценария.",
    formulaIds: [
      "engineering_hydronic_mass_flow_required",
      "engineering_hydronic_heat_power",
      "engineering_hydronic_volume_flow_required",
      "engineering_return_temperature_default",
      "engineering_installed_capacity_cascade",
      "engineering_ventilation_loss_rho_cp_L",
      "comfort_setpoint_resolve",
      "coolant_flow_rate",
      "hydronic_heat_capacity",
      "radiator_heat_output",
    ],
  },
  {
    id: "homogeneity",
    title: "Однородность и мостики из модели",
    description: "Коэффициент r, ψ/χ и приведённые сопротивления по данным BIM-модели.",
    formulaIds: [
      "homogeneity_from_linear_point_bridges",
      "model_homogeneity_area_weighted",
      "reduced_resistance_homogeneity",
    ],
  },
  {
    id: "surface-field",
    title: "Поле температур поверхностей",
    description: "Локальные температуры и потоки на патчах внутренних поверхностей.",
    formulaIds: [
      "surface_patch_heat_flux",
      "surface_mrt_area_weighted",
      "internal_surface_temperature",
      "dew_point_magnus",
      "estimate_mrt_from_envelope",
    ],
  },
  {
    id: "economics",
    title: "Экономика мероприятий",
    description: "Окупаемость, NPV и перевод теплотехнического эффекта в деньги.",
    formulaIds: [
      "economics_simple_payback",
      "economics_npv",
      "economics_annual_energy_saving",
      "economics_tariff_gcal_to_kwh",
      "economics_profitability_index",
      "economics_discounted_payback",
      "scenario_energy_tariff_resolve",
      "scenario_heating_energy_source",
    ],
  },
  {
    id: "diagnostics",
    title: "Диагностика и структура потерь",
    description: "Разложение потерь, KPI здания и нормированные показатели.",
    formulaIds: [
      "loss_share_breakdown",
      "heat_loss_coefficient_total",
      "thermal_time_constant",
      "free_cooling",
      "specific_heat_load_area",
      "specific_heat_load_volume",
      "specific_heat_load_norm_delta_t",
      "derived_compactness",
      "derived_wwr",
      "derived_u_eq",
      "derived_h_total",
      "derived_t_op",
      "derived_f_rsi",
      "derived_co2",
      "derived_dh_underheat",
      "derived_dh_overheat",
      "steady_field",
      "boundary_conditions",
      "diagnostics_balance_relative_residual",
      "diagnostics_envelope_split_deviation",
      "diagnostics_loss_share_percent",
      "opening_u_area_weighted",
      "comfort_relative_humidity_resolve",
      "engineering_field_5point_stencil",
      "physics_steady_room_balance",
    ],
  },
  {
    id: "consistency",
    title: "Согласованность расчёта",
    description: "Проверки целостности: H·ΔT, суммы компонент, энергия и зоны.",
    formulaIds: [
      "consistency_H_times_deltaT",
      "consistency_component_loss_sum",
      "consistency_energy_integration",
      "consistency_zone_sum_vs_building",
      "consistency_h_total_components_sum",
      "thermal_mc_underheat_probability",
    ],
  },
  {
    id: "networks",
    title: "Инженерные сети",
    description: "Воздуховоды, гидравлика труб и агрегирование нагрузок ветвей.",
    formulaIds: [
      "networks_duct_pressure_drop_simplified",
      "pressure_drop_simple",
      "network_equipment_room_heat_sum",
    ],
  },
  {
    id: "uncertainty",
    title: "Вероятностный анализ / Монте-Карло",
    description: "Распределения входов, число испытаний, перцентили и риск превышения.",
    formulaIds: [
      "uncertainty_mc",
      "uncertainty_std",
      "uncertainty_percentile",
      "uncertainty_risk_probability",
      "uncertainty_cv",
      "uncertainty_confidence_interval",
      "morris_mu_star_sensitivity",
      "sensitivity_index",
      "monte_carlo_value_at_risk",
      "monte_carlo_conditional_var",
      "monte_carlo_exceedance_heating",
      "mc_pearson_sensitivity_ranking",
      "mc_cholesky_correlated_sampling",
    ],
  },
  {
    id: "derived",
    title: "Дополнительные показатели и нормативные проверки",
    description: "Дополнительные инженерные показатели и проверки, которые считаются поверх основных контуров и не подменяют базовый расчёт.",
    formulaIds: [
      "interstitial_condensation_check",
      "fourier_number",
      "boundary_condition_third_kind",
      "normative_ventilation",
      "ventilation_recovery",
      "uncertainty_corr_sensitivity",
      "rc_envelope_loss",
    ],
  },
  {
    id: "calibration",
    title: "Калибровка модели",
    description: "Подбор параметров и метрики расхождения с наблюдениями.",
    formulaIds: [
      "calibration_parameter_search",
      "calibration_timeseries_rmse",
      "calibration_rmse",
      "calibration_mape",
      "derived_validation_rmse",
      "derived_validation_mbe",
      "derived_validation_cvrmse",
    ],
  },
];

const formulaUsageStatus: Record<string, FormulaUsageStatus> = {
  layer_resistance: "используется в инженерном балансе",
  total_resistance: "используется в проверке СП 50",
  envelope_heat_loss: "используется в инженерном балансе",
  transmission_loss: "используется в инженерном балансе",
  envelope_infiltration: "используется в RC-модели",
  ventilation_loss: "используется в инженерном балансе",
  internal_gains: "используется в RC-модели",
  thermal_balance: "используется в RC-модели",
  thermal_balance_room: "используется в инженерном балансе",
  rc_lumped: "используется в RC-модели",
  weather_sinusoid: "используется в RC-модели",
  thermal_peak_load: "используется в RC-модели",
  uncertainty_mc: "используется в RC-модели",
  uncertainty_std: "используется в RC-модели",
  calibration_rmse: "используется только в legacy path",
  calibration_mape: "используется только в legacy path",
  radiator_heat_output: "используется в инженерной оценке оборудования",
  coolant_flow_rate: "используется в инженерной оценке оборудования",
  rc_zone_discrete_balance: "используется в RC-модели",
  rc_zone_capacitance: "используется в RC-модели",
  rc_ventilation_conductance: "используется в RC-модели",
  rc_heating_demand_step: "используется в RC-модели",
  infiltration_envelope_leakage_flow: "используется в RC-модели",
  infiltration_pressure_wind: "используется в RC-модели",
  infiltration_pressure_stack: "используется в RC-модели",
  infiltration_ach_from_flow: "используется в RC-модели",
  climate_gsop: "используется в проверке СП 50",
  sp50_annual_heating_energy: "используется в проверке СП 50",
  sp50_q_byt_internal_gains: "используется в проверке СП 50",
  sp50_q_rad_solar_gains: "используется в проверке СП 50",
  sp50_beta_gain_use_factor: "используется в проверке СП 50",
  homogeneity_from_linear_point_bridges: "используется в проверке СП 50",
  model_homogeneity_area_weighted: "используется в проверке СП 50",
  economics_simple_payback: "справочная / пока не участвует в основном расчёте",
  economics_npv: "справочная / пока не участвует в основном расчёте",
  loss_share_breakdown: "используется в инженерном балансе",
  facade_weighted_u_conductance: "используется в RC-модели",
  physics_multiroom_steady_balance: "используется в инженерном балансе",
  rc_heating_energy_integral: "используется в RC-модели",
  rc_unmet_load_energy: "используется в RC-модели",
  uncertainty_percentile: "используется в RC-модели",
  morris_mu_star_sensitivity: "используется в RC-модели",
  geometry_heated_volume: "используется в RC-модели",
  consistency_H_times_deltaT: "используется в инженерном балансе",
  consistency_component_loss_sum: "используется в инженерном балансе",
  networks_pipe_heat_loss_insulated: "используется в инженерной оценке оборудования",
  monte_carlo_value_at_risk: "используется в RC-модели",
  transient_1d_explicit_ftcs: "используется в 1D transient",
  transient_interface_flux_fourier: "используется в 1D transient",
  transient_mesh_stability_r: "используется в 1D transient",
  transient_monte_carlo_layers: "используется в 1D transient",
  layer_bridge_R_ut_lambda_o: "используется в проверке СП 50",
  envelope_H_psi_H_chi_aggregate: "используется в проверке СП 50",
  envelope_enrich_linear_psi: "используется в проверке СП 50",
  sp50_resistance_margin: "используется в проверке СП 50",
  sp50_kob_compliance_margin: "используется в проверке СП 50",
  sp50_air_permeability_resistance: "используется в проверке СП 50",
  sp50_floor_absorption_y: "используется в проверке СП 50",
  climate_average_air_density_sp50: "используется в проверке СП 50",
  calibration_parameter_search: "используется только в legacy path",
  calibration_timeseries_rmse: "используется только в legacy path",
  opening_effective_g_value: "справочная / пока не участвует в основном расчёте",
  diagnostics_balance_relative_residual: "используется в инженерном балансе",
  diagnostics_envelope_split_deviation: "используется в инженерном балансе",
  transient_mc_probability_below_comfort: "используется в 1D transient",
  transient_mc_tsi_min_percentiles: "используется в 1D transient",
  transient_lambda_multiplier: "используется в 1D transient",
  transient_spearman_sensitivity: "используется в 1D transient",
  transient_time_below_threshold: "используется в 1D transient",
  consistency_h_total_components_sum: "используется в инженерном балансе",
  opening_u_area_weighted: "справочная / пока не участвует в основном расчёте",
  thermal_mc_underheat_probability: "используется в RC-модели",
  ventilation_effective_ach: "используется в RC-модели",
  comfort_relative_humidity_resolve: "справочная / пока не участвует в основном расчёте",
  engineering_hydronic_mass_flow_required: "используется в инженерной оценке оборудования",
  engineering_return_temperature_default: "используется в инженерной оценке оборудования",
  engineering_installed_capacity_cascade: "используется в инженерной оценке оборудования",
  engineering_ventilation_loss_rho_cp_L: "используется в инженерном балансе",
  sp230_psi_window_jamb: "используется в проверке СП 50",
  sp230_psi_convex_corner: "используется в проверке СП 50",
  sp230_chi_disc_anchor: "используется в проверке СП 50",
  sp230_psi_wall_roof: "используется в проверке СП 50",
  sp230_psi_floor_ground_edge: "используется в проверке СП 50",
  scenario_energy_tariff_resolve: "справочная / пока не участвует в основном расчёте",
  scenario_heating_energy_source: "справочная / пока не участвует в основном расчёте",
  bridge_accounting_mode_resolve: "используется в проверке СП 50",
  u_value_from_resistance: "используется в RC-модели",
  assembly_resistance_series: "используется в проверке СП 50",
  wall_facade_weighted_u: "используется в RC-модели",
  envelope_leakage_power_law: "используется в RC-модели",
  sp50_q_heating_characteristic: "используется в проверке СП 50",
  sp50_air_specific_weight: "используется в проверке СП 50",
  sp50_temperature_in_layer: "используется в проверке СП 50",
  fragment_homogeneity_planar: "используется в проверке СП 50",
  engineering_hydronic_heat_power: "используется в инженерной оценке оборудования",
  engineering_hydronic_volume_flow_required: "используется в инженерной оценке оборудования",
  sp230_psi_pitched_rafter: "используется в проверке СП 50",
  sp230_psi_pitched_ridge: "используется в проверке СП 50",
  monte_carlo_exceedance_heating: "используется в RC-модели",
  comfort_setpoint_resolve: "используется в RC-модели",
  twin_graph_internal_conductance: "используется в twin-графе (3D и предпросмотр)",
  twin_graph_outdoor_conductance: "используется в twin-графе (3D и предпросмотр)",
  twin_node_capacitance_heuristic: "используется в twin-графе (3D и предпросмотр)",
  wall_conductance_adjacency_scale: "используется в RC-модели",
  diagnostics_loss_share_percent: "используется в инженерном балансе",
  mc_pearson_sensitivity_ranking: "используется в RC-модели",
  mc_cholesky_correlated_sampling: "используется в RC-модели",
  solar_declination_spencer: "справочная / пока не участвует в основном расчёте",
  climate_resolve_sp131_city: "используется в проверке СП 50",
  steady_field: "используется в инженерном балансе",
  boundary_conditions: "используется в инженерном балансе",
  derived_u_eq: "используется в инженерном балансе",
  derived_h_total: "используется в инженерном балансе",
  derived_dh_underheat: "используется в RC-модели",
  derived_dh_overheat: "используется в RC-модели",
  engineering_field_5point_stencil: "используется в инженерном балансе",
  physics_steady_room_balance: "используется в инженерном балансе",
  network_equipment_room_heat_sum: "используется в инженерной оценке оборудования",
  scenario_infiltration_ach_resolve: "используется в RC-модели",
  scenario_ventilation_ach_resolve: "используется в RC-модели",
  simulation_metrics_energy_integral: "используется в RC-модели",
  discomfort_seconds_threshold: "используется в RC-модели",
};

const formulaById: Record<string, Formula> = Object.fromEntries(formulaRegistry.map((formula) => [formula.id, formula]));

export default function FormulasPage() {
  const twin = useTwinStore((state) => state.twin);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const frames = useTwinStore((state) => state.simulationFrames);
  const timeIndex = useTwinStore((state) => state.timeIndex);
  const assumptionMap = useMemo(
    () => Object.fromEntries(assumptions.map((item) => [item.id, item])),
    []
  );
  const selectedSpace = useMemo(() => {
    if (!twin || !selectedSpaceId) {
      return null;
    }
    return twin.spaces?.find((space) => space.id === selectedSpaceId) ?? null;
  }, [twin, selectedSpaceId]);
  const currentFrame = frames[timeIndex] ?? null;
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>(formulaTopics[0]?.id ?? "");

  const valueContext = useMemo<FormulaValueContext>(
    () => ({
      selectedSpace,
      frame: currentFrame,
      frames,
      assumptionMap,
      uncertaintyConfig,
    }),
    [assumptionMap, currentFrame, frames, selectedSpace, uncertaintyConfig]
  );
  const totalFormulaCount = useMemo(() => {
    const assigned = new Set<string>();
    formulaTopics.forEach((topic) => {
      topic.formulaIds.forEach((id) => {
        if (formulaById[id]) {
          assigned.add(id);
        }
      });
    });
    return assigned.size;
  }, []);

  const filteredTopics = useMemo(() => {
    const assignedFormulaIds = new Set<string>();

    return formulaTopics
      .map((topic) => ({
        ...topic,
        formulas: topic.formulaIds
          .map((id) => formulaById[id])
          .filter((formula): formula is Formula => {
            if (!formula || assignedFormulaIds.has(formula.id)) {
              return false;
            }
            assignedFormulaIds.add(formula.id);
            return true;
          }),
      }))
      .filter((topic) => topic.formulas.length > 0);
  }, []);

  React.useEffect(() => {
    if (!filteredTopics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(filteredTopics[0]?.id ?? "");
    }
  }, [filteredTopics, selectedTopicId]);

  const activeTopic =
    filteredTopics.find((topic) => topic.id === selectedTopicId) ?? filteredTopics[0] ?? null;

  return (
    <section className="mx-auto max-w-[min(100%,96rem)] space-y-6 p-4 sm:p-6">
      <SummaryHero title="Формулы">
        <SummaryHighlightGrid
          className="mt-1"
          items={[
            {
              label: "Темы",
              value: String(filteredTopics.length),
            },
            {
              label: "В теме",
              value: String(activeTopic?.formulas.length ?? 0),
            },
            {
              label: "Всего",
              value: String(totalFormulaCount),
            },
          ]}
        />
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-3 shadow-[var(--shadow-control)]">
          <div className="flex min-w-max gap-2">
            {filteredTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setSelectedTopicId(topic.id)}
                className={
                  activeTopic?.id === topic.id
                    ? "ui-btn-primary whitespace-nowrap px-3 py-1.5 text-xs"
                    : "ui-btn-secondary whitespace-nowrap px-3 py-1.5 text-xs"
                }
              >
                {topic.title}
              </button>
            ))}
          </div>
        </div>
      </SummaryHero>

      {activeTopic ? (
        <FormulaGroup
          key={activeTopic.id}
          topic={activeTopic}
          formulas={activeTopic.formulas}
          context={valueContext}
        />
      ) : null}
    </section>
  );
}

const FormulaGroup = ({
  topic,
  formulas,
  context,
}: {
  topic: FormulaTopic;
  formulas: Formula[];
  context: FormulaValueContext;
}) => {
  if (!formulas.length) {
    return null;
  }
  return (
    <section className="ui-panel scroll-mt-24 space-y-3 p-5 sm:p-6" id={`topic-${topic.id}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">{topic.title}</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {formulas.map((formula) => (
          <FormulaCard key={formula.id} formula={formula} context={context} />
        ))}
      </div>
    </section>
  );
};

const FormulaCard = ({ formula, context }: { formula: Formula; context: FormulaValueContext }) => {
  const resolvedVariables = formula.variables.map((variable) => ({
    variable,
    data: resolveVariableValue(formula.id, variable, context),
  }));

  const [copied, setCopied] = React.useState<"latex" | "text" | null>(null);
  const copy = async (mode: "latex" | "text") => {
    const payload = mode === "latex" ? formula.formulaLatex ?? formula.latex : buildPlainText(formula);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  };

  return (
    <article id={`formula-${formula.id}`} className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
      <div>
        <h3 className="text-lg font-semibold text-[color:var(--text-base)]">{formula.titleRu ?? formula.title}</h3>
        {formula.relatedFormulaIds?.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-[color:var(--text-muted)]">См. также:</span>
            {formula.relatedFormulaIds.map((relatedId) => {
              const related = formulaById[relatedId];
              if (!related) {
                return null;
              }
              return (
                <a
                  key={relatedId}
                  href={`#formula-${relatedId}`}
                  className="rounded-full border border-[color:var(--border-soft)] px-2 py-0.5 font-semibold text-[color:var(--accent-base)] hover:border-[color:var(--accent-base)]/40"
                >
                  {related.titleRu ?? related.title}
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3">
        <BlockMath math={formula.formulaLatex ?? formula.latex} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy("latex")}
          className="ui-control rounded-full px-3 py-1.5 text-sm font-semibold hover:border-[color:var(--accent-base)]/35"
        >
          {copied === "latex" ? "Скопировано" : "Скопировать LaTeX"}
        </button>
        <button
          type="button"
          onClick={() => copy("text")}
          className="ui-control rounded-full px-3 py-1.5 text-sm font-semibold hover:border-[color:var(--accent-base)]/35"
        >
          {copied === "text" ? "Готово" : "Скопировать текст"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
        <table className="w-full text-sm text-[color:var(--text-muted)]">
          <thead>
            <tr className="text-sm text-[color:var(--text-soft)]">
              <th className="px-3 py-2 text-left font-semibold">Переменная</th>
              <th className="px-3 py-2 text-left font-semibold">Описание</th>
              <th className="px-3 py-2 text-left font-semibold">Значение</th>
              <th className="px-3 py-2 text-left font-semibold">Ед.</th>
              <th className="px-3 py-2 text-left font-semibold">Источник</th>
            </tr>
          </thead>
          <tbody>
            {resolvedVariables.map(({ variable, data }) => (
              <tr key={`${formula.id}-${variable.key}`} className="border-t border-[color:var(--border-soft)]">
                <td className="px-3 py-2 font-semibold text-[color:var(--text-base)]">
                  {variable.symbolLatex ? <InlineMath math={variable.symbolLatex} /> : variable.key}
                </td>
                <td className="px-3 py-2">{variable.label}</td>
                <td className="px-3 py-2">
                  {data.value}
                  {data.reason && <p className="text-xs text-[color:var(--text-soft)]">{data.reason}</p>}
                </td>
                <td className="px-3 py-2">{variable.unit ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-[color:var(--text-soft)]">{variable.source ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Подставленные значения</p>
        <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
          {resolvedVariables.map(({ variable, data }) => (
            <li key={`resolved-${formula.id}-${variable.key}`} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-[color:var(--text-base)]">
                  {variable.symbolLatex ? <InlineMath math={variable.symbolLatex} /> : variable.key}
                </span>
                <span>{data.value}</span>
              </div>
              {data.reason && <span className="text-xs text-[color:var(--text-soft)]">{data.reason}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-3">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Физический смысл</p>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">{formula.physicalMeaning}</p>
      </div>
    </article>
  );
};

const buildPlainText = (formula: Formula): string => {
  const variables = formula.variables
    .map((variable) => `${variable.symbolLatex ?? variable.key}: ${variable.label} (${variable.unit ?? "—"})`)
    .join("\n");
  const assumptionsText = formula.assumptions.map((item) => `- ${item}`).join("\n");
  return [
    formula.title,
    `Метод: ${formula.methodName}`,
    formula.latex,
    variables,
    `Применимость: ${formula.applicability}`,
    `Физический смысл: ${formula.physicalMeaning}`,
    "Допущения:",
    assumptionsText,
  ].join("\n");
};

const AIR_DENSITY = 1.204; // kg/m3
const AIR_HEAT_CAPACITY = 1005; // J/(kgK)
const DEFAULT_HEIGHT = 3;

const formatWithUnit = (value: number, unit?: string, digits = 2): string => {
  const formatted = formatNumber(value, { maximumFractionDigits: digits });
  return unit ? `${formatted} ${unit}` : formatted;
};

const numberFromAssumption = (map: Record<string, Assumption>, id: string): number | null => {
  const entry = map[id];
  if (!entry) {
    return null;
  }
  const normalized = entry.value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function resolveVariableValue(
  formulaId: string,
  variable: FormulaVariable,
  context: FormulaValueContext
): ResolvedVariableValue {
  const { selectedSpace, frame, frames, assumptionMap, uncertaintyConfig } = context;
  const area = selectedSpace?.area_m2 ?? null;
  const volume = selectedSpace?.volume_m3 ?? null;
  const height = area && volume ? volume / area : DEFAULT_HEIGHT;
  const indoorTemp = frame && selectedSpace ? frame.temperatures[selectedSpace.id] ?? null : null;
  const outdoorTemp = null;

  const missing = (message: string): ResolvedVariableValue => ({ value: "—", reason: message });

  switch (formulaId) {
    case "geom_polygon_area":
      if (variable.key === "area") {
        return area != null ? { value: formatWithUnit(area, "м²", 2) } : missing("нет выбранного помещения");
      }
      if (variable.key === "vertex_coords") {
        return selectedSpace ? { value: "используются вершины наброска" } : missing("нет данных контура");
      }
      if (variable.key === "vertex_count") {
        return selectedSpace ? { value: "n", reason: "число вершин берётся из контура" } : missing("контур не создан");
      }
      break;
    case "geom_volume":
      if (variable.key === "volume") {
        return volume != null ? { value: formatWithUnit(volume, "м³", 2) } : missing("у помещения нет сохранённого объёма");
      }
      if (variable.key === "area") {
        return area != null ? { value: formatWithUnit(area, "м²", 2) } : missing("нет площади помещения");
      }
      if (variable.key === "level_height") {
        return { value: formatWithUnit(height, "м", 2), reason: "используется высота уровня или значение по умолчанию" };
      }
      break;
    case "envelope_heat_loss":
      if (variable.key === "u_value") {
        return missing("выберите сборку стены в инспекторе");
      }
      if (variable.key === "area") {
        return area != null ? { value: formatWithUnit(area, "м²", 2) } : missing("нет выбранной стены");
      }
      if (variable.key === "t_in") {
        const fallback = numberFromAssumption(assumptionMap, "comfort_setpoint_day") ?? 21;
        const source = indoorTemp == null ? "используется сетпоинт по умолчанию" : undefined;
        return { value: `${formatNumber(indoorTemp ?? fallback, { maximumFractionDigits: 1 })} °C`, reason: source };
      }
      if (variable.key === "t_out") {
        return outdoorTemp != null ? { value: `${formatNumber(outdoorTemp, { maximumFractionDigits: 1 })} °C` } : missing("нет погодного профиля");
      }
      break;
    case "envelope_infiltration":
      if (variable.key === "rho_air") {
        const value = numberFromAssumption(assumptionMap, "air_density");
        return value != null ? { value: formatWithUnit(value, "кг/м³", 2) } : missing("нет допущения air_density");
      }
      if (variable.key === "cp_air") {
        const valueJ = numberFromAssumption(assumptionMap, "air_cp");
        if (valueJ == null) {
          return missing("нет допущения air_cp");
        }
        return {
          value: formatWithUnit(valueJ / 1000, "кДж/(кг·К)", 3),
          reason: "переведено из Дж/(кг·К) в кДж/(кг·К)",
        };
      }
      if (variable.key === "v_dot_inf") {
        return missing("не задан расход инфильтрации");
      }
      if (variable.key === "delta_t") {
        if (indoorTemp == null || outdoorTemp == null) {
          return missing("нужны температуры помещения и улицы");
        }
        return { value: formatWithUnit(indoorTemp - outdoorTemp, "К", 1) };
      }
      break;
    case "thermal_balance":
    case "thermal_balance_room":
      if (variable.key === "c_node") {
        if (area == null) {
          return missing("нет площади помещения");
        }
        const volumeEstimate = area * (height || DEFAULT_HEIGHT);
        const capacityKJ = (AIR_DENSITY * volumeEstimate * AIR_HEAT_CAPACITY) / 1000;
        return { value: formatWithUnit(capacityKJ, "кДж/К", 1), reason: "оценка по воздуху в помещении" };
      }
      if (variable.key === "u_ij" || variable.key === "a_ij") {
        return missing("рассчитывается после построения стен и смежностей");
      }
      if (variable.key === "q_inf" || variable.key === "q_int" || variable.key === "q_hvac") {
        return missing("зависит от сценариев и решателя");
      }
      break;
    case "thermal_peak_load":
      if (variable.key === "q_peak") {
        return missing("пиковая нагрузка доступна после детального расчёта HVAC");
      }
      if (variable.key === "q_hvac_time") {
        return frames.length
          ? { value: "см. график тепловой нагрузки", reason: "используйте результаты расчёта" }
          : missing("нет данных решателя");
      }
      break;
    case "uncertainty_mc":
      if (variable.key === "samples") {
        return uncertaintyConfig
          ? { value: String(uncertaintyConfig.runs) }
          : missing("не выбрано количество прогонов");
      }
      if (variable.key === "sample_value") {
        return missing("определяется в каждом прогоне Monte Carlo");
      }
      break;
    case "uncertainty_std":
      if (variable.key === "mu_hat") {
        return missing("вычисляется после завершения Монте-Карло");
      }
      if (variable.key === "sample_value") {
        return missing("каждый прогон даёт своё значение");
      }
      if (variable.key === "samples") {
        return uncertaintyConfig
          ? { value: String(uncertaintyConfig.runs) }
          : missing("не задано количество прогонов");
      }
      break;
    case "calibration_rmse":
    case "calibration_mape":
      if (variable.key === "observations") {
        return { value: "12", reason: "введите 12 значений энергии" };
      }
      if (variable.key === "energy_obs") {
        return missing("заполните фактические данные");
      }
      if (variable.key === "energy_sim") {
        return missing("зависит от результатов расчёта");
      }
      break;
    default:
      break;
  }
  return { value: "—" };
}
