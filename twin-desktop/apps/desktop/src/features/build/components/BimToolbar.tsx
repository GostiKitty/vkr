import type { EquipmentType } from "../../../entities/networks/types";
import type { BuildTool } from "../build.store";
import Tooltip from "../../../shared/ui/Tooltip";

export type BuildViewportMode = "plan" | "view3d" | "networks" | "results";

interface ToolbarButton {
  id: string;
  label: string;
  description: string;
  formulaIds?: string[];
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
}

interface BimToolbarProps {
  activeTool: BuildTool;
  activeViewport: BuildViewportMode;
  equipmentPreset: EquipmentType;
  heatmapAvailable: boolean;
  onToolChange: (tool: BuildTool) => void;
  onEquipmentPresetChange: (type: EquipmentType) => void;
  onViewportChange: (mode: BuildViewportMode) => void;
  onImportIfc: () => void;
  onImportRevit: () => void;
  onExportIfc: () => void;
  onExportPng: () => void;
  onSnapshot: () => void;
}

const buttonBase =
  "inline-flex items-center px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)]";

function ToolbarAction({ button }: { button: ToolbarButton }) {
  const content = button.disabled ? button.disabledReason ?? "\u0424\u0443\u043d\u043a\u0446\u0438\u044f \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430." : button.description;
  const formulas = button.disabled ? [] : button.formulaIds;
  const className = `${buttonBase} ${
    button.disabled
      ? "ui-control cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
      : button.active
        ? "ui-control border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] shadow-sm"
        : "ui-control text-[color:var(--text-muted)]"
  }`;

  return (
    <Tooltip title={button.label} description={content} linkedFormulaIds={formulas}>
      <span className="inline-flex">
        <button type="button" onClick={button.onClick} disabled={button.disabled} className={className}>
          {button.label}
        </button>
      </span>
    </Tooltip>
  );
}

function ToolbarGroup({ title, buttons }: { title: string; buttons: ToolbarButton[] }) {
  return (
    <div className="ui-toolbar flex flex-wrap items-center gap-2 px-3 py-3">
      <span className="ui-kicker mr-1">{title}</span>
      {buttons.map((button) => (
        <ToolbarAction key={button.id} button={button} />
      ))}
    </div>
  );
}

