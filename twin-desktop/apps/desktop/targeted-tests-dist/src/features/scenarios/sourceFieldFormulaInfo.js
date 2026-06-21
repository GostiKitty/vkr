import { formulaMap } from "../../entities/formulas/registry";
function formulaInfoFromRegistry(primaryId, options) {
    const formula = formulaMap[primaryId];
    if (!formula) {
        return undefined;
    }
    const related = options?.relatedIds ?? formula.relatedFormulaIds ?? [];
    const linkedFormulaIds = [primaryId, ...related.filter((id) => id !== primaryId && formulaMap[id])];
    return {
        title: formula.titleRu ?? formula.title,
        meaning: options?.meaning ?? formula.description,
        formula: options?.formula ?? formula.formulaLatex ?? formula.latex,
        inputs: options?.inputs,
        calculatedIn: options?.calculatedIn ?? formula.sourceFiles?.join(", "),
        linkedFormulaIds: [...new Set(linkedFormulaIds)],
    };
}
const SOURCE_FIELD_FORMULA_INFO = {
    "materials.bridge-mode": formulaInfoFromRegistry("bridge_accounting_mode_resolve"),
    "materials.homogeneity-coefficient": formulaInfoFromRegistry("model_homogeneity_area_weighted", {
        relatedIds: ["homogeneity_from_linear_point_bridges", "reduced_resistance_homogeneity"],
        inputs: ["ψ, χ и площади фрагментов ограждения", "R_0 однородной части"],
    }),
    "materials.window-u": formulaInfoFromRegistry("opening_u_area_weighted", {
        relatedIds: ["u_value_from_resistance"],
        inputs: ["U и площади окон из модели"],
    }),
    "materials.door-u": formulaInfoFromRegistry("opening_u_area_weighted", {
        relatedIds: ["u_value_from_resistance"],
        inputs: ["U и площади дверей из модели"],
    }),
    "materials.window-g": formulaInfoFromRegistry("opening_effective_g_value", {
        inputs: ["g-value остекления из модели и пресетов"],
    }),
    "materials.shading-factor": formulaInfoFromRegistry("effective_shading_solar_combine", {
        relatedIds: ["model_shading_area_weighted", "facade_solar_access_factor", "solar_position_altitude_azimuth"],
        inputs: ["архитектурное затенение s_0", "ориентация фасада", "положение солнца"],
    }),
    "materials.h-psi": formulaInfoFromRegistry("envelope_H_psi_H_chi_aggregate", {
        relatedIds: ["thermal_bridge_linear", "envelope_enrich_linear_psi"],
        inputs: ["ψ_i, длины l_i по фрагментам ограждения"],
    }),
    "materials.h-chi": formulaInfoFromRegistry("envelope_H_psi_H_chi_aggregate", {
        relatedIds: ["thermal_bridge_point"],
        inputs: ["χ_j, количество n_j по фрагментам ограждения"],
    }),
    "materials.u-eq": formulaInfoFromRegistry("derived_u_eq", {
        relatedIds: ["u_value_from_resistance", "opening_u_area_weighted"],
    }),
    "materials.h-tr": formulaInfoFromRegistry("heat_loss_coefficient_total", {
        meaning: "Трансмиссионный коэффициент H_tr = Σ U_i·A_i по ограждениям модели.",
        relatedIds: ["u_value_from_resistance", "transmission_loss"],
    }),
    "materials.h-total": formulaInfoFromRegistry("derived_h_total", {
        relatedIds: ["heat_loss_coefficient_total"],
    }),
    "materials.q-tr": formulaInfoFromRegistry("transmission_loss", {
        relatedIds: ["u_value_from_resistance"],
    }),
    "materials.q-bridges": formulaInfoFromRegistry("thermal_bridge_heat_loss_sum", {
        relatedIds: ["envelope_H_psi_H_chi_aggregate"],
    }),
    "materials.bridge-share": formulaInfoFromRegistry("thermal_bridge_heat_loss_sum", {
        meaning: "Доля теплопотерь через мостики холода относительно суммарных потерь оболочки.",
        formula: String.raw `\text{доля} = 100 \cdot \frac{\dot{Q}_{bridge}}{\dot{Q}_{tot}}`,
        relatedIds: ["thermal_bridge_heat_loss_sum"],
    }),
    "geometry.floor-area": formulaInfoFromRegistry("geom_polygon_area", {
        inputs: ["контуры помещений модели"],
    }),
    "geometry.heated-area": formulaInfoFromRegistry("geom_polygon_area", {
        meaning: "Сумма площадей отапливаемых помещений по контурам модели.",
        inputs: ["отапливаемые помещения"],
    }),
    "geometry.heated-volume": formulaInfoFromRegistry("geometry_heated_volume", {
        relatedIds: ["geom_volume"],
    }),
    "geometry.facade-area": formulaInfoFromRegistry("geom_polygon_area", {
        meaning: "Суммарная площадь наружных фасадов по геометрии модели.",
    }),
    "geometry.envelope-area": formulaInfoFromRegistry("geom_polygon_area", {
        meaning: "Площадь наружной оболочки A_env по граням модели.",
    }),
    "geometry.wwr": formulaInfoFromRegistry("derived_wwr", {
        relatedIds: ["geometry_opening_area"],
    }),
    "geometry.compactness": formulaInfoFromRegistry("derived_compactness"),
    "geometry.window-area": formulaInfoFromRegistry("geometry_opening_area", {
        inputs: ["ширина и высота окон в модели"],
    }),
    "geometry.door-area": formulaInfoFromRegistry("geometry_opening_area", {
        meaning: "Суммарная площадь дверей по габаритам проёмов модели.",
        inputs: ["ширина и высота дверей в модели"],
    }),
    "geometry.roof-area": formulaInfoFromRegistry("geom_polygon_area", {
        meaning: "Сумма площадей элементов кровли по контурам модели.",
        inputs: ["контуры кровли"],
    }),
    "geometry.floor-slab-area": formulaInfoFromRegistry("geom_polygon_area", {
        meaning: "Сумма площадей плит пола и перекрытий по контурам модели.",
        inputs: ["контуры плит пола и перекрытий"],
    }),
    "climate.gsop": formulaInfoFromRegistry("climate_gsop"),
    "climate.deltaT": formulaInfoFromRegistry("transmission_loss", {
        meaning: "Расчётная разность температур для стационарных проверок: ΔT = T_in − T_out.",
        formula: String.raw `\Delta T = T_{in} - T_{out}`,
        relatedIds: ["climate_resolve_sp131_city"],
    }),
    "air.total-volume": formulaInfoFromRegistry("geometry_heated_volume", {
        relatedIds: ["geom_volume"],
        meaning: "Суммарный отапливаемый объём здания по геометрии модели.",
    }),
    "air.infiltration-ach": formulaInfoFromRegistry("infiltration_ach_from_flow", {
        relatedIds: [
            "infiltration_envelope_leakage_flow",
            "infiltration_pressure_wind",
            "infiltration_pressure_stack",
            "scenario_infiltration_ach_resolve",
        ],
        meaning: "Кратность инфильтрации из расчётного расхода утечек или заданного режима.",
    }),
    "air.infiltration-source": formulaInfoFromRegistry("scenario_infiltration_ach_resolve", {
        meaning: "Показывает, откуда взята кратность: вручную, из модели, расчёт утечек или дефолт.",
    }),
    "air.ventilation-ach": formulaInfoFromRegistry("scenario_ventilation_ach_resolve", {
        relatedIds: ["ventilation_effective_ach", "airflow_rate"],
    }),
    "air.infiltration-flow": formulaInfoFromRegistry("airflow_rate", {
        meaning: "Объёмный расход инфильтрации: L_inf = n_inf · V / 3600.",
        relatedIds: ["envelope_infiltration", "infiltration_ach_from_flow"],
    }),
    "air.ventilation-flow": formulaInfoFromRegistry("airflow_rate", {
        meaning: "Объёмный расход механической вентиляции: L_vent = n_vent · V / 3600.",
        relatedIds: ["ventilation_loss", "rc_ventilation_conductance"],
    }),
    "air.pressure-wind": formulaInfoFromRegistry("infiltration_pressure_wind"),
    "air.pressure-stack": formulaInfoFromRegistry("infiltration_pressure_stack"),
    "air.pressure-total": formulaInfoFromRegistry("infiltration_envelope_leakage_flow", {
        meaning: "Суммарный перепад давления для расчёта утечек.",
        formula: String.raw `\Delta P_{total} = \Delta P_{wind} + \Delta P_{stack} + \Delta P_{mech}`,
        relatedIds: ["infiltration_pressure_wind", "infiltration_pressure_stack"],
    }),
    "air.q-inf": formulaInfoFromRegistry("envelope_infiltration", {
        relatedIds: ["rc_infiltration_g", "airflow_rate"],
    }),
    "air.q-vent-before": formulaInfoFromRegistry("ventilation_loss", {
        relatedIds: ["airflow_rate"],
    }),
    "air.q-vent-after": formulaInfoFromRegistry("ventilation_recovery", {
        relatedIds: ["ventilation_loss", "rc_ventilation_conductance"],
    }),
    "air.saved-by-recovery": formulaInfoFromRegistry("ventilation_recovery", {
        meaning: "Снижение вентиляционных потерь за счёт рекуперации: Q_до − Q_после.",
        formula: String.raw `\dot{Q}_{saved} = \dot{Q}_{vent,before} - \dot{Q}_{vent,after}`,
    }),
    "air.h-inf": formulaInfoFromRegistry("rc_infiltration_g", {
        relatedIds: ["envelope_infiltration"],
    }),
    "air.h-vent-before": formulaInfoFromRegistry("rc_ventilation_conductance", {
        meaning: "Коэффициент потерь на вентиляцию до учёта рекуперации: H_ve = ρ·c_p·L.",
        formula: String.raw `H_{ve} = \rho \, c_p \, L`,
        relatedIds: ["ventilation_loss"],
    }),
    "air.h-vent": formulaInfoFromRegistry("ventilation_recovery", {
        meaning: "Эффективный коэффициент потерь на вентиляцию после рекуперации.",
        relatedIds: ["rc_ventilation_conductance", "ventilation_effective_ach"],
    }),
    "air.h-total": formulaInfoFromRegistry("heat_loss_coefficient_total", {
        meaning: "Сумма H_inf и H_ve (и других компонентов воздухообмена в сводке).",
        relatedIds: ["rc_infiltration_g", "rc_ventilation_conductance"],
    }),
    "scenario.ventilation.infiltration-ach": formulaInfoFromRegistry("scenario_infiltration_ach_resolve"),
    "scenario.ventilation.ventilation-ach": formulaInfoFromRegistry("scenario_ventilation_ach_resolve", {
        relatedIds: ["ventilation_effective_ach"],
    }),
    "scenario.ventilation.heat-recovery": formulaInfoFromRegistry("ventilation_effective_ach", {
        meaning: "КПД рекуперации снижает эффективную кратность приточного воздуха.",
        relatedIds: ["ventilation_recovery"],
    }),
    "scenario.ventilation.stack-height": formulaInfoFromRegistry("infiltration_pressure_stack", {
        meaning: "Высота здания для штабельного перепада; по умолчанию из геометрии этажей модели.",
        relatedIds: ["geom_volume"],
    }),
};
const SUFFIX_FORMULA_IDS = [
    { test: (key) => key.endsWith(":r0"), primaryId: "assembly_resistance_series", relatedIds: ["total_resistance"] },
    {
        test: (key) => key.endsWith(":rred"),
        primaryId: "reduced_resistance_homogeneity",
        relatedIds: ["homogeneity_from_linear_point_bridges"],
    },
    { test: (key) => key.endsWith(":u"), primaryId: "u_value_from_resistance" },
    { test: (key) => key.endsWith(":bridge-mode"), primaryId: "bridge_accounting_mode_resolve" },
    { test: (key) => /:layer:\d+:r$/.test(key), primaryId: "layer_resistance" },
];
export function getSourceFieldFormulaInfo(fieldKey) {
    const direct = SOURCE_FIELD_FORMULA_INFO[fieldKey];
    if (direct) {
        return direct;
    }
    for (const entry of SUFFIX_FORMULA_IDS) {
        if (entry.test(fieldKey)) {
            return formulaInfoFromRegistry(entry.primaryId, { relatedIds: entry.relatedIds });
        }
    }
    return undefined;
}
