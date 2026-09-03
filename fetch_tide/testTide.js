const BASE_URL = "http://localhost:3002/tide";

async function testTide(name, params) {
    console.log("\n========================================");
    console.log(`TEST: ${name}`);
    console.log("========================================");

    const url = `${BASE_URL}?${new URLSearchParams(params)}`;

    console.log("URL:", url);

    try {
        const response = await fetch(url);

        let data;

        try {
            data = await response.json();
        } catch {
            console.error("ERROR: Server did not return valid JSON");
            console.error("HTTP Status:", response.status);
            return;
        }

        console.log("HTTP Status:", response.status);
        console.log("Success:", data.success);

        // ========================================
        // EXPECTED ERROR RESPONSE
        // ========================================

        if (!data.success) {
            console.log("Error:", data.error);
            return;
        }

        // ========================================
        // BASIC RESPONSE
        // ========================================

        console.log("Date Range:", data.date_range);
        console.log("Locations:", data.locations_count);

        // ========================================
        // HANDLE BOTH:
        // data.data = object
        // data.data = array
        // ========================================

        let location;

        if (Array.isArray(data.data)) {
            location = data.data[0];
        } else {
            location = data.data;
        }

        // ========================================
        // SAFETY CHECK
        // ========================================

        if (!location) {
            console.log("\nERROR: No location data returned.");

            console.log("\nRAW API RESPONSE:");
            console.log(JSON.stringify(data, null, 2));

            return;
        }

        // ========================================
        // STATION
        // ========================================

        console.log("\nStation:");

        console.log(
            "  Name:",
            location.station?.name ?? "N/A"
        );

        console.log(
            "  Latitude:",
            location.station?.latitude ?? "N/A"
        );

        console.log(
            "  Longitude:",
            location.station?.longitude ?? "N/A"
        );

        console.log(
            "  Distance:",
            location.station?.distance_km ?? "N/A",
            "km"
        );

        // ========================================
        // TIDE DATA
        // ========================================

        const tides = location.tides || {};

        console.log("\nTide Data:");

        console.log(
            "  High Tides:",
            tides.high_tide?.length ?? 0
        );

        console.log(
            "  Low Tides:",
            tides.low_tide?.length ?? 0
        );

        console.log(
            "  Current Height:",
            tides.current_tide_height_m ?? null
        );

        console.log(
            "  Tide Phase:",
            tides.tide_phase ?? null
        );

        console.log(
            "  Current Velocity:",
            tides.tidal_current_velocity_ms ?? null
        );

        console.log(
            "  Current Direction:",
            tides.tidal_current_direction_deg ?? null
        );

        // ========================================
        // HIGH TIDES
        // ========================================

        console.log("\nFirst 3 High Tides:");

        if (
            Array.isArray(tides.high_tide) &&
            tides.high_tide.length > 0
        ) {
            console.log(
                JSON.stringify(
                    tides.high_tide.slice(0, 3),
                    null,
                    2
                )
            );
        } else {
            console.log("No high tide data");
        }

        // ========================================
        // LOW TIDES
        // ========================================

        console.log("\nFirst 3 Low Tides:");

        if (
            Array.isArray(tides.low_tide) &&
            tides.low_tide.length > 0
        ) {
            console.log(
                JSON.stringify(
                    tides.low_tide.slice(0, 3),
                    null,
                    2
                )
            );
        } else {
            console.log("No low tide data");
        }

        // ========================================
        // SOURCE
        // ========================================

        console.log("\nSource:");
        console.log(
            " ",
            location.source ?? data.source ?? "N/A"
        );

        // ========================================
        // RAW RESPONSE
        // ========================================

        console.log("\nRaw location response:");

        console.log(
            JSON.stringify(location, null, 2)
        );

    } catch (error) {
        console.error("\nREQUEST FAILED:");
        console.error(error.message);
    }
}


// ======================================================
// RUN ALL TESTS
// ======================================================

async function runTests() {

    // ==================================================
    // TEST 1 — MUMBAI
    // ==================================================

    await testTide(
        "Mumbai",
        {
            lat: "19.076",
            lon: "72.8777",
            fromDate: "2026-08-29",
            toDate: "2026-09-05"
        }
    );


    // ==================================================
    // TEST 2 — CHENNAI
    // ==================================================

    await testTide(
        "Chennai",
        {
            lat: "13.0827",
            lon: "80.2707",
            fromDate: "2026-08-29",
            toDate: "2026-09-05"
        }
    );


    // ==================================================
    // TEST 3 — GOA
    // ==================================================

    await testTide(
        "Goa",
        {
            lat: "15.4909",
            lon: "73.8278",
            fromDate: "2026-08-29",
            toDate: "2026-09-05"
        }
    );


    // ==================================================
    // TEST 4 — KERALA
    // ==================================================

    await testTide(
        "Kerala",
        {
            lat: "9.9312",
            lon: "76.2673",
            fromDate: "2026-08-29",
            toDate: "2026-09-05"
        }
    );


    // ==================================================
    // TEST 5 — INVALID LATITUDE
    // ==================================================

    await testTide(
        "Invalid Latitude",
        {
            lat: "999",
            lon: "72.8777",
            fromDate: "2026-08-29",
            toDate: "2026-09-05"
        }
    );


    // ==================================================
    // TEST 6 — INVALID LONGITUDE
    // ==================================================

    await testTide(
        "Invalid Longitude",
        {
            lat: "19.076",
            lon: "999",
            fromDate: "2026-08-29",
            toDate: "2026-09-05"
        }
    );


    // ==================================================
    // DONE
    // ==================================================

    console.log("\n========================================");
    console.log("ALL TESTS COMPLETED");
    console.log("========================================");
}


// ======================================================
// START
// ======================================================

runTests();