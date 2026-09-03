const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const pdfjsLib =
    require("pdfjs-dist/legacy/build/pdf.mjs");


// ============================================================
// CONFIG
// ============================================================

const RSMC_ARCHIVE_URL =
    "https://rsmcnewdelhi.imd.gov.in/archive-information.php?internal_menu=Mg%3D%3D&menu_id=Mg%3D%3D";

const DATA_DIR =
    path.join(__dirname, "rsmc_data");


// Number of latest archive entries to test
const MAX_CANDIDATES = 15;


// ============================================================
// CREATE DIRECTORY
// ============================================================

if (!fs.existsSync(DATA_DIR)) {

    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );
}


// ============================================================
// HEADERS
// ============================================================

const HEADERS = {

    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 " +
        "Chrome/142.0.0.0 Safari/537.36",

    "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

    "Accept-Language":
        "en-US,en;q=0.9"
};


// ============================================================
// FETCH ARCHIVE
// ============================================================

async function fetchArchivePage() {

    console.log(
        "\nFetching RSMC archive..."
    );

    const response =
        await axios.get(
            RSMC_ARCHIVE_URL,
            {
                headers: HEADERS,
                timeout: 30000
            }
        );

    console.log(
        "Archive page downloaded."
    );

    return response.data;
}


// ============================================================
// PARSE RSMC DATE
//
// Example:
//
// 30-08-2026 06:30:00
// ============================================================

function parseRSMCDate(
    dateString
) {

    if (!dateString) {
        return null;
    }


    const match =
        dateString.match(
            /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
        );


    if (!match) {
        return null;
    }


    const day =
        Number(match[1]);

    const month =
        Number(match[2]);

    const year =
        Number(match[3]);

    const hour =
        Number(match[4]);

    const minute =
        Number(match[5]);

    const second =
        Number(match[6]);


    return new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
    );
}


// ============================================================
// ABSOLUTE URL
// ============================================================

function makeAbsoluteURL(
    href
) {

    if (!href) {
        return null;
    }


    try {

        return new URL(
            href,
            RSMC_ARCHIVE_URL
        ).href;

    } catch {

        return null;
    }
}


// ============================================================
// FIND PDF LINK
// ============================================================

function findPDFLink(
    $,
    row
) {

    let pdfURL = null;


    $(row)
        .find("a")
        .each(
            function () {

                if (pdfURL) {
                    return;
                }


                const href =
                    $(this).attr("href");


                if (!href) {
                    return;
                }


                const absoluteURL =
                    makeAbsoluteURL(
                        href
                    );


                if (!absoluteURL) {
                    return;
                }


                if (
                    absoluteURL
                        .toLowerCase()
                        .includes(".pdf")
                ) {

                    pdfURL =
                        absoluteURL;
                }
            }
        );


    return pdfURL;
}


// ============================================================
// PARSE ARCHIVE TABLE
// ============================================================

function parseBulletins(
    html
) {

    const $ =
        cheerio.load(
            html
        );


    const bulletins = [];


    $("table tr").each(
        function () {

            const row =
                this;


            const cells =
                $(row)
                    .find("td");


            if (
                cells.length < 3
            ) {

                return;
            }


            const serial =
                $(cells[0])
                    .text()
                    .trim();


            const title =
                $(cells[1])
                    .text()
                    .trim();


            const issueDate =
                $(cells[2])
                    .text()
                    .trim();


            // Ignore header
            if (
                !/^\d+$/.test(serial)
            ) {

                return;
            }


            if (!title) {
                return;
            }


            const parsedDate =
                parseRSMCDate(
                    issueDate
                );


            if (!parsedDate) {
                return;
            }


            const pdfURL =
                findPDFLink(
                    $,
                    row
                );


            bulletins.push({

                serial:
                    Number(serial),

                title,

                issueDate,

                parsedDate,

                pdfURL
            });
        }
    );


    return bulletins;
}


// ============================================================
// DOWNLOAD PDF
// ============================================================

