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
const REGION_URLS = {
  nazare: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/nazare.json",
  peniche: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/peniche.json",
  ericeira: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/ericeira.json",
  lisboa: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/lisboa.json",
  cascais: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/cascais.json",
  costa_caparica: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/costa_caparica.json",
  sines: "https://raw.githubusercontent.com/surforacleapp/homeOracle/main/docs/sines.json",
};

const DEFAULT_REGION = "ericeira";

function getForecastUrl(region) {
  const key = region?.toLowerCase().replace(/\s+/g, "_") || DEFAULT_REGION;
  return REGION_URLS[key] || REGION_URLS[DEFAULT_REGION];
}

// ----------------------------
// 🧠 Home Oracle endpoint
// POST /home-oracle
// Body: { ...userProfile }
// ----------------------------
app.post("/home-oracle", async (req, res) => {
  try {
    const rawUserProfile = req.body;

    const region = req.body.region || DEFAULT_REGION;
  const response = await fetch(getForecastUrl(region));
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

    const region = req.body.region || DEFAULT_REGION;
  const response = await fetch(getForecastUrl(region));
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
