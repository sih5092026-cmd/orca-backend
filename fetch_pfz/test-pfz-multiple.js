const BASE_URL = "http://localhost:3005/api/pfz";

// ============================================================
// ORCA PFZ MULTI-LOCATION TEST
// ============================================================

const tests = [

    // --------------------------------------------------------
    // WEST COAST
    // --------------------------------------------------------

    {
        name: "Gujarat",
        lat: 21.5,
        lon: 70.0
    },

    {
        name: "Maharashtra",
        lat: 19.076,
        lon: 72.8777
    },

    {
        name: "Goa",
        lat: 15.49,
        lon: 73.83
    },

    {
        name: "Karnataka",
        lat: 13.0,
        lon: 74.8
    },

    {
        name: "Kerala",
        lat: 10.0,
        lon: 76.0
    },


    // --------------------------------------------------------
    // EAST COAST
    // --------------------------------------------------------

    {
        name: "South Tamil Nadu",
        lat: 9.0,
        lon: 78.0
    },

    {
        name: "North Tamil Nadu",
        lat: 12.5,
        lon: 80.5
    },

    {
        name: "South Andhra Pradesh",
        lat: 14.0,
        lon: 80.5
    },

    {
        name: "North Andhra Pradesh",
        lat: 17.0,
        lon: 83.0
    },

    {
        name: "Odisha",
        lat: 20.0,
        lon: 86.5
    },

    {
        name: "West Bengal",
        lat: 22.0,
        lon: 88.0
    },


    // --------------------------------------------------------
    // ISLANDS
    // --------------------------------------------------------

    {
        name: "Lakshadweep",
        lat: 10.5,
        lon: 72.5
    },

    {
        name: "Andaman",
        lat: 11.5,
        lon: 93.0
    },

    {
        name: "Nicobar",
        lat: 8.0,
        lon: 93.0
    },


    // --------------------------------------------------------
    // OFFSHORE TESTS
    // --------------------------------------------------------

    {
        name: "Mumbai Offshore",
        lat: 18.8,
        lon: 72.5
    },

    {
        name: "Goa Offshore",
        lat: 15.0,
        lon: 73.5
    },

    {
        name: "Chennai Offshore",
        lat: 13.0,
        lon: 80.6
    },

    {
        name: "Andaman Offshore",
        lat: 11.0,
        lon: 93.5
    },


    // --------------------------------------------------------
    // OUTSIDE / CONTROL
    // --------------------------------------------------------

    {
        name: "Sri Lanka",
        lat: 6.0,
        lon: 80.5
    },

    {
        name: "Arabian Sea",
        lat: 15.0,
        lon: 65.0
    },


    // --------------------------------------------------------
    // INVALID INPUTS
    // --------------------------------------------------------

    {
        name: "Invalid Latitude",
        lat: 999,
        lon: 72.5
    },

    {
        name: "Invalid Longitude",
        lat: 19.0,
        lon: 999
    }

];


// ============================================================
// TEST ONE URL
// ============================================================

