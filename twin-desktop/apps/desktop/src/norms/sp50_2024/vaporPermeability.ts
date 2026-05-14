const VAPOR_BARRIER_RESISTANCE: Record<string, number> = {
  polyethylene: 7.3,
  bitumen_membrane: 18,
  aluminum_foil: 200,
  vapor_barrier_membrane: 12,
};

export function getSaturationVaporPressurePa(temperatureC: number): number {
  return 1.84e11 * Math.exp(-5330 / (273 + temperatureC));
}

export function getInternalVaporPartialPressurePa(input: {
  indoorTemperatureC: number;
  relativeHumidityPercent: number;
}): number {
  return (input.relativeHumidityPercent / 100) * getSaturationVaporPressurePa(input.indoorTemperatureC);
}

export function getSheetMaterialVaporResistance(materialId: string): number | null {
  return VAPOR_BARRIER_RESISTANCE[materialId] ?? null;
}

export { VAPOR_BARRIER_RESISTANCE };
