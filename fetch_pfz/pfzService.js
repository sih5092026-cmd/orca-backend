const cheerio = require("cheerio");

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
// HTTP SESSION FETCH + 6-HOUR CACHE + RETRIES
// ============================================================

const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const jar = new CookieJar();

const client = wrapper(
    axios.create({
        jar,
        timeout: 20000,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        },
        maxRedirects: 10
    })
);

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Cache HTML independently for each URL/sector.
// Parsed zone coordinates are recalculated for each user location.
const htmlCache = new Map();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getHtml(url, referer = null, options = {}) {

    const useCache = options.useCache !== false;
    const cacheKey = url;

    if (useCache) {
        const cached = htmlCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
            console.log(`Cache HIT: ${url}`);
            return cached.html;
        }

        if (cached) {
            htmlCache.delete(cacheKey);
            console.log(`Cache EXPIRED: ${url}`);
        }
    }

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const headers = {};

            if (referer) {
                headers.Referer = referer;
            }

            console.log(`INCOIS request attempt ${attempt}/${MAX_RETRIES}: ${url}`);

            const response = await client.get(url, { headers });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(
                    `INCOIS HTTP request failed for ${url}: ` +
                    `${response.status} ${response.statusText}`
                );
            }

            const html = response.data;

            if (useCache) {
                htmlCache.set(cacheKey, {
                    html,
                    timestamp: Date.now()
                });
                console.log(`Cache STORE: ${url}`);
            }

            return html;

        } catch (error) {
            lastError = error;

            if (attempt < MAX_RETRIES) {
                console.warn(
                    `INCOIS request failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
                );
                await sleep(RETRY_DELAY_MS * attempt);
            }
        }
    }

    if (lastError && (lastError.code === "ECONNABORTED" || lastError.code === "ETIMEDOUT")) {
        throw new Error(
            `INCOIS HTTP request timed out after 20 seconds (${MAX_RETRIES} attempts): ${url}`
        );
    }

    throw new Error(
        `INCOIS HTTP request failed after ${MAX_RETRIES} attempts for ${url}: ` +
        `${lastError ? lastError.message : "Unknown error"}`
    );
}

// ============================================================
// TABLE EXTRACTION
// ============================================================

// ============================================================
// TABLE EXTRACTION
// ============================================================

function extractTables(html) {

    const $ = cheerio.load(html);

    return $("table")
        .map(function () {

            return [
                $(this)
                    .find("tr")
                    .map(function () {

                        return [
                            $(this)
                                .find("th, td")
                                .map(function () {
                                    return $(this)
                                        .text()
                                        .replace(/\s+/g, " ")
                                        .trim();
                                })
                                .get()
                        ];
                    })
                    .get()
            ];
        })
        .get();
}


// ============================================================
// DISCOVER SEC IDs
// ============================================================

async function discoverSectorIds(html) {

    console.log(
        "\nDiscovering INCOIS PFZ sectors..."
    );

    const $ = cheerio.load(html);

    const result = [];

    $("select option").each(function () {

        result.push({

            text:
                $(this)
                    .text()
                    .replace(/\s+/g, " ")
                    .trim(),

            value:
                String($(this).attr("value") || "")
                    .trim()
        });
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
// FORECAST DATE / VALID UPTO
// ============================================================

function extractForecastDates(html) {

    const $ = cheerio.load(html);

    const rows =
        $("tr")
            .map(function () {

                return [
                    $(this)
                        .find("th, td")
                        .map(function () {
                            return $(this)
                                .text()
                                .replace(/\s+/g, " ")
                                .trim();
                        })
                        .get()
                ];
            })
            .get();

    let forecast_date = null;
    let valid_upto = null;

    const datePattern =
        /^\d{1,2}\s+[A-Z]{3}\s+\d{4}$/i;

    for (
        let rowIndex = 0;
        rowIndex < rows.length;
        rowIndex++
    ) {

        const row = rows[rowIndex];

        for (
            let cellIndex = 0;
            cellIndex < row.length;
            cellIndex++
        ) {

            const label =
                row[cellIndex]
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();

            if (
                label.includes("forecast date") &&
                !forecast_date
            ) {

                const sameRowValue =
                    row[cellIndex + 1];

                if (
                    sameRowValue &&
                    datePattern.test(sameRowValue)
                ) {
                    forecast_date = sameRowValue;
                    continue;
                }

                const nextRow =
                    rows[rowIndex + 1];

                const nextRowValue =
                    nextRow &&
                    nextRow[cellIndex];

                if (
                    nextRowValue &&
                    datePattern.test(nextRowValue)
                ) {
                    forecast_date = nextRowValue;
                }
            }

            if (
                label.includes("valid upto") &&
                !valid_upto
            ) {

                const sameRowValue =
                    row[cellIndex + 1];

                if (
                    sameRowValue &&
                    datePattern.test(sameRowValue)
                ) {
                    valid_upto = sameRowValue;
                    continue;
                }

                const nextRow =
                    rows[rowIndex + 1];

                const nextRowValue =
                    nextRow &&
                    nextRow[cellIndex];

                if (
                    nextRowValue &&
                    datePattern.test(nextRowValue)
                ) {
                    valid_upto = nextRowValue;
                }
            }
        }
    }

    return {
        forecast_date,
        valid_upto
    };
}


// ============================================================
// FETCH ONE SECTOR
// ============================================================

async function fetchSector(
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

    const html =
        await getHtml(url, INCOIS_HOME);

    const tables =
        extractTables(html);

    const table =
        findPFZTable(
            tables
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
            row
                .join(" ")
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

    const dates =
        extractForecastDates(html);

    return {

        available:
            zones.length > 0,

        forecast_date:
            dates.forecast_date,

        valid_upto:
            dates.valid_upto,

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
        // Fetch INCOIS home page and discover sector IDs
        // ----------------------------------------------------

        const homeHtml =
            await getHtml(INCOIS_HOME);

        const sectorIds =
            await discoverSectorIds(
                homeHtml
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

    }
}


module.exports = {

    getPFZData,

    detectSector,

    dmsToDecimal,

    parseRange,

    distanceKm
};