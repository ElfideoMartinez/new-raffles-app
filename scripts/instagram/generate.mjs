#!/usr/bin/env node
/**
 * Instagram content generator — item 17.
 *
 * Takes a JSON input (schema in README.md), fills a self-contained HTML
 * template, and captures exact Instagram sizes with headless Chrome:
 *   feed  = 1080x1350 (4:5)   story = 1080x1920 (9:16)
 * Output: instagram-pack/out/<slug>/{feed.jpg, story.jpg, caption.txt, manifest.json}
 *
 * Publishing constraints enforced here (per ufc-mission/promotion-options.md §7):
 *   - JPEG (Antwork/IG only accept .jpg/.jpeg), converted via `sips`
 *   - ≤ 8 MB (recompressed if over)
 *   - exact pixel dimensions verified programmatically and printed in the log
 *   - no external network assets: templates are pure CSS/typography; page
 *     requests are blocked anyway (request interception denies everything)
 *
 * RUN:  node scripts/instagram/generate.mjs scripts/instagram/examples/ufc333-bets.json
 * Requires: puppeteer-core + local Google Chrome (already in repo dev flow).
 */
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAX_BYTES = 8 * 1024 * 1024; // Instagram/Antwork limit

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/instagram/generate.mjs <input.json>");
  process.exit(1);
}
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const required = ["slug", "brand", "event", "caption"];
for (const k of required) if (!(k in input)) throw new Error(`Input missing required key: ${k}`);

// Default CTA (Daniel, 2026-10-25): bet-themed emoji, max 3.
const DEFAULT_CTA = "Atrévete a jugar 🎲🥊🔥";
if (!input.cta) input.cta = DEFAULT_CTA;

const outDir = join(ROOT, "instagram-pack", "out", input.slug);
mkdirSync(outDir, { recursive: true });

// ---- 1. Fill templates ----------------------------------------------------
function fill(html, data) {
  // {{#each list}}...{{/each}} blocks
  html = html.replace(/\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, path, body) => {
    const list = get(data, path) || [];
    return list.map((item) => body.replace(/\{\{([\w.]+)\}\}/g, (__, key) =>
      key === "this" ? item : get(item, key, "") ?? "")).join("");
  });
  // raw (unescaped-content) tokens: {{triple.brace}} or {{{path}}} — used for data URIs
  html = html.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, path) => get(data, path, "") ?? "");
  html = html.replace(/\{\{\s*triple\.([\w.]+)\s*\}\}/g, (_, path) => get(data, path, "") ?? "");
  // {{#if path}}…{{/if}} and {{#unless path}}…{{/unless}}
  html = html.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, path, body) =>
    truthy(get(data, path)) ? body : ""
  );
  html = html.replace(/\{\{#unless ([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, path, body) =>
    truthy(get(data, path)) ? "" : body
  );
  // plain tokens
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, path) => get(data, path, "") ?? "");
}
function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== "" && v !== false;
}
function get(obj, path, dflt) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj) ?? dflt;
}
function readTemplate(kind) {
  // input.feedTemplate/storyTemplate wins; else input.templates.{feed,story}; else the event default
  const p = input[`${kind}Template`]
    || input.templates?.[kind]
    || join(HERE, "templates", `${kind}-event.html`);
  return fill(readFileSync(p, "utf8"), input);
}

// ---- 1b. Optional fighter photo -> data URI (local file only) -------------
if (input.fighter && input.fighter.image && !input.fighter.photoDataUri) {
  const img = resolve(ROOT, input.fighter.image);
  if (existsSync(img)) {
    const ext = img.toLowerCase().endsWith(".png") ? "png" : "jpeg";
    input.fighter.photoDataUri = `data:image/${ext};base64,${readFileSync(img).toString("base64")}`;
    console.log(`  photo embedded: ${input.fighter.image}`);
  } else {
    console.warn(`  photo not found (initials fallback): ${input.fighter.image}`);
  }
}

