import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "redis";
import geoip from "geoip-lite"; // ✅ NEW

const app = express();
const PORT = 5000;

const redisClient = createClient({ url: "redis://localhost:6379" });
redisClient.on("error", (err) => console.error("Redis Client Error", err));
await redisClient.connect();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const getCacheKey = (params) => {
  return `mgnrega:${params.state_name}:${params.fin_year}:${params.limit}`;
};

app.get("/api/mgnrega", async (req, res) => {
  const { state_name, fin_year, limit, lat, lon } = req.query;

  if (!state_name || !fin_year || !limit) {
    return res.status(400).json({
      error: "Please provide state_name, fin_year, and limit.",
    });
  }

  // ✅ STEP 1: Determine user location
  let userLat = lat;
  let userLon = lon;

  if (!userLat || !userLon || userLat === "null" || userLon === "null") {
    // Fallback: Approximate from IP
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    if (geo) {
      userLat = geo.ll[0];
      userLon = geo.ll[1];
      console.log(`🌍 Fallback location (IP): ${userLat}, ${userLon}`);
    } else {
      console.log("📍 No location info available");
    }
  } else {
    console.log(`📍 Precise GPS location: ${userLat}, ${userLon}`);
  }

  const cacheKey = getCacheKey(req.query);

  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("✅ Returning cached data");
      return res.json({
        userLocation: { lat: userLat, lon: userLon },
        recordCount: JSON.parse(cachedData).length,
        records: JSON.parse(cachedData),
      });
    }

    const baseUrl = "https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722";
    const apiKey = "579b464db66ec23bdd0000018454fd5ff68b4f345d0ee805160ee6fb";

    const queryParams = new URLSearchParams({
      "api-key": apiKey,
      format: "json",
      "filters[state_name]": state_name,
      "filters[fin_year]": fin_year,
      limit,
    });

    const url = `${baseUrl}?${queryParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    const records = data.records || [];

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(records));
    console.log("🧠 Data cached in Redis");

    res.json({
      userLocation: userLat && userLon ? { lat: userLat, lon: userLon } : null,
      recordCount: records.length,
      records,
    });
  } catch (err) {
    console.error("❌ Error fetching MGNREGA data:", err);
    res.status(500).json({ error: "Failed to fetch data from external API." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
