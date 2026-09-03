// test-cyclone.js
// Run: node test-cyclone.js
// Simulates a fake active cyclone near Visakhapatnam so you can verify the
// distance/filter logic without waiting for a real storm.

const express = require("express");
const app = express();
const PORT = 4001;

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

// Fake GDACS-shaped fixture: a cyclone centered near Visakhapatnam (17.68N, 83.22E)
const MOCK_CYCLONE = {
  eventname: "TESTCYCLONE-26",
  eventid: 9999999,
  alertlevel: "Orange",
  severitydata: { severity: 118, severitytext: "Cyclonic Storm (test fixture)" },
  lat: 17.68,
  lon: 83.22,
  url: { details: "mock://details", geometry: "mock://geometry" },
};

app.get("/api/cyclone", (req, res) => {
  const { lat, lon, radius_km } = req.query;
  const inputLat = parseFloat(lat);
  const inputLon = parseFloat(lon);
  const searchRadiusKm = radius_km ? parseFloat(radius_km) : 500;

  const distanceKm = haversineKm(inputLat, inputLon, MOCK_CYCLONE.lat, MOCK_CYCLONE.lon);

  if (distanceKm > searchRadiusKm) {
    return res.json({
      cyclone: {
        active: false, name: null, distance_km: null, category: null,
        maximum_sustained_wind_kmh: null, maximum_gust_kmh: null,
        central_pressure_hpa: null, movement_direction_deg: null,
        movement_speed_kmh: null, warning_level: null, forecast_track: [],
      },
    });
  }

  res.json({
    cyclone: {
      active: true,
      name: MOCK_CYCLONE.eventname,
      distance_km: Math.round(distanceKm * 10) / 10,
      category: "Cyclonic Storm",
      maximum_sustained_wind_kmh: MOCK_CYCLONE.severitydata.severity,
      maximum_gust_kmh: null,
      central_pressure_hpa: null,
      movement_direction_deg: null,
      movement_speed_kmh: null,
      warning_level: MOCK_CYCLONE.alertlevel,
      forecast_track: [],
    },
  });
});

app.listen(PORT, () => console.log(`Mock cyclone API on http://localhost:${PORT}`));