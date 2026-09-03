const express = require("express");
const cors = require("cors");

const {
    getPFZData
} = require("./pfzService");

const app = express();

const PORT = 3005;

app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {

    res.json({
        success: true,
        service: "ORCA PFZ API",
        status: "running"
    });

});


app.get("/api/pfz", async (req, res) => {

    try {

        const latitude =
            Number(req.query.latitude);

        const longitude =
            Number(req.query.longitude);


        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "latitude and longitude are required"

            });
        }


        const pfz =
            await getPFZData(
                latitude,
                longitude
            );


        res.json({

            success: true,

            location: {

                latitude,

                longitude

            },

            pfz

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


app.listen(
    PORT,
    () => {

        console.log(
            "\n========================================"
        );

        console.log(
            "ORCA PFZ SERVER"
        );

        console.log(
            "========================================"
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            `http://localhost:${PORT}/api/pfz?latitude=15.49&longitude=73.83`
        );

        console.log(
            "========================================\n"
        );

    }
);