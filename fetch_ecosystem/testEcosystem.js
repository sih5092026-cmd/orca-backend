const BASE_URL = "http://localhost:3006/api/ecosystem";

// ============================================================
// TEST LOCATIONS
// ============================================================

const locations = [
    // {
    //     name: "Mumbai",
    //     latitude: 19.0760,
    //     longitude: 72.8777
    // },
    {
        name: "Goa",
        latitude: 15.4909,
        longitude: 73.8278
    },
    {
        name: "Kochi",
        latitude: 9.9312,
        longitude: 76.2673
    },
    {
        name: "Chennai",
        latitude: 13.0827,
        longitude: 80.2707
    },
    {
        name: "Visakhapatnam",
        latitude: 17.6868,
        longitude: 83.2185
    },
    {
        name: "Kolkata",
        latitude: 22.5726,
        longitude: 88.3639
    },
    {
        name: "Port Blair",
        latitude: 11.6234,
        longitude: 92.7265
    }
];

// ============================================================
// TEST DATES
// ============================================================

const dates = [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05"
];

// ============================================================
// DELAY
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// FETCH ONE TEST
// ============================================================

async function testEcosystem(location, date) {

    const params = new URLSearchParams({
        latitude: location.latitude,
        longitude: location.longitude,
        date
    });

    const url = `${BASE_URL}?${params.toString()}`;

    console.log("\n----------------------------------------");
    console.log(`Location : ${location.name}`);
    console.log(`Latitude : ${location.latitude}`);
    console.log(`Longitude: ${location.longitude}`);
    console.log(`Date     : ${date}`);
    console.log("----------------------------------------");

    const startTime = Date.now();

    try {

        const response = await fetch(url);

        const elapsed = Date.now() - startTime;

        const data = await response.json();

        console.log(`HTTP     : ${response.status}`);
        console.log(`Time     : ${elapsed} ms`);
        console.log(`Success  : ${data.success}`);

        if (!response.ok || !data.success) {

            console.log("ERROR:");
            console.log(data);

            return {
                success: false,
                location: location.name,
                date,
                elapsed
            };
        }

        const ecosystem = data.ecosystem || {};

        console.log("\nECOSYSTEM DATA:");

        console.log(
            "Chlorophyll        :",
            ecosystem.chlorophyll_mg_m3
        );

        console.log(
            "Phytoplankton      :",
            ecosystem.phytoplankton_mmol_m3
        );

        console.log(
            "Dissolved Oxygen   :",
            ecosystem.dissolved_oxygen_mg_l
        );

        console.log(
            "Primary Production :",
            ecosystem.primary_production_mg_c_m3_day
        );

        console.log(
            "Nitrate            :",
            ecosystem.nitrate_mmol_m3
        );

        console.log(
            "Phosphate          :",
            ecosystem.phosphate_mmol_m3
        );

        console.log(
            "Silicate           :",
            ecosystem.silicate_mmol_m3
        );

        console.log(
            "Iron               :",
            ecosystem.dissolved_iron_mmol_m3
        );

        console.log(
            "pH                 :",
            ecosystem.ph
        );

        console.log(
            "DIC                :",
            ecosystem.dissolved_inorganic_carbon_mmol_m3
        );

        console.log(
            "Total Alkalinity   :",
            ecosystem.total_alkalinity_mmol_m3
        );

        console.log(
            "Surface CO2        :",
            ecosystem.surface_co2_pa
        );

        console.log(
            "Optical Attenuation:",
            ecosystem.optical_attenuation_m_inv
        );

        console.log(
            "Zooplankton        :",
            ecosystem.zooplankton_mmol_m3
        );

        console.log(
            "Suspended Matter   :",
            ecosystem.suspended_matter_mg_l
        );

        console.log(
            "Secchi Depth       :",
            ecosystem.secchi_depth_m
        );

        console.log(
            "KD490              :",
            ecosystem.kd490_m_inv
        );

        return {
            success: true,
            location: location.name,
            date,
            elapsed,
            ecosystem
        };

    } catch (error) {

        console.log("REQUEST FAILED:");
        console.log(error.message);

        return {
            success: false,
            location: location.name,
            date,
            elapsed: Date.now() - startTime,
            error: error.message
        };
    }
}

// ============================================================
// MAIN TEST
// ============================================================

async function runTests() {

    console.log("========================================");
    console.log("       ORCA ECOSYSTEM API TEST");
    console.log("========================================");

    console.log(`API: ${BASE_URL}`);

    const results = [];

    let testNumber = 1;

    for (const location of locations) {

        for (const date of dates) {

            console.log(`\n\nTEST ${testNumber}`);

            const result = await testEcosystem(
                location,
                date
            );

            results.push(result);

            testNumber++;

            // Small delay between requests
            await sleep(1000);
        }
    }

    // ========================================================
    // SUMMARY
    // ========================================================

    console.log("\n\n========================================");
    console.log("             TEST SUMMARY");
    console.log("========================================");

    const successful = results.filter(
        result => result.success
    );

    const failed = results.filter(
        result => !result.success
    );

    console.log(`Total Tests : ${results.length}`);
    console.log(`Successful  : ${successful.length}`);
    console.log(`Failed      : ${failed.length}`);

    console.log("\nRESULTS:");

    for (const result of results) {

        console.log(
            `${result.success ? "✅" : "❌"} ` +
            `${result.location.padEnd(15)} ` +
            `${result.date} ` +
            `${result.elapsed || "-"} ms`
        );
    }

    console.log("\n========================================");
    console.log("              TEST COMPLETE");
    console.log("========================================");
}

// ============================================================
// START
// ============================================================

runTests();