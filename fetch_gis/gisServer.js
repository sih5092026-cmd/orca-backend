const express = require("express");
const cors = require("cors");


// ============================================================
// GIS SERVICE
// ============================================================

const {
    getGISData
} = require("./gisService");


// ============================================================
// FISHING ZONE SERVICE
// ============================================================

const {
    getFishingZone
} = require("./fishingZone");


// ============================================================
// APP
// ============================================================

const app = express();

const PORT = 3005;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(express.json());


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            service:
                "ORCA GIS Service",

            port:
                PORT

        });

    }
);


// ============================================================
// GIS API
// ============================================================

app.get(
    "/api/gis",
    async (req, res) => {

        try {

            // ------------------------------------------------
            // Get coordinates
            // ------------------------------------------------

            const latitude =
                Number(
                    req.query.latitude
                );


            const longitude =
                Number(
                    req.query.longitude
                );


            // ------------------------------------------------
            // Validate coordinates
            // ------------------------------------------------

            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "latitude and longitude are required"

                    });
            }


            if (
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Invalid latitude or longitude"

                    });
            }


            // ------------------------------------------------
            // Console
            // ------------------------------------------------

            console.log("");

            console.log(
                "========================================"
            );

            console.log(
                "GIS REQUEST"
            );

            console.log(
                `Latitude:  ${latitude}`
            );

            console.log(
                `Longitude: ${longitude}`
            );

            console.log(
                "========================================"
            );


            // ------------------------------------------------
            // Existing GIS data
            // ------------------------------------------------

            const gis =
                await getGISData(
                    latitude,
                    longitude
                );


            // ------------------------------------------------
            // Fishing zone
            // ------------------------------------------------

            const fishingZone =
                await getFishingZone(
                    latitude,
                    longitude
                );


            // ------------------------------------------------
            // Add fishing zone
            // ------------------------------------------------

            gis.fishing_zone =
                fishingZone;


            // ------------------------------------------------
            // Final response
            // ------------------------------------------------

            return res.json({

                success: true,

                location: {

                    latitude,

                    longitude

                },

                gis

            });

        }
        catch (error) {

            console.error("");

            console.error(
                "GIS API ERROR:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });
        }

    }
);


// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res
            .status(404)
            .json({

                success: false,

                error:
                    "Route not found"

            });

    }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "        ORCA GIS SERVICE"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log(
            `API:    http://localhost:${PORT}/api/gis`
        );

        console.log(
            "========================================"
        );

        console.log("");

    }
);