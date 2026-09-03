const express = require("express");
const cors = require("cors");

const {
    getEcosystemData
} = require("./ecosystem");


const app = express();

const PORT =
    process.env.PORT || 3006;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(
    express.json()
);


// ============================================================
// HOME
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            service:
                "ORCA Ecosystem Service",

            status:
                "running",

            endpoint:
                "/api/ecosystem?latitude=19.076&longitude=72.8777&date=2026-09-03"

        });

    }
);


// ============================================================
// ECOSYSTEM API
// ============================================================

app.get(
    "/api/ecosystem",
    async (req, res) => {

        try {

            const latitude =
                Number(
                    req.query.latitude
                );

            const longitude =
                Number(
                    req.query.longitude
                );

            const date =
                req.query.date;


            // ------------------------------------------------
            // VALIDATE LATITUDE
            // ------------------------------------------------

            if (
                !Number.isFinite(latitude) ||
                latitude < -90 ||
                latitude > 90
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid latitude"

                });

            }


            // ------------------------------------------------
            // VALIDATE LONGITUDE
            // ------------------------------------------------

            if (
                !Number.isFinite(longitude) ||
                longitude < -180 ||
                longitude > 180
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid longitude"

                });

            }


            // ------------------------------------------------
            // VALIDATE DATE
            // ------------------------------------------------

            if (!date) {

                return res.status(400).json({

                    success: false,

                    error:
                        "date is required. Example: 2026-09-03"

                });

            }


            // ------------------------------------------------
            // FETCH ECOSYSTEM
            // ------------------------------------------------

            const result =
                await getEcosystemData(

                    latitude,

                    longitude,

                    date

                );


            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({

                success: true,

                location: {

                    latitude,

                    longitude

                },

                request: {

                    date

                },

                ecosystem:
                    result.ecosystem

            });

        }


        catch (error) {

            console.error(
                "Ecosystem API error:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    "Failed to fetch ecosystem data",

                message:
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

        res.status(404).json({

            success: false,

            error:
                "Endpoint not found"

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
            "       ORCA ECOSYSTEM SERVICE"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log(
            `API: http://localhost:${PORT}/api/ecosystem`
        );

        console.log(
            "========================================"
        );

        console.log("");

    }
);