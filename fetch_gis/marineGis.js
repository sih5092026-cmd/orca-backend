const fs = require("fs");
const path = require("path");
const shapefile = require("shapefile");

const {
    point,
    polygon,
    multiPolygon,
    booleanPointInPolygon,
    polygonToLine,
    nearestPointOnLine
} = require("@turf/turf");


// ============================================================
// WDPA DATA DIRECTORY
// ============================================================

const WDPA_DIR = path.join(
    __dirname,
    "data",
    "protected_areas"
);


// ============================================================
// WDPA PARTS
// ============================================================

const WDPA_PARTS = [
    "part0",
    "part1",
    "part2"
];


// ============================================================
// CACHE
// ============================================================

let marineAreas = null;
let loadingPromise = null;


// ============================================================
// FIND POLYGON SHAPEFILE
// ============================================================

function findPolygonShp(part) {

    const dir = path.join(
        WDPA_DIR,
        part
    );

    if (!fs.existsSync(dir)) {
        console.log(
            `Directory not found: ${dir}`
        );

        return null;
    }

    const files =
        fs.readdirSync(dir);

    const shpFile =
        files.find(file =>
            file
                .toLowerCase()
                .endsWith("-polygons.shp")
        );

    if (!shpFile) {

        console.log(
            `Polygon shapefile not found in ${dir}`
        );

        return null;
    }

    return path.join(
        dir,
        shpFile
    );
}


// ============================================================
// CHECK MARINE / COASTAL AREA
// ============================================================
//
// Your WDPA dataset DOES NOT have a MARINE field.
//
// Actual fields include:
//
// SITE_ID
// SITE_PID
// SITE_TYPE
// NAME_ENG
// NAME
// DESIG
// DESIG_ENG
// DESIG_TYPE
// IUCN_CAT
// INT_CRIT
// REALM
// REP_M_AREA
// GIS_M_AREA
// REP_AREA
// GIS_AREA
//
// Therefore we use REP_M_AREA / GIS_M_AREA / REALM.
//
// ============================================================

function isMarineArea(properties) {

    if (!properties) {
        return false;
    }


    // --------------------------------------------------------
    // Reported marine area
    // --------------------------------------------------------

    const reportedMarineArea =
        Number(
            properties.REP_M_AREA
        );


    // --------------------------------------------------------
    // GIS calculated marine area
    // --------------------------------------------------------

    const gisMarineArea =
        Number(
            properties.GIS_M_AREA
        );


    // --------------------------------------------------------
    // Realm
    // --------------------------------------------------------

    const realm =
        String(
            properties.REALM || ""
        )
            .trim()
            .toLowerCase();


    // --------------------------------------------------------
    // Marine area
    // --------------------------------------------------------

    if (
        Number.isFinite(
            reportedMarineArea
        ) &&
        reportedMarineArea > 0
    ) {
        return true;
    }


    // --------------------------------------------------------
    // Marine area from GIS
    // --------------------------------------------------------

    if (
        Number.isFinite(
            gisMarineArea
        ) &&
        gisMarineArea > 0
    ) {
        return true;
    }


    // --------------------------------------------------------
    // Marine realm
    // --------------------------------------------------------

    if (
        realm.includes("marine")
    ) {
        return true;
    }


    return false;
}


// ============================================================
// LOAD ONE PART
// ============================================================

async function loadPart(part) {

    const shpFile =
        findPolygonShp(part);

    if (!shpFile) {
        return [];
    }


    console.log(
        `Loading WDPA ${part}: ${shpFile}`
    );


    const source =
        await shapefile.open(
            shpFile
        );


    const areas = [];


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


        // ----------------------------------------------------
        // Only polygon geometries
        // ----------------------------------------------------

        if (
            feature.geometry.type !==
                "Polygon" &&
            feature.geometry.type !==
                "MultiPolygon"
        ) {
            continue;
        }


        // ----------------------------------------------------
        // Only marine/coastal protected areas
        // ----------------------------------------------------

        if (
            !isMarineArea(
                feature.properties
            )
        ) {
            continue;
        }


        areas.push(
            feature
        );
    }


    console.log(
        `${part}: ${areas.length} marine/coastal areas`
    );


    return areas;
}


// ============================================================
// LOAD ALL MARINE PROTECTED AREAS
// ============================================================

async function loadMarineProtectedAreas() {

    // Already loaded
    if (marineAreas) {
        return marineAreas;
    }


    // Currently loading
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
                "LOADING WDPA MARINE PROTECTED AREAS"
            );
            console.log(
                "========================================"
            );


            let allAreas = [];


            // ------------------------------------------------
            // Load part0, part1 and part2
            // ------------------------------------------------

            for (
                const part of WDPA_PARTS
            ) {

                const areas =
                    await loadPart(
                        part
                    );


                allAreas =
                    allAreas.concat(
                        areas
                    );
            }


            marineAreas =
                allAreas;


            console.log("");
            console.log(
                `TOTAL MARINE/COASTAL AREAS: ${marineAreas.length}`
            );
            console.log("");


            return marineAreas;

        })();


    return loadingPromise;
}


