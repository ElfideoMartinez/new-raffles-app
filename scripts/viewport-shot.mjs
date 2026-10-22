/**
 * True-viewport screenshots + overflow assertion.
 *
 * WHY THIS EXISTS
 * Chrome's `--headless=new --screenshot --window-size=W,H` composites against a
 * wider layout viewport and crops, which fakes horizontal overflow that the CSS
 * does not have. Puppeteer's setViewport sets the real layout viewport, so this
 * is the honest way to screenshot and to assert scrollWidth === clientWidth.
 *
 * RUN (app served, e.g. npx next start -p 3111)
 *   node scripts/viewport-shot.mjs http://127.0.0.1:3111/ 390 320 1440
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:3111/";
const widths = process.argv.slice(3).map(Number);
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.SHOT_DIR || "shots";

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--hide-scrollbars"] });
let failed = false;
try {
  for (const w of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 1000, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });
    const m = await page.evaluate(() => ({
      vs: document.documentElement.clientWidth,
      sw: document.documentElement.scrollWidth,
    }));
    const overflow = m.sw > m.vs;
    if (overflow) failed = true;
    const path = `${OUT}/viewport-${w}.png`;
    await page.screenshot({ path });
    console.log(`${w}px: viewport=${m.vs} scrollWidth=${m.sw} overflow=${overflow ? "YES" : "no"} -> ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
