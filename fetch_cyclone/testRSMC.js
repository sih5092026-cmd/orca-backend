const {
    getLatestRSMCBulletin
} = require("./rsmcFetcher");


async function main() {

    try {

        const result =
            await getLatestRSMCBulletin();


        console.log(
            "\n\n========================================"
        );

        console.log(
            "FINAL RESULT"
        );

        console.log(
            "========================================"
        );


        console.log(
            "\nSource:",
            result.source
        );


        console.log(
            "\nBulletin:",
            result.title
        );


        console.log(
            "\nIssued:",
            result.issued_at
        );


        console.log(
            "\nPDF:",
            result.pdf_url
        );


        console.log(
            "\nPDF saved:",
            result.pdf_path
        );


        console.log(
            "\nText saved:",
            result.text_path
        );


        console.log(
            "\n\n========================================"
        );

        console.log(
            "BULLETIN TEXT"
        );

        console.log(
            "========================================\n"
        );


        console.log(
            result.text
        );


    } catch (error) {

        console.error(
            "\nRSMC ERROR:"
        );

        console.error(
            error
        );
    }
}


main();