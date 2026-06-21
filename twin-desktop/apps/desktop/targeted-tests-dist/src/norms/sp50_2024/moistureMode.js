const MOISTURE_MODE_TABLE = [
    {
        minTemperatureC: -Infinity,
        maxTemperatureC: 12,
        bands: [
            { maxRelativeHumidity: 60, mode: "dry" },
            { maxRelativeHumidity: 75, mode: "normal" },
            { maxRelativeHumidity: 85, mode: "wet" },
            { maxRelativeHumidity: Infinity, mode: "veryWet" },
        ],
    },
    {
        minTemperatureC: 12,
        maxTemperatureC: 24,
        bands: [
            { maxRelativeHumidity: 50, mode: "dry" },
            { maxRelativeHumidity: 60, mode: "normal" },
            { maxRelativeHumidity: 75, mode: "wet" },
            { maxRelativeHumidity: Infinity, mode: "veryWet" },
        ],
    },
    {
        minTemperatureC: 24,
        maxTemperatureC: Infinity,
        bands: [
            { maxRelativeHumidity: 40, mode: "dry" },
            { maxRelativeHumidity: 50, mode: "normal" },
            { maxRelativeHumidity: 60, mode: "wet" },
            { maxRelativeHumidity: Infinity, mode: "veryWet" },
        ],
    },
];
export function getMoistureMode(input) {
    const row = MOISTURE_MODE_TABLE.find((candidate) => input.indoorTemperature > candidate.minTemperatureC && input.indoorTemperature <= candidate.maxTemperatureC);
    if (!row) {
        return "normal";
    }
    return row.bands.find((band) => input.relativeHumidity <= band.maxRelativeHumidity)?.mode ?? "veryWet";
}
export { MOISTURE_MODE_TABLE };
