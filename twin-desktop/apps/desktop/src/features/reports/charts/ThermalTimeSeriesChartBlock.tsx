import { useTwinStore } from "../../../entities/twin/twin.store";
import { useWorkflowStore } from "../../../entities/workflow/workflow.store";
import { ThermalTimeSeriesChart, type ThermalTimeSeriesHeatingDisplay } from "./ThermalTimeSeriesChart";
import { useThermalChartResult } from "./useThermalChartResult";

interface ThermalTimeSeriesChartBlockProps {
  heatingDisplay: ThermalTimeSeriesHeatingDisplay;
  onRunCalculation?: () => void;
}

/**
 * Динамика температуры и отопления по текущей модели.
 * `heatingDisplay="raw"` — шаги RC без обработки (для вероятностного анализа).
 * `heatingDisplay="equipment"` — нагрузка с ограничением по мощности и инерцией (как у реального источника).
 */
export function ThermalTimeSeriesChartBlock({ heatingDisplay, onRunCalculation }: ThermalTimeSeriesChartBlockProps) {
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const { chartResult, chartRoomOptions, chartRoomId, resultState, simulationSource, activeOptions } =
    useThermalChartResult();

  return (
    <ThermalTimeSeriesChart
      result={chartResult}
      roomId={chartRoomId}
      roomOptions={chartRoomOptions}
      onSelectRoom={selectSpace}
      resultState={resultState}
      simulationSource={simulationSource}
      onRunCalculation={onRunCalculation}
      heatingDisplay={heatingDisplay}
      installedCapacityKW={
        activeOptions.heatingCapacityW != null && activeOptions.heatingCapacityW > 0
          ? activeOptions.heatingCapacityW / 1000
          : null
      }
      monteCarloResult={monteCarloResult}
    />
  );
}

export default ThermalTimeSeriesChartBlock;
