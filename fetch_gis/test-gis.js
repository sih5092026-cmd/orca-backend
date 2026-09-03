const BASE_URL = "http://localhost:3005/api/gis";

// ============================================================
// TEST LOCATIONS
// ============================================================

const tests = [
    // Mumbai
    {
        name: "Mumbai Land",
        lat: 19.076,
        lon: 72.8777
    },
    {
        name: "Mumbai Offshore 1",
        lat: 18.95,
        lon: 72.65
    },
    {
        name: "Mumbai Offshore 2",
        lat: 18.8,
        lon: 72.5
    },
    {
        name: "Mumbai Offshore 3",
        lat: 18.5,
        lon: 71.5
    },

    // Goa
    {
        name: "Goa Land",
        lat: 15.2993,
        lon: 74.124
    },
    {
        name: "Goa Offshore",
        lat: 15.0,
        lon: 73.5
    },

    // Kochi
    {
        name: "Kochi Land",
        lat: 9.9312,
        lon: 76.2673
    },
    {
        name: "Kochi Offshore",
        lat: 9.5,
        lon: 75.8
    },

    // Chennai
    {
        name: "Chennai Land",
        lat: 13.0827,
        lon: 80.2707
    },
    {
        name: "Chennai Offshore",
        lat: 13.0,
        lon: 80.6
    },

    // Visakhapatnam
    {
        name: "Visakhapatnam Land",
        lat: 17.6868,
        lon: 83.2185
    },
    {
        name: "Visakhapatnam Offshore",
        lat: 17.5,
        lon: 83.7
    },

    // Andaman
    {
        name: "Port Blair Land",
        lat: 11.6234,
        lon: 92.7265
    },
    {
        name: "Andaman Offshore",
        lat: 11.0,
        lon: 93.5
    },

    // Lakshadweep
    {
        name: "Kavaratti",
        lat: 10.5669,
        lon: 72.642
    },
    {
        name: "Lakshadweep Offshore",
        lat: 10.3,
        lon: 72.0
    },

    // Negative / control tests
    {
        name: "Sri Lanka",
        lat: 5.9,
        lon: 80.27
    },
    {
        name: "Sri Lanka Offshore",
        lat: 6.0,
        lon: 81.5
    },
    {
        name: "Pakistan Control",
        lat: 24.0,
        lon: 66.5
    },
    {
        name: "Bangladesh Control",
        lat: 21.5,
        lon: 90.5
    }
];


// ============================================================
// TEST ONE LOCATION
// ============================================================

async function testLocation(test) {

    const url =
        `${BASE_URL}?latitude=${test.lat}&longitude=${test.lon}`;

    try {

        const response = await fetch(url);

        const data = await response.json();

        if (!response.ok) {

            return {
                name: test.name,
                coordinates: `${test.lat}, ${test.lon}`,
                http: response.status,
                error: data.error || "Unknown error"
            };
        }


        const gis = data.gis || {};
        const zone = gis.fishing_zone || {};


        return {

            name: test.name,

            coordinates:
                `${test.lat}, ${test.lon}`,

            depth:
                gis.water_depth_m,

            coast_km:
                gis.coast_distance_km,

            zone:
                zone.zone,

            country:
                zone.country,

            status:
                zone.status,

            limit_nm:
                zone.distance_limit_nm,

            zone_id:
                zone.zone_id,

            boundary_km:
                gis.nearest_maritime_boundary_km,

            port_km:
                gis.nearest_port_km,

            error: null
        };

    }
    catch (error) {

        return {

            name: test.name,

            coordinates:
                `${test.lat}, ${test.lon}`,

            error:
                error.message
        };
    }
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log("");
    console.log("============================================================");
    console.log("              ORCA GIS MULTI-LOCATION TEST");
    console.log("============================================================");
    console.log(`API: ${BASE_URL}`);
    console.log(`Tests: ${tests.length}`);
    console.log("============================================================");
    console.log("");


    const results = [];


    for (const test of tests) {

        process.stdout.write(
            `Testing ${test.name.padEnd(28)} ... `
        );

        const result =
            await testLocation(test);

        results.push(result);

        if (result.error) {

            console.log(
                `ERROR: ${result.error}`
            );

        }
        else {

            console.log(
                `${result.zone} | depth=${result.depth}m`
            );
        }
    }


    // ========================================================
    // DETAILED TABLE
    // ========================================================

    console.log("");
    console.log("============================================================");
    console.log("                         RESULTS");
    console.log("============================================================");
    console.log("");


    console.table(
        results.map(r => ({
            Location: r.name,
            Coordinates: r.coordinates,
            Depth_m: r.depth ?? "-",
            Coast_km: r.coast_km ?? "-",
            Zone: r.zone ?? "-",
            Country: r.country ?? "-",
            Status: r.status ?? "-",
            Limit_NM: r.limit_nm ?? "-",
            Zone_ID: r.zone_id ?? "-",
            Error: r.error ?? "-"
        }))
    );


    // ========================================================
    // SUMMARY
    // ========================================================

    const successful =
        results.filter(r => !r.error);

    const failed =
        results.filter(r => r.error);


    console.log("");
    console.log("============================================================");
    console.log("                         SUMMARY");
    console.log("============================================================");

    console.log(
        `Total:      ${results.length}`
    );

    console.log(
        `Successful: ${successful.length}`
    );

    console.log(
        `Failed:     ${failed.length}`
    );


    // Count zones

    const zoneCounts = {};

    for (const result of successful) {

        const zone =
            result.zone || "UNKNOWN";

        zoneCounts[zone] =
            (zoneCounts[zone] || 0) + 1;
    }


    console.log("");
    console.log("Zone counts:");

    for (const [zone, count] of Object.entries(zoneCounts)) {

        console.log(
            `  ${zone}: ${count}`
        );
    }


    console.log("");
    console.log("============================================================");
}


main();