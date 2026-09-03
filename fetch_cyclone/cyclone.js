// server.js
// Node 18+ (uses built-in fetch). Run: npm install express && node server.js

const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;

// RSMC New Delhi area of responsibility (Bay of Bengal + Arabian Sea)
const IO_LON_MIN = 45, IO_LON_MAX = 100;
const IO_LAT_MIN = 0, IO_LAT_MAX = 30;
const IO_COUNTRIES = new Set(["IND", "BGD", "MMR", "LKA", "PAK", "OMN", "MDV", "THA"]);

const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/Events/geteventlist/EVENTS4APP";

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough wind -> category label (approximation; not IMD's official grade scale)
function windToCategory(windKmh) {
  if (windKmh == null) return null;
  if (windKmh < 63) return "Depression";
  if (windKmh < 89) return "Deep Depression";
  if (windKmh < 118) return "Cyclonic Storm";
  if (windKmh < 166) return "Severe Cyclonic Storm";
  if (windKmh < 222) return "Very Severe Cyclonic Storm";
  if (windKmh < 262) return "Extremely Severe Cyclonic Storm";
  return "Super Cyclonic Storm";
}

function emptyCycloneResponse() {
  return {
    cyclone: {
      active: false,
      name: null,
      distance_km: null,
      category: null,
      maximum_sustained_wind_kmh: null,
      maximum_gust_kmh: null,
      central_pressure_hpa: null,
      movement_direction_deg: null,
      movement_speed_kmh: null,
      warning_level: null,
      forecast_track: [],
    },
  };
}

app.get("/api/cyclone", async (req, res) => {
  try {
    const { lat, lon, date, time, radius_km } = req.query;

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: "lat and lon query parameters are required" });
    }

    const inputLat = parseFloat(lat);
    const inputLon = parseFloat(lon);
    const searchRadiusKm = radius_km ? parseFloat(radius_km) : 500; // default 500km

    if (Number.isNaN(inputLat) || Number.isNaN(inputLon)) {
      return res.status(400).json({ error: "lat and lon must be valid numbers" });
    }
    if (Number.isNaN(searchRadiusKm) || searchRadiusKm <= 0) {
      return res.status(400).json({ error: "radius_km must be a positive number" });
    }

    // date/time accepted for API-contract completeness; GDACS EVENTS4APP only
    // returns current/recent events (last ~4 days), so historical date filtering
    // beyond that window isn't possible with this free endpoint.
    const requestedDateTime =
      date && time ? new Date(`${date}T${time}`) : date ? new Date(date) : null;

    const gdacsResp = await fetch(GDACS_URL, { timeout: 10000 });
    if (!gdacsResp.ok) {
      return res.status(502).json({ error: "Failed to fetch GDACS data", status: gdacsResp.status });
    }
    const gdacsJson = await gdacsResp.json();
    const events = gdacsJson.features || [];

    // Filter to North Indian Ocean cyclones only
    const ioCyclones = events
      .filter((e) => e.properties.eventtype === "TC")
      .filter((e) => {
        const [lon2, lat2] = e.geometry.coordinates;
        const inBbox = lon2 >= IO_LON_MIN && lon2 <= IO_LON_MAX && lat2 >= IO_LAT_MIN && lat2 <= IO_LAT_MAX;
        const countries = new Set((e.properties.affectedcountries || []).map((c) => c.iso3));
        const affectsIndiaRegion = [...countries].some((c) => IO_COUNTRIES.has(c));
        return inBbox || affectsIndiaRegion;
      })
      .map((e) => {
        const [cLon, cLat] = e.geometry.coordinates;
        const distanceKm = haversineKm(inputLat, inputLon, cLat, cLon);
        const windKmh = e.properties.severitydata?.severity ?? null;
        return {
          raw: e,
          lat: cLat,
          lon: cLon,
          distanceKm,
          windKmh,
        };
      })
      .filter((c) => c.distanceKm <= searchRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (ioCyclones.length === 0) {
      return res.json(emptyCycloneResponse());
    }

    const nearest = ioCyclones[0];
    const p = nearest.raw.properties;

    // Fields GDACS's free list endpoint does NOT provide are set to null:
    // maximum_gust_kmh, central_pressure_hpa, movement_direction_deg,
    // movement_speed_kmh, forecast_track. Populating these needs either
    // GDACS's richer geteventdata/getgeometry endpoints (track polygon,
    // per-episode wind data) or IMD RSMC bulletins directly.
    const response = {
      cyclone: {
        active: true,
        name: p.eventname || null,
        distance_km: Math.round(nearest.distanceKm * 10) / 10,
        category: windToCategory(nearest.windKmh),
        maximum_sustained_wind_kmh: nearest.windKmh,
        maximum_gust_kmh: null,
        central_pressure_hpa: null,
        movement_direction_deg: null,
        movement_speed_kmh: null,
        warning_level: p.alertlevel || null, // Green / Orange / Red
        forecast_track: [], // needs getgeometry/geteventdata enrichment
      },
      meta: {
        source: "GDACS (aggregating NOAA/JTWC/RSMC)",
        source_event_id: p.eventid,
        details_url: p.url?.details || null,
        track_geometry_url: p.url?.geometry || null,
        query: {
          lat: inputLat,
          lon: inputLon,
          radius_km: searchRadiusKm,
          date: date || null,
          time: time || null,
        },
        candidates_found: ioCyclones.length,
      },
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cyclone API running on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/cyclone?lat=15.5&lon=80.2&radius_km=500`);
});