const fs = require("fs");
const path = require("path");
const shapefile = require("shapefile");

const {
    point,
    polygon,
    multiPolygon,
    polygonToLine,
    nearestPointOnLine
} = require("@turf/turf");


// ============================================================
// INDIA EEZ FILE
// ============================================================

const INDIA_EEZ_SHP = path.join(
    __dirname,
    "data",
    "maritime",
    "india",
    "india_eez.shp"
);


// ============================================================
// CACHE
// ============================================================

let indiaEEZ = null;
let indiaEEZBoundary = null;

let loadingPromise = null;


// ============================================================
// LOAD INDIA EEZ
// ============================================================

async function loadMaritimeBoundary() {

    if (
        indiaEEZBoundary
    ) {
        return indiaEEZBoundary;
    }


    if (loadingPromise) {
        return loadingPromise;
    }


    loadingPromise =
        (async () => {

            console.log("");

            console.log(
                "========================================"
            );

            console.log(
                "LOADING INDIA EEZ BOUNDARY"
            );

            console.log(
                "========================================"
            );


            // ------------------------------------------------
            // Check file
            // ------------------------------------------------

            if (
                !fs.existsSync(
                    INDIA_EEZ_SHP
                )
            ) {

                throw new Error(
                    `India EEZ shapefile not found:\n${INDIA_EEZ_SHP}`
                );
            }


            console.log(
                `File: ${INDIA_EEZ_SHP}`
            );


            // ------------------------------------------------
            // Open shapefile
            // ------------------------------------------------

            const source =
                await shapefile.open(
                    INDIA_EEZ_SHP
                );


            const features = [];


            // ------------------------------------------------
            // Read India EEZ polygons
            // ------------------------------------------------

            while (true) {

                const result =
                    await source.read();


                if (result.done) {
                    break;
                }


                const feature =
                    result.value;


                if (!feature) {
                    continue;
                }


                if (!feature.geometry) {
                    continue;
                }


                if (
                    feature.geometry.type !==
                        "Polygon" &&
                    feature.geometry.type !==
                        "MultiPolygon"
                ) {

                    continue;
                }


                features.push(
                    feature
                );
            }


            console.log(
                `India EEZ polygons: ${features.length}`
            );


            // ------------------------------------------------
            // Convert all EEZ polygons to boundary lines
            // ------------------------------------------------

            const boundaries = [];


            for (
                const feature of features
            ) {

                try {

                    let boundary = null;


                    if (
                        feature.geometry.type ===
                        "Polygon"
                    ) {

                        boundary =
                            polygonToLine(
                                polygon(
                                    feature.geometry.coordinates
                                )
                            );
                    }


                    else if (
                        feature.geometry.type ===
                        "MultiPolygon"
                    ) {

                        boundary =
                            polygonToLine(
                                multiPolygon(
                                    feature.geometry.coordinates
                                )
                            );
                    }


                    if (boundary) {

                        boundaries.push(
                            boundary
                        );
                    }

                }
                catch (error) {

                    console.error(
                        "Boundary conversion error:",
                        error.message
                    );

                }
            }


            indiaEEZ =
                features;


            indiaEEZBoundary =
                boundaries;


            console.log(
                `India EEZ boundaries: ${boundaries.length}`
            );


            console.log(
                "========================================"
            );

            console.log(
                "INDIA EEZ BOUNDARY READY"
            );

            console.log(
                "========================================"
            );

            console.log("");


            return indiaEEZBoundary;

        })();


    return loadingPromise;
}


// ============================================================
// GET NEAREST INDIA EEZ BOUNDARY
// ============================================================

async function getNearestMaritimeBoundary(
    latitude,
    longitude
) {

    latitude =
        Number(latitude);

    longitude =
        Number(longitude);


    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        return null;
    }


    // --------------------------------------------------------
    // Load boundary
    // --------------------------------------------------------

    const boundaries =
        await loadMaritimeBoundary();


    // --------------------------------------------------------
    // User point
    // --------------------------------------------------------

    const userPoint =
        point([
            longitude,
            latitude
        ]);


    let nearestDistance =
        Infinity;


    // --------------------------------------------------------
    // Check every India EEZ boundary
    // --------------------------------------------------------

    for (
        const boundary of boundaries
    ) {

        try {

            const nearest =
                nearestPointOnLine(
                    boundary,
                    userPoint,
                    {
                        units:
                            "kilometers"
                    }
                );


            if (
                !nearest ||
                !nearest.properties
            ) {

                continue;
            }


            const distance =
                Number(
                    nearest.properties.dist
                );


            if (
                !Number.isFinite(
                    distance
                )
            ) {

                continue;
            }


            if (
                distance <
                nearestDistance
            ) {

                nearestDistance =
                    distance;
            }

        }
        catch (error) {

            // Ignore malformed geometry

            continue;
        }
    }


    // --------------------------------------------------------
    // No boundary
    // --------------------------------------------------------

    if (
        !Number.isFinite(
            nearestDistance
        )
    ) {

        return null;
    }


    // --------------------------------------------------------
    // Return KM
    // --------------------------------------------------------

    return Number(
        nearestDistance.toFixed(2)
    );
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    loadMaritimeBoundary,

    getNearestMaritimeBoundary

};