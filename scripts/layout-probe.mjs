/**
 * Layout overflow probe.
 *
 * WHY THIS EXISTS
 * Screenshots show *that* a card overflows the viewport, but not which element
 * pins the width. This walks the DOM at a given viewport and reports every node
 * whose box extends past the document scroll width, with its computed
 * min-width / width / display, so the fix targets the real cause instead of
 * guessing at Tailwind classes.
 *
 * RUN (app must already be served, e.g. npx next start -p 3111)
 *   node scripts/layout-probe.mjs http://127.0.0.1:3111/ 390
 *
 * Uses puppeteer-core with the system Chrome, so no browser download.
 */

import puppeteer from "puppeteer-core";

const url = process.argv[2] || "http://127.0.0.1:3111/";
const width = Number(process.argv[3] || 390);
const height = Number(process.argv[4] || 900);
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });

  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const viewport = doc.clientWidth;
    const scrollWidth = doc.scrollWidth;

    const describe = (el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").slice(0, 120),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
        left: Math.round(el.getBoundingClientRect().left),
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        minWidth: cs.minWidth,
        maxWidth: cs.maxWidth,
        display: cs.display,
        flex: cs.flex,
        position: cs.position,
      };
    };

    // Every element that reaches past the viewport, innermost first.
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > viewport + 0.5) {
        offenders.push(describe(el));
      }
    }

    // The card and its ancestors, so we can see where the width is introduced.
    const card = document.querySelector("article");
    const chain = [];
    for (let el = card; el && el !== document.body; el = el.parentElement) {
      chain.push(describe(el));
    }

    return { viewport, scrollWidth, offenders, chain };
  });

  console.log(
    `viewport=${report.viewport}px documentScrollWidth=${report.scrollWidth}px ` +
      `overflow=${report.scrollWidth > report.viewport ? "YES" : "no"}`
  );

  console.log("\n-- widest offenders (element extends past viewport) --");
  const seen = new Set();
  const unique = report.offenders.filter((o) => {
    const k = `${o.tag}|${o.cls}|${o.width}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!unique.length) console.log("(none)");
  for (const o of unique.slice(0, 15)) {
    console.log(
      `<${o.tag}> right=${o.right} w=${o.width} scrollW=${o.scrollWidth} ` +
        `minW=${o.minWidth} maxW=${o.maxWidth} display=${o.display} flex=${o.flex}\n` +
        `   cls="${o.cls}"\n   text="${o.text}"`
    );
  }

  console.log("\n-- card ancestor chain (child -> body) --");
  for (const o of report.chain) {
    console.log(
      `<${o.tag}> w=${o.width} left=${o.left} right=${o.right} minW=${o.minWidth} ` +
        `display=${o.display} flex=${o.flex} cls="${o.cls}"`
    );
  }
} finally {
  await browser.close();
}