export function BimToolbar({
  activeTool,
  activeViewport,
  equipmentPreset,
  heatmapAvailable,
  onToolChange,
  onEquipmentPresetChange,
  onViewportChange,
  onImportIfc,
  onImportRevit,
  onExportIfc,
  onExportPng,
  onSnapshot,
}: BimToolbarProps) {
  const modelButtons: ToolbarButton[] = [
    {
      id: "roomRect",
      label: "\u041a\u043e\u043c\u043d\u0430\u0442\u0430",
      description: "\u041f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0430\u044f \u043a\u043e\u043c\u043d\u0430\u0442\u0430 \u0441 \u0431\u044b\u0441\u0442\u0440\u044b\u043c \u043f\u043e\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u0435\u043c \u043f\u043e \u0434\u0432\u0443\u043c \u0442\u043e\u0447\u043a\u0430\u043c.",
      formulaIds: ["geom_polygon_area", "geom_volume"],
      active: activeTool === "roomRect",
      onClick: () => onToolChange("roomRect"),
    },
    {
      id: "wall",
      label: "\u0421\u0442\u0435\u043d\u0430",
      description: "\u0421\u0442\u0435\u043d\u043e\u0432\u043e\u0439 \u0441\u0435\u0433\u043c\u0435\u043d\u0442 \u0441 \u0442\u043e\u043b\u0449\u0438\u043d\u043e\u0439 \u0438 \u0432\u044b\u0441\u043e\u0442\u043e\u0439 \u0434\u043b\u044f BIM-\u043c\u043e\u0434\u0435\u043b\u0438.",
      formulaIds: ["envelope_heat_loss"],
      active: activeTool === "wall",
      onClick: () => onToolChange("wall"),
    },
    {
      id: "window",
      label: "\u041e\u043a\u043d\u043e",
      description: "\u041e\u043a\u043e\u043d\u043d\u044b\u0439 \u043f\u0440\u043e\u0451\u043c \u0441 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0439 \u043f\u0440\u0438\u0432\u044f\u0437\u043a\u043e\u0439 \u043a \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0435\u0439 \u0441\u0442\u0435\u043d\u0435.",
      formulaIds: ["envelope_heat_loss"],
      active: activeTool === "window",
      onClick: () => onToolChange("window"),
    },
    {
      id: "door",
      label: "\u0414\u0432\u0435\u0440\u044c",
      description: "\u0414\u0432\u0435\u0440\u043d\u043e\u0439 \u043f\u0440\u043e\u0451\u043c \u0441 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u0435\u043c \u043f\u043e \u0441\u0442\u0435\u043d\u0435 \u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u043e\u0439 \u043f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u0439.",
      formulaIds: ["envelope_infiltration"],
      active: activeTool === "door",
      onClick: () => onToolChange("door"),
    },
  ];

  const networkButtons: ToolbarButton[] = [
    {
      id: "pipe",
      label: "\u0422\u0440\u0443\u0431\u0430",
      description: "\u041f\u043e\u043b\u0438\u043b\u0438\u043d\u0438\u044f \u0442\u0440\u0443\u0431\u043e\u043f\u0440\u043e\u0432\u043e\u0434\u0430 \u0441 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0430\u043c\u0438 \u0434\u0438\u0430\u043c\u0435\u0442\u0440\u0430, \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b \u0438 \u0440\u0430\u0441\u0445\u043e\u0434\u0430.",
      formulaIds: ["coolant_flow_rate"],
      active: activeTool === "pipe",
      onClick: () => onToolChange("pipe"),
    },
    {
      id: "duct",
      label: "\u0412\u043e\u0437\u0434\u0443\u0445\u043e\u0432\u043e\u0434",
      description: "\u0422\u0440\u0430\u0441\u0441\u0430 \u0432\u043e\u0437\u0434\u0443\u0445\u043e\u0432\u043e\u0434\u0430 \u0441 \u0440\u0430\u0441\u0447\u0451\u0442\u043d\u044b\u043c \u0440\u0430\u0441\u0445\u043e\u0434\u043e\u043c \u0432\u043e\u0437\u0434\u0443\u0445\u0430.",
      formulaIds: ["airflow_rate", "pressure_drop_simple"],
      active: activeTool === "duct",
      onClick: () => onToolChange("duct"),
    },
    {
      id: "radiator",
      label: "\u0420\u0430\u0434\u0438\u0430\u0442\u043e\u0440",
      description: "\u0420\u0430\u0437\u043c\u0435\u0449\u0430\u0435\u0442 \u043e\u0442\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u043f\u0440\u0438\u0431\u043e\u0440 \u0432 \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0438.",
      formulaIds: ["radiator_heat_output"],
      active: activeTool === "equipment" && equipmentPreset === "radiator",
      onClick: () => {
        onEquipmentPresetChange("radiator");
        onToolChange("equipment");
      },
    },
    {
      id: "diffuser",
      label: "\u0412\u0435\u043d\u0442\u0440\u0435\u0448\u0451\u0442\u043a\u0430",
      description: "\u0420\u0430\u0437\u043c\u0435\u0449\u0430\u0435\u0442 \u0432\u0435\u043d\u0442\u0438\u043b\u044f\u0446\u0438\u043e\u043d\u043d\u0443\u044e \u0440\u0435\u0448\u0451\u0442\u043a\u0443 \u0438\u043b\u0438 \u0434\u0438\u0444\u0444\u0443\u0437\u043e\u0440 \u0432 \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0438.",
      formulaIds: ["airflow_rate"],
      active: activeTool === "equipment" && equipmentPreset === "diffuser",
      onClick: () => {
        onEquipmentPresetChange("diffuser");
        onToolChange("equipment");
      },
    },
    {
      id: "pump",
      label: "\u041d\u0430\u0441\u043e\u0441",
      description: "\u0420\u0430\u0437\u043c\u0435\u0449\u0430\u0435\u0442 \u043d\u0430\u0441\u043e\u0441 \u0434\u043b\u044f \u0433\u0438\u0434\u0440\u0430\u0432\u043b\u0438\u0447\u0435\u0441\u043a\u043e\u0439 \u0441\u0435\u0442\u0438.",
      formulaIds: ["pressure_drop_simple"],
      active: activeTool === "equipment" && equipmentPreset === "pump",
      onClick: () => {
        onEquipmentPresetChange("pump");
        onToolChange("equipment");
      },
    },
    {
      id: "heat_exchanger",
      label: "\u0412\u043e\u0434\u043e\u043f\u043e\u0434\u043e\u0433\u0440\u0435\u0432\u0430\u0442\u0435\u043b\u044c",
      description: "\u041f\u043b\u0430\u0441\u0442\u0438\u043d\u0447\u0430\u0442\u044b\u0439 \u0432\u043e\u0434\u043e\u043f\u043e\u0434\u043e\u0433\u0440\u0435\u0432\u0430\u0442\u0435\u043b\u044c \u0422\u041f (\u0421\u041f 41-101-95, \u043f. 4.2).",
      formulaIds: ["radiator_heat_output"],
      active: activeTool === "equipment" && equipmentPreset === "heat_exchanger",
      onClick: () => {
        onEquipmentPresetChange("heat_exchanger");
        onToolChange("equipment");
      },
    },
    {
      id: "elevator",
      label: "\u042d\u043b\u0435\u0432\u0430\u0442\u043e\u0440",
      description: "\u0412\u043e\u0434\u043e\u0441\u0442\u0440\u0443\u0439\u043d\u044b\u0439 \u044d\u043b\u0435\u0432\u0430\u0442\u043e\u0440 (\u0421\u041f 41-101-95, \u043f. 4.4).",
      formulaIds: ["pressure_drop_simple"],
      active: activeTool === "equipment" && equipmentPreset === "elevator",
      onClick: () => {
        onEquipmentPresetChange("elevator");
        onToolChange("equipment");
      },
    },
    {
      id: "expansion_tank",
      label: "\u0420\u0430\u0441\u0448\u0438\u0440\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0431\u0430\u043a",
      description: "\u041c\u0435\u043c\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0431\u0430\u043a \u043d\u0430 \u043e\u0431\u0440\u0430\u0442\u043d\u043e\u043c \u043a\u043e\u043d\u0442\u0443\u0440\u0435 (\u0421\u041f 41-101-95, \u043f. 4.5).",
      formulaIds: ["pressure_drop_simple"],
      active: activeTool === "equipment" && equipmentPreset === "expansion_tank",
      onClick: () => {
        onEquipmentPresetChange("expansion_tank");
        onToolChange("equipment");
      },
    },
    {
      id: "dirt_separator",
      label: "\u0413\u0440\u044f\u0437\u0435\u0432\u0438\u043a",
      description: "\u041c\u0430\u0433\u043d\u0438\u0442\u043d\u044b\u0439 \u0433\u0440\u044f\u0437\u0435\u0432\u0438\u043a \u043d\u0430 \u0432\u0432\u043e\u0434\u0435 \u0422\u041f (\u0421\u041f 41-101-95, \u043f. 4.6).",
      formulaIds: ["pressure_drop_simple"],
      active: activeTool === "equipment" && equipmentPreset === "dirt_separator",
      onClick: () => {
        onEquipmentPresetChange("dirt_separator");
        onToolChange("equipment");
      },
    },
    {
      id: "sensor",
      label: "\u0414\u0430\u0442\u0447\u0438\u043a",
      description: "\u0420\u0430\u0437\u043c\u0435\u0449\u0430\u0435\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b, \u0432\u043b\u0430\u0436\u043d\u043e\u0441\u0442\u0438, CO2 \u0438 \u0434\u0440\u0443\u0433\u0438\u0445 \u0432\u0435\u043b\u0438\u0447\u0438\u043d.",
      formulaIds: ["thermal_balance_room"],
      active: activeTool === "sensor",
      onClick: () => onToolChange("sensor"),
    },
  ];

  const viewButtons: ToolbarButton[] = [
    {
      id: "plan",
      label: "\u041f\u043b\u0430\u043d",
      description: "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0433\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0438 \u0438 BIM-\u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432 \u043d\u0430 2D-\u043f\u043b\u0430\u043d\u0435.",
      active: activeViewport === "plan",
      onClick: () => onViewportChange("plan"),
    },
    {
      id: "view3d",
      label: "3D",
      description: "\u041e\u0431\u044a\u0451\u043c\u043d\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u043c\u043e\u0434\u0435\u043b\u0438 \u0441 \u0432\u044b\u0431\u043e\u0440\u043e\u043c \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432.",
      active: activeViewport === "view3d",
      onClick: () => onViewportChange("view3d"),
    },
    {
      id: "networks",
      label: "\u0421\u0435\u0442\u0438",
      description: "\u0420\u0430\u0431\u043e\u0447\u0438\u0439 \u0440\u0435\u0436\u0438\u043c \u0434\u043b\u044f \u0442\u0440\u0443\u0431, \u0432\u043e\u0437\u0434\u0443\u0445\u043e\u0432\u043e\u0434\u043e\u0432, \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f \u0438 \u0434\u0430\u0442\u0447\u0438\u043a\u043e\u0432.",
      active: activeViewport === "networks",
      onClick: () => onViewportChange("networks"),
    },
    {
      id: "heatmap",
      label: "\u0422\u0435\u043f\u043b\u043e\u0432\u0430\u044f \u043a\u0430\u0440\u0442\u0430",
      description: heatmapAvailable
        ? "\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 3D-\u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u043d\u043e\u0439 \u043e\u043a\u0440\u0430\u0441\u043a\u043e\u0439 \u043f\u043e \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0430\u043c \u0440\u0430\u0441\u0447\u0451\u0442\u0430."
        : "\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043e\u0431\u044b \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0442\u0435\u043f\u043b\u043e\u0432\u0443\u044e \u043a\u0430\u0440\u0442\u0443.",
      active: heatmapAvailable && activeViewport === "view3d",
      disabled: !heatmapAvailable,
      disabledReason: "\u0422\u0435\u043f\u043b\u043e\u0432\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430.",
      onClick: () => onViewportChange("view3d"),
    },
  ];

  const fileButtons: ToolbarButton[] = [
    {
      id: "import-ifc",
      label: "\u0418\u043c\u043f\u043e\u0440\u0442 IFC",
      description: "\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u043c\u0430\u0441\u0442\u0435\u0440 \u0438\u043c\u043f\u043e\u0440\u0442\u0430 IFC-\u043c\u043e\u0434\u0435\u043b\u0438.",
      onClick: onImportIfc,
    },
    {
      id: "import-rvt",
      label: "\u0418\u043c\u043f\u043e\u0440\u0442 Revit",
      description: "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u043f\u043e \u043a\u043e\u043d\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u0438 Revit \u0432 IFC.",
      onClick: onImportRevit,
    },
    {
      id: "export-ifc",
      label: "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 IFC",
      description: "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 BIM-\u043c\u043e\u0434\u0435\u043b\u0438 \u0432 IFC.",
      disabled: true,
      disabledReason: "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 IFC \u0435\u0449\u0451 \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435. \u041f\u043e\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b Twin JSON, PNG \u0438 \u0441\u043d\u0438\u043c\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.",
      onClick: onExportIfc,
    },
    {
      id: "export-png",
      label: "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 PNG",
      description: "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442 \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0432\u0438\u0434 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0430 \u0432 PNG.",
      onClick: onExportPng,
    },
    {
      id: "snapshot",
      label: "\u0421\u043d\u0438\u043c\u043e\u043a",
      description: "\u0421\u043e\u0437\u0434\u0430\u0451\u0442 \u0441\u043d\u0438\u043c\u043e\u043a \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0432\u0438\u0434\u0430 \u0438\u043b\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.",
      onClick: onSnapshot,
    },
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-[1.2fr,1.7fr,1fr,1.15fr]">
      <ToolbarGroup title="\u041c\u043e\u0434\u0435\u043b\u044c" buttons={modelButtons} />
      <ToolbarGroup title="\u0418\u043d\u0436\u0435\u043d\u0435\u0440\u043d\u044b\u0435 \u0441\u0435\u0442\u0438" buttons={networkButtons} />
      <ToolbarGroup title="\u0412\u0438\u0434" buttons={viewButtons} />
      <ToolbarGroup title="\u0424\u0430\u0439\u043b" buttons={fileButtons} />
    </div>
  );
}

export default BimToolbar;

