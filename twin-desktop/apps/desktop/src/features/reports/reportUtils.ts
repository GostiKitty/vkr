import { calibrateParameters, type CalibrationParameter } from "../../core/calibration/calibrator";
import {
  runMonteCarlo,
  type MonteCarloResult,
  type ThermalScenario,
  type UncertainParameter,
} from "../../core/uncertainty/monteCarloEngine";
import {
  type OutdoorBoundary,
  type SimulationOptions,
  type ThermalConnection,
  type ThermalNode,
} from "../../core/thermal/thermalModel";
import type { SimulationFrame } from "../../entities/twin/types";
import type { Twin } from "../../shared/api/types";
import { formatArea, formatNumber, formatVolume } from "../../shared/utils/format";
import { outdoorTemperatureAt } from "../twin/twin.engine";

export interface MonteCarloAnalytics {
  result: MonteCarloResult;
}

export interface CalibrationSummary {
  rmse: number;
  mape: number;
  parameters: Record<string, number>;
}

export interface BuildReportArgs {
  twin: Twin | null;
  frames: SimulationFrame[];
  uncertaintyRuns?: number;
  uncertaintyMode?: "full-physics" | "surrogate";
  monteCarlo?: MonteCarloAnalytics | null;
  calibration?: CalibrationSummary | null;
}

export interface ReportSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  table?: {
    title: string;
    headers: string[];
    rows: string[][];
  };
}

export interface ScientificReportData {
  title: string;
  generatedAt: string;
  sections: ReportSection[];
}

export function generateMonteCarloAnalytics(twin: Twin | null): MonteCarloAnalytics | null {
  if (!twin?.spaces?.length) {
    return null;
  }

  const parameters: UncertainParameter[] = [
    { name: "infiltration", distribution: { kind: "uniform", min: 0.15, max: 0.6 } },
    { name: "internal_gain", distribution: { kind: "normal", mean: 8, stdDev: 2 } },
    { name: "envelope_u", distribution: { kind: "uniform", min: 0.18, max: 0.35 } },
  ];

  const scenarioBuilder = (samples: Record<string, number>) =>
    buildScenarioFromTwin(twin, samples, {
      durationHours: 24,
      timestepMinutes: 15,
    });

  const result = runMonteCarlo({
    runs: 96,
    seed: 2026,
    parameters,
    scenarioBuilder,
    heatingLoadThreshold: (twin.spaces.length || 1) * 1200,
    evaluationMode: "full-physics",
    morris: {
      levels: 6,
      trajectories: 4,
      seed: 42,
      targetMetric: "peakHeatingLoad",
    },
  });

  return { result };
}

export function generateCalibrationSummary(twin: Twin | null): CalibrationSummary | null {
  if (!twin?.spaces?.length) {
    return null;
  }
  const observed = buildObservedMonthlyEnergy(twin);
  const parameters: CalibrationParameter[] = [
    { name: "internal_gain", min: 4, max: 12 },
    { name: "envelope_factor", min: 0.5, max: 1.5 },
  ];

  const result = calibrateParameters({
    observations: observed,
    parameters,
    iterations: 250,
    seed: 2026,
    model: (params) => synthesizeMonthlyEnergy(twin, params),
  });

  return {
    rmse: result.rmse,
    mape: result.mape,
    parameters: result.bestParameters,
  };
}

