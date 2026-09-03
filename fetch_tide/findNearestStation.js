const stations = require("./stations.json");

function findNearestStation(latitude, longitude) {
    if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        throw new Error("Latitude and longitude must be valid numbers.");
    }

    const R = 6371;

    const toRadians = (degree) => degree * Math.PI / 180;

    let nearestStation = null;
    let shortestDistance = Infinity;

    for (const station of stations) {
        const dLat = toRadians(station.latitude - latitude);
        const dLon = toRadians(station.longitude - longitude);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(latitude)) *
            Math.cos(toRadians(station.latitude)) *
            Math.sin(dLon / 2) ** 2;

        const c = 2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

        const distance = R * c;

        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestStation = station;
        }
    }

    return {
        name: nearestStation.name,
        latitude: nearestStation.latitude,
        longitude: nearestStation.longitude,
        distance_km: Number(shortestDistance.toFixed(2))
    };
}

module.exports = {
    findNearestStation
};