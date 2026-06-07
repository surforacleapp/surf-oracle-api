// engineV2.js
// Absolute 0–100 surf scoring engine (multi-spot, tide-aware)

// ----------------------------
// Utilities
// ----------------------------

function degToCardinal(deg) {
  if (deg == null) return null;
  const dirs = [
    "N","NNE","NE","ENE","E","ESE","SE","SSE",
    "S","SSW","SW","WSW","W","WNW","NW","NNW"
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

function angularDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ----------------------------
// Spots (v2)
// ----------------------------

const spots = [
  {
    name: "Ribeira d’Ilhas",
    swell: ["NW","WNW","W"],
    wind: ["E","NE","N"],
    bestTide: ["mid"]
  },
  {
    name: "São Julião",
    swell: ["NW","W"],
    wind: ["E","NE"],
    bestTide: ["low","mid"],
    size: { min: 1.0, max: 2.0 }
  },
  {
    name: "Foz do Lizandro",
    swell: ["SW","W","NW"],
    wind: ["E","SE","NE"],
    bestTide: ["mid"]
  },
  {
    name: "Matadouro",
    swell: ["NW","WNW","W"],
    wind: ["E","SE","NE"],
    bestTide: ["mid","high"]
  },
  {
    name: "Praia do Sul",
    swell: ["SW","WSW","W"],
    wind: ["E","NE","N"],
    bestTide: ["mid"]
  }
];

// ----------------------------
// Core scoring per hour & spot
// ----------------------------

function scoreHourForSpot(hour, spot) {
  const reasons = [];
  let score = 50; // neutral baseline

  const waveHeight = hour.waveHeight;
  const wavePeriod = hour.wavePeriod;
  const windSpeed = hour.windSpeed;
  const swellDir = degToCardinal(hour.swellDirection || hour.waveDirection);
  const windDir = degToCardinal(hour.windDirection);
  const energy = (waveHeight * waveHeight) * wavePeriod;

  // --- Size sanity check (São Julião rule) ---
  if (spot.size) {
    if (waveHeight < spot.size.min || waveHeight > spot.size.max) {
      score -= 20;
      reasons.push("Wave size not ideal for this spot");
    }
  }

  // --- Swell direction ---
  if (spot.swell.includes(swellDir)) {
    score += 20;
    reasons.push("Good swell direction");
  } else {
    score -= 25;
    reasons.push("Poor swell direction");
  }

  // --- Wind direction ---
  if (spot.wind.includes(windDir)) {
    score += 15;
    reasons.push("Favorable wind");
  } else {
    score -= 30;
    reasons.push("Unfavorable wind");
  }

  // --- Wind strength ---
  if (windSpeed > 25) {
    score -= 25;
    reasons.push("Strong wind");
  } else if (windSpeed > 15) {
    score -= 10;
    reasons.push("Moderate wind");
  }

  // --- Period quality ---
  if (wavePeriod >= 12) {
    score += 15;
    reasons.push("Good swell period");
  } else if (wavePeriod < 8) {
    score -= 15;
    reasons.push("Weak swell period");
  }

  // --- Tide influence ---
  if (hour.tide?.phase) {
    if (spot.bestTide.includes(hour.tide.phase)) {
      score += 10;
      reasons.push("Good tide");
    } else {
      score -= 10;
      reasons.push("Unfavorable tide");
    }
  }

  // --- Global storm detection ---
  const stormDay =
    waveHeight >= 4 ||
    windSpeed >= 35;

  if (stormDay) {
    score = Math.min(score, 15);
    reasons.push("Storm conditions");
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    energy,
    reasons,
    flags: {
      stormDay
    }
  };
}

// ----------------------------
// Public API
// ----------------------------

export function getSurfRecommendationsV2(forecast) {
  const results = [];

  forecast.forEach(hour => {
    spots.forEach(spot => {
      const scored = scoreHourForSpot(hour, spot);

      results.push({
        time: hour.time,
        spot: spot.name,
        waveHeight: hour.waveHeight,
        wavePeriod: hour.wavePeriod,
        windSpeed: hour.windSpeed,
        windDirection: hour.windDirection,
        swellDirection: hour.swellDirection,
        tide: hour.tide,
        score: scored.score,
        energy: scored.energy,
        reasons: scored.reasons,
        flags: scored.flags
      });
    });
  });

  return results;
}
