import { useEffect, useRef, useState } from "react";
import type { EngineeringEquipmentType } from "../../../entities/engineering/types";
import type { BuildTool } from "../build.store";
import { ENGINEERING_EQUIPMENT_LABELS, EQUIPMENT_VARIANT_DEFAULT, EQUIPMENT_VARIANTS } from "../engineering2d/catalog";

type LibTab = "valves" | "equipment" | "air" | "sensors";

const TAB_LABELS: Record<LibTab, string> = {
  valves: "РђСЂРјР°С‚СѓСЂР°",
  equipment: "РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ",
  air: "Р’РѕР·РґСѓС…",
  sensors: "Р”Р°С‚С‡РёРєРё",
};

const VALVE_BUTTONS: Array<{ type: EngineeringEquipmentType; avokCode: string }> = [
  { type: "valve", avokCode: "2.8.01" },
  { type: "gateValve", avokCode: "2.8.03" },
  { type: "ballValve", avokCode: "2.8.05" },
  { type: "checkValve", avokCode: "2.8.15" },
  { type: "threeWayValve", avokCode: "2.8.08" },
  { type: "controlValve", avokCode: "2.8.09" },
  { type: "balancingValve", avokCode: "2.8.13" },
  { type: "pressureRegulator", avokCode: "2.8.20" },
  { type: "safetyValve", avokCode: "2.8.23" },
  { type: "thermostaticValve", avokCode: "2.8.19" },
  { type: "flowMeter", avokCode: "2.9.04" },
];

const EQUIPMENT_BUTTONS: Array<{ type: EngineeringEquipmentType; avokCode: string }> = [
  { type: "heatExchanger", avokCode: "3.7.01" },
  { type: "pump", avokCode: "3.6.02" },
  { type: "convector", avokCode: "3.1.04" },
  { type: "expansionTank", avokCode: "3.7.06" },
  { type: "manifold", avokCode: "вЂ”" },
  { type: "heatMeter", avokCode: "вЂ”" },
  { type: "automationCabinet", avokCode: "вЂ”" },
];

const AIR_BUTTONS: Array<{ type: EngineeringEquipmentType; avokCode: string }> = [
  { type: "airHandlingUnit", avokCode: "вЂ”" },
  { type: "ductFan", avokCode: "вЂ”" },
  { type: "roofFan", avokCode: "вЂ”" },
  { type: "airFilter", avokCode: "вЂ”" },
  { type: "airDamper", avokCode: "вЂ”" },
  { type: "airCheckValve", avokCode: "—" },
  { type: "fireDamper", avokCode: "вЂ”" },
  { type: "silencer", avokCode: "вЂ”" },
  { type: "airHeater", avokCode: "вЂ”" },
  { type: "airCooler", avokCode: "вЂ”" },
  { type: "airHumidifier", avokCode: "вЂ”" },
  { type: "airDehumidifier", avokCode: "вЂ”" },
  { type: "supplyDiffuser", avokCode: "вЂ”" },
  { type: "exhaustGrille", avokCode: "вЂ”" },
];

AIR_BUTTONS.splice(
  5,
  0,
  { type: "airFlowRegulatorConst", avokCode: "вЂ”" },
  { type: "airFlowRegulatorVar", avokCode: "вЂ”" }
);

const SENSOR_BUTTONS: Array<{ type: EngineeringEquipmentType; avokCode: string }> = [
  { type: "sensorTemperature", avokCode: "5.1.02" },
  { type: "sensorPressure", avokCode: "5.1.05" },
  { type: "sensorFlow", avokCode: "5.1.07" },
  { type: "sensorHumidity", avokCode: "5.1.09" },
];

