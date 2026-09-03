

const fs = require("fs");
const path = require("path");
const shapefile = require("shapefile");

const {
    point,
    polygon,
    multiPolygon,
    booleanPointInPolygon
} = require("@turf/turf");


// ============================================================
// PATHS
// ============================================================

const MARITIME_DIR = path.join(
    __dirname,
    "data",
    "maritime"
);

const INDIA_MARITIME_DIR = path.join(
    MARITIME_DIR,
    "india"
);


// ============================================================
// INDIA SHAPEFILES
// ============================================================

const EEZ_SHP = path.join(
    INDIA_MARITIME_DIR,
    "india_eez.shp"
);

const ZONE_24NM_SHP = path.join(
    INDIA_MARITIME_DIR,
    "india_24nm.shp"
);

const ZONE_12NM_SHP = path.join(
    INDIA_MARITIME_DIR,
    "india_12nm.shp"
);


// ============================================================
// CACHE
// ============================================================

let indiaEEZ = [];
let india24NM = [];
let india12NM = [];

let loaded = false;
let loadingPromise = null;


// ============================================================
// CHECK FILE
// ============================================================

function checkFile(file) {

    if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        return false;
    }

    return true;
}


// ============================================================
// GET ZONE ID
// ============================================================

function getZoneId(properties) {

    if (!properties) {
        return null;
    }

    const keys = [
        "MRGID",
        "MRGID_EEZ",
        "MRGID_TER1",
        "MRGID_TER2",
        "GEONAME",
        "SOVEREIGN1",
        "TERRITORY1",
        "ID",
        "OBJECTID"
    ];

    for (const key of keys) {

        if (
            properties[key] !== undefined &&
            properties[key] !== null &&
            properties[key] !== ""
        ) {
            return properties[key];
        }
    }

    return null;
}


// ============================================================
// GET BOUNDING BOX
// ============================================================

function getBoundingBox(feature) {

    if (!feature || !feature.geometry) {
        return null;
    }

    const geometry = feature.geometry;

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;


    function processCoordinate(coord) {

        if (
            !Array.isArray(coord) ||
            coord.length < 2
        ) {
            return;
        }

        const lon = Number(coord[0]);
        const lat = Number(coord[1]);

        if (
            !Number.isFinite(lon) ||
            !Number.isFinite(lat)
        ) {
            return;
        }

        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);

        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }


    function walk(coords) {

        if (!Array.isArray(coords)) {
            return;
        }

        // [longitude, latitude]
        if (
            coords.length >= 2 &&
            typeof coords[0] === "number" &&
            typeof coords[1] === "number"
        ) {
            processCoordinate(coords);
            return;
        }

        for (const child of coords) {
            walk(child);
        }
    }


    walk(geometry.coordinates);


    if (
        !Number.isFinite(minLon) ||
        !Number.isFinite(maxLon) ||
        !Number.isFinite(minLat) ||
        !Number.isFinite(maxLat)
    ) {
        return null;
    }


    return {
        minLon,
        maxLon,
        minLat,
        maxLat
    };
}


// ============================================================
// POINT IN BOUNDING BOX
// ============================================================

function pointInBBox(
    latitude,
    longitude,
    bbox
) {

    if (!bbox) {
        return false;
    }

    return (
        longitude >= bbox.minLon &&
        longitude <= bbox.maxLon &&
        latitude >= bbox.minLat &&
        latitude <= bbox.maxLat
    );
}


// ============================================================
// LOAD SHAPEFILE
// ============================================================

async function loadIndiaFeatures(
    file,
    name
) {

    if (!checkFile(file)) {
        throw new Error(
            `${name} shapefile not found`
        );
    }


    console.log("");
    console.log(`Loading ${name}...`);
    console.log(`File: ${file}`);


    const source = await shapefile.open(file);

    const features = [];


    while (true) {

        const result = await source.read();

        if (result.done) {
            break;
        }

        const feature = result.value;

        if (!feature) {
            continue;
        }

        if (!feature.geometry) {
            continue;
        }


        // Only Polygon / MultiPolygon
        if (
            feature.geometry.type !== "Polygon" &&
            feature.geometry.type !== "MultiPolygon"
        ) {
            continue;
        }


        const bbox = getBoundingBox(feature);

        if (!bbox) {
            console.warn(
                `${name}: skipping feature with invalid bbox`
            );

            continue;
        }


        features.push({
            feature,
            bbox
        });
    }


    console.log(
        `${name}: ${features.length} polygons loaded`
    );


    return features;
}


// ============================================================
// LOAD ALL INDIA MARITIME DATA
// ============================================================