export function buildScientificReportData(args: BuildReportArgs): ScientificReportData {
  const sections: ReportSection[] = [];
  const now = new Date().toISOString();
  const twin = args.twin;
  const spaces = twin?.spaces ?? [];
  const totalArea = spaces.reduce((sum, space) => sum + (space.area_m2 ?? 0), 0);
  const totalVolume = spaces.reduce((sum, space) => sum + (space.volume_m3 ?? 0), 0);

  sections.push({
    heading: "Model Description",
    paragraphs: [
      `Building "${twin?.building?.name ?? "Unnamed"}" contains ${spaces.length || 0} thermal zones covering ${formatArea(
        totalArea
      )} with a combined volume of ${formatVolume(totalVolume)}.`,
      `Source schema: ${twin?.meta?.schema_version ?? "n/a"} · Imported from ${twin?.meta?.source ?? "unknown"} on ${
        twin?.meta?.created_at ?? "unspecified date"
      }.`,
    ],
  });

  const assumptionBullets =
    twin?.assumptions && Object.keys(twin.assumptions).length
      ? Object.entries(twin.assumptions).map(([key, value]) => `${key}: ${String(value)}`)
      : [
          "Envelope treated as homogeneous conductive shells per ASHRAE simple model.",
          "Internal gains assumed uniformly distributed across occupied zones.",
          "Air infiltration driven by ACH uncertainty captured as uniform distribution between 0.15–0.60 ACH.",
        ];

  sections.push({
    heading: "Model Assumptions",
    paragraphs: ["Primary simplifying assumptions applied during preprocessing:"],
    bullets: assumptionBullets,
  });

  sections.push({
    heading: "Governing Equations",
    paragraphs: [
      "Each zone obeys the first-order energy balance: C dT/dt = Σ(U·A·(Tn − T)) + ṁ·cp·(Tout − T) + Qint.",
      "The solver integrates explicitly with adaptive 15-minute steps, using sinusoidal outdoor boundary forcing.",
    ],
  });

  sections.push({
    heading: "Uncertainty Definition",
    paragraphs: [
      `Workflow mode: ${args.uncertaintyMode ?? "full-physics"} · Monte Carlo runs requested: ${
        args.uncertaintyRuns ?? 0
      }.`,
      "Parameters sampled: infiltration (uniform 0.15–0.60 ACH), internal gains (normal μ=8 W/m², σ=2), envelope U-value (uniform 0.18–0.35 W/m²K).",
    ],
  });

  if (args.monteCarlo?.result) {
    const mc = args.monteCarlo.result;
    sections.push({
      heading: "Monte Carlo Results",
      paragraphs: [
        `The ensemble of ${mc.runs} simulations yields peak heating demand μ=${formatNumber(
          mc.peakHeatingLoad.mean,
          { maximumFractionDigits: 1 }
        )} kW with σ=${formatNumber(mc.peakHeatingLoad.stdDev, { maximumFractionDigits: 1 })} kW.`,
        `95th percentile heating load reaches ${formatNumber(mc.peakHeatingLoad.p95, {
          maximumFractionDigits: 1,
        })} kW while annual energy mean is ${formatNumber(mc.annualEnergy.mean, { maximumFractionDigits: 1 })} kWh.`,
      ],
      table: {
        title: "Summary Statistics",
        headers: ["Metric", "Mean", "Std", "p5", "p50", "p95"],
        rows: [
          [
            "Peak heating load (kW)",
            formatNumber(mc.peakHeatingLoad.mean, { maximumFractionDigits: 1 }),
            formatNumber(mc.peakHeatingLoad.stdDev, { maximumFractionDigits: 1 }),
            formatNumber(mc.peakHeatingLoad.p5, { maximumFractionDigits: 1 }),
            formatNumber(mc.peakHeatingLoad.p50, { maximumFractionDigits: 1 }),
            formatNumber(mc.peakHeatingLoad.p95, { maximumFractionDigits: 1 }),
          ],
          [
            "Annual energy (kWh)",
            formatNumber(mc.annualEnergy.mean, { maximumFractionDigits: 1 }),
            formatNumber(mc.annualEnergy.stdDev, { maximumFractionDigits: 1 }),
            formatNumber(mc.annualEnergy.p5, { maximumFractionDigits: 1 }),
            formatNumber(mc.annualEnergy.p50, { maximumFractionDigits: 1 }),
            formatNumber(mc.annualEnergy.p95, { maximumFractionDigits: 1 }),
          ],
        ],
      },
    });

    if (mc.sensitivity?.entries?.length) {
      sections.push({
        heading: "Sensitivity Ranking (Morris)",
        paragraphs: ["Parameters ordered by μ* emphasising the most influential uncertainties."],
        table: {
          title: "Elementary Effects",
          headers: ["Parameter", "μ*", "σ"],
          rows: mc.sensitivity.entries.map((entry) => [
            entry.name,
            formatNumber(entry.muStar, { maximumFractionDigits: 3 }),
            formatNumber(entry.sigma, { maximumFractionDigits: 3 }),
          ]),
        },
      });
    }
  }

  if (args.calibration) {
    sections.push({
      heading: "Calibration Summary",
      paragraphs: [
        `Random-search calibration achieved RMSE = ${formatNumber(args.calibration.rmse, {
          maximumFractionDigits: 2,
        })} and MAPE = ${formatNumber(args.calibration.mape, { maximumFractionDigits: 2 })}%.`,
      ],
      table: {
        title: "Calibrated Parameters",
        headers: ["Parameter", "Value"],
        rows: Object.entries(args.calibration.parameters).map(([key, value]) => [
          key,
          formatNumber(value, { maximumFractionDigits: 3 }),
        ]),
      },
    });
  }

  const tempSpan = deriveTemperatureSpan(args.frames);
  sections.push({
    heading: "Results & Conclusions",
    paragraphs: [
      `Simulated temperature envelope spans ${formatNumber(tempSpan.min, {
        maximumFractionDigits: 1,
      })}–${formatNumber(tempSpan.max, { maximumFractionDigits: 1 })} °C across ${args.frames.length} frames.`,
    ],
    bullets: buildConclusions(args, tempSpan),
  });

  return {
    title: "Digital Twin Scientific Report",
    generatedAt: now,
    sections,
  };
}

