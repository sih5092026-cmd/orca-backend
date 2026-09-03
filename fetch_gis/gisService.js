const fs = require("fs");
const path = require("path");

const shapefile = require("shapefile");
const GeoTIFF = require("geotiff");
const {
    getNearestMaritimeBoundary
} = require("./maritimeBoundary");
const {
    getMarineProtectedArea
} = require("./marineGis");
const {
    point,
    lineString,
    multiLineString,
    nearestPointOnLine
} = require("@turf/turf");


// ============================================================
// FILE PATHS
// ============================================================

const COASTLINE_SHP = path.join(
    __dirname,
    "data",
    "coastline",
    "ne_10m_coastline.shp"
);

const GEBCO_TIF = path.join(
    __dirname,
    "data",
    "gebco",
    "gebco_2026_n25.0_s0.0_w65.0_e100.0_geotiff.tif"
);

const PORTS_JSON = path.join(
    __dirname,
    "data",
    "ports",
    "indian_ports.json"
);


// ============================================================
// CACHE
// ============================================================

let coastlineFeatures = null;
let coastlineLoading = null;

let gebcoImage = null;
let gebcoRaster = null;
let gebcoLoading = null;

let ports = null;


// ============================================================
// LOAD PORTS
// ============================================================

function loadPorts() {

    if (ports) {
        return ports;
    }

    console.log("");
    console.log("Loading Indian ports...");

    if (!fs.existsSync(PORTS_JSON)) {
        throw new Error(
            `Port dataset not found:\n${PORTS_JSON}`
        );
    }

    const file = fs.readFileSync(
        PORTS_JSON,
        "utf8"
    );

    const data = JSON.parse(file);

    if (!Array.isArray(data)) {
        throw new Error(
            "indian_ports.json must contain an array"
        );
    }

    ports = data.filter((port) => {

        return (
            Number.isFinite(Number(port.latitude)) &&
            Number.isFinite(Number(port.longitude))
        );

    });

    console.log(
        `Indian ports loaded: ${ports.length}`
    );

    return ports;
}


// ============================================================
// HAVERSINE DISTANCE
// ============================================================

function haversineDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const toRadians = (degree) =>
        degree * Math.PI / 180;

    const dLat =
        toRadians(lat2 - lat1);

    const dLon =
        toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


// ============================================================
// FIND NEAREST PORT
// ============================================================

function getNearestPort(
    latitude,
    longitude
) {

    const portList = loadPorts();

    if (portList.length === 0) {
        return {
            nearest_port_km: null,
            nearest_port: null
        };
    }

    let nearestPort = null;
    let minimumDistance = Infinity;

    for (const port of portList) {

        const portLat =
            Number(port.latitude);

        const portLon =
            Number(port.longitude);

        const distance =
            haversineDistance(
                latitude,
                longitude,
                portLat,
                portLon
            );

        if (distance < minimumDistance) {

            minimumDistance = distance;

            nearestPort = port;
        }
    }

    if (!nearestPort) {

        return {
            nearest_port_km: null,
            nearest_port: null
        };
    }

    return {

        nearest_port_km:
            Number(
                minimumDistance.toFixed(2)
            ),

        nearest_port: {

            port_id:
                nearestPort.port_id ?? null,

            name:
                nearestPort.name ?? null,

            state:
                nearestPort.state ?? null,

            port_type:
                nearestPort.port_type ?? null,

            latitude:
                Number(nearestPort.latitude),

            longitude:
                Number(nearestPort.longitude)
        }
    };
}


// ============================================================
// LOAD NATURAL EARTH COASTLINE
// ============================================================

async function loadCoastline() {

    if (coastlineFeatures) {
        return coastlineFeatures;
    }

    if (coastlineLoading) {
        return coastlineLoading;
    }

    coastlineLoading = (async () => {

        console.log("");
        console.log(
            "Loading Natural Earth coastline..."
        );

        if (!fs.existsSync(COASTLINE_SHP)) {
            throw new Error(
                `Coastline file not found:\n${COASTLINE_SHP}`
            );
        }

        const source =
            await shapefile.open(
                COASTLINE_SHP
            );

        const features = [];

        while (true) {

            const result =
                await source.read();

            if (result.done) {
                break;
            }

            if (!result.value) {
                continue;
            }

            const geometry =
                result.value.geometry;

            if (!geometry) {
                continue;
            }

            if (
                geometry.type === "LineString" ||
                geometry.type === "MultiLineString"
            ) {

                features.push(
                    result.value
                );
            }
        }

        coastlineFeatures =
            features;

        console.log(
            `Coastline loaded: ${features.length} features`
        );

        return coastlineFeatures;

    })();

    return coastlineLoading;
}


// ============================================================
// COAST DISTANCE
// ============================================================

