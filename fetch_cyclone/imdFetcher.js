const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");


// ============================================================
// PDF PARSER
// ============================================================

const pdfParseModule = require("pdf-parse");


// Handle different pdf-parse versions
const pdfParse =
    typeof pdfParseModule === "function"
        ? pdfParseModule
        : pdfParseModule.default;


// ============================================================
// CONFIG
// ============================================================

const IMD_CYCLONE_PAGE =
    "https://mausam.imd.gov.in/responsive/cycloneinformation.php";

const DOWNLOAD_DIR =
    path.join(
        __dirname,
        "imd_data"
    );


// ============================================================
// DIRECTORY
// ============================================================

if (!fs.existsSync(DOWNLOAD_DIR)) {

    fs.mkdirSync(
        DOWNLOAD_DIR,
        {
            recursive: true
        }
    );
}


// ============================================================
// HEADERS
// ============================================================

const headers = {

    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 " +
        "Chrome/142.0.0.0 Safari/537.36",

    "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};


// ============================================================
// FETCH IMD PAGE
// ============================================================

async function fetchIMDPage() {

    console.log(
        "\nFetching IMD cyclone page..."
    );


    const response =
        await axios.get(
            IMD_CYCLONE_PAGE,
            {
                headers,
                timeout: 30000
            }
        );


    return response.data;
}


// ============================================================
// FIND CYCLONE PDF LINKS
// ============================================================

function findCyclonePDFLinks(html) {

    const $ =
        cheerio.load(html);


    const links = [];


    $("a").each(
        (index, element) => {

            const href =
                $(element).attr("href");

            const text =
                $(element)
                    .text()
                    .trim();


            if (!href) {
                return;
            }


            const combined =
                (
                    text +
                    " " +
                    href
                ).toLowerCase();


            // ------------------------------------------------
            // Only cyclone-related links
            // ------------------------------------------------

            const cycloneKeywords = [

                "cyclone",

                "cyclonic",

                "rsmc",

                "disturbance",

                "bulletin",

                "warning",

                "track"
            ];


            const isCyclone =
                cycloneKeywords.some(
                    keyword =>
                        combined.includes(
                            keyword
                        )
                );


            if (!isCyclone) {
                return;
            }


            // ------------------------------------------------
            // PDF / download links
            // ------------------------------------------------

            if (
                combined.includes(".pdf") ||
                combined.includes("download")
            ) {

                links.push({

                    text,

                    href
                });
            }
        }
    );


    return links;
}


// ============================================================
// MAKE ABSOLUTE URL
// ============================================================

function makeAbsoluteURL(
    url,
    baseURL
) {

    try {

        return new URL(
            url,
            baseURL
        ).href;

    } catch {

        return null;
    }
}


// ============================================================
// DOWNLOAD PDF
// ============================================================

async function downloadPDF(
    pdfURL,
    filename =
        "imd_cyclone_bulletin.pdf"
) {

    console.log(
        "\nDownloading cyclone bulletin:"
    );

    console.log(
        pdfURL
    );


    const outputPath =
        path.join(
            DOWNLOAD_DIR,
            filename
        );


    const response =
        await axios.get(
            pdfURL,
            {
                responseType:
                    "arraybuffer",

                headers,

                timeout:
                    60000
            }
        );


    fs.writeFileSync(
        outputPath,
        response.data
    );


    console.log(
        "\nPDF saved:"
    );

    console.log(
        outputPath
    );


    return outputPath;
}


// ============================================================
// EXTRACT PDF TEXT
// ============================================================

async function extractPDFText(
    pdfPath
) {

    console.log(
        "\nExtracting PDF text..."
    );


    if (
        typeof pdfParse !== "function"
    ) {

        throw new Error(
            "pdf-parse API not compatible with this version."
        );
    }


    const buffer =
        fs.readFileSync(
            pdfPath
        );


    const data =
        await pdfParse(
            buffer
        );


    console.log(
        "\nPages:",
        data.numpages
    );


    console.log(
        "Characters:",
        data.text.length
    );


    return data.text;
}


// ============================================================
// SAVE TEXT
// ============================================================

function saveText(
    text,
    filename =
        "imd_cyclone_bulletin.txt"
) {

    const outputPath =
        path.join(
            DOWNLOAD_DIR,
            filename
        );


    fs.writeFileSync(
        outputPath,
        text,
        "utf8"
    );


    console.log(
        "\nText saved:"
    );

    console.log(
        outputPath
    );


    return outputPath;
}


// ============================================================
// MAIN FUNCTION
// ============================================================

async function getLatestIMDBulletin() {

    try {

        // ----------------------------------------------------
        // 1. Get IMD page
        // ----------------------------------------------------

        const html =
            await fetchIMDPage();


        // ----------------------------------------------------
        // 2. Find cyclone PDFs
        // ----------------------------------------------------

        const links =
            findCyclonePDFLinks(
                html
            );


        console.log(
            "\nCyclone-related PDF links:"
        );


        console.log(
            links
        );


        if (
            links.length === 0
        ) {

            throw new Error(
                "No cyclone PDF links found."
            );
        }


        // ----------------------------------------------------
        // 3. Find first valid PDF
        // ----------------------------------------------------

        let pdfURL =
            null;


        for (
            const link of links
        ) {

            const absoluteURL =
                makeAbsoluteURL(
                    link.href,
                    IMD_CYCLONE_PAGE
                );


            if (!absoluteURL) {
                continue;
            }


            if (
                absoluteURL
                    .toLowerCase()
                    .includes(".pdf")
            ) {

                pdfURL =
                    absoluteURL;

                break;
            }
        }


        if (!pdfURL) {

            throw new Error(
                "Could not identify cyclone PDF."
            );
        }


        // ----------------------------------------------------
        // 4. Download
        // ----------------------------------------------------

        const pdfPath =
            await downloadPDF(
                pdfURL
            );


        // ----------------------------------------------------
        // 5. Extract text
        // ----------------------------------------------------

        const text =
            await extractPDFText(
                pdfPath
            );


        // ----------------------------------------------------
        // 6. Save text
        // ----------------------------------------------------

        const textPath =
            saveText(
                text
            );


        return {

            pdfURL,

            pdfPath,

            textPath,

            text
        };


    } catch (error) {

        console.error(
            "\nIMD FETCH ERROR:"
        );

        console.error(
            error
        );


        throw error;
    }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getLatestIMDBulletin,

    fetchIMDPage,

    findCyclonePDFLinks,

    downloadPDF,

    extractPDFText
};