async function loadFishingZones() {

    if (loaded) {

        return {
            eez: indiaEEZ,
            zone24: india24NM,
            zone12: india12NM
        };
    }


    if (loadingPromise) {
        return loadingPromise;
    }


    loadingPromise = (async () => {

        console.log("");
        console.log("========================================");
        console.log("LOADING INDIA MARITIME ZONES");
        console.log("========================================");


        indiaEEZ = await loadIndiaFeatures(
            EEZ_SHP,
            "India EEZ"
        );


        india24NM = await loadIndiaFeatures(
            ZONE_24NM_SHP,
            "India 24 NM"
        );


        india12NM = await loadIndiaFeatures(
            ZONE_12NM_SHP,
            "India 12 NM"
        );


        loaded = true;


        console.log("");
        console.log("========================================");
        console.log("INDIA MARITIME DATA READY");
        console.log("========================================");

        console.log(`EEZ:    ${indiaEEZ.length}`);
        console.log(`24 NM:  ${india24NM.length}`);
        console.log(`12 NM:  ${india12NM.length}`);

        console.log("========================================");
        console.log("");


        return {
            eez: indiaEEZ,
            zone24: india24NM,
            zone12: india12NM
        };

    })();


    try {
        return await loadingPromise;
    }
    catch (error) {

        // IMPORTANT:
        // Allow retry if loading failed.
        loadingPromise = null;
        loaded = false;

        throw error;
    }
}


// ============================================================
// POINT INSIDE FEATURE
// ============================================================

function pointInsideFeature(
    userPoint,
    item
) {

    if (
        !item ||
        !item.feature ||
        !item.feature.geometry
    ) {
        return false;
    }


    const coordinates =
        userPoint.geometry.coordinates;

    const longitude = coordinates[0];
    const latitude = coordinates[1];


    // --------------------------------------------------------
    // Fast bounding box check
    // --------------------------------------------------------

    if (
        !pointInBBox(
            latitude,
            longitude,
            item.bbox
        )
    ) {
        return false;
    }


    // --------------------------------------------------------
    // Turf polygon check
    // --------------------------------------------------------

    try {

        const geometry =
            item.feature.geometry;


        if (geometry.type === "Polygon") {

            return booleanPointInPolygon(
                userPoint,
                polygon(
                    geometry.coordinates
                )
            );
        }


        if (geometry.type === "MultiPolygon") {

            return booleanPointInPolygon(
                userPoint,
                multiPolygon(
                    geometry.coordinates
                )
            );
        }

    }
    catch (error) {

        console.error(
            "Polygon check error:",
            error.message
        );

        return false;
    }


    return false;
}


// ============================================================
// FIND ZONE
// ============================================================

function findZone(
    latitude,
    longitude,
    features
) {

    const userPoint = point([
        longitude,
        latitude
    ]);


    for (const item of features) {

        if (
            pointInsideFeature(
                userPoint,
                item
            )
        ) {
            return item.feature;
        }
    }


    return null;
}


// ============================================================
// GET FISHING ZONE
// ============================================================

async function getFishingZone(
    latitude,
    longitude
) {

    latitude = Number(latitude);
    longitude = Number(longitude);


    // ========================================================
    // VALIDATION
    // ========================================================

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        throw new Error(
            "Invalid latitude or longitude"
        );
    }


    if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        throw new Error(
            "Latitude or longitude out of range"
        );
    }


    // ========================================================
    // LOAD DATA
    // ========================================================

    const data = await loadFishingZones();


    console.log("");
    console.log("----------------------------------------");
    console.log("FISHING ZONE CHECK");
    console.log(
        `Latitude:  ${latitude}`
    );
    console.log(
        `Longitude: ${longitude}`
    );
    console.log("----------------------------------------");


    // ========================================================
    // 12 NM — TERRITORIAL WATERS
    // ========================================================

    const territorial = findZone(
        latitude,
        longitude,
        data.zone12
    );


    if (territorial) {

        console.log(
            "MATCH: India Territorial Waters"
        );

        return {

            zone: "Territorial Waters",

            name: "India Territorial Sea",

            country: "India",

            status: "inside",

            distance_limit_nm: 12,

            dataset:
                "Marine Regions World 12NM v4",

            zone_id:
                getZoneId(
                    territorial.properties
                )
        };
    }


    // ========================================================
    // 24 NM — CONTIGUOUS ZONE
    // ========================================================

    const contiguous = findZone(
        latitude,
        longitude,
        data.zone24
    );


    if (contiguous) {

        console.log(
            "MATCH: India Contiguous Zone"
        );

        return {

            zone: "Contiguous Zone",

            name: "India Contiguous Zone",

            country: "India",

            status: "inside",

            distance_limit_nm: 24,

            dataset:
                "Marine Regions World 24NM v4",

            zone_id:
                getZoneId(
                    contiguous.properties
                )
        };
    }


    // ========================================================
    // EEZ — 200 NM
    // ========================================================

    const eez = findZone(
        latitude,
        longitude,
        data.eez
    );


    if (eez) {

        console.log(
            "MATCH: India EEZ"
        );

        return {

            zone: "EEZ",

            name:
                "India Exclusive Economic Zone",

            country: "India",

            status: "inside",

            distance_limit_nm: 200,

            dataset:
                "Marine Regions World EEZ v12",

            zone_id:
                getZoneId(
                    eez.properties
                )
        };
    }


    // ========================================================
    // OUTSIDE INDIA EEZ
    // ========================================================

    console.log(
        "NO MATCH: Outside India EEZ"
    );


    return {

        zone: "Outside India EEZ",

        name: null,

        country: null,

        status: "outside_india_jurisdiction",

        distance_limit_nm: null,

        dataset: "Marine Regions",

        zone_id: null
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    loadFishingZones,

    getFishingZone

};

































