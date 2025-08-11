import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import admin from "firebase-admin";

let firebaseApp;

export const handler = async (event) => {
  let browser;

  if (!firebaseApp) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();

  try {
    // Launch Puppeteer with AWS Lambda-compatible Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    // await page.goto("https://na.nasomi.com/index.php", { waitUntil: "domcontentloaded" });
    await page.goto("https://www.laughingplace.com/w/p/disneyland-current-wait-times/", { waitUntil: "domcontentloaded" });

    // Get page title
    // const title = await page.title();
    const data = await page.evaluate(() => document.querySelector('h1')?.innerText);

    const tableData1 = await page.$$eval('table tbody tr td:nth-child(1)', tdArray => tdArray.map(td => td.innerText))
    const tableData2 = await page.$$eval('table tbody tr td:nth-child(4)', tdArray => tdArray.map(td => td.innerText))

    const scrapedTable = Object.fromEntries(tableData1.map((tableData, index) => [tableData, tableData2[index]]));
    console.log(scrapedTable)



    const date = new Date();
    // const todaysDate = String(date.toISOString().split("T")[0])
    const todaysDate = String(date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }));
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const currentTime = `${hours}${minutes}`;
    const docRef = db.collection("waitTimes").doc(todaysDate);
  
    // Example: Save scraped data
    await docRef.set({
      [currentTime]: scrapedTable,
    }, { merge: true });



    return {
      statusCode: 200,
      // body: JSON.stringify({ title }),
      body: JSON.stringify({ data }),
      test: 6,
    };
  } catch (error) {
    console.error("Error running Puppeteer:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
