import { askEngineeringAssistant } from "./assistant";
import { DigitalTwinModule } from "./digitalTwin";
import { runEnergySimulation } from "./energySimulation";
import { analyzeEngineeringModel } from "./modelAnalyzer";
export class AIEngine {
    modelAnalyzer = {
        analyze: (model, options) => this.analyzeModel(model, options),
    };
    energySimulation = {
        run: (input) => this.runEnergySimulation(input),
    };
    digitalTwin;
    assistant = {
        ask: (question) => this.askAssistant(question),
    };
    latestModel = null;
    latestAnalysis = null;
    latestEnergySimulation = null;
    latestDigitalTwin = null;
    constructor(options = {}) {
        this.digitalTwin = new DigitalTwinModule(options.digitalTwinRefreshIntervalMs ?? 4000);
    }
    analyzeModel(model, options) {
        this.latestModel = model;
        this.latestAnalysis = analyzeEngineeringModel(model, options);
        return this.latestAnalysis;
    }
    runEnergySimulation(input) {
        this.latestEnergySimulation = runEnergySimulation(input);
        return this.latestEnergySimulation;
    }
    getDigitalTwinState(model, thermalResult) {
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
    askAssistant(question) {
        return askEngineeringAssistant(question, {
            model: this.latestModel,
            analysis: this.latestAnalysis,
            energySimulation: this.latestEnergySimulation,
            digitalTwin: this.latestDigitalTwin,
        });
    }
    getSnapshot() {
        return {
            warnings: this.latestAnalysis?.warnings ?? [],
            recommendations: this.latestAnalysis?.recommendations ?? [],
            energySimulation: this.latestEnergySimulation,
            digitalTwin: this.latestDigitalTwin,
        };
    }
}
export function createAIEngine(options) {
    return new AIEngine(options);
}