// ###################################################



// const fs = require("fs");
// const path = require("path");
// const shapefile = require("shapefile");

// const {
//     point,
//     polygon,
//     multiPolygon,
//     booleanPointInPolygon
// } = require("@turf/turf");


// // ============================================================
// // PATHS
// // ============================================================

// const MARITIME_DIR = path.join(
//     __dirname,
//     "data",
//     "maritime"
// );

// const INDIA_MARITIME_DIR = path.join(
//     MARITIME_DIR,
//     "india"
// );


// // ============================================================
// // INDIA-ONLY SHAPEFILES
// // ============================================================

// const EEZ_SHP = path.join(
//     INDIA_MARITIME_DIR,
//     "india_eez.shp"
// );

// const ZONE_24NM_SHP = path.join(
//     INDIA_MARITIME_DIR,
//     "india_24nm.shp"
// );

// const ZONE_12NM_SHP = path.join(
//     INDIA_MARITIME_DIR,
//     "india_12nm.shp"
// );


// // ============================================================
// // CACHE
// // ============================================================

// let indiaEEZ = [];
// let india24NM = [];
// let india12NM = [];

// let loaded = false;
// let loadingPromise = null;


// // ============================================================
// // CHECK FILE
// // ============================================================

// function checkFile(file) {

//     if (!fs.existsSync(file)) {

//         console.error(
//             `File not found: ${file}`
//         );

//         return false;
//     }

//     return true;
// }


// // ============================================================
// // GET ZONE ID
// // ============================================================

// function getZoneId(properties) {

//     if (!properties) {
//         return null;
//     }

//     const keys = [
//         "MRGID",
//         "MRGID_EEZ",
//         "MRGID_TER1",
//         "MRGID_TER2",
//         "MRGID_EEZ",
//         "GEONAME",
//         "SOVEREIGN1",
//         "TERRITORY1",
//         "ID",
//         "OBJECTID"
//     ];

//     for (const key of keys) {

//         if (
//             properties[key] !== undefined &&
//             properties[key] !== null &&
//             properties[key] !== ""
//         ) {

//             return properties[key];
//         }
//     }

//     return null;
// }


// // ============================================================
// // GET BOUNDING BOX
// // ============================================================

// function getBoundingBox(feature) {

//     const geometry =
//         feature.geometry;

//     let minLon = Infinity;
//     let maxLon = -Infinity;

//     let minLat = Infinity;
//     let maxLat = -Infinity;


//     function processCoordinate(coord) {

//         const lon = Number(coord[0]);
//         const lat = Number(coord[1]);

//         if (!Number.isFinite(lon) ||
//             !Number.isFinite(lat)) {

//             return;
//         }

//         if (lon < minLon) {
//             minLon = lon;
//         }

//         if (lon > maxLon) {
//             maxLon = lon;
//         }

//         if (lat < minLat) {
//             minLat = lat;
//         }

//         if (lat > maxLat) {
//             maxLat = lat;
//         }
//     }


//     function walk(coords) {

//         if (!Array.isArray(coords)) {
//             return;
//         }


//         // Coordinate = [longitude, latitude]

//         if (
//             coords.length >= 2 &&
//             typeof coords[0] === "number" &&
//             typeof coords[1] === "number"
//         ) {

//             processCoordinate(coords);

//             return;
//         }


//         for (const child of coords) {

//             walk(child);
//         }
//     }


//     walk(
//         geometry.coordinates
//     );


//     return {

