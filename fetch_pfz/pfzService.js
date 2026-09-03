const puppeteer = require("puppeteer");

const INCOIS_HOME =
    "https://www.incois.gov.in/MarineFisheries/" +
    "TextDataHome?mfid=1&request_locale=en";

const INCOIS_TEXT =
    "https://www.incois.gov.in/MarineFisheries/TextData";


// ============================================================
// DMS -> DECIMAL
// ============================================================

function dmsToDecimal(value) {

    if (!value) return null;

    const text = String(value)
        .replace(/\u00a0/g, " ")
        .replace(/[°'"]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const match = text.match(
        /(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*([NSEW])/i
    );

    if (!match) return null;

    const degrees = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    let decimal =
        degrees +
        minutes / 60 +
        seconds / 3600;

    const direction =
        match[4].toUpperCase();

    if (
        direction === "S" ||
        direction === "W"
    ) {
        decimal = -decimal;
    }

    return Number(decimal.toFixed(6));
}


// ============================================================
// RANGE
// ============================================================

function parseRange(value) {

    const text = String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

    const match = text.match(
        /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/
    );

    if (!match) {

        return {
            min: null,
            max: null,
            raw: text || null
        };
    }

    return {

        min: Number(match[1]),

        max: Number(match[2]),

        raw: text
    };
}


// ============================================================
// HAVERSINE DISTANCE
// ============================================================

function distanceKm(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLon =
        (lon2 - lon1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );
}


// ============================================================
// NORMALIZE NAME
// ============================================================

function normalizeName(value) {

    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}


// ============================================================
// DETECT COASTAL SECTOR
// ============================================================

function detectSector(
    latitude,
    longitude
) {

    // Gujarat
    if (
        latitude >= 20 &&
        longitude >= 68 &&
        longitude < 72.8
    ) {
        return "GUJARAT";
    }


    // Maharashtra
    if (
        latitude >= 15.5 &&
        latitude < 20.5 &&
        longitude >= 72.5 &&
        longitude < 74.2
    ) {
        return "MAHARASHTRA";
    }


    // Goa
    if (
        latitude >= 14.7 &&
        latitude < 16.0 &&
        longitude >= 73.4 &&
        longitude < 74.5
    ) {
        return "GOA";
    }


    // Karnataka
    if (
        latitude >= 11.5 &&
        latitude < 15.2 &&
        longitude >= 73.5 &&
        longitude < 75.5
    ) {
        return "KARNATAKA";
    }


    // Kerala
    if (
        latitude >= 8.0 &&
        latitude < 12.8 &&
        longitude >= 74.5 &&
        longitude < 77.5
    ) {
        return "KERALA";
    }


    // South Tamil Nadu
    if (
        latitude >= 8.0 &&
        latitude < 10.8 &&
        longitude >= 77 &&
        longitude <= 80.5
    ) {
        return "SOUTH TAMILNADU";
    }


    // North Tamil Nadu
    if (
        latitude >= 10.0 &&
        latitude < 13.7 &&
        longitude >= 79.3 &&
        longitude <= 81.5
    ) {
        return "NORTH TAMILNADU";
    }


    // South Andhra Pradesh
    if (
        latitude >= 12.5 &&
        latitude < 15.5 &&
        longitude >= 79.5 &&
        longitude <= 82.5
    ) {
        return "SOUTH ANDHRA PRADESH";
    }


    // North Andhra Pradesh
    if (
        latitude >= 14.5 &&
        latitude < 18.5 &&
        longitude >= 81 &&
        longitude <= 84.5
    ) {
        return "NORTH ANDHRA PRADESH";
    }


    // Odisha
    if (
        latitude >= 17.5 &&
        latitude < 22.5 &&
        longitude >= 81.5 &&
        longitude <= 87.5
    ) {
        return "ODISHA";
    }


    // West Bengal
    if (
        latitude >= 21 &&
        latitude <= 23 &&
        longitude >= 87 &&
        longitude <= 89
    ) {
        return "WEST BENGAL";
    }


    // Lakshadweep
    if (
        latitude >= 8 &&
        latitude <= 13.5 &&
        longitude >= 70 &&
        longitude <= 75.5
    ) {
        return "LAKSHADWEEP";
    }


    // Andaman
    if (
        latitude >= 10 &&
        latitude <= 14.5 &&
        longitude >= 92 &&
        longitude <= 94
    ) {
        return "ANDAMAN";
    }


    // Nicobar
    if (
        latitude >= 6 &&
        latitude < 10 &&
        longitude >= 92 &&
        longitude <= 94.5
    ) {
        return "NICOBAR";
    }


    return null;
}


// ============================================================
// DISCOVER SEC IDs
// ============================================================

async function discoverSectorIds(page) {

    console.log(
        "\nDiscovering INCOIS PFZ sectors..."
    );


    await page.goto(
        INCOIS_HOME,
        {
            waitUntil: "networkidle2",
            timeout: 60000
        }
    );


    await new Promise(
        resolve => setTimeout(resolve, 2000)
    );


    const result =
        await page.evaluate(() => {

            const output = [];


            const selects =
                Array.from(
                    document.querySelectorAll("select")
                );


            for (
                const select of selects
            ) {

                const options =
                    Array.from(
                        select.options
                    );


                for (
                    const option of options
                ) {

                    output.push({

                        text:
                            option.textContent
                                .replace(/\s+/g, " ")
                                .trim(),

                        value:
                            option.value
                                .trim()
                    });
                }
            }


            return output;
        });


    const mapping = {};


    for (
        const item of result
    ) {

        const name =
            normalizeName(
                item.text
            );


        let value =
            item.value;


        // ====================================================
        // IMPORTANT FIX
        //
        // Example:
        //
        // TextData;jsessionid=XXXX?secid=SEC003
        //
        // becomes:
        //
        // SEC003
        // ====================================================

        const secMatch =
            value.match(
                /[?&]secid=(SEC\d+)/i
            );


        if (secMatch) {

            value =
                secMatch[1].toUpperCase();
        }


        if (
            name &&
            /^SEC\d+$/i.test(value)
        ) {

            mapping[name] =
                value;
        }
    }


    console.log(
        "\n========================================"
    );

    console.log(
        "DISCOVERED INCOIS PFZ SECTORS"
    );

    console.log(
        "========================================"
    );


    console.table(mapping);


    return mapping;
}


// ============================================================
// EXTRACT PFZ TABLE
// ============================================================

function findPFZTable(tables) {

    for (
        const table of tables
    ) {

        const text =
            table
                .flat()
                .join(" ")
                .toLowerCase();


        if (
            text.includes("from the coast") &&
            text.includes("direction") &&
            text.includes("bearing") &&
            text.includes("latitude") &&
            text.includes("longitude")
        ) {

            return table;
        }
    }


    return null;
}


// ============================================================
// FETCH ONE SECTOR
// ============================================================

async function fetchSector(
    page,
    sector,
    secid,
    userLatitude,
    userLongitude
) {

    const url =
        `${INCOIS_TEXT}?secid=${secid}`;


    console.log(
        `\nFetching ${sector}`
    );

    console.log(
        `SEC ID: ${secid}`
    );


    await page.goto(
        url,
        {
            waitUntil: "networkidle2",
            timeout: 60000
        }
    );


    await new Promise(
        resolve => setTimeout(resolve, 2500)
    );


    const data =
        await page.evaluate(() => {

            const tables =
                Array.from(
                    document.querySelectorAll("table")
                );


            return {

                body:
                    document.body.innerText,

                tables:
                    tables.map(
                        table => {

                            const rows =
                                Array.from(
                                    table.querySelectorAll("tr")
                                );


                            return rows.map(
                                row =>
                                    Array.from(
                                        row.querySelectorAll(
                                            "th, td"
                                        )
                                    ).map(
                                        cell =>
                                            cell.innerText
                                                .replace(/\s+/g, " ")
                                                .trim()
                                    )
                            );
                        }
                    )
            };
        });


    const table =
        findPFZTable(
            data.tables
        );


    if (!table) {

        console.log(
            `No PFZ table for ${sector}`
        );


        return {

            available: false,

            forecast_date: null,

            valid_upto: null,

            zones: []
        };
    }


    console.log(
        `PFZ table found for ${sector}`
    );


    const zones = [];


    for (
        const row of table
    ) {

        if (row.length < 7) {
            continue;
        }


        if (
            row[0]
                .toLowerCase()
                .includes(
                    "from the coast"
                )
        ) {
            continue;
        }


        const latitude =
            dmsToDecimal(
                row[5]
            );


        const longitude =
            dmsToDecimal(
                row[6]
            );


        if (
            latitude === null ||
            longitude === null
        ) {
            continue;
        }


        const distance =
            parseRange(row[3]);


        const depth =
            parseRange(row[4]);


        const bearing =
            Number(
                row[2]
                    .replace(/[^\d.-]/g, "")
            );


        zones.push({

            zone_id:
                `PFZ-${String(
                    zones.length + 1
                ).padStart(3, "0")}`,

            coastal_reference:
                row[0],

            direction:
                row[1],

            bearing_deg:
                Number.isFinite(bearing)
                    ? bearing
                    : null,

            distance_range_km:
                distance.raw,

            distance_min_km:
                distance.min,

            distance_max_km:
                distance.max,

            depth_range_m:
                depth.raw,

            depth_min_m:
                depth.min,

            depth_max_m:
                depth.max,

            latitude,

            longitude,

            distance_from_user_km:
                Number(
                    distanceKm(
                        userLatitude,
                        userLongitude,
                        latitude,
                        longitude
                    ).toFixed(2)
                ),

            pfz_confidence:
                null,

            suitability_score:
                null,

            sst_c:
                null,

            chlorophyll_mg_m3:
                null,

            sst_gradient:
                null,

            chlorophyll_gradient:
                null,

            front_present:
                null,

            potential_fish_aggregation:
                true,

            recommended:
                false
        });
    }


    zones.sort(
        (a, b) =>
            a.distance_from_user_km -
            b.distance_from_user_km
    );


    if (zones.length > 0) {

        zones[0].recommended =
            true;
    }


    const body =
        data.body
            .replace(/\s+/g, " ");


    const forecastMatch =
        body.match(
            /FORECAST\s*DATE\s+(\d{1,2}\s+[A-Z]{3}\s+\d{4})/i
        );


    const validMatch =
        body.match(
            /VALID\s+UPTO\s+(\d{1,2}\s+[A-Z]{3}\s+\d{4})/i
        );


    return {

        available:
            zones.length > 0,

        forecast_date:
            forecastMatch
                ? forecastMatch[1]
                : null,

        valid_upto:
            validMatch
                ? validMatch[1]
                : null,

        zones
    };
}


// ============================================================
// MAIN PFZ FUNCTION
// ============================================================

async function getPFZData(
    latitude,
    longitude
) {

    let browser = null;


    try {

        // ----------------------------------------------------
        // Validate
        // ----------------------------------------------------

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            throw new Error(
                "Invalid latitude or longitude."
            );
        }


        // ----------------------------------------------------
        // Detect sector
        // ----------------------------------------------------

        const sector =
            detectSector(
                latitude,
                longitude
            );


        if (!sector) {

            return {

                available: false,

                source:
                    "INCOIS PFZ",

                sector: null,

                secid: null,

                forecast_date: null,

                valid_upto: null,

                candidate_zones: [],

                error:
                    "Location is outside configured Indian coastal PFZ sectors."
            };
        }


        console.log(
            `\nDetected sector: ${sector}`
        );


        // ----------------------------------------------------
        // Start Chrome
        // ----------------------------------------------------

        browser =
            await puppeteer.launch({

                headless: true,

                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage"
                ]
            });


        const page =
            await browser.newPage();


        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/142.0.0.0 Safari/537.36"
        );


        // ----------------------------------------------------
        // Discover sector IDs
        // ----------------------------------------------------

        const sectorIds =
            await discoverSectorIds(
                page
            );


        const secid =
            sectorIds[
                sector
            ];


        if (!secid) {

            throw new Error(
                `INCOIS SEC ID not found for ${sector}`
            );
        }


        console.log(
            `Using SEC ID: ${secid}`
        );


        // ----------------------------------------------------
        // Fetch sector
        // ----------------------------------------------------

        const result =
            await fetchSector(
                page,
                sector,
                secid,
                latitude,
                longitude
            );


        return {

            available:
                result.available,

            source:
                "INCOIS PFZ",

            sector,

            secid,

            forecast_date:
                result.forecast_date,

            valid_upto:
                result.valid_upto,

            candidate_zones:
                result.zones
        };


    } catch (error) {

        console.error(
            "\nPFZ ERROR:"
        );

        console.error(
            error.message
        );


        return {

            available: false,

            source:
                "INCOIS PFZ",

            sector: null,

            secid: null,

            forecast_date: null,

            valid_upto: null,

            candidate_zones: [],

            error:
                error.message
        };


    } finally {

        if (browser) {

            await browser.close();

        }
    }
}


module.exports = {

    getPFZData,

    detectSector,

    dmsToDecimal,

    parseRange,

    distanceKm
};