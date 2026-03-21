// homeOracle.js
// Builds the Home Screen recommendation using engineV2 (0–100 scoring)

import { getSurfRecommendationsV2 } from "./engineV2.js";
import { deriveUserProfile } from "./userProfile.js";

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

/**
 * @param {Array} forecast - normalized ForecastHour[]
 * @param {Object} rawUserProfile - raw onboarding answers
 */
export function getHomeRecommendation(forecast, rawUserProfile) {
  // 1. Derive user profile
  const userProfile = deriveUserProfile(rawUserProfile);

  // 2. Run engine V2 (raw intelligence)
  const all = getSurfRecommendationsV2(forecast);

  // 3. Sort by score (best relative conditions first)
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  console.log("Forecast length:", forecast.length);
  console.log("Total scored results:", all.length);
  console.log("Sorted length:", sorted.length);

  // 4. Secondary time window (same spot, close score)
  const secondary = sorted.find(r =>
    r.spot === best.spot &&
    r.time !== best.time &&
    r.score >= best.score - 10
  );

  // ----------------------------
  // ABSOLUTE GLOBAL DANGER LOGIC
  // ----------------------------
  const globalDanger =
    best.flags?.stormDay === true ||
    best.waveHeight >= 3.0 ||
    best.energy >= 3000;

  // ----------------------------
  // VERDICT DECISION (ORDER MATTERS)
  // ----------------------------
  let verdictKey = "NO_GO";

  // 1️⃣ Nobody should surf (overrides everything)
  if (globalDanger) {
    verdictKey = "NO_ONE";
  }

  // 2️⃣ Beginner safety override
  else if (
    userProfile.level === "beginner" &&
    (
      best.waveHeight > userProfile.comfort.maxWaveHeight ||
      best.energy > userProfile.comfort.maxEnergy
    )
  ) {
    verdictKey = "NO_GO";
  }

  // 3️⃣ Normal decision logic (only if safe)
  else if (best.score >= 70) {
    verdictKey = "GO_NOW";
  }
  else if (best.score >= 40) {
    verdictKey = "GO";
  }
  else {
    verdictKey = "NO_GO";
  }

  // ----------------------------
  // UI RATING (0–5 stars)
  // ----------------------------
  let displayRating = Math.round(best.score / 20);

  // Never show high stars on danger days
  if (globalDanger) {
    displayRating = Math.min(displayRating, 2);
  }

  // Protect beginners from misleading ratings
  if (
    userProfile.level === "beginner" &&
    verdictKey !== "GO_NOW"
  ) {
    displayRating = Math.min(displayRating, 2);
  }

  // ----------------------------
  // TOP 3 SPOTS (awareness only)
  // ----------------------------
  const topSpots = sorted.slice(0, 3).map(r => ({
    spot: r.spot,
    rating: Math.round(r.score / 20),
    time_window: r.time,
    why_short:
      verdictKey.startsWith("NO")
        ? "Conditions are unsafe"
        : r.reasons[0] || ""
  }));

  // ----------------------------
  // RETURN HOME PAYLOAD
  // ----------------------------
  return {
    verdict: verdictCopy[verdictKey],

    primary: {
      spot: best.spot,
      time_window: best.time,
      secondary_time_window: secondary ? secondary.time : null,
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