async function getCoastDistance(
    latitude,
    longitude
) {

    const coastline =
        await loadCoastline();

    const userPoint =
        point([
            longitude,
            latitude
        ]);

    let minimumDistance =
        Infinity;

    for (const feature of coastline) {

        try {

            const geometry =
                feature.geometry;

            let result = null;

            if (
                geometry.type ===
                "LineString"
            ) {

                const line =
                    lineString(
                        geometry.coordinates
                    );

                result =
                    nearestPointOnLine(
                        line,
                        userPoint,
                        {
                            units: "kilometers"
                        }
                    );
            }

            else if (
                geometry.type ===
                "MultiLineString"
            ) {

                const multiLine =
                    multiLineString(
                        geometry.coordinates
                    );

                result =
                    nearestPointOnLine(
                        multiLine,
                        userPoint,
                        {
                            units: "kilometers"
                        }
                    );
            }

            if (
                result &&
                result.properties &&
                typeof result.properties.dist ===
                "number"
            ) {

                if (
                    result.properties.dist <
                    minimumDistance
                ) {

                    minimumDistance =
                        result.properties.dist;
                }
            }

        }
        catch (error) {

            continue;
        }
    }

    if (
        !Number.isFinite(
            minimumDistance
        )
    ) {

        return null;
    }

    return Number(
        minimumDistance.toFixed(2)
    );
}


// ============================================================
// LOAD GEBCO GEOTIFF
// ============================================================

async function loadGEBCO() {

    if (
        gebcoImage &&
        gebcoRaster
    ) {

        return {
            image: gebcoImage,
            raster: gebcoRaster
        };
    }

    if (gebcoLoading) {
        return gebcoLoading;
    }

    gebcoLoading = (async () => {

        console.log("");
        console.log(
            "Loading GEBCO 2026 GeoTIFF..."
        );

        if (!fs.existsSync(GEBCO_TIF)) {

            throw new Error(
                `GEBCO GeoTIFF not found:\n${GEBCO_TIF}`
            );
        }

        const buffer =
            fs.readFileSync(
                GEBCO_TIF
            );

        const arrayBuffer =
            buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset +
                buffer.byteLength
            );

        const tiff =
            await GeoTIFF.fromArrayBuffer(
                arrayBuffer
            );

        const image =
            await tiff.getImage();

        const raster =
            await image.readRasters({
                interleave: true
            });

        gebcoImage =
            image;

        gebcoRaster =
            raster;

        console.log(
            `GEBCO loaded: ${image.getWidth()} x ${image.getHeight()}`
        );

        console.log(
            "GEBCO bounding box:",
            image.getBoundingBox()
        );

        return {
            image,
            raster
        };

    })();

    return gebcoLoading;
}


// ============================================================
// GET WATER DEPTH
// ============================================================

async function getWaterDepth(
    latitude,
    longitude
) {

    const {
        image,
        raster
    } = await loadGEBCO();

    const [
        west,
        south,
        east,
        north
    ] =
        image.getBoundingBox();

    if (
        longitude < west ||
        longitude > east ||
        latitude < south ||
        latitude > north
    ) {

        return null;
    }

    const width =
        image.getWidth();

    const height =
        image.getHeight();

    let x =
        Math.floor(
            (
                (longitude - west) /
                (east - west)
            ) * width
        );
    let y =
        Math.floor(
            (
                (north - latitude) /
                (north - south)
            ) * height
        );
    if (x >= width) {
        x = width - 1;
    }

    if (y >= height) {
        y = height - 1;
    }

    if (
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height
    ) {

        return null;
    }

    const index =
        y * width + x;

    const elevation =
        Number(
            raster[index]
        );

    if (
        !Number.isFinite(
            elevation
        )
    ) {

        return null;
    }

    /*
     * GEBCO:
     *
     * Negative = underwater
     * Positive = land
     */

    if (elevation >= 0) {
        return 0;
    }

    return Number(
        Math.abs(elevation).toFixed(2)
    );
}


// ============================================================
// MAIN GIS FUNCTION
// ============================================================

async function getGISData(
    latitude,
    longitude
) {

    latitude =
        Number(latitude);

    longitude =
        Number(longitude);


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


    console.log("");
    console.log(
        "Processing GIS:",
        latitude,
        longitude
    );


    /*
     * Coast + depth + nearest port
     */

    const [
        coastDistance,
        waterDepth,
        marineProtectedArea,
        maritimeBoundaryDistance
    ] = await Promise.all([
        getCoastDistance(
            latitude,
            longitude
        ),

        getWaterDepth(
            latitude,
            longitude
        ),

        getMarineProtectedArea(
            latitude,
            longitude
        ),

        getNearestMaritimeBoundary(
            latitude,
            longitude
        )
    ]);


    /*
     * Nearest port
     */

    const portData =
        getNearestPort(
            latitude,
            longitude
        );


    return {

        coast_distance_km:
            coastDistance,

        water_depth_m:
            waterDepth,

        nearest_restricted_zone_km:
            null,

        inside_restricted_zone:
            null,

        inside_marine_protected_area:
            marineProtectedArea
                .inside_marine_protected_area,

        nearest_marine_protected_area_km:
            marineProtectedArea
                .nearest_marine_protected_area_km,

        nearest_marine_protected_area:
            marineProtectedArea
                .nearest_marine_protected_area,

        nearest_maritime_boundary_km:
            maritimeBoundaryDistance,

        nearest_port_km:
            portData.nearest_port_km,

        fishing_zone:
            null,

        location_valid:
            true,

        nearest_port:
            portData.nearest_port
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getGISData,

    getCoastDistance,

    getWaterDepth,

    getNearestPort,

    loadCoastline,

    loadGEBCO,

    loadPorts

};