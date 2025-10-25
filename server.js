import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "redis";

const app = express();
const PORT = process.env.PORT || 5000;

//  Redis client setup
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = createClient({
  url: redisUrl
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
await redisClient.connect(); // connect to Redis server

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Helper function to generate cache keys
const getCacheKey = (params) => {
  return `mgnrega:${params.state_name}:${params.fin_year}:${params.limit}`;
};

// API route
app.get("/api/mgnrega", async (req, res) => {
  const { state_name, fin_year, limit } = req.query;

  if (!state_name || !fin_year || !limit) {
    return res.status(400).json({ error: "Please provide state_name, fin_year, and limit." });
  }

  const cacheKey = getCacheKey(req.query);

  try {
    // Check if data exists in Redis
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("Returning cached data");
      return res.json(JSON.parse(cachedData));
    }

    console.log("Fetching from API...");
    const baseUrl = process.env.MGNREGA_BASE_URL;
    const apiKey = process.env.MGNREGA_API_KEY;

    if (!baseUrl || !apiKey) {
      console.error("MGNREGA_BASE_URL or MGNREGA_API_KEY not set in .env");
      return res.status(500).json({ error: "Server configuration error." });
    }

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

    //  Store data in Redis for 1 hour (3600 seconds)
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(records));
    console.log("Data cached in Redis");

    res.json(records);
  } catch (err) {
    console.error("Error fetching MGNREGA data:", err);
    res.status(500).json({ error: "Failed to fetch data from external API." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
