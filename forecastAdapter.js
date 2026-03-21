// forecastAdapter.js
// Converts raw Stormglass-style forecast JSON into Oracle ForecastHour[]

// Helper: pick first available value from preferred providers
const pick = (obj, providers) => {
  if (!obj) return null;

  for (const p of providers) {
    if (obj[p] != null) return obj[p];
  }

  return null;
};

export function adaptStormglassForecast(raw) {
  if (!raw || !Array.isArray(raw.forecast)) {
    return [];
  }

  return raw.forecast.map(hour => ({
    time: hour.time,

    // --- Wave (combined sea state) ---
    waveHeight: pick(hour.waveHeight, ["sg", "noaa", "ecmwf"]),
    wavePeriod: pick(hour.wavePeriod, ["sg", "noaa", "ecmwf"]),
    waveDirection: pick(hour.waveDirection, ["sg", "noaa", "ecmwf"]),

    // --- Primary swell ---
    swellHeight: pick(hour.swellHeight, ["sg", "noaa", "meteo"]),
    swellPeriod: pick(hour.swellPeriod, ["sg", "noaa", "meteo"]),
    swellDirection: pick(hour.swellDirection, ["sg", "noaa", "meteo"]),

    // --- Wind ---
    windSpeed: pick(hour.windSpeed, ["sg", "noaa", "ecmwf"]),
    windDirection: pick(hour.windDirection, ["sg", "noaa", "ecmwf"]),

    // --- Tide (placeholder for v1) ---
    tide: {
      height: null,
      phase: null
    }
  }));
}
