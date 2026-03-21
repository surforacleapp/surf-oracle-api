import express from "express";
import fetch from "node-fetch";
import cors from "cors";

import { adaptStormglassForecast } from "./forecastAdapter.js";
import { getHomeRecommendation } from "./homeOracle.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🌊 GitHub forecast source (Ericeira for now)
const FORECAST_URL =
  "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/ericeira.json";

// 🧠 Oracle endpoint
app.post("/home-oracle", async (req, res) => {
  try {
    const rawUserProfile = req.body;

    // 1️⃣ Fetch forecast from GitHub
    const response = await fetch(FORECAST_URL);

    if (!response.ok) {
      throw new Error("Failed to fetch forecast JSON from GitHub");
    }

    const json = await response.json();

    // 2️⃣ Adapt forecast to Oracle format
    const forecast = adaptStormglassForecast({
      forecast: json.forecast
    });

    // 3️⃣ Run Oracle brain
    const result = getHomeRecommendation(forecast, rawUserProfile);

    res.json(result);

  } catch (err) {
    console.error("Oracle error:", err);
    res.status(500).json({ error: "Oracle failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Oracle running on port ${PORT}`);
});
