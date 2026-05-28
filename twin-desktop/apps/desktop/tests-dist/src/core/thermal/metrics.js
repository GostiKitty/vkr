export function computeSimulationMetrics(frames) {
    const zones = new Map();
    let globalPeak = 0;
    let globalPeakUnmet = 0;
    let totalEnergy = 0;
    let discomfort = 0;
    let underheating = 0;
    let overheating = 0;
    let totalUnmetEnergy = 0;
    frames.forEach((frame) => {
        const timestepSeconds = frame.timestepSeconds;
        let frameHeating = 0;
        let frameUnmet = 0;
        frame.zones.forEach((zone) => {
            const entry = getOrCreateZoneSummary(zones, zone.zoneId);
            entry.energyJ += zone.heatingPowerW * timestepSeconds;
            totalEnergy += zone.heatingPowerW * timestepSeconds;
            frameHeating += zone.heatingPowerW;
            if (zone.heatingPowerW > entry.peakHeatingW) {
                entry.peakHeatingW = zone.heatingPowerW;
            }
            const unmetLoadW = Number.isFinite(zone.unmetLoadW) ? Math.max(0, zone.unmetLoadW ?? 0) : 0;
            if (unmetLoadW > entry.peakUnmetLoadW) {
                entry.peakUnmetLoadW = unmetLoadW;
            }
            frameUnmet += unmetLoadW;
            totalUnmetEnergy += unmetLoadW * timestepSeconds;
            if (zone.temperatureC + 0.05 < zone.setpointC) {
                entry.discomfortSeconds += timestepSeconds;
                entry.underheatingSeconds += timestepSeconds;
                entry.totalDiscomfortSeconds += timestepSeconds;
                discomfort += timestepSeconds;
                underheating += timestepSeconds;
            }
            else if (zone.temperatureC - 0.05 > zone.setpointC) {
                entry.overheatingSeconds += timestepSeconds;
                entry.totalDiscomfortSeconds += timestepSeconds;
                overheating += timestepSeconds;
            }
        });
        if (frameHeating > globalPeak) {
            globalPeak = frameHeating;
        }
        if (frameUnmet > globalPeakUnmet) {
            globalPeakUnmet = frameUnmet;
        }
    });
    return {
        peakHeatingW: globalPeak,
        totalEnergyJ: totalEnergy,
        discomfortSeconds: discomfort,
        underheatingSeconds: underheating,
        overheatingSeconds: overheating,
        totalDiscomfortSeconds: underheating + overheating,
        peakUnmetLoadW: globalPeakUnmet,
        totalUnmetEnergyJ: totalUnmetEnergy,
        zones: Object.fromEntries(Array.from(zones.entries())),
    };
}
function getOrCreateZoneSummary(container, zoneId) {
    const existing = container.get(zoneId);
    if (existing) {
        return existing;
    }
    const created = {
        zoneId,
        energyJ: 0,
        discomfortSeconds: 0,
        underheatingSeconds: 0,
        overheatingSeconds: 0,
        totalDiscomfortSeconds: 0,
        peakHeatingW: 0,
        peakUnmetLoadW: 0,
    };
    container.set(zoneId, created);
    return created;
}
