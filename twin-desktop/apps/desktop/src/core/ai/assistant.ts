import type { AIAssistantContext, AIAssistantResult, AIWarning } from "./types";

export function askEngineeringAssistant(question: string, context: AIAssistantContext = {}): AIAssistantResult {
  const normalizedQuestion = question.trim();
  const lowerQuestion = normalizedQuestion.toLowerCase();
  const warnings = context.analysis?.warnings ?? [];
  const matchedWarnings = findRelevantWarnings(lowerQuestion, warnings);
  const explanation = buildExplanation(lowerQuestion, matchedWarnings, context);

  return {
    module: "assistant",
    timestamp: Date.now(),
    question: normalizedQuestion,
    answer: explanation.answer,
    recommendations: explanation.recommendations,
    relatedWarningIds: matchedWarnings.map((warning) => warning.id),
  };
}

function findRelevantWarnings(question: string, warnings: AIWarning[]): AIWarning[] {
  const tokens = question.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return warnings.slice(0, 2);
  }
  const directMatch = warnings.filter((warning) => {
    const haystack = `${warning.code} ${warning.title} ${warning.message}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
  return directMatch.length ? directMatch : warnings.slice(0, 2);
}

function buildExplanation(
  question: string,
  warnings: AIWarning[],
  context: AIAssistantContext
): Pick<AIAssistantResult, "answer" | "recommendations"> {
  if (warnings.some((warning) => warning.code === "insufficient_ventilation") || question.includes("vent")) {
    const room = warnings.find((warning) => warning.code === "insufficient_ventilation");
    return {
      answer: room
        ? `${room.title}. The room airflow per area is below the target, which can cause stale air and weak contaminant removal.`
        : "Ventilation problems usually mean the supplied airflow is too low for the served floor area or occupancy.",
      recommendations: [
        "Increase the design airflow or add more supply and exhaust terminals.",
        "Check whether air terminals are assigned to the correct room and level.",
      ],
    };
  }

  if (warnings.some((warning) => warning.code === "incorrect_pipe_diameter") || question.includes("pipe")) {
    const pipe = warnings.find((warning) => warning.code === "incorrect_pipe_diameter");
    return {
      answer: pipe
        ? `${pipe.title}. The estimated velocity indicates that the hydraulic branch is not sized correctly for the carried flow.`
        : "Pipe sizing issues usually appear when velocity is too high, causing noise and losses, or too low, causing oversizing and poor control.",
      recommendations: [
        "Recalculate branch flow and resize the pipe diameter to bring velocity back into range.",
        "Review branch lengths and balancing so the pressure drop matches the design intent.",
      ],
    };
  }

  if (warnings.some((warning) => warning.code === "abnormal_pressure") || question.includes("pressure")) {
    const pressure = warnings.find((warning) => warning.code === "abnormal_pressure");
    return {
      answer: pressure
        ? `${pressure.title}. The pressure value is outside the expected operating band, which often indicates a control, balancing, or sensor issue.`
        : "Abnormal pressure typically means the system head, resistance, or sensor reading is outside the design envelope.",
      recommendations: [
        "Verify pump head, control valves, and measured pressure against the branch design.",
        "Inspect the nearest pressure sensor calibration before changing equipment settings.",
      ],
    };
  }

  if (question.includes("energy") && context.energySimulation) {
    return {
      answer: `The latest energy simulation estimates a peak load of ${context.energySimulation.totals.peakDemand_W.toFixed(
        1
      )} W with ventilation energy of ${context.energySimulation.totals.ventilationEnergy_W.toFixed(1)} W.`,
      recommendations: [
        "Reduce the insulation coefficient or design temperature delta to lower transmission loads.",
        "Optimize ventilation airflow where indoor air quality allows it.",
      ],
    };
  }

  if (context.digitalTwin) {
    return {
      answer: `The digital twin currently tracks ${context.digitalTwin.rooms.length} rooms, ${context.digitalTwin.sensors.length} sensors, and ${context.digitalTwin.events.length} active engineering events.`,
      recommendations: [
        "Ask about ventilation, pipe sizing, pressure, or energy to get a focused explanation.",
      ],
    };
  }

  return {
    answer: "No engineering context is loaded yet. Run model analysis or the digital twin first so the assistant can explain real warnings.",
    recommendations: ["Call analyzeModel() before asking for detailed engineering explanations."],
  };
}
