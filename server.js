import express from "express";
import fetch from "node-fetch";
import cors from "cors";

import { adaptStormglassForecast } from "./forecastAdapter.js";
import { getHomeRecommendation } from "./homeOracle.js";
import { getSpotForecast } from "./spotOracle.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🌊 GitHub forecast source (Ericeira for now)
const FORECAST_URL =
  "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/ericeira.json";

// ----------------------------
// 🧠 Home Oracle endpoint
// POST /home-oracle
// Body: { ...userProfile }
// ----------------------------
app.post("/home-oracle", async (req, res) => {
  try {
    const rawUserProfile = req.body;

    const response = await fetch(FORECAST_URL);
    if (!response.ok) throw new Error("Failed to fetch forecast JSON from GitHub");

    const json = await response.json();
    const forecast = adaptStormglassForecast({ forecast: json.forecast });
    const result = getHomeRecommendation(forecast, rawUserProfile);

    res.json(result);
  } catch (err) {
    console.error("Home Oracle error:", err);
    res.status(500).json({ error: "Home Oracle failed." });
  }
});

// ----------------------------
// 🏄 Spot Forecast endpoint
// POST /spot-forecast
// Body: { spot: "Ribeira d'Ilhas", ...userProfile }
// ----------------------------
app.post("/spot-forecast", async (req, res) => {
  try {
    const { spot, ...rawUserProfile } = req.body;

    if (!spot) {
      return res.status(400).json({ error: "Missing required field: spot" });
    }

    const response = await fetch(FORECAST_URL);
    if (!response.ok) throw new Error("Failed to fetch forecast JSON from GitHub");

    const json = await response.json();
    const forecast = adaptStormglassForecast({ forecast: json.forecast });
    const result = getSpotForecast(forecast, rawUserProfile, spot);

    res.json(result);
  } catch (err) {
    console.error("Spot Forecast error:", err);
    res.status(500).json({ error: "Spot Forecast failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Oracle running on port ${PORT}`);
});
