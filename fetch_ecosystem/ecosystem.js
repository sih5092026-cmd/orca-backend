const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config();


// ============================================================
// CONFIGURATION
// ============================================================

const PYTHON_COMMAND =
    process.env.PYTHON_COMMAND || "python";

const PYTHON_FILE =
    path.join(__dirname, "ecosystem.py");


// ============================================================
// FETCH ECOSYSTEM DATA THROUGH PYTHON
// ============================================================

function getEcosystemData(
    latitude,
    longitude,
    date
) {

    return new Promise((resolve, reject) => {

        const input = JSON.stringify({

            latitude,
            longitude,
            date

        });


        console.log("");
        console.log("========================================");
        console.log("       ORCA ECOSYSTEM SERVICE");
        console.log("========================================");
        console.log("Latitude :", latitude);
        console.log("Longitude:", longitude);
        console.log("Date     :", date);
        console.log("========================================");


        // ----------------------------------------------------
        // START PYTHON
        // ----------------------------------------------------

        const python =
            spawn(
                PYTHON_COMMAND,
                [
                    PYTHON_FILE
                ],
                {
                    env: {
                        ...process.env,

                        COPERNICUSMARINE_SERVICE_USERNAME:
                            process.env.COPERNICUSMARINE_SERVICE_USERNAME,

                        COPERNICUSMARINE_SERVICE_PASSWORD:
                            process.env.COPERNICUSMARINE_SERVICE_PASSWORD
                    }
                }
            );


        let stdout = "";
        let stderr = "";


        // ----------------------------------------------------
        // PYTHON OUTPUT
        // ----------------------------------------------------

        python.stdout.on(
            "data",
            (data) => {

                stdout +=
                    data.toString();

            }
        );


        // ----------------------------------------------------
        // PYTHON ERROR OUTPUT
        // ----------------------------------------------------

        python.stderr.on(
            "data",
            (data) => {

                stderr +=
                    data.toString();

                console.error(
                    data.toString()
                );

            }
        );


        // ----------------------------------------------------
        // PROCESS ERROR
        // ----------------------------------------------------

        python.on(
            "error",
            (error) => {

                reject(
                    new Error(
                        `Failed to start Python: ${error.message}`
                    )
                );

            }
        );


        // ----------------------------------------------------
        // PROCESS COMPLETE
        // ----------------------------------------------------

        python.on(
            "close",
            (code) => {

                if (code !== 0) {

                    reject(
                        new Error(
                            stderr ||
                            `Python process exited with code ${code}`
                        )
                    );

                    return;
                }


                // --------------------------------------------
                // EMPTY OUTPUT
                // --------------------------------------------

                if (!stdout.trim()) {

                    reject(
                        new Error(
                            "Python returned empty response"
                        )
                    );

                    return;
                }


                // --------------------------------------------
                // PARSE JSON
                // --------------------------------------------

                try {

                    const result =
                        JSON.parse(
                            stdout.trim()
                        );


                    if (result.error) {

                        reject(
                            new Error(
                                result.error
                            )
                        );

                        return;
                    }


                    resolve(result);

                } catch (error) {

                    console.error(
                        "Invalid Python JSON:"
                    );

                    console.error(
                        stdout
                    );


                    reject(
                        new Error(
                            `Invalid Python response: ${error.message}`
                        )
                    );

                }

            }
        );


        // ----------------------------------------------------
        // SEND INPUT TO PYTHON
        // ----------------------------------------------------

        python.stdin.write(
            input
        );

        python.stdin.end();

    });
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    getEcosystemData
};