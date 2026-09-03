const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const INCOIS_HOME =
  "https://www.incois.gov.in/MarineFisheries/TextDataHome?mfid=1&request_locale=en";

const INCOIS_SECTOR =
  "https://www.incois.gov.in/MarineFisheries/TextData?secid=SEC003";

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    jar,
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    maxRedirects: 10,
  })
);

async function main() {
  console.log("GET home page...");
  await client.get(INCOIS_HOME);

  console.log("GET SEC003...");

  const response = await client.get(INCOIS_SECTOR, {
    headers: {
      Referer: INCOIS_HOME,
    },
  });

  const body = response.data;

  const finalUrl =
    response.request?.res?.responseUrl ||
    response.request?.responseURL ||
    response.config.url;

  console.log("\n--- RESULT ---");
  console.log("Final URL:", finalUrl);
  console.log("Status:", response.status);
  console.log("Body length:", body.length);
  console.log('Contains "bearing":', body.toLowerCase().includes("bearing"));
}

main().catch((error) => {
  console.error("\n--- FAILED ---");
  console.error(error.message);

  if (error.response) {
    console.error("Status:", error.response.status);
    console.error("URL:", error.config?.url);
  }

  process.exit(1);
});
