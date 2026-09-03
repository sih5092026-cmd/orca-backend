const express = require("express");
const cors = require("cors");

const {
    findNearestStation
} = require("./findNearestStation");

const {
    fetchTidePage,
    parseTidePage
} = require("./tideService");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;


// ==================================================
// VALIDATE COORDINATES
// ==================================================

function validateCoordinates(latitude, longitude) {

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        return false;
    }

    if (
        latitude < -90 ||
        latitude > 90
    ) {
        return false;
    }

    if (
        longitude < -180 ||
        longitude > 180
    ) {
        return false;
    }

    return true;
}


// ==================================================
// VALIDATE DATE
// ==================================================

function isValidDate(dateString) {

    if (
        typeof dateString !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ) {
        return false;
    }

    const date = new Date(`${dateString}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === dateString
    );
}


// ==================================================
// GET TIDE FOR ONE LOCATION
// ==================================================

async function getTideForLocation(
    latitude,
    longitude,
    fromDate,
    toDate
) {

    // --------------------------------------------------
    // Coordinate validation
    // --------------------------------------------------

    if (
        !validateCoordinates(
            latitude,
            longitude
        )
    ) {
        throw new Error(
            "Invalid latitude or longitude"
        );
    }


    // --------------------------------------------------
    // Find nearest PAT station
    // --------------------------------------------------

    const station =
        findNearestStation(
            latitude,
            longitude
        );


    if (!station) {
        throw new Error(
            "No nearby tide station found"
        );
    }


    // --------------------------------------------------
    // Fetch INCOIS PAT page
    // --------------------------------------------------

    const html =
        await fetchTidePage(
            station.name,
            fromDate,
            toDate
        );


    // --------------------------------------------------
    // Parse tide data
    // --------------------------------------------------

    const tides =
        parseTidePage(html);


    // --------------------------------------------------
    // Return ORCA structure
    // --------------------------------------------------

    return {

        latitude,

        longitude,

        station: {

            name:
                station.name,

            latitude:
                station.latitude,

            longitude:
                station.longitude,

            distance_km:
                station.distance_km
        },

        date_range: {

            from:
                fromDate,

            to:
                toDate
        },

        tides,

        source:
            "INCOIS PAT"
    };
}


// ==================================================
// GET TIDE DATA FOR MULTIPLE LOCATIONS
// ==================================================

async function getTideData(
    locations,
    fromDate,
    toDate
) {

    if (!Array.isArray(locations)) {

        throw new Error(
            "locations must be an array"
        );
    }


    if (locations.length === 0) {

        throw new Error(
            "At least one location is required"
        );
    }


    // --------------------------------------------------
    // Validate dates
    // --------------------------------------------------

    if (!isValidDate(fromDate)) {

        throw new Error(
            `Invalid fromDate: ${fromDate}`
        );
    }


    if (!isValidDate(toDate)) {

        throw new Error(
            `Invalid toDate: ${toDate}`
        );
    }


    // --------------------------------------------------
    // Check date order
    // --------------------------------------------------

    if (fromDate > toDate) {

        throw new Error(
            "fromDate must be before or equal to toDate"
        );
    }


    // --------------------------------------------------
    // Fetch all locations
    // --------------------------------------------------

    return await Promise.all(

        locations.map(
            async (location) => {

                if (!location) {

                    throw new Error(
                        "Invalid location"
                    );
                }


                const latitude =
                    Number(
                        location.latitude
                    );

                const longitude =
                    Number(
                        location.longitude
                    );


                if (
                    !validateCoordinates(
                        latitude,
                        longitude
                    )
                ) {

                    throw new Error(
                        `Invalid latitude or longitude: ${latitude}, ${longitude}`
                    );
                }


                return await getTideForLocation(

                    latitude,

                    longitude,

                    fromDate,

                    toDate

                );
            }
        )
    );
}


// ==================================================
// HEALTH CHECK
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            service:
                "ORCA Tide API",

            status:
                "running",

            port:
                PORT,

            endpoint:
                "/tide"
        });
    }
);


// ==================================================
// TIDE API
// ==================================================

app.get(
    "/tide",
    async (req, res) => {

        try {

            // ==================================================
            // READ QUERY PARAMETERS
            // ==================================================

            const lat =
                req.query.lat;

            const lon =
                req.query.lon;

            const requestedFromDate =
                req.query.fromDate;

            const requestedToDate =
                req.query.toDate;


            // ==================================================
            // COORDINATES
            // ==================================================

            let latitude;
            let longitude;


            // --------------------------------------------------
            // If user supplied coordinates
            // --------------------------------------------------

            if (
                lat !== undefined ||
                lon !== undefined
            ) {

                // Both are required

                if (
                    lat === undefined ||
                    lon === undefined
                ) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Both lat and lon are required"
                    });
                }


                latitude =
                    Number(lat);

                longitude =
                    Number(lon);


                // --------------------------------------------------
                // IMPORTANT: geographic validation
                // --------------------------------------------------

                if (
                    !validateCoordinates(
                        latitude,
                        longitude
                    )
                ) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Invalid latitude or longitude. Latitude must be between -90 and 90, longitude must be between -180 and 180."
                    });
                }

            }

            // --------------------------------------------------
            // Default Mumbai
            // --------------------------------------------------

            else {

                latitude =
                    19.076;

                longitude =
                    72.8777;
            }


            // ==================================================
            // DATE RANGE
            // ==================================================

            const fromDate =
                requestedFromDate ||
                "2026-08-29";

            const toDate =
                requestedToDate ||
                "2026-11-30";


            // ==================================================
            // VALIDATE DATES
            // ==================================================

            if (
                !isValidDate(fromDate)
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        `Invalid fromDate: ${fromDate}. Expected YYYY-MM-DD.`
                });
            }


            if (
                !isValidDate(toDate)
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        `Invalid toDate: ${toDate}. Expected YYYY-MM-DD.`
                });
            }


            if (
                fromDate > toDate
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "fromDate must be before or equal to toDate"
                });
            }


            // ==================================================
            // CREATE LOCATION
            // ==================================================

            const locations = [

                {

                    latitude,

                    longitude
                }

            ];


            // ==================================================
            // FETCH TIDE
            // ==================================================

            const tide =
                await getTideData(

                    locations,

                    fromDate,

                    toDate

                );


            // ==================================================
            // RESPONSE
            // ==================================================

            return res.json({

                success: true,

                date_range: {

                    from:
                        fromDate,

                    to:
                        toDate
                },

                locations_count:
                    tide.length,

                data:
                    tide
            });

        }

        catch (error) {

            console.error(
                "\nTide API Error:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }

    }
);


// ==================================================
// START SERVER
// ==================================================

app.listen(

    PORT,

    () => {

        console.log(
            "\n========================================"
        );

        console.log(
            "          ORCA TIDE SERVER"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server running on: http://localhost:${PORT}`
        );

        console.log(
            `Tide API: http://localhost:${PORT}/tide`
        );

        console.log(
            "\nTest URL:"
        );

        console.log(

            `http://localhost:${PORT}/tide?lat=19.076&lon=72.8777&fromDate=2026-08-29&toDate=2026-11-30`

        );

        console.log(
            "\nInvalid coordinate test:"
        );

        console.log(

            `http://localhost:${PORT}/tide?lat=999&lon=72.8777&fromDate=2026-08-29&toDate=2026-09-05`

        );

        console.log(
            "========================================\n"
        );
    }
);


// ==================================================
// EXPORTS
// ==================================================

module.exports = {

    getTideData,

    getTideForLocation

};