// ============================================================
// AREA NAME
// ============================================================

function getAreaName(properties) {

    if (!properties) {
        return null;
    }


    return (
        properties.NAME_ENG ||
        properties.NAME ||
        null
    );
}


// ============================================================
// WDPA SITE ID
// ============================================================

function getWdpaId(properties) {

    if (!properties) {
        return null;
    }


    return (
        properties.SITE_ID ||
        properties.SITE_PID ||
        null
    );
}


// ============================================================
// DESIGNATION
// ============================================================

function getDesignation(properties) {

    if (!properties) {
        return null;
    }


    return (
        properties.DESIG_ENG ||
        properties.DESIG ||
        null
    );
}


// ============================================================
// SITE TYPE
// ============================================================

function getSiteType(properties) {

    if (!properties) {
        return null;
    }


    return (
        properties.SITE_TYPE ||
        null
    );
}


// ============================================================
// IUCN CATEGORY
// ============================================================

function getIucnCategory(properties) {

    if (!properties) {
        return null;
    }


    return (
        properties.IUCN_CAT ||
        null
    );
}


// ============================================================
// GET NEAREST MARINE PROTECTED AREA
// ============================================================

async function getMarineProtectedArea(
    latitude,
    longitude
) {

    const areas =
        await loadMarineProtectedAreas();


    // --------------------------------------------------------
    // User point
    // --------------------------------------------------------

    const userPoint =
        point([
            longitude,
            latitude
        ]);


    let inside =
        false;


    let nearestDistance =
        Infinity;


    let nearestArea =
        null;


    // ========================================================
    // CHECK EVERY PROTECTED AREA
    // ========================================================

    for (
        const feature of areas
    ) {

        try {

            const geometry =
                feature.geometry;


            let isInside =
                false;


            // ==================================================
            // POLYGON
            // ==================================================

            if (
                geometry.type ===
                "Polygon"
            ) {

                const poly =
                    polygon(
                        geometry.coordinates
                    );


                isInside =
                    booleanPointInPolygon(
                        userPoint,
                        poly
                    );
            }


            // ==================================================
            // MULTIPOLYGON
            // ==================================================

            else if (
                geometry.type ===
                "MultiPolygon"
            ) {

                const multi =
                    multiPolygon(
                        geometry.coordinates
                    );


                isInside =
                    booleanPointInPolygon(
                        userPoint,
                        multi
                    );
            }


            // ==================================================
            // INSIDE PROTECTED AREA
            // ==================================================

            if (isInside) {

                inside =
                    true;


                nearestDistance =
                    0;


                nearestArea =
                    feature.properties;


                // Don't break.
                //
                // There can be overlapping
                // protected areas.

                continue;
            }


            // ==================================================
            // CREATE BOUNDARY
            // ==================================================

            let boundary =
                null;


            if (
                geometry.type ===
                "Polygon"
            ) {

                boundary =
                    polygonToLine(
                        polygon(
                            geometry.coordinates
                        )
                    );
            }


            else if (
                geometry.type ===
                "MultiPolygon"
            ) {

                boundary =
                    polygonToLine(
                        multiPolygon(
                            geometry.coordinates
                        )
                    );
            }


            if (!boundary) {
                continue;
            }


            // ==================================================
            // NEAREST POINT ON BOUNDARY
            // ==================================================

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


            // ==================================================
            // UPDATE NEAREST
            // ==================================================

            if (
                distance <
                nearestDistance
            ) {

                nearestDistance =
                    distance;


                nearestArea =
                    feature.properties;
            }

        }
        catch (error) {

            // Ignore malformed polygon
            continue;
        }
    }


    // ========================================================
    // NO PROTECTED AREA FOUND
    // ========================================================

    if (
        !Number.isFinite(
            nearestDistance
        )
    ) {

        return {

            inside_marine_protected_area:
                false,

            nearest_marine_protected_area_km:
                null,

            nearest_marine_protected_area:
                null
        };
    }


    // ========================================================
    // RESULT
    // ========================================================

    return {

        inside_marine_protected_area:
            inside,


        nearest_marine_protected_area_km:
            Number(
                nearestDistance.toFixed(2)
            ),


        nearest_marine_protected_area:
            nearestArea
                ? {

                    name:
                        getAreaName(
                            nearestArea
                        ),

                    wdpa_id:
                        getWdpaId(
                            nearestArea
                        ),

                    designation:
                        getDesignation(
                            nearestArea
                        ),

                    site_type:
                        getSiteType(
                            nearestArea
                        ),

                    iucn_category:
                        getIucnCategory(
                            nearestArea
                        )

                }
                : null
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    loadMarineProtectedAreas,

    getMarineProtectedArea

};