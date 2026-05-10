// spotOracle.js
// Returns a full 5-day forecast for a single spot + user level
// Used by the dynamic Spot Detail page in FlutterFlow

import { getSurfRecommendationsV2 } from "./engineV2.js";
import { deriveUserProfile } from "./userProfile.js";

// ----------------------------
// Static surf guides per spot
// One entry per spot name (must match engineV2.js exactly)
// TODO: expand copy for each spot, translate to Oracle voice
// ----------------------------

const spotGuides = {
  "Ribeira d'Ilhas": {
    type: "Beach & reef break",
    ideal_swell: "NW 1.5–3m, 12s+",
    ideal_wind: "E or NE offshore",
    ideal_tide: "Mid tide",
    crowd: "Can get busy on good days",
    notes: "One of Ericeira's most consistent spots. Works best on a solid NW swell with light easterly winds. Powerful waves — not ideal for beginners on bigger days.",
  },
  "São Julião": {
    type: "Beach break",
    ideal_swell: "NW–W 1–2m",
    ideal_wind: "E or NE offshore",
    ideal_tide: "Low to mid tide",
    crowd: "Moderate",
    notes: "Forgiving beach break, great for beginner and intermediate surfers. Gets messy above 2m. Best on smaller, clean NW swells.",
  },
  "Foz do Lizandro": {
    type: "River mouth beach break",
    ideal_swell: "SW–NW 1–2m",
    ideal_wind: "E or SE offshore",
    ideal_tide: "Mid tide",
    crowd: "Usually quiet",
    notes: "Mellow and consistent. The river mouth creates shifting sandbars that can produce fun, hollow sections. Good option when other spots are too big.",
  },
  "Matadouro": {
    type: "Beach break",
    ideal_swell: "NW–WNW 1.5–3m",
    ideal_wind: "E or SE offshore",
    ideal_tide: "Mid to high tide",
    crowd: "Less crowded than Ribeira",
    notes: "Powerful and punchy. Works well at mid to high tide on a solid NW swell. Good intermediate spot when Ribeira is too crowded.",
  },
  "Praia do Sul": {
    type: "Beach break",
    ideal_swell: "SW–W 1–2m",
    ideal_wind: "E or NE offshore",
    ideal_tide: "Mid tide",
    crowd: "Usually quiet",
    notes: "A reliable option when the swell has a southerly component. Relaxed atmosphere and forgiving waves make it a solid choice for intermediate surfers.",
  },
};

// ----------------------------
// Helpers
// ----------------------------

function formatTime(isoString) {
  const date = new Date(isoString);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toISOString().split("T")[0];
}

function getDayName(isoString) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return days[new Date(isoString).getUTCDay()];
}

function verdictFromScore(score, waveHeight, userLevel) {
  if (waveHeight >= 4) return "NO GO";
  if (userLevel === "beginner" && waveHeight > 1.4) return "NO GO";
  if (score >= 70) return "SURF IS ON";
  if (score >= 40) return "SURFABLE";
  return "NO GO";
}

// ----------------------------
// Group hourly results into daily summaries
// ----------------------------

function buildDailyForecast(spotHours, userProfile) {
  // Group by date
  const byDate = {};

  for (const hour of spotHours) {
    const date = formatDate(hour.time);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(hour);
  }

  const days = Object.entries(byDate).slice(0, 5); // max 5 days

  return days.map(([date, hours]) => {
    // Best hour of the day = highest score
    const best = [...hours].sort((a, b) => b.score - a.score)[0];

    // Find a second window close in score but different time
    const second = hours.find(h =>
      h.time !== best.time &&
      h.score >= best.score - 10
    );

    const displayRating = Math.min(Math.round(best.score / 20), 5);
    const verdict = verdictFromScore(best.score, best.waveHeight, userProfile.level);

    // Hourly breakdown for the detail view (every hour, cleaned up)
    const hourly = hours.map(h => ({
      time: formatTime(h.time),
      wave_height: h.waveHeight != null ? `${h.waveHeight.toFixed(1)}m` : "–",
      period: h.wavePeriod != null ? `${h.wavePeriod.toFixed(0)}s` : "–",
      wind: h.windSpeed != null ? `${h.windSpeed.toFixed(0)}km/h` : "–",
      score: h.score,
      rating: Math.min(Math.round(h.score / 20), 5),
    }));

    return {
      date,
      day_name: getDayName(date + "T00:00:00Z"),
      verdict,
      rating: displayRating,
      best_window: formatTime(best.time),
      second_window: second ? formatTime(second.time) : null,
      wave_height: best.waveHeight != null ? `${best.waveHeight.toFixed(1)}m` : "–",
      period: best.wavePeriod != null ? `${best.wavePeriod.toFixed(0)}s` : "–",
      wind: best.windSpeed != null ? `${best.windSpeed.toFixed(0)}km/h` : "–",
      why_short: best.reasons[0] || "",
      hourly,
    };
  });
}

// ----------------------------
// Main export
// ----------------------------

export function getSpotForecast(forecast, rawUserProfile, spotName) {
  const userProfile = deriveUserProfile(rawUserProfile);

  // Score all hours for all spots (reuse existing engine)
  const all = getSurfRecommendationsV2(forecast);

  // Normalize apostrophe variants so "d'Ilhas" and "d'Ilhas" both match
  const normalize = s => s.replace(/[\u2018\u2019\u0027]/g, "'");

  // Filter to just the requested spot
  const spotHours = all.filter(r => normalize(r.spot) === normalize(spotName));

  if (spotHours.length === 0) {
    return { error: `Spot "${spotName}" not found.` };
  }

  // Build 5-day daily summaries
  const daily_forecast = buildDailyForecast(spotHours, userProfile);

  // Today's best window (first day)
  const today = daily_forecast[0];

  // Static surf guide for this spot (normalize keys too)
  const guideKey = Object.keys(spotGuides).find(
    k => normalize(k) === normalize(spotName)
  );
  const guide = guideKey ? spotGuides[guideKey] : null;

  return {
    spot: spotName,
    user_level: userProfile.level,

    // Summary card (top of page)
    summary: {
      verdict: today.verdict,
      rating: today.rating,
      best_window: today.best_window,
      second_window: today.second_window,
      wave_height: today.wave_height,
      period: today.period,
      wind: today.wind,
      why_short: today.why_short,
    },

    // 5-day forecast list
    daily_forecast,

    // Static spot info
    surf_guide: guide,
  };
}