// userProfile.js
// Derives Oracle-ready user profile from raw onboarding inputs

export function deriveUserProfile(raw) {
  let score = 0;

  // --- Surf frequency ---
  if (raw.surfFrequency === "fairly_regular") score += 1;
  if (raw.surfFrequency === "a_lot") score += 2;

  // --- Surf experience ---
  if (raw.surfExperience === "1_to_3_years") score += 1;
  if (raw.surfExperience === "3_plus_years") score += 2;

  // --- Paddle ability ---
  if (raw.paddleAbility === "depends_on_day") score += 1;
  if (raw.paddleAbility === "pretty_easy") score += 2;

  // --- Board type ---
  if (raw.boardType === "midlength") score += 1;
  if (raw.boardType === "shortboard") score += 2;

  // --- Board size ---
  if (raw.boardSize === "6_6_to_7_2") score += 1;
  if (raw.boardSize === "5_0_to_6_6") score += 2;

  // --- Nose shape ---
  if (raw.noseShape === "pointed") {
    score += 1;
  }

  // --- Level decision (4 levels) ---
  let level;
  if (score >= 10) {
    level = "advanced";
  } else if (score >= 7) {
    level = "advanced_intermediate";
  } else if (score >= 4) {
    level = "intermediate";
  } else {
    level = "beginner";
  }

  // --- Comfort & danger matrices (dynamic per level) ---
  const comfort = {
    beginner: {
      maxWaveHeight: 1.2,
      maxEnergy: 1000,
      maxWindSpeed: 20,
      idealPeriod: { min: 8, max: 14 }
    },
    intermediate: {
      maxWaveHeight: 2.0,
      maxEnergy: 2000,
      maxWindSpeed: 25,
      idealPeriod: { min: 7, max: 16 }
    },
    advanced_intermediate: {
      maxWaveHeight: 3.0,
      maxEnergy: 4000,
      maxWindSpeed: 30,
      idealPeriod: { min: 6, max: 18 }
    },
    advanced: {
      maxWaveHeight: 5.0,
      maxEnergy: 8000,
      maxWindSpeed: 40,
      idealPeriod: { min: 5, max: 20 }
    }
  }[level];

  // --- Risk appetite ---
  let riskAppetite;
  if (raw.riskAppetite === "adventurous") {
    riskAppetite = "adventurous";
  } else if (raw.riskAppetite === "moderate") {
    riskAppetite = "moderate";
  } else {
    riskAppetite = "conservative";
  }

  // --- User goals ---
  const goals = raw.goals || ["have_fun"];

  return {
    level,
    confidenceScore: score,
    comfort,
    riskAppetite,
    goals
  };
}