//         minLon,
//         maxLon,
//         minLat,
//         maxLat

//     };
// }


// // ============================================================
// // POINT IN BOUNDING BOX
// // ============================================================

// function pointInBBox(
//     latitude,
//     longitude,
//     bbox
// ) {

//     return (

//         longitude >= bbox.minLon &&

//         longitude <= bbox.maxLon &&

//         latitude >= bbox.minLat &&

//         latitude <= bbox.maxLat

//     );
// }


// // ============================================================
// // LOAD INDIA SHAPEFILE
// // ============================================================

// async function loadIndiaFeatures(
//     file,
//     name
// ) {

//     if (!checkFile(file)) {

//         throw new Error(
//             `${name} shapefile not found`
//         );
//     }


//     console.log(
//         `Loading ${name}...`
//     );

//     console.log(
//         file
//     );


//     const source =
//         await shapefile.open(file);


//     const features = [];


//     while (true) {

//         const result =
//             await source.read();


//         if (result.done) {
//             break;
//         }


//         const feature =
//             result.value;


//         if (!feature) {
//             continue;
//         }


//         if (!feature.geometry) {
//             continue;
//         }


//         // --------------------------------------------------------
//         // Only Polygon / MultiPolygon
//         // --------------------------------------------------------

//         if (
//             feature.geometry.type !== "Polygon" &&
//             feature.geometry.type !== "MultiPolygon"
//         ) {

//             continue;
//         }


//         // --------------------------------------------------------
//         // Calculate bounding box ONCE
//         // --------------------------------------------------------

//         const bbox =
//             getBoundingBox(feature);


//         features.push({

//             feature,

//             bbox

//         });
//     }


//     console.log(
//         `${name}: ${features.length} India polygons`
//     );


//     return features;
// }


// // ============================================================
// // LOAD ALL INDIA MARITIME DATA
// // ============================================================

// async function loadFishingZones() {

//     // --------------------------------------------------------
//     // Already loaded
//     // --------------------------------------------------------

//     if (loaded) {

//         return {

//             eez:
//                 indiaEEZ,

//             zone24:
//                 india24NM,

//             zone12:
//                 india12NM

//         };
//     }


//     // --------------------------------------------------------
//     // Already loading
//     // --------------------------------------------------------

//     if (loadingPromise) {

//         return loadingPromise;
//     }


//     // --------------------------------------------------------
//     // Start loading
//     // --------------------------------------------------------

//     loadingPromise =
//         (async () => {

//             console.log("");

//             console.log(
//                 "========================================"
//             );

//             console.log(
//                 "LOADING INDIA MARITIME ZONES"
//             );

//             console.log(
//                 "========================================"
//             );


//             // ----------------------------------------------------
//             // EEZ
//             // ----------------------------------------------------

//             indiaEEZ =
//                 await loadIndiaFeatures(
//                     EEZ_SHP,
//                     "India EEZ"
//                 );


//             // ----------------------------------------------------
//             // 24 NM
//             // ----------------------------------------------------

//             india24NM =
//                 await loadIndiaFeatures(
//                     ZONE_24NM_SHP,
//                     "India 24 NM"
//                 );


//             // ----------------------------------------------------
//             // 12 NM
//             // ----------------------------------------------------

//             india12NM =
//                 await loadIndiaFeatures(
//                     ZONE_12NM_SHP,
//                     "India 12 NM"
//                 );


//             loaded = true;


//             console.log("");

//             console.log(
//                 "========================================"
//             );

//             console.log(
//                 "INDIA MARITIME DATA READY"
//             );

//             console.log(
//                 "========================================"
//             );

//             console.log(
//                 `EEZ:    ${indiaEEZ.length}`
//             );

//             console.log(
//                 `24 NM:  ${india24NM.length}`
//             );

//             console.log(
//                 `12 NM:  ${india12NM.length}`
//             );

//             console.log(
//                 "========================================"
//             );

//             console.log("");


//             return {

//                 eez:
//                     indiaEEZ,

//                 zone24:
//                     india24NM,

//                 zone12:
//                     india12NM

//             };

//         })();


//     return loadingPromise;
// }


// // ============================================================
// // POINT INSIDE FEATURE
// // ============================================================

// function pointInsideFeature(
//     userPoint,
//     item
// ) {

//     // --------------------------------------------------------
//     // First bounding box check
//     // This avoids expensive Turf operations
//     // --------------------------------------------------------

//     const bbox =
//         item.bbox;


//     const coordinates =
//         userPoint.geometry.coordinates;


//     const longitude =
//         coordinates[0];

//     const latitude =
//         coordinates[1];


