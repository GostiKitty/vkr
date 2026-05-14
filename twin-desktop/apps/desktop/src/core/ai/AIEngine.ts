import type { BuildingModel } from "../../entities/geometry/types";
import type { ThermalSimulationResult } from "../thermal/solver";
import { askEngineeringAssistant } from "./assistant";
import { DigitalTwinModule } from "./digitalTwin";
import { runEnergySimulation } from "./energySimulation";
import { analyzeEngineeringModel } from "./modelAnalyzer";
import type {
  AIAssistantResult,
  AIEngineSnapshot,
  DigitalTwinState,
  EnergySimulationInput,
  EnergySimulationResult,
  ModelAnalysisResult,
  ModelAnalyzerOptions,
} from "./types";

export class AIEngine {
  readonly modelAnalyzer = {
    analyze: (model: BuildingModel, options?: ModelAnalyzerOptions) => this.analyzeModel(model, options),
  };

  readonly energySimulation = {
    run: (input: EnergySimulationInput | EnergySimulationInput[]) => this.runEnergySimulation(input),
  };

  readonly digitalTwin: DigitalTwinModule;

  readonly assistant = {
    ask: (question: string) => this.askAssistant(question),
  };

  private latestModel: BuildingModel | null = null;
  private latestAnalysis: ModelAnalysisResult | null = null;
  private latestEnergySimulation: EnergySimulationResult | null = null;
  private latestDigitalTwin: DigitalTwinState | null = null;

  constructor(options: { digitalTwinRefreshIntervalMs?: number } = {}) {
    this.digitalTwin = new DigitalTwinModule(options.digitalTwinRefreshIntervalMs ?? 4000);
  }

  analyzeModel(model: BuildingModel, options?: ModelAnalyzerOptions): ModelAnalysisResult {
    this.latestModel = model;
    this.latestAnalysis = analyzeEngineeringModel(model, options);
    return this.latestAnalysis;
  }

  runEnergySimulation(input: EnergySimulationInput | EnergySimulationInput[]): EnergySimulationResult {
    this.latestEnergySimulation = runEnergySimulation(input);
    return this.latestEnergySimulation;
  }

  getDigitalTwinState(model?: BuildingModel, thermalResult?: ThermalSimulationResult | null): DigitalTwinState {
    const activeModel = model ?? this.latestModel;
    if (!activeModel) {
      throw new Error("AIEngine.getDigitalTwinState requires a building model.");
    }
    this.latestModel = activeModel;
    this.latestDigitalTwin = this.digitalTwin.getState({
      model: activeModel,
      thermalResult: thermalResult ?? null,
    });
    return this.latestDigitalTwin;
  }

  askAssistant(question: string): AIAssistantResult {
    return askEngineeringAssistant(question, {
      model: this.latestModel,
      analysis: this.latestAnalysis,
      energySimulation: this.latestEnergySimulation,
      digitalTwin: this.latestDigitalTwin,
    });
  }

  getSnapshot(): AIEngineSnapshot {
    return {
      warnings: this.latestAnalysis?.warnings ?? [],
      recommendations: this.latestAnalysis?.recommendations ?? [],
      energySimulation: this.latestEnergySimulation,
      digitalTwin: this.latestDigitalTwin,
    };
  }
}

export function createAIEngine(options?: ConstructorParameters<typeof AIEngine>[0]): AIEngine {
  return new AIEngine(options);
}
