const {
    getPFZData
} = require("./pfzService");


async function main() {

    const latitude = 19.0760;
    const longitude = 72.8777;

    const result =
        await getPFZData(
            latitude,
            longitude,
            "MAHARASHTRA"
        );


    console.log(
        "\n========================================"
    );

    console.log(
        "FINAL PFZ RESULT"
    );

    console.log(
        "========================================"
    );


    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );
}


main();