async function downloadPDF(
    pdfURL,
    filename
) {

    console.log(
        "\nDownloading:"
    );

    console.log(
        pdfURL
    );


    const response =
        await axios.get(
            pdfURL,
            {
                responseType:
                    "arraybuffer",

                headers:
                    HEADERS,

                timeout:
                    60000
            }
        );


    const pdfPath =
        path.join(
            DATA_DIR,
            filename
        );


    fs.writeFileSync(
        pdfPath,
        response.data
    );


    return pdfPath;
}


// ============================================================
// EXTRACT PDF TEXT
// ============================================================

async function extractPDFText(
    pdfPath
) {

    const buffer =
        fs.readFileSync(
            pdfPath
        );


    const data =
        new Uint8Array(
            buffer
        );


    const pdf =
        await pdfjsLib
            .getDocument({
                data
            })
            .promise;


    let fullText = "";


    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

        const page =
            await pdf.getPage(
                pageNumber
            );


        const content =
            await page.getTextContent();


        const pageText =
            content.items
                .map(
                    item =>
                        item.str
                )
                .join(" ");


        fullText +=
            pageText +
            "\n";
    }


    return fullText.trim();
}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(
    text
) {

    return text
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}


// ============================================================
// CHECK WHETHER PDF IS ACTUALLY RSMC BULLETIN
// ============================================================

function isActualRSMCBulletin(
    text
) {

    const normalized =
        normalizeText(
            text
        );


    // --------------------------------------------------------
    // Tropical Weather Outlook must NOT be accepted
    // --------------------------------------------------------

    if (
        normalized.includes(
            "TROPICAL WEATHER OUTLOOK"
        )
    ) {

        return false;
    }


    // --------------------------------------------------------
    // These indicate an actual RSMC bulletin
    // --------------------------------------------------------

    const indicators = [

        "RSMC BULLETIN",

        "REGIONAL SPECIALISED METEOROLOGICAL CENTRE",

        "TROPICAL CYCLONE ADVISORY",

        "CYCLONE WARNING",

        "CURRENT INFORMATION",

        "FORECAST POSITION"
    ];


    let score = 0;


    for (
        const indicator of indicators
    ) {

        if (
            normalized.includes(
                indicator
            )
        ) {

            score++;
        }
    }


    // Require at least two indicators
    return score >= 2;
}


// ============================================================
// CHECK PDF CONTENT
// ============================================================

async function validateBulletinPDF(
    pdfPath
) {

    console.log(
        "\nChecking PDF content..."
    );


    const text =
        await extractPDFText(
            pdfPath
        );


    const valid =
        isActualRSMCBulletin(
            text
        );


    if (valid) {

        console.log(
            "✓ Valid RSMC bulletin detected."
        );

    } else {

        console.log(
            "✗ This PDF is NOT an RSMC bulletin."
        );
    }


    return {

        valid,

        text
    };
}


// ============================================================
// FIND LATEST VALID BULLETIN
// ============================================================

async function findLatestValidBulletin(
    bulletins
) {

    if (
        !bulletins ||
        bulletins.length === 0
    ) {

        throw new Error(
            "No RSMC bulletin rows found."
        );
    }


    // --------------------------------------------------------
    // Sort newest first
    // --------------------------------------------------------

    const sorted =
        bulletins
            .filter(
                bulletin =>
                    bulletin.pdfURL
            )
            .sort(
                (a, b) =>
                    b.parsedDate -
                    a.parsedDate
            );


    console.log(
        `\nTesting latest ${Math.min(
            sorted.length,
            MAX_CANDIDATES
        )} bulletin candidates...`
    );


    // --------------------------------------------------------
    // Try candidates one by one
    // --------------------------------------------------------

    const candidates =
        sorted.slice(
            0,
            MAX_CANDIDATES
        );


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const bulletin =
            candidates[i];


        console.log(
            "\n----------------------------------------"
        );


        console.log(
            `Candidate ${i + 1}/${candidates.length}`
        );


        console.log(
            "Title:",
            bulletin.title
        );


        console.log(
            "Issue:",
            bulletin.issueDate
        );


        console.log(
            "PDF:",
            bulletin.pdfURL
        );


        try {

            const filename =
                `candidate_${i + 1}.pdf`;


            const pdfPath =
                await downloadPDF(
                    bulletin.pdfURL,
                    filename
                );


            const validation =
                await validateBulletinPDF(
                    pdfPath
                );


            if (
                validation.valid
            ) {

                return {

                    bulletin,

                    pdfPath,

                    text:
                        validation.text
                };
            }


        } catch (error) {

            console.log(
                "Candidate failed:"
            );

            console.log(
                error.message
            );
        }
    }


    throw new Error(
        "No valid RSMC bulletin PDF was found " +
        `among the latest ${MAX_CANDIDATES} candidates.`
    );
}


