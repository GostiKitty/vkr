export interface WeatherProfile {
  temperatureC: (timeSeconds: number) => number;
}

export interface SinusoidalWeatherParams {
  baseC: number;
  amplitudeC: number;
  seasonalOffsetC?: number;
  phaseShiftHours?: number;
  periodHours?: number;
}

export function createSinusoidalWeatherProfile(params: SinusoidalWeatherParams): WeatherProfile {
  const amplitude = params.amplitudeC;
  const seasonal = params.seasonalOffsetC ?? 0;
  const phaseShiftHours = params.phaseShiftHours ?? 0;
  const periodHours = params.periodHours ?? 24;
  const omega = (2 * Math.PI) / periodHours;
  return {
    temperatureC: (timeSeconds) => {
      const hours = timeSeconds / 3600;
      const phaseHours = hours + phaseShiftHours;
      return params.baseC + seasonal + amplitude * Math.sin(omega * phaseHours);
    },
  };
}