// ---- 2. Render with headless Chrome ---------------------------------------
const CHROME_ARGS = ["--hide-scrollbars", "--disable-remote-fonts", "--disable-dev-shm-usage"];
const sizes = { feed: [1080, 1350], story: [1080, 1920] };
// input.only = "feed" | "story" -> render just that kind
const kinds = input.only ? [input.only] : ["feed", "story"];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: [...CHROME_ARGS, "--no-first-run", "--no-default-browser-check"],
});
const results = [];
try {
  for (const kind of kinds) {
    const [w, h] = sizes[kind];
    const html = readTemplate(kind);
    const page = await browser.newPage();
    // Block ALL network requests (file:// templates only): proves no external assets.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url().startsWith("http://") || req.url().startsWith("https://")) {
        req.abort(); console.warn(`  [blocked external request] ${req.url()}`);
      } else req.continue();
    });
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto("data:text/html;charset=utf-8," + encodeURIComponent(html), { waitUntil: "load" });
    const pngPath = join(outDir, `${kind}.png`);
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    results.push({ kind, png: pngPath, w, h });
  }
} finally { await browser.close(); }

// ---- 3. Convert PNG -> JPEG ≤8MB (publishing constraint) -------------------
function sips(args) { return execFileSync("sips", args, { encoding: "utf8" }); }
function dims(jpgPath) {
  const out = sips(["-g", "pixelWidth", "-g", "pixelHeight", jpgPath]);
  const w = Number(out.match(/pixelWidth: (\d+)/)[1]);
  const h = Number(out.match(/pixelHeight: (\d+)/)[1]);
  return [w, h];
}

for (const r of results) {
  const jpg = join(outDir, `${r.kind}.jpg`);
  sips(["-s", "format", "jpeg", "-s", "formatOptions", "90", r.png, "--out", jpg]);
  unlinkSync(r.png);
  let size = statSync(jpg).size;
  if (size > MAX_BYTES) { // recompress down until it fits
    for (const q of [80, 70, 60, 50]) {
      sips(["-s", "format", "jpeg", "-s", "formatOptions", String(q), jpg, "--out", jpg]);
      size = statSync(jpg).size;
      if (size <= MAX_BYTES) break;
    }
  }
  const [vw, vh] = dims(jpg);
  r.jpg = jpg; r.size = size; r.verifiedDims = [vw, vh];
}

// ---- 4. Caption + manifest -------------------------------------------------
const captionTxt = [
  input.caption.text.trim(), "", input.caption.hashtags.trim(), "",
  ...(input.caption.first_comment ? [`(Primer comentario: ${input.caption.first_comment.trim()})`] : []),
].join("\n");
writeFileSync(join(outDir, "caption.txt"), captionTxt + "\n");

const manifest = {
  slug: input.slug, generated_by: "scripts/instagram/generate.mjs",
  generated_at: new Date().toISOString(),
  input: resolve(inputPath), brand: input.brand, event: input.event,
  assets: results.map((r) => ({
    kind: r.kind, file: `${r.kind}.jpg`,
    dimensions: `${r.verifiedDims[0]}x${r.verifiedDims[1]}`,
    bytes: r.size, under_8mb: r.size <= MAX_BYTES,
    format: "jpeg",
  })),
  antwork_media_rules: "jpg/jpeg <= 8MB; upload via add_media -> PUT URL -> curl",
  story_note: input.story?.sticker_note || null,
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// ---- 5. Verification log ---------------------------------------------------
console.log(`\nGenerated ${input.slug} -> ${outDir}`);
let allOk = true;
for (const r of results) {
  const dimOk = r.verifiedDims[0] === r.w && r.verifiedDims[1] === r.h;
  const sizeOk = r.size <= MAX_BYTES;
  if (!dimOk || !sizeOk) allOk = false;
  console.log(
    `  ${r.kind}.jpg: ${r.verifiedDims[0]}x${r.verifiedDims[1]}px ` +
    `(expected ${r.w}x${r.h}) [${dimOk ? "OK" : "MISMATCH"}] · ` +
    `${(r.size / 1024 / 1024).toFixed(2)} MB [${sizeOk ? "OK ≤8MB" : "OVER"}]`
  );
}
console.log(`  caption.txt + manifest.json written`);
process.exitCode = allOk ? 0 : 1;