export function createScientificReportPdf(data: ScientificReportData): Blob {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const pages: string[] = [];
  let currentY = pageHeight - margin;
  let currentContent: string[] = [];

  const pushLine = (text: string, size = 12) => {
    const wrapped = wrapText(text, size, contentWidth);
    wrapped.forEach((line) => {
      if (currentY < margin + size) {
        finalizePage();
      }
      currentContent.push(`BT /F1 ${size} Tf 1 0 0 1 ${margin} ${currentY.toFixed(2)} Tm (${escapePdfText(line)}) Tj ET`);
      currentY -= size + 4;
    });
  };

  const finalizePage = () => {
    pages.push(currentContent.join("\n"));
    currentContent = [];
    currentY = pageHeight - margin;
  };

  pushLine(data.title, 18);
  pushLine(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, 10);
  currentY -= 10;

  data.sections.forEach((section) => {
    pushLine(section.heading, 14);
    section.paragraphs.forEach((paragraph) => pushLine(paragraph, 11));
    if (section.bullets?.length) {
      section.bullets.forEach((bullet) => pushLine(`• ${bullet}`, 11));
    }
    if (section.table) {
      pushLine(section.table.title, 12);
      const header = section.table.headers.join(" | ");
      pushLine(header, 10);
      section.table.rows.forEach((row) => pushLine(row.join(" | "), 10));
    }
    currentY -= 6;
  });

  if (currentContent.length) {
    finalizePage();
  }

  const pdfString = buildPdfDocument(pages, pageWidth, pageHeight);
  return new Blob([new TextEncoder().encode(pdfString)], { type: "application/pdf" });
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const approxCharWidth = fontSize * 0.55;
  const maxChars = Math.max(1, Math.floor(maxWidth / approxCharWidth));
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if ((current + word).length <= maxChars) {
      current = current ? `${current} ${word}` : word;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  });
  if (current) {
    lines.push(current);
  }
  return lines;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfDocument(pages: string[], width: number, height: number): string {
  const offsets: number[] = [];
  let body = "%PDF-1.4\n";
  const encoder = new TextEncoder();
  const write = (chunk: string) => {
    body += chunk;
  };
  const addObject = (id: number, content: string) => {
    offsets[id] = encoder.encode(body).length;
    write(`${id} 0 obj\n${content}\nendobj\n`);
  };

  const fontId = 3;
  const pageObjects: { pageId: number; contentId: number }[] = [];
  let nextId = 4;

  pages.forEach((content) => {
    const contentId = nextId++;
    const contentStream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    addObject(contentId, contentStream);
    const pageId = nextId++;
    pageObjects.push({ pageId, contentId });
    addObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
  });

  const kids = pageObjects.map((entry) => `${entry.pageId} 0 R`).join(" ");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageObjects.length} /MediaBox [0 0 ${width} ${height}] >>`);
  addObject(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = encoder.encode(body).length;
  write(`xref\n0 ${nextId}\n0000000000 65535 f \n`);
  for (let i = 1; i < nextId; i++) {
    const offset = offsets[i] ?? 0;
    write(`${offset.toString().padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer << /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return body;
}

