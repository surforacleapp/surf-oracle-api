// homeOracle.js
// Builds the Home Screen recommendation using engineV2 (0–100 scoring)

import { getSurfRecommendationsV2 } from "./engineV2.js";
import { deriveUserProfile } from "./userProfile.js";

// ----------------------------
// Helpers: Time + Date formatting
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

// ----------------------------
// Oracle language (v1 locked)
// ----------------------------

const verdictCopy = {
  NO_ONE: "NO ONE SURFS TODAY",
  NO_GO: "NO GO",
  GO: "SURFABLE CONDITIONS",
  GO_NOW: "SURF IS ON"
};

const whyShortMap = {
  NO_ONE:
    "Powerful storm swell and strong winds. The ocean is not for humans today.",
  NO_GO:
    "Conditions are not a good fit for your level. Not recommended.",
  GO:
    "Surfable waves with some trade-offs. Manageable with the right timing.",
  GO_NOW:
    "Clean, fun conditions during the best window of the day."
};

export function getHomeRecommendation(forecast, rawUserProfile) {
  const userProfile = deriveUserProfile(rawUserProfile);

  const all = getSurfRecommendationsV2(forecast);
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  const secondary = sorted.find(r =>
    r.spot === best.spot &&
    r.time !== best.time &&
    r.score >= best.score - 10
  );

  // ----------------------------
  // GLOBAL DANGER
  // ----------------------------
  const globalDanger =
    best.flags?.stormDay === true ||
    best.waveHeight >= 3.0 ||
    best.energy >= 3000;

  // ----------------------------
  // VERDICT
  // ----------------------------
  let verdictKey = "NO_GO";

  if (globalDanger) {
    verdictKey = "NO_ONE";
  }
  else if (
    userProfile.level === "beginner" &&
    (
      best.waveHeight > userProfile.comfort.maxWaveHeight ||
      best.energy > userProfile.comfort.maxEnergy
    )
  ) {
    verdictKey = "NO_GO";
  }
  else if (best.score >= 70) {
    verdictKey = "GO_NOW";
  }
  else if (best.score >= 40) {
    verdictKey = "GO";
  }

  // ----------------------------
  // UI RATING
  // ----------------------------
  let displayRating = Math.round(best.score / 20);

  if (globalDanger) {
    displayRating = Math.min(displayRating, 2);
  }

  if (
    userProfile.level === "beginner" &&
    verdictKey !== "GO_NOW"
  ) {
    displayRating = Math.min(displayRating, 2);
  }

  // ----------------------------
  // TOP 3 SPOTS
  // Fix: deduplicate by spot name and exclude the primary spot,
  // so the list always shows 3 distinct alternatives.
  // ----------------------------
  const seenSpots = new Set();
  const topSpots = [];

  for (const r of sorted) {
    if (seenSpots.has(r.spot)) continue;       // skip duplicate spots
    if (r.spot === best.spot) continue;        // exclude primary spot
    seenSpots.add(r.spot);
    topSpots.push({
      spot: r.spot,
      rating: Math.round(r.score / 20),
      time_window: formatTime(r.time),
      date: formatDate(r.time),
      why_short:
        verdictKey.startsWith("NO")
          ? "Conditions are unsafe"
          : r.reasons[0] || ""
    });
    if (topSpots.length === 3) break;
  }

  // ----------------------------
  // RETURN PAYLOAD
  // ----------------------------
  return {
    verdict: verdictCopy[verdictKey],

    primary: {
      spot: best.spot,
      time_window: formatTime(best.time),
      date: formatDate(best.time),
      secondary_time_window: secondary ? formatTime(secondary.time) : null,
      rating: displayRating,

      surf_height:
        best.waveHeight != null
          ? `${best.waveHeight.toFixed(1)}m`
          : "–",

      period:
        best.wavePeriod != null
          ? `${best.wavePeriod.toFixed(0)}s`
          : "–",

      wind:
        best.windSpeed != null && best.windDirection != null
          ? `${Math.round(best.windDirection)}° ${best.windSpeed.toFixed(0)}km/h`
          : "–",

      why_short: whyShortMap[verdictKey]
    },

    top_spots: topSpots,

    meta: {
      userLevel: userProfile.level,
      confidenceScore: userProfile.confidenceScore,
      globalDanger
    }
  };
}