// ============================================================
// cycloneParser.js
// Parse IMD / RSMC cyclone bulletin text
// ============================================================

function cleanText(text) {
    return text
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n")
        .trim();
}


// ============================================================
// NUMBER HELPER
// ============================================================

function toNumber(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const number = parseFloat(
        String(value).replace(/,/g, "")
    );

    return Number.isFinite(number) ? number : null;
}


// ============================================================
// COORDINATE PARSER
// Supports:
//
// 18.5 N, 72.0 E
// 18.5°N 72.0°E
// 18.5 N and 72.0 E
// 18.5N / 72.0E
// ============================================================

function parseCoordinates(text) {

    const patterns = [

        /(\d+(?:\.\d+)?)\s*°?\s*([NS])\D+(\d+(?:\.\d+)?)\s*°?\s*([EW])/i,

        /(\d+(?:\.\d+)?)\s*([NS])\D+(\d+(?:\.\d+)?)\s*([EW])/i
    ];


    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (!match) {
            continue;
        }


        let latitude =
            toNumber(match[1]);

        let longitude =
            toNumber(match[3]);


        if (
            match[2].toUpperCase() === "S"
        ) {
            latitude = -latitude;
        }


        if (
            match[4].toUpperCase() === "W"
        ) {
            longitude = -longitude;
        }


        return {
            latitude,
            longitude
        };
    }


    return {
        latitude: null,
        longitude: null
    };
}


// ============================================================
// CYCLONE NAME / SYSTEM TYPE
// ============================================================

function parseCycloneName(text) {

    const patterns = [

        /Cyclonic Storm\s+([A-Z][A-Z0-9 -]*)/i,

        /Severe Cyclonic Storm\s+([A-Z][A-Z0-9 -]*)/i,

        /Very Severe Cyclonic Storm\s+([A-Z][A-Z0-9 -]*)/i,

        /Extremely Severe Cyclonic Storm\s+([A-Z][A-Z0-9 -]*)/i,

        /Super Cyclonic Storm\s+([A-Z][A-Z0-9 -]*)/i
    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            return match[1]
                .trim()
                .replace(/\s+/g, " ");
        }
    }


    return null;
}


// ============================================================
// CATEGORY
// ============================================================

function parseCategory(text) {

    const categories = [

        "Super Cyclonic Storm",

        "Extremely Severe Cyclonic Storm",

        "Very Severe Cyclonic Storm",

        "Severe Cyclonic Storm",

        "Cyclonic Storm",

        "Deep Depression",

        "Depression",

        "Low Pressure Area"
    ];


    for (const category of categories) {

        if (
            text.toLowerCase()
                .includes(category.toLowerCase())
        ) {

            return category;
        }
    }


    return null;
}


// ============================================================
// MAXIMUM SUSTAINED WIND
// ============================================================

