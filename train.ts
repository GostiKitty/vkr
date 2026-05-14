export interface SurrogateTrainingSample {
  inputs: Record<string, number>;
  output: number;
}

export interface SurrogateTrainingConfig {
  samples: SurrogateTrainingSample[];
  lambda?: number;
}

export interface SurrogateMetrics {
  r2: number;
  mae: number;
}

export interface SurrogateModel {
  featureNames: string[];
  intercept: number;
  weights: number[];
  predict: (inputs: Record<string, number>) => number;
}

export interface SurrogateTrainingResult {
  model: SurrogateModel;
  metrics: SurrogateMetrics;
}

export function trainLinearSurrogate(config: SurrogateTrainingConfig): SurrogateTrainingResult {
  if (!config.samples.length) {
    throw new Error("At least one training sample is required");
  }

  const featureNames = extractFeatureNames(config.samples);
  const { designMatrix, target } = buildDesignMatrix(config.samples, featureNames);
  const lambda = config.lambda ?? 1e-6;
  const beta = solveNormalEquation(designMatrix, target, lambda);
  const intercept = beta[0];
  const weights = beta.slice(1);

  const model: SurrogateModel = {
    featureNames,
    intercept,
    weights,
    predict: (inputs) => predictValue(inputs, featureNames, intercept, weights),
  };

  const predictions = config.samples.map((sample) => model.predict(sample.inputs));
  const metrics = evaluateMetrics(predictions, target);

  return { model, metrics };
}

export function predictValue(
  inputs: Record<string, number>,
  featureNames: string[],
  intercept: number,
  weights: number[]
): number {
  let value = intercept;
  featureNames.forEach((name, index) => {
    const inputValue = inputs[name];
    if (!Number.isFinite(inputValue)) {
      throw new Error(Missing or invalid feature );
    }
    value += weights[index] * inputValue;
  });
  return value;
}

function extractFeatureNames(samples: SurrogateTrainingSample[]): string[] {
  const firstKeys = Object.keys(samples[0].inputs).sort();
  samples.forEach((sample, index) => {
    const keys = Object.keys(sample.inputs).sort();
    if (keys.length !== firstKeys.length || !keys.every((key, idx) => key === firstKeys[idx])) {
      throw new Error(Sample  has mismatched features);
    }
  });
  return firstKeys;
}

function buildDesignMatrix(samples: SurrogateTrainingSample[], featureNames: string[]) {
  const rows = samples.length;
  const cols = featureNames.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const target = samples.map((sample) => sample.output);

  for (let i = 0; i < rows; i++) {
    matrix[i][0] = 1;
    featureNames.forEach((name, j) => {
      matrix[i][j + 1] = samples[i].inputs[name];
    });
  }

  return { designMatrix: matrix, target };
}

function solveNormalEquation(X: number[][], y: number[], lambda: number): number[] {
  const rows = X.length;
  const cols = X[0].length;
  const XtX = Array.from({ length: cols }, () => Array<number>(cols).fill(0));
  const Xty = Array<number>(cols).fill(0);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        sum += X[r][i] * X[r][j];
      }
      XtX[i][j] = sum + (i === j && i !== 0 ? lambda : 0);
    }
  }

  for (let i = 0; i < cols; i++) {
    let sum = 0;
    for (let r = 0; r < rows; r++) {
      sum += X[r][i] * y[r];
    }
    Xty[i] = sum;
  }

  return gaussianSolve(XtX, Xty);
}

function gaussianSolve(matrix: number[][], vector: number[]): number[] {
  const n = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let i = 0; i < n; i++) {
    let pivot = augmented[i][i];
    if (Math.abs(pivot) < 1e-12) {
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(augmented[r][i]) > Math.abs(pivot)) {
          [augmented[i], augmented[r]] = [augmented[r], augmented[i]];
          pivot = augmented[i][i];
          break;
        }
      }
    }
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("Matrix is singular or ill-conditioned");
    }

    for (let j = i; j <= n; j++) {
      augmented[i][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = augmented[r][i];
      for (let c = i; c <= n; c++) {
        augmented[r][c] -= factor * augmented[i][c];
      }
    }
  }

  return augmented.map((row) => row[n]);
}

function evaluateMetrics(predictions: number[], targets: number[]): SurrogateMetrics {
  let sse = 0;
  let sae = 0;
  const mean = targets.reduce((sum, value) => sum + value, 0) / targets.length;
  let sst = 0;
  for (let i = 0; i < targets.length; i++) {
    const error = predictions[i] - targets[i];
    sse += error * error;
    sae += Math.abs(error);
    const deviation = targets[i] - mean;
    sst += deviation * deviation;
  }
  const r2 = sst === 0 ? 1 : 1 - sse / sst;
  const mae = sae / targets.length;
  return { r2, mae };
}
