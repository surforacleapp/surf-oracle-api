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

  // --- Nose shape (only if mid-size board) ---
  if (
    raw.boardSize === "6_6_to_7_2" &&
    raw.noseShape === "pointed"
  ) {
    score += 1;
  }

  // --- Level decision ---
  const level = score >= 7 ? "intermediate" : "beginner";

  // --- Safety & comfort limits ---
  const comfort =
    level === "beginner"
      ? { maxWaveHeight: 1.4, maxEnergy: 1200 }
      : { maxWaveHeight: 2.0, maxEnergy: 2000 };

  return {
    level,
    confidenceScore: score,
    comfort
  };
}