function parseSustainedWind(text) {

    const patterns = [

        /maximum sustained wind speed[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /maximum sustained winds?[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /sustained wind speed[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /wind speed[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i
    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            return toNumber(
                match[1]
            );
        }
    }


    return null;
}


// ============================================================
// MAXIMUM GUST
// ============================================================

function parseGust(text) {

    const patterns = [

        /gusting to[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /gusts?[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /maximum gust[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i
    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            return toNumber(
                match[1]
            );
        }
    }


    return null;
}


// ============================================================
// CENTRAL PRESSURE
// ============================================================

function parsePressure(text) {

    const patterns = [

        /central pressure[^0-9]*(\d+(?:\.\d+)?)\s*hpa/i,

        /estimated central pressure[^0-9]*(\d+(?:\.\d+)?)\s*hpa/i,

        /pressure[^0-9]*(\d+(?:\.\d+)?)\s*hpa/i
    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            return toNumber(
                match[1]
            );
        }
    }


    return null;
}


// ============================================================
// MOVEMENT SPEED
// ============================================================

function parseMovementSpeed(text) {

    const patterns = [

        /moving[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /moving at[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i,

        /speed of[^0-9]*(\d+(?:\.\d+)?)\s*kmph/i
    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            return toNumber(
                match[1]
            );
        }
    }


    return null;
}


// ============================================================
// MOVEMENT DIRECTION
// ============================================================
//
// Example:
// moving northwestwards at 12 kmph
//
// Returns compass direction for now.
// Later we can convert to degrees.
//
// ============================================================

function parseMovementDirection(text) {

    const directions = [

        {
            regex: /north[- ]?west(?:wards)?/i,
            degrees: 315
        },

        {
            regex: /north[- ]?east(?:wards)?/i,
            degrees: 45
        },

        {
            regex: /south[- ]?west(?:wards)?/i,
            degrees: 225
        },

        {
            regex: /south[- ]?east(?:wards)?/i,
            degrees: 135
        },

        {
            regex: /northward(?:s)?/i,
            degrees: 0
        },

        {
            regex: /eastward(?:s)?/i,
            degrees: 90
        },

        {
            regex: /southward(?:s)?/i,
            degrees: 180
        },

        {
            regex: /westward(?:s)?/i,
            degrees: 270
        }
    ];


    for (const direction of directions) {

        if (
            direction.regex.test(text)
        ) {

            return direction.degrees;
        }
    }


    return null;
}


// ============================================================
// WARNING LEVEL
// ============================================================

function parseWarningLevel(text) {

    const levels = [

        "Red Warning",

        "Orange Warning",

        "Yellow Warning",

        "Green Warning",

        "Red Alert",

        "Orange Alert",

        "Yellow Alert",

        "Green Alert"
    ];


    for (const level of levels) {

        if (
            text.toLowerCase()
                .includes(level.toLowerCase())
        ) {

            return level;
        }
    }


    return null;
}


// ============================================================
// FORECAST TRACK
// ============================================================
//
// Attempts to find forecast coordinates.
//
// Supported examples:
//
// +24 HRS: 19.2°N 70.8°E
// 24 HOURS: 19.2 N 70.8 E
// 24 HRS - 19.2 N, 70.8 E
//
// ============================================================

function parseForecastTrack(text) {

    const track = [];


    const regex =
        /(?:\+?\s*)?(\d+)\s*(?:HRS?|HOURS?)\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*°?\s*([NS])\D+(\d+(?:\.\d+)?)\s*°?\s*([EW])/gi;


    let match;


    while (
        (match = regex.exec(text)) !== null
    ) {

        let latitude =
            toNumber(match[2]);

        let longitude =
            toNumber(match[4]);


        if (
            match[3].toUpperCase() === "S"
        ) {

            latitude = -latitude;
        }


        if (
            match[5].toUpperCase() === "W"
        ) {

            longitude = -longitude;
        }


        track.push({

            hours:
                toNumber(match[1]),

            latitude,

            longitude
        });
    }


    return track;
}


// ============================================================
// MAIN PARSER
// ============================================================

function parseCycloneBulletin(text) {

    if (
        typeof text !== "string" ||
        text.trim() === ""
    ) {

        return {

            active: false,

            name: null,

            latitude: null,

            longitude: null,

            category: null,

            maximum_sustained_wind_kmh: null,

            maximum_gust_kmh: null,

            central_pressure_hpa: null,

            movement_direction_deg: null,

            movement_speed_kmh: null,

            warning_level: null,

            forecast_track: []
        };
    }


    const clean =
        cleanText(text);


    const coordinates =
        parseCoordinates(clean);


    const category =
        parseCategory(clean);


    const name =
        parseCycloneName(clean);


    const sustainedWind =
        parseSustainedWind(clean);


    const gust =
        parseGust(clean);


    const pressure =
        parsePressure(clean);


    const movementSpeed =
        parseMovementSpeed(clean);


    const movementDirection =
        parseMovementDirection(clean);


    const warningLevel =
        parseWarningLevel(clean);


    const forecastTrack =
        parseForecastTrack(clean);


    const active =
        (
            coordinates.latitude !== null &&
            coordinates.longitude !== null
        );


    return {

        active,

        name,

        latitude:
            coordinates.latitude,

        longitude:
            coordinates.longitude,

        category,

        maximum_sustained_wind_kmh:
            sustainedWind,

        maximum_gust_kmh:
            gust,

        central_pressure_hpa:
            pressure,

        movement_direction_deg:
            movementDirection,

        movement_speed_kmh:
            movementSpeed,

        warning_level:
            warningLevel,

        forecast_track:
            forecastTrack
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    parseCycloneBulletin,

    parseCoordinates,

    parseForecastTrack
};