const AIR_GOST_REFERENCE: Partial<Record<EngineeringEquipmentType, string>> = {
  airHandlingUnit: "Р“РћРЎРў 21.205-2016",
  ductFan: "Р“РћРЎРў 21.205-2016, РїРѕР·. 20",
  airFilter: "Р“РћРЎРў 21.205-2016, РїРѕР·. 23",
  airDamper: "Р“РћРЎРў 21.205-2016, РїРѕР·. 24",
  fireDamper: "Р“РћРЎРў 21.205-2016, РїРѕР·. 15",
  silencer: "Р“РћРЎРў 21.205-2016, РїРѕР·. 27",
  airHeater: "Р“РћРЎРў 21.205-2016, РїРѕР·. 2",
  airCooler: "Р“РћРЎРў 21.205-2016, РїРѕР·. 3",
  airHumidifier: "Р“РћРЎРў 21.205-2016",
  airDehumidifier: "Р“РћРЎРў 21.205-2016",
  supplyDiffuser: "Р“РћРЎРў 21.205-2016, С‚Р°Р±Р». 10, РїРѕР·. 1",
  exhaustGrille: "Р“РћРЎРў 21.205-2016, С‚Р°Р±Р». 10, РїРѕР·. 2",
};

AIR_GOST_REFERENCE.airFlowRegulatorConst = "Р“РћРЎРў 21.205-2016, РїРѕР·. 17";
AIR_GOST_REFERENCE.airFlowRegulatorVar = "Р“РћРЎРў 21.205-2016, РїРѕР·. 18";
AIR_GOST_REFERENCE.roofFan = "Р“РћРЎРў 21.205-2016";
AIR_GOST_REFERENCE.airCheckValve = "ГОСТ 21.205-2016";

interface EngineeringLibraryPanelProps {
  currentTool: BuildTool;
  selectedType: EngineeringEquipmentType;
  selectedVariant?: string;
  onPickEquipment: (type: EngineeringEquipmentType, variant?: string) => void;
  onPickPipe: () => void;
  onAddItpParallelDhw: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return <p className="ui-engineering-lib__label">{children}</p>;
}

function buildEquipmentTitle(type: EngineeringEquipmentType, code: string): string {
  const label = ENGINEERING_EQUIPMENT_LABELS[type];
  const gostRef = AIR_GOST_REFERENCE[type];
  if (gostRef) {
    return `${label} В· ${gostRef}`;
  }
  if (code === "вЂ”" || code === "РІР‚вЂ”") {
    return label;
  }
  return `${label} В· ${code}`;
}

function QuickActionButton({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`ui-engineering-lib__action ${active ? "ui-engineering-lib__action--active" : ""}`}
    >
      <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

function VariantDropdown({
  type,
  currentVariant,
  onSelect,
  onClose,
}: {
  type: EngineeringEquipmentType;
  currentVariant: string;
  onSelect: (variant: string) => void;
  onClose: () => void;
}) {
  const variants = EQUIPMENT_VARIANTS[type];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!variants?.length) {
    return null;
  }

  return (
    <div ref={ref} className="ui-engineering-lib__variant-menu">
      {variants.map((variant) => (
        <button
          key={variant.key}
          type="button"
          onMouseDown={(event) => {
            event.stopPropagation();
            onSelect(variant.key);
            onClose();
          }}
          className={`ui-engineering-lib__variant-item ${
            variant.key === currentVariant ? "ui-engineering-lib__variant-item--active" : ""
          }`}
        >
          {variant.key === currentVariant ? (
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent-base)]" />
          ) : (
            <span className="inline-block h-1.5 w-1.5 shrink-0" />
          )}
          {variant.label}
        </button>
      ))}
    </div>
  );
}

