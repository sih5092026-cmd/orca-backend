const cheerio = require("cheerio");

const BASE_URL =
    "https://www.incois.gov.in/oceanservices/PAT/tidegraphphases.jsp";


// ==================================================
// FETCH INCOIS PAT PAGE
// ==================================================

async function fetchTidePage(
    stationName,
    fromDate,
    toDate
) {

    if (!stationName) {
        throw new Error("Station name is required");
    }

    if (!fromDate) {
        throw new Error("fromDate is required");
    }

    if (!toDate) {
        throw new Error("toDate is required");
    }


    const url = new URL(BASE_URL);

    url.searchParams.set(
        "fromDate",
        fromDate
    );

    url.searchParams.set(
        "toDate",
        toDate
    );

    url.searchParams.set(
        "region",
        stationName
    );


    console.log(
        "\nFetching INCOIS PAT:"
    );

    console.log(
        url.toString()
    );


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `INCOIS request failed: ${response.status}`
        );
    }


    return await response.text();
}


// ==================================================
// PARSE INCOIS PAT PAGE
// ==================================================

function parseTidePage(html) {

    const $ =
        cheerio.load(html);


    const highTide = [];
    const lowTide = [];


    // ==================================================
    // FIND TABLE
    // ==================================================

    $("table").each(
        (tableIndex, table) => {

            const tableText =
                $(table)
                    .text()
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();


            /*
             * We want the table containing
             * High Tide and Low Tide.
             */

            if (
                !tableText.includes("high tide") ||
                !tableText.includes("low tide")
            ) {

                return;
            }


            // ==================================================
            // READ EVERY ROW
            // ==================================================

            $(table)
                .find("tr")
                .each(
                    (rowIndex, row) => {

                        const cells =
                            $(row)
                                .find("td")
                                .map(
                                    (i, cell) =>
                                        $(cell)
                                            .text()
                                            .replace(
                                                /\s+/g,
                                                " "
                                            )
                                            .trim()
                                )
                                .get();


                        /*
                         * Expected INCOIS row:
                         *
                         * High Time | High Level |
                         * Low Time  | Low Level
                         *
                         * Example:
                         *
                         * 30-08-2026 00:09
                         * 1.20
                         * 30-08-2026 05:59
                         * 0.36
                         */

                        if (
                            cells.length < 4
                        ) {

                            return;
                        }


                        const highTime =
                            cells[0];

                        const highLevel =
                            Number(
                                cells[1]
                            );


                        const lowTime =
                            cells[2];

                        const lowLevel =
                            Number(
                                cells[3]
                            );


                        // ==================================================
                        // HIGH TIDE
                        // ==================================================

                        if (
                            isValidTideTime(
                                highTime
                            ) &&
                            Number.isFinite(
                                highLevel
                            )
                        ) {

                            highTide.push({

                                date:
                                    extractDate(
                                        highTime
                                    ),

                                time:
                                    extractTime(
                                        highTime
                                    ),

                                height_m:
                                    highLevel
                            });
                        }


                        // ==================================================
                        // LOW TIDE
                        // ==================================================

                        if (
                            isValidTideTime(
                                lowTime
                            ) &&
                            Number.isFinite(
                                lowLevel
                            )
                        ) {

                            lowTide.push({

                                date:
                                    extractDate(
                                        lowTime
                                    ),

                                time:
                                    extractTime(
                                        lowTime
                                    ),

                                height_m:
                                    lowLevel
                            });
                        }
                    }
                );
        }
    );


    // ==================================================
    // REMOVE DUPLICATES
    // ==================================================

    const uniqueHigh =
        removeDuplicates(
            highTide
        );


    const uniqueLow =
        removeDuplicates(
            lowTide
        );


    // ==================================================
    // SORT
    // ==================================================

    uniqueHigh.sort(
        compareTideDateTime
    );

    uniqueLow.sort(
        compareTideDateTime
    );


    // ==================================================
    // FINAL REQUIRED ORCA STRUCTURE
    // ==================================================

    return {

        current_tide_height_m:
            null,

        tide_phase:
            null,

        high_tide:
            uniqueHigh.map(
                tide => ({

                    time:
                        `${tide.date} ${tide.time}`,

                    height_m:
                        tide.height_m
                })
            ),

        low_tide:
            uniqueLow.map(
                tide => ({

                    time:
                        `${tide.date} ${tide.time}`,

                    height_m:
                        tide.height_m
                })
            ),

        tidal_current_velocity_ms:
            null,

        tidal_current_direction_deg:
            null
    };
}


// ==================================================
// CHECK TIDE TIME
// ==================================================

function isValidTideTime(
    value
) {

    if (
        !value ||
        typeof value !== "string"
    ) {

        return false;
    }


    return /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/
        .test(
            value.trim()
        );
}


// ==================================================
// EXTRACT DATE
// ==================================================

function extractDate(
    value
) {

    const match =
        value
            .trim()
            .match(
                /^(\d{2}-\d{2}-\d{4})\s+\d{2}:\d{2}$/
            );


    if (!match) {
        return null;
    }


    return match[1];
}


// ==================================================
// EXTRACT TIME
// ==================================================

function extractTime(
    value
) {

    const match =
        value
            .trim()
            .match(
                /^\d{2}-\d{2}-\d{4}\s+(\d{2}:\d{2})$/
            );


    if (!match) {
        return null;
    }


    return match[1];
}


// ==================================================
// REMOVE DUPLICATES
// ==================================================

function removeDuplicates(
    tides
) {

    const map =
        new Map();


    for (
        const tide of tides
    ) {

        const key =
            `${tide.date}|${tide.time}|${tide.height_m}`;


        map.set(
            key,
            tide
        );
    }


    return [
        ...map.values()
    ];
}


// ==================================================
// SORT TIDES
// ==================================================

function compareTideDateTime(
    a,
    b
) {

    const dateA =
        parseINCOISTime(
            `${a.date} ${a.time}`
        );


    const dateB =
        parseINCOISTime(
            `${b.date} ${b.time}`
        );


    return dateA - dateB;
}


// ==================================================
// PARSE INCOIS IST TIME
// ==================================================

function parseINCOISTime(
    value
) {

    const match =
        value.match(
            /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/
        );


    if (!match) {
        return null;
    }


    const day =
        Number(match[1]);

    const month =
        Number(match[2]);

    const year =
        Number(match[3]);

    const hour =
        Number(match[4]);

    const minute =
        Number(match[5]);


    // IST → UTC

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            hour - 5,
            minute - 30
        )
    );
}


// ==================================================
// EXPORT
// ==================================================

module.exports = {

    fetchTidePage,

    parseTidePage
};