// ============================================================
// SAVE TEXT
// ============================================================

function saveText(
    text
) {

    const textPath =
        path.join(
            DATA_DIR,
            "latest_rsmc_bulletin.txt"
        );


    fs.writeFileSync(
        textPath,
        text,
        "utf8"
    );


    console.log(
        "\nText saved:"
    );

    console.log(
        textPath
    );


    return textPath;
}


// ============================================================
// MAIN
// ============================================================

async function getLatestRSMCBulletin() {

    // --------------------------------------------------------
    // 1. Fetch archive
    // --------------------------------------------------------

    const html =
        await fetchArchivePage();


    // --------------------------------------------------------
    // 2. Parse rows
    // --------------------------------------------------------

    const bulletins =
        parseBulletins(
            html
        );


    console.log(
        `\nFound ${bulletins.length} bulletin rows.`
    );


    // --------------------------------------------------------
    // 3. Show latest rows
    // --------------------------------------------------------

    console.log(
        "\nLatest archive entries:"
    );


    bulletins
        .sort(
            (a, b) =>
                b.parsedDate -
                a.parsedDate
        )
        .slice(0, 10)
        .forEach(
            bulletin => {

                console.log(
                    `${bulletin.issueDate} | ` +
                    `${bulletin.title}`
                );
            }
        );


    // --------------------------------------------------------
    // 4. Find actual latest RSMC bulletin
    // --------------------------------------------------------

    const result =
        await findLatestValidBulletin(
            bulletins
        );


    const latest =
        result.bulletin;


    // --------------------------------------------------------
    // 5. Move/copy accepted PDF
    // --------------------------------------------------------

    const finalPDFPath =
        path.join(
            DATA_DIR,
            "latest_rsmc_bulletin.pdf"
        );


    fs.copyFileSync(
        result.pdfPath,
        finalPDFPath
    );


    // --------------------------------------------------------
    // 6. Save extracted text
    // --------------------------------------------------------

    const textPath =
        saveText(
            result.text
        );


    // --------------------------------------------------------
    // 7. Result
    // --------------------------------------------------------

    console.log(
        "\n========================================"
    );

    console.log(
        "LATEST VALID RSMC BULLETIN"
    );

    console.log(
        "========================================"
    );


    console.log(
        "Title:",
        latest.title
    );


    console.log(
        "Issued:",
        latest.issueDate
    );


    console.log(
        "PDF:",
        latest.pdfURL
    );


    console.log(
        "PDF saved:",
        finalPDFPath
    );


    console.log(
        "Text saved:",
        textPath
    );


    return {

        source:
            "RSMC New Delhi",

        bulletin_type:
            "RSMC Bulletin",

        title:
            latest.title,

        issued_at:
            latest.issueDate,

        pdf_url:
            latest.pdfURL,

        pdf_path:
            finalPDFPath,

        text_path:
            textPath,

        text:
            result.text
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    fetchArchivePage,

    parseBulletins,

    downloadPDF,

    extractPDFText,

    isActualRSMCBulletin,

    findLatestValidBulletin,

    getLatestRSMCBulletin
};