function EquipmentListItem({
  label,
  title,
  active,
  equipmentType,
  hasVariants,
  currentVariant,
  onPickVariant,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  equipmentType?: EngineeringEquipmentType;
  hasVariants: boolean;
  currentVariant?: string;
  onPickVariant?: (variant: string) => void;
  onClick: () => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const variants = equipmentType && hasVariants ? EQUIPMENT_VARIANTS[equipmentType] : undefined;
  const variantLabel = variants?.find((variant) => variant.key === currentVariant)?.label;

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <div className={`ui-engineering-lib__item ${active ? "ui-engineering-lib__item--active" : ""}`}>
        <button type="button" title={title} aria-label={title} aria-pressed={active} onClick={onClick} className="ui-engineering-lib__item-main">
          <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight">{label}</span>
        </button>
        {hasVariants ? (
          <button
            type="button"
            aria-label={`Р’Р°СЂРёР°РЅС‚: ${variantLabel ?? "РЅРµ РІС‹Р±СЂР°РЅ"}`}
            aria-expanded={dropdownOpen}
            onClick={(event) => {
              event.stopPropagation();
              setDropdownOpen((open) => !open);
            }}
            className={`ui-engineering-lib__variant-trigger ${active ? "ui-engineering-lib__variant-trigger--active" : ""}`}
          >
            <span className="max-w-[5.5rem] truncate">{variantLabel ?? "Р’Р°СЂРёР°РЅС‚"}</span>
            <span aria-hidden="true">в–ѕ</span>
          </button>
        ) : null}
      </div>
      {dropdownOpen && hasVariants && equipmentType && onPickVariant ? (
        <VariantDropdown
          type={equipmentType}
          currentVariant={currentVariant ?? ""}
          onSelect={(variant) => {
            onPickVariant(variant);
            setDropdownOpen(false);
          }}
          onClose={() => setDropdownOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function EngineeringLibraryPanel({
  currentTool,
  selectedType,
  selectedVariant,
  onPickEquipment,
  onPickPipe,
  onAddItpParallelDhw,
}: EngineeringLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<LibTab>("valves");
  const [variantByType, setVariantByType] = useState<Partial<Record<EngineeringEquipmentType, string>>>({});

  const getVariant = (type: EngineeringEquipmentType): string | undefined => {
    return variantByType[type] ?? EQUIPMENT_VARIANT_DEFAULT[type];
  };

  const handlePickVariant = (type: EngineeringEquipmentType, variant: string) => {
    setVariantByType((prev) => ({ ...prev, [type]: variant }));
    if (currentTool === "engineeringEquipment" && selectedType === type) {
      onPickEquipment(type, variant);
    }
  };

  const isEquipmentActive = (type: EngineeringEquipmentType) =>
    currentTool === "engineeringEquipment" && selectedType === type;

  const currentButtons =
    activeTab === "valves"
      ? VALVE_BUTTONS
      : activeTab === "air"
        ? AIR_BUTTONS
        : activeTab === "sensors"
          ? SENSOR_BUTTONS
          : EQUIPMENT_BUTTONS;

  return (
    <div className="ui-engineering-lib">
      <section className="ui-engineering-lib__section">
        <SectionLabel>РџРѕРґРєР»СЋС‡РµРЅРёРµ</SectionLabel>
        <div className="ui-engineering-lib__actions">
          <QuickActionButton
            label="РЎРѕРµРґРёРЅРёС‚СЊ С‚СЂСѓР±РѕР№"
            title="РРЅР¶РµРЅРµСЂРЅС‹Р№ С‚СЂСѓР±РѕРїСЂРѕРІРѕРґ"
            active={currentTool === "engineeringPipe"}
            onClick={onPickPipe}
          />
          <QuickActionButton
            label="РРўРџ РїР°СЂР°Р». Р“Р’РЎ + Р·Р°РІ. РѕС‚РѕРїР»РµРЅРёРµ"
            title="РРўРџ РїР°СЂР°Р». Р“Р’РЎ + Р·Р°РІ. РѕС‚РѕРїР»РµРЅРёРµ"
            onClick={onAddItpParallelDhw}
          />
        </div>
      </section>

      <section className="ui-engineering-lib__section">
        <div className="ui-segmented-control flex w-full" role="tablist" aria-label="РљР°С‚РµРіРѕСЂРёСЏ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ">
          {(Object.entries(TAB_LABELS) as [LibTab, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`ui-segmented-control__item min-w-0 flex-1 px-2 py-1.5 text-[11px] ${
                activeTab === id ? "ui-segmented-control__item--active" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="ui-engineering-lib__section">
        <div className="ui-engineering-lib__list">
          {currentButtons.map((button) => {
            const hasVariants = Boolean(EQUIPMENT_VARIANTS[button.type]?.length);
            const variant = getVariant(button.type);

            return (
                <EquipmentListItem
                  key={button.type}
                  equipmentType={button.type}
                  label={ENGINEERING_EQUIPMENT_LABELS[button.type]}
                  title={buildEquipmentTitle(button.type, button.avokCode)}
                  active={isEquipmentActive(button.type)}
                  hasVariants={hasVariants}
                  currentVariant={variant}
                onPickVariant={(nextVariant) => handlePickVariant(button.type, nextVariant)}
                onClick={() => onPickEquipment(button.type, variant)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default EngineeringLibraryPanel;

