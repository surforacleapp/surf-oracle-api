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
function buildTimeWindow(hours, primaryThreshold = 60, secondaryThreshold = 50) {
  // Find all hours above primary threshold
  const primaryHours = hours
    .filter(h => h.score >= primaryThreshold)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  // Find consecutive block for primary window
  let primaryStart = null;
  let primaryEnd = null;
  if (primaryHours.length > 0) {
    primaryStart = formatTime(primaryHours[0].time);
    primaryEnd = formatTime(primaryHours[primaryHours.length - 1].time);
  }

  // Find secondary window — hours above secondary threshold
  // that are NOT in the primary block
  const secondaryHours = hours
    .filter(h => h.score >= secondaryThreshold && h.score < primaryThreshold)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  let secondaryStart = null;
  let secondaryEnd = null;
  if (secondaryHours.length > 0) {
    secondaryStart = formatTime(secondaryHours[0].time);
    secondaryEnd = formatTime(secondaryHours[secondaryHours.length - 1].time);
  }

  return {
    primary: primaryStart && primaryEnd
      ? `${primaryStart}–${primaryEnd}`
      : null,
    secondary: secondaryStart && secondaryEnd
      ? `${secondaryStart}–${secondaryEnd}`
      : null
  };
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

function buildWhyShort(verdictKey, reasons, waveHeight, windSpeed) {
  if (verdictKey === "NO_ONE") {
    return "The ocean is not safe today. Sit this one out.";
  }

  if (verdictKey === "NO_GO") {
    const reason = reasons?.[0];
    if (reason === "Poor swell direction") return "The swell isn't hitting the right angle today. Waves will be messy and hard to read.";
    if (reason === "Unfavorable wind") return "Wind is making a mess of things. Probably not worth the drive.";
    if (reason === "Strong wind") return "Too much wind today. Conditions will be choppy and frustrating.";
    if (reason === "Weak swell period") return "Waves will be weak and hard to catch. Good day to rest or cross-train.";
    if (reason === "Wave size not ideal for this spot") return "Size and spot aren't matching up today. Better options elsewhere.";
    return "Today's conditions aren't worth rearranging your day for. Better days coming.";
  }

  if (verdictKey === "GO_NOW") {
    const reason = reasons?.[0];
    if (reason === "Good swell direction") return "Swell is coming from a great angle. Waves should have good shape and be easy to read.";
    if (reason === "Favorable wind") return "Wind is offshore and clean. One of the better mornings this week.";
    if (reason === "Good swell period") return "The waves will carry more power than they look. Great opportunity to work on your surfing.";
    if (reason === "Good tide") return "Tide is dialled in for the morning window. Go early.";
    return "Clean conditions during the best window of the day. Worth showing up for.";
  }

  if (verdictKey === "GO") {
    const reason = reasons?.[0];
    if (reason === "Moderate wind") return "A bit of wind in the mix but still enjoyable. Go early before it picks up.";
    if (reason === "Poor swell direction") return "Not the cleanest setup today but there are waves to be had. Good for building confidence.";
    if (reason === "Weak swell period") return "Waves will be softer than ideal. Perfect for beginners looking to practice.";
    return "Decent conditions with a few trade-offs. Pick the right window and it's worth it.";
  }

  return "Check conditions before heading out.";
}

export function getHomeRecommendation(forecast, rawUserProfile) {
  const userProfile = deriveUserProfile(rawUserProfile);

  const all = getSurfRecommendationsV2(forecast);
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  const secondary = sorted.find(r =>
    r.spot !== best.spot &&
    r.score >= best.score - 15
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

    const spotHours = all.filter(r => r.spot === best.spot);
    const windows = buildTimeWindow(spotHours);

    primary: {
      spot: best.spot,
      time_window: windows.primary,
      date: formatDate(best.time),
      secondary_time_window: windows.secondary,
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

      why_short: buildWhyShort(verdictKey, best.reasons, best.waveHeight, best.windSpeed)
    },

    top_spots: topSpots,

    meta: {
      userLevel: userProfile.level,
      confidenceScore: userProfile.confidenceScore,
      globalDanger
    }
  };
}