async function testLocation(test) {

    const url =
        `${BASE_URL}?latitude=${test.lat}&longitude=${test.lon}`;

    try {

        const response = await fetch(url);

        let data;

        try {
            data = await response.json();
        }
        catch {
            return {
                name: test.name,
                coordinates: `${test.lat}, ${test.lon}`,
                http: response.status,
                sector: "-",
                secid: "-",
                available: "-",
                candidates: "-",
                recommended: "-",
                forecast: "-",
                valid_upto: "-",
                error: "Invalid JSON response"
            };
        }


        // ----------------------------------------------------
        // HTTP ERROR
        // ----------------------------------------------------

        if (!response.ok) {

            return {
                name: test.name,
                coordinates: `${test.lat}, ${test.lon}`,
                http: response.status,
                sector: "-",
                secid: "-",
                available: "-",
                candidates: "-",
                recommended: "-",
                forecast: "-",
                valid_upto: "-",
                error: data.error || "API error"
            };
        }


        const pfz = data.pfz || {};

        const candidates =
            Array.isArray(pfz.candidate_zones)
                ? pfz.candidate_zones
                : [];


        // ----------------------------------------------------
        // FIND RECOMMENDED
        // ----------------------------------------------------

        const recommended =
            candidates.find(
                zone => zone.recommended === true
            );


        return {

            name: test.name,

            coordinates:
                `${test.lat}, ${test.lon}`,

            http:
                response.status,

            sector:
                pfz.sector ?? "-",

            secid:
                pfz.secid ?? "-",

            available:
                pfz.available ?? false,

            candidates:
                candidates.length,

            recommended:
                recommended
                    ? `${recommended.latitude}, ${recommended.longitude}`
                    : "-",

            nearest_km:
                recommended
                    ? recommended.distance_from_user_km
                    : "-",

            forecast:
                pfz.forecast_date ?? "-",

            valid_upto:
                pfz.valid_upto ?? "-",

            error:
                pfz.error ?? "-"
        };

    }
    catch (error) {

        return {

            name: test.name,

            coordinates:
                `${test.lat}, ${test.lon}`,

            http:
                "-",

            sector:
                "-",

            secid:
                "-",

            available:
                "-",

            candidates:
                "-",

            recommended:
                "-",

            nearest_km:
                "-",

            forecast:
                "-",

            valid_upto:
                "-",

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
    console.log(
        "============================================================"
    );

    console.log(
        "              ORCA PFZ MULTI-LOCATION TEST"
    );

    console.log(
        "============================================================"
    );

    console.log(
        `API: ${BASE_URL}`
    );

    console.log(
        `Tests: ${tests.length}`
    );

    console.log(
        "============================================================"
    );

    console.log("");


    const results = [];


    // --------------------------------------------------------
    // RUN TESTS ONE BY ONE
    // --------------------------------------------------------

    for (const test of tests) {

        process.stdout.write(
            `Testing ${test.name.padEnd(25)} ... `
        );


        const result =
            await testLocation(test);


        results.push(result);


        if (result.error !== "-") {

            console.log(
                `ERROR: ${result.error}`
            );

        }
        else {

            console.log(
                `${result.sector} | ` +
                `available=${result.available} | ` +
                `candidates=${result.candidates}`
            );
        }
    }


    // ========================================================
    // RESULT TABLE
    // ========================================================

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "                         RESULTS"
    );

    console.log(
        "============================================================"
    );

    console.log("");


    console.table(results);


    // ========================================================
    // SUMMARY
    // ========================================================

    const successful =
        results.filter(
            r =>
                r.http >= 200 &&
                r.http < 300
        );

    const failed =
        results.filter(
            r =>
                r.error !== "-"
        );


    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "                         SUMMARY"
    );

    console.log(
        "============================================================"
    );


    console.log(
        `Total tests:       ${results.length}`
    );

    console.log(
        `HTTP successful:   ${successful.length}`
    );

    console.log(
        `Errors:            ${failed.length}`
    );


    // --------------------------------------------------------
    // SECTOR COUNTS
    // --------------------------------------------------------

    const sectors = {};


    for (const result of successful) {

        const sector =
            result.sector || "NO SECTOR";


        sectors[sector] =
            (sectors[sector] || 0) + 1;
    }


    console.log("");
    console.log("Sector results:");


    for (
        const [sector, count]
        of Object.entries(sectors)
    ) {

        console.log(
            `  ${sector}: ${count}`
        );
    }


    // --------------------------------------------------------
    // PFZ AVAILABILITY
    // --------------------------------------------------------

    const available =
        successful.filter(
            r => r.available === true
        ).length;


    const unavailable =
        successful.filter(
            r => r.available === false
        ).length;


    console.log("");

    console.log(
        `PFZ available:     ${available}`
    );

    console.log(
        `PFZ unavailable:   ${unavailable}`
    );


    console.log("");
    console.log(
        "============================================================"
    );
}


main();