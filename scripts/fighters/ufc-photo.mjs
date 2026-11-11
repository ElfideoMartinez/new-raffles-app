#!/usr/bin/env node
// ufc-photo — fetch each fighter's official UFC athlete-page full-body image
// (transparent PNG cutout) and wire it as profile.photo. Runs BEFORE the
// Commons search in gather.mjs; a failure here leaves the existing photo alone.
//
// Usage: node scripts/fighters/ufc-photo.mjs [slug ...] [--dry-run] [--force]
//   no slugs = every fighters/<slug>/profile.json
//
// Source: https://www.ufcespanol.com/athlete/<slug> -> athlete_bio_full_body PNG
// License: UFC official press image (© UFC). Reference use only; see
// references/ufc-press-photos.md in the ufc-ig-content-flow skill.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertImageBytes, validateNativeDecode } from "./photo.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const ROOT = path.resolve(process.cwd(), "fighters");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const onlySlugs = args.filter((a) => !a.startsWith("--"));
const CHECKED = new Date().toISOString().slice(0, 10);
const LICENSE = "UFC official press image (© UFC) — reference copy only, not CC/Commons";

export function extractFullBodyUrl(html) {
  const m = html.match(/https:\/\/ufc\.com\/images\/styles\/athlete_bio_full_body\/[^"'\s<>)]+/);
  return m ? m[0].replace(/&amp;/g, "&") : null;
}

// A photo.png that is NOT UFC-sourced is a manual cutout (Daniel's): never overwrite it.
export function protectsManualCutout(dir, photo) {
  return fs.existsSync(path.join(dir, "photo.png")) && !isUfcSourced(photo);
}

export function isUfcSourced(photo) {
  return !!photo && /ufc(espanol)?\.com|ufc\.com/.test(photo.source_url || photo.download_url || "");
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { status: res.status });
  return res.text();
}

async function fetchImage(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const fmt = assertImageBytes(buf);
  if (fmt !== "png") throw new Error(`expected PNG cutout, got ${fmt}`);
  return buf;
}

function writeSourcesPhotoBlock(dir, slug, page, imgUrl) {
  const file = path.join(dir, "sources.md");
  const block = [
    "## Photo",
    `- File: photo.png (UFC full-body athlete image, transparent PNG)`,
    `- Source page: ${page} (checked ${CHECKED})`,
    `- Image URL: ${imgUrl}`,
    `- License: ${LICENSE}`,
    "",
  ].join("\n");
  let txt = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : `# ${slug} — sources\n\n`;
  txt = txt.replace(/## Photo[\s\S]*?(?=\n## |$)/, block);
  if (!txt.includes("## Photo")) txt += "\n" + block;
  fs.writeFileSync(file, txt);
}

// Fetch + validate + save the UFC full-body PNG to <dir>/photo.png.
// Returns the photo record, or null when the athlete page has no full-body image.
// Throws on network/validation errors; callers keep their existing photo then.
export async function ufcCutout(slug, dir) {
  const page = `https://www.ufcespanol.com/athlete/${slug}`;
  const html = await fetchText(page);
  const imgUrl = extractFullBodyUrl(html);
  if (!imgUrl) return null;
  const buf = await fetchImage(imgUrl);
  const stage = path.join(dir, `.photo-ufc-${process.pid}.png`);
  fs.writeFileSync(stage, buf);
  try {
    const dims = validateNativeDecode(stage, stage + ".decoded.png");
    fs.renameSync(stage, path.join(dir, "photo.png"));
    return {
      file: "photo.png",
      title: "UFC athlete page full-body image (transparent PNG)",
      url: imgUrl,
      thumbUrl: imgUrl,
      filePage: page,
      license: LICENSE,
      licenseUrl: null,
      artist: null,
      credit: "",
      source: "ufcespanol",
      ...dims,
    };
  } finally {
    fs.rmSync(stage, { force: true });
    fs.rmSync(stage + ".decoded.png", { force: true });
  }
}

async function processFighter(slug) {
  const dir = path.join(ROOT, slug);
  const pf = path.join(dir, "profile.json");
  const profile = JSON.parse(fs.readFileSync(pf, "utf8"));
  if (!FORCE && isUfcSourced(profile.photo) && profile.photo.file === "photo.png") {
    return { slug, status: "already-ufc" };
  }
  if (protectsManualCutout(dir, profile.photo)) return { slug, status: "manual-kept" };
  if (DRY) {
    const html = await fetchText(`https://www.ufcespanol.com/athlete/${slug}`);
    const imgUrl = extractFullBodyUrl(html);
    return imgUrl ? { slug, status: "dry-run", imgUrl } : { slug, status: "no-full-body-on-page" };
  }
  const c = await ufcCutout(slug, dir);
  if (!c) return { slug, status: "no-full-body-on-page" };
  profile.photo = {
    file: c.file,
    source_url: c.filePage,
    download_url: c.url,
    license: c.license,
    license_url: null,
    artist: null,
    matched_name_score: 1,
    width: c.width,
    height: c.height,
  };
  profile.sources = [
    ...(profile.sources || []).filter((s) => !/athlete\/|ufc\.com/.test(s.url || "")),
    { url: c.filePage, note: "UFC athlete page: full-body press image (photo.png)", checked: CHECKED },
  ];
  fs.writeFileSync(pf, JSON.stringify(profile, null, 2) + "\n");
  writeSourcesPhotoBlock(dir, slug, c.filePage, c.url);
  return { slug, status: "ok", width: c.width, height: c.height };
}

async function main() {
  const slugs = onlySlugs.length
    ? onlySlugs
    : fs.readdirSync(ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, "profile.json")))
        .map((d) => d.name);
  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await processFighter(slug));
    } catch (e) {
      // Keep whatever photo the profile already had (Commons fallback).
      results.push({ slug, status: "error", error: e.message });
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(JSON.stringify(counts));
  for (const r of results) if (r.status !== "ok" && r.status !== "already-ufc") console.log(r.slug, r.status, r.error || r.imgUrl || "");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