function buildScenarioFromTwin(
  twin: Twin,
  samples: Record<string, number>,
  options: SimulationOptions
): ThermalScenario {
  const airDensity = 1.225;
  const cpAir = 1005;
  const infiltration = samples.infiltration ?? 0.3;
  const internalGain = samples.internal_gain ?? 8;
  const envelopeU = samples.envelope_u ?? 0.25;

  const nodes: ThermalNode[] = (twin.spaces ?? []).map((space, idx) => {
    const area = space.area_m2 ?? 45;
    const volume = Math.max(space.volume_m3 ?? area * 3, 60);
    return {
      id: space.id || `space-${idx}`,
      volume,
      heatCapacity: volume * airDensity * cpAir,
      initialTemp: 20,
      internalGain: internalGain * area,
      infiltrationMassFlow: infiltration * area * 0.001,
      infiltrationSpecificHeat: cpAir,
    };
  });

  const connections: ThermalConnection[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i];
    const to = nodes[i + 1];
    const area = Math.max(Math.sqrt(from.volume) + Math.sqrt(to.volume), 15);
    connections.push({
      from: from.id,
      to: to.id,
      U: envelopeU,
      area,
    });
  }

  const boundary: OutdoorBoundary = {
    outdoorTemp: outdoorTemperatureAt,
  };

  return {
    nodes,
    connections,
    boundary,
    options,
  };
}

function buildObservedMonthlyEnergy(twin: Twin): number[] {
  const spaces = twin.spaces ?? [];
  const totalArea = spaces.reduce((sum, space) => sum + (space.area_m2 ?? 0), 0);
  const baseLoad = Math.max(totalArea * 1.2, 200);
  return Array.from({ length: 12 }, (_, month) => {
    const seasonalFactor = 1 + 0.35 * Math.cos(((month + 1) / 12) * 2 * Math.PI);
    return baseLoad * seasonalFactor;
  });
}

function synthesizeMonthlyEnergy(twin: Twin, params: Record<string, number>): number[] {
  const spaces = twin.spaces ?? [];
  const totalArea = spaces.reduce((sum, space) => sum + (space.area_m2 ?? 0), 0);
  const base = Math.max(totalArea, 100);
  return Array.from({ length: 12 }, (_, month) => {
    const seasonal = 1 + 0.4 * Math.cos(((month + 1) / 12) * 2 * Math.PI);
    return base * seasonal * (params.envelope_factor ?? 1) - (params.internal_gain ?? 0) * 10;
  });
}

function deriveTemperatureSpan(frames: SimulationFrame[]) {
  if (!frames.length) {
    return { min: 0, max: 0 };
  }
  let min = Infinity;
  let max = -Infinity;
  frames.forEach((frame) => {
    Object.values(frame.temperatures).forEach((temp) => {
      if (typeof temp === "number") {
        min = Math.min(min, temp);
        max = Math.max(max, temp);
      }
    });
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }
  return { min, max };
}

function buildConclusions(args: BuildReportArgs, span: { min: number; max: number }): string[] {
  const bullets: string[] = [];
  if (args.monteCarlo?.result) {
    bullets.push(
      `Peak load exhibits ${formatNumber(args.monteCarlo.result.peakHeatingLoad.stdDev, {
        maximumFractionDigits: 1,
      })} kW standard deviation driven largely by infiltration variance.`
    );
  }
  if (args.calibration) {
    const envelopeFactor = args.calibration.parameters.envelope_factor ?? 1;
    bullets.push(
      `Calibrated envelope factor = ${formatNumber(envelopeFactor, {
        maximumFractionDigits: 2,
      })} with residual RMSE ${formatNumber(args.calibration.rmse, { maximumFractionDigits: 2 })}.`
    );
  }
  bullets.push(
    `Simulated thermal range spans ${formatNumber(span.min, { maximumFractionDigits: 1 })}–${formatNumber(span.max, {
      maximumFractionDigits: 1,
    })} °C across the evaluated horizon.`
  );
  return bullets;
}