//     if (
//         !pointInBBox(
//             latitude,
//             longitude,
//             bbox
//         )
//     ) {

//         return false;
//     }


//     // --------------------------------------------------------
//     // Actual polygon check
//     // --------------------------------------------------------

//     try {

//         const geometry =
//             item.feature.geometry;


//         // ----------------------------------------------------
//         // Polygon
//         // ----------------------------------------------------

//         if (
//             geometry.type === "Polygon"
//         ) {

//             return booleanPointInPolygon(

//                 userPoint,

//                 polygon(
//                     geometry.coordinates
//                 )

//             );
//         }


//         // ----------------------------------------------------
//         // MultiPolygon
//         // ----------------------------------------------------

//         if (
//             geometry.type === "MultiPolygon"
//         ) {

//             return booleanPointInPolygon(

//                 userPoint,

//                 multiPolygon(
//                     geometry.coordinates
//                 )

//             );
//         }

//     }
//     catch (error) {

//         console.error(
//             "Polygon check error:",
//             error.message
//         );

//         return false;
//     }


//     return false;
// }


// // ============================================================
// // FIND ZONE
// // ============================================================

// function findZone(
//     latitude,
//     longitude,
//     features
// ) {

//     const userPoint =
//         point([
//             longitude,
//             latitude
//         ]);


//     for (
//         const item of features
//     ) {

//         if (
//             pointInsideFeature(
//                 userPoint,
//                 item
//             )
//         ) {

//             return item.feature;
//         }
//     }


//     return null;
// }


// // ============================================================
// // GET FISHING ZONE
// // ============================================================

// async function getFishingZone(
//     latitude,
//     longitude
// ) {

//     latitude =
//         Number(latitude);

//     longitude =
//         Number(longitude);


//     // --------------------------------------------------------
//     // Validate coordinates
//     // --------------------------------------------------------

//     if (
//         !Number.isFinite(latitude) ||
//         !Number.isFinite(longitude)
//     ) {

//         throw new Error(
//             "Invalid latitude or longitude"
//         );
//     }


//     if (
//         latitude < -90 ||
//         latitude > 90 ||
//         longitude < -180 ||
//         longitude > 180
//     ) {

//         throw new Error(
//             "Latitude or longitude out of range"
//         );
//     }


//     // --------------------------------------------------------
//     // Load data
//     // --------------------------------------------------------

//     const data =
//         await loadFishingZones();


//     // ========================================================
//     // 12 NM
//     // ========================================================

//     const territorial =
//         findZone(
//             latitude,
//             longitude,
//             data.zone12
//         );


//     if (territorial) {

//         return {

//             zone:
//                 "Territorial Waters",

//             name:
//                 "India Territorial Sea",

//             country:
//                 "India",

//             status:
//                 "inside",

//             distance_limit_nm:
//                 12,

//             dataset:
//                 "Marine Regions World 12NM v4",

//             zone_id:
//                 getZoneId(
//                     territorial.properties
//                 )

//         };
//     }


//     // ========================================================
//     // 24 NM
//     // ========================================================

//     const contiguous =
//         findZone(
//             latitude,
//             longitude,
//             data.zone24
//         );


//     if (contiguous) {

//         return {

//             zone:
//                 "Contiguous Zone",

//             name:
//                 "India Contiguous Zone",

//             country:
//                 "India",

//             status:
//                 "inside",

//             distance_limit_nm:
//                 24,

//             dataset:
//                 "Marine Regions World 24NM v4",

//             zone_id:
//                 getZoneId(
//                     contiguous.properties
//                 )

//         };
//     }


//     // ========================================================
//     // EEZ
//     // ========================================================

//     const eez =
//         findZone(
//             latitude,
//             longitude,
//             data.eez
//         );


//     if (eez) {

//         return {

//             zone:
//                 "EEZ",

//             name:
//                 "India Exclusive Economic Zone",

//             country:
//                 "India",

//             status:
//                 "inside",

//             distance_limit_nm:
//                 200,

//             dataset:
//                 "Marine Regions World EEZ v12",

//             zone_id:
//                 getZoneId(
//                     eez.properties
//                 )

//         };
//     }


//     // ========================================================
//     // OUTSIDE INDIA EEZ
//     // ========================================================

//     return {

//         zone:
//             "Outside EEZ",

//         name:
//             null,

//         country:
//             null,

//         status:
//             "outside",

//         distance_limit_nm:
//             null,

//         dataset:
//             "Marine Regions",

//         zone_id:
//             null

//     };
// }


// // ============================================================
// // EXPORT
// // ============================================================

// module.exports = {

//     loadFishingZones,

//     getFishingZone

// };