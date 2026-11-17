#!/usr/bin/env node
// fighters gatherer (backlog 22) — build fighter profiles for a UFC event card.
//
// Usage: node scripts/fighters/gather.mjs --date=2026-10-24 [--max=20] [--dir=fighters] [--any-license]
//
// Sources (priority order):
//  1. ESPN scoreboard  -> card, bout order, winner, record, division, country flag
//  2. Wikipedia REST summary + action API -> short facts, birth date, URL
//  3. Wikimedia Commons (search) + Wikipedia pageimage -> photos (license-gated)
//
// License policy (default): only CC0 / Public Domain / CC BY* / CC BY-SA* are downloaded.
// --any-license: accept any image regardless of license (recorded for later review).
// Non-free, "all rights reserved", missing license, and GFDL-only are skipped (logged).
// Matching rule: file title/description must contain BOTH surname and one given
// name (case-insensitive, accent-insensitive). No guesses, no renames.

import fs from "node:fs";
import path from "node:path";
import { savePhoto, assertImageBytes, validateNativeDecode } from "./photo.mjs";
import { ufcCutout, protectsManualCutout, isUfcSourced } from "./ufc-photo.mjs";
import { boutResults } from "./results.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [, k, v] = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [k, v === undefined ? true : v];
  })
);
const DATE = args.date;
if (typeof DATE !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(DATE) ||
    !Number.isFinite(Date.parse(`${DATE}T00:00:00Z`)) ||
    new Date(`${DATE}T00:00:00Z`).toISOString().slice(0, 10) !== DATE) {
  throw new Error("Required --date=YYYY-MM-DD must be a valid calendar date");
}
const MAX = parseInt(args.max || "20", 10);
// --any-license: download regardless of license (small production, Daniel's call
// 2026-10-26). The license string is still recorded everywhere for later review.
const ANY_LICENSE = !!args["any-license"];
const ROOT = path.resolve(process.cwd(), args.dir || "fighters");
const UA = "raffles-fighters-gatherer/1.0 (local research script; contact: repo owner)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHECKED = new Date().toISOString().slice(0, 10);

// ~1 request/second with 429 backoff-retry
let lastReq = 0;
async function fetchJson(url, tries = 4) {
  for (let i = 0; ; i++) {
    const wait = 1300 - (Date.now() - lastReq);
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status === 503) {
      if (i >= tries) throw new Error(`HTTP ${res.status} (gave up after retries) for ${url}`);
      const backoff = 8000 * (i + 1);
      console.log(`  rate-limited (${res.status}); backing off ${backoff / 1000}s…`);
      await sleep(backoff);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
}

const stripAccents = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function parseName(displayName) {
  // ESPN: "Abdul-Rakhman Yakhyaev" -> given "abdul-rakhman", surname "yakhyaev"
  const parts = displayName.trim().split(/\s+/);
  const surname = stripAccents(parts[parts.length - 1]);
  const given = parts.slice(0, -1).map(stripAccents);
  return { surname, given };
}

// name match: file title/description must contain surname AND at least one given name
function matchesName(displayName, ...texts) {
  const { surname, given } = parseName(displayName);
  const hay = stripAccents(texts.filter(Boolean).join(" \n "));
  const hasSurname = hay.includes(surname);
  const hasGiven = given.some((g) => g.length >= 2 && hay.includes(g));
  if (hasSurname && hasGiven) return true;
  const reason = !hasSurname
    ? `surname "${surname}" not found`
    : `no given name of [${given.join(", ")}] found`;
  return reason; // truthy string = rejection reason; true = match
}

const OK_LICENSE = (l) => {
  const s = (l || "").toLowerCase();
  if (ANY_LICENSE) return { ok: true, name: l || "(none recorded)", relaxed: true };
  if (!s) return { ok: false, note: "missing license" };
  if (s.startsWith("cc0") || s.includes("public domain")) return { ok: true, name: l };
  if (/^cc by(-sa)?[ \d.-]/.test(s) || s.startsWith("cc by") || s.startsWith("cc by-sa"))
    return { ok: true, name: l };
  if (s.includes("gfdl")) return { ok: false, note: `GFDL-only (${l})` };
  return { ok: false, note: `license not accepted: ${l}` };
};

const slugify = (s) =>
  stripAccents(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function espnCard(date) {
  const ymd = date.replace(/-/g, "");
  const url = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${ymd}`;
  const d = await fetchJson(url);
  const ev = d.events[0];
  if (!ev) throw new Error("No UFC event on that date");
  const fighters = new Map();
  const bouts = ev.competitions
    .slice()
    .reverse() // main event first; order 0 = main, 1 = co-main (matches insights/backfill convention)
    .map((c, i) => {
      const results = boutResults(c);
      return {
      order: i,
      division: c.type?.abbreviation || null,
      date: c.date || ev.date || null,
      athletes: c.competitors.map((x, index) => ({
        name: x.athlete.displayName,
        result: results[index],
        record: x.records?.[0]?.summary || null,
        country: x.athlete.flag?.alt || null,
        flagUrl: x.athlete.flag?.href || null,
      })),
      };
    });
  for (const b of bouts)
    for (const a of b.athletes) {
      if (!fighters.has(a.name))
        fighters.set(a.name, { name: a.name, bouts: [] });
      fighters.get(a.name).bouts.push({
        order: b.order,
        date: b.date || null,
        division: b.division,
        opponent: b.athletes.find((x) => x !== a)?.name || null,
        winner: a.result === "W" ? true : a.result === "L" ? false : null,
        result: a.result,
        record: a.record,
        country: a.country,
      });
    }
  return {
    eventName: ev.name,
    date,
    fighters: [...fighters.values()].slice(0, MAX),
  };
}

async function wikipediaSummary(name) {
  // try exact title, then "Name (fighter)" / "Name (mixed martial artist)"
  const candidates = [
    name.replace(/ /g, "_"),
    `${name}_(fighter)`.replace(/ /g, "_"),
    `${name}_(mixed_martial_artist)`.replace(/ /g, "_"),
  ];
  for (const title of candidates) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    try {
      const d = await fetchJson(url);
      if (d.type === "standard" && d.extract)
        return { title: d.title, extract: d.extract, url: d.content_urls.desktop.page };
    } catch (e) {
      if (!/404/.test(e.message)) console.log(`  wiki summary ${title}: ${e.message}`);
    }
  }
  return null;
}

async function wikipediaInfo(title) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=revisions|pageimages&rvprop=content&rvslots=main&piprop=original|name` +
    `&format=json&formatversion=2&redirects=1`;
  const d = await fetchJson(url);
  const page = d.query?.pages?.[0];
  if (!page || page.missing) return {};
  const wikitext = page.revisions?.[0]?.slots?.main?.content || "";
  const birth = wikitext.match(/\{\{[Bb]irth date[^}]*?\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/);
  const record = wikitext.match(/\|\s*wins\s*=\s*(\d+)[\s\S]{0,120}?\|\s*losses\s*=\s*(\d+)/);
  const nickname = wikitext.match(/\|\s*nickname\s*=\s*([^|\n]+)/);
  const height = wikitext.match(/\|\s*height\s*=\s*([^|\n]+)/);
  return {
    birthDate: birth ? `${birth[1]}-${birth[2].padStart(2, "0")}-${birth[3].padStart(2, "0")}` : null,
    record: record ? { wins: +record[1], losses: +record[2] } : null,
    nickname: nickname ? nickname[1].trim().replace(/''/g, "") : null,
    height: height ? height[1].trim() : null,
    pageImage: page.original?.source || null,
    pageImageName: page.pageimage || null,
    pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
  };
}

// Commons search for images; returns candidates with license info + rejection reasons
async function commonsCandidates(name) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(name + " fighter")}&gsrnamespace=6&gsrlimit=10` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json&formatversion=2`;
  const d = await fetchJson(url);
  const out = [];
  for (const p of d.query?.pages || []) {
    if (!/\.(jpe?g|png)$/i.test(p.title || "")) {
      rejections.push(`[${name}] SKIP ${p.title} — not a jpg/png (pdf/svg/other)`);
      continue;
    }
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata || {};
    const license = meta.LicenseShortName?.value || "";
    const licenseUrl = meta.LicenseUrl?.value || "";
    const artist = (meta.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
    const credit = (meta.Credit?.value || "").replace(/<[^>]+>/g, "").trim();
    const desc = (meta.ImageDescription?.value || "").replace(/<[^>]+>/g, "").trim();
    const title = p.title || "";
    const nameCheck = matchesName(name, title, desc);
    let verdict;
    if (nameCheck !== true) verdict = { ok: false, reason: `name mismatch: ${nameCheck}` };
    else {
      const lic = OK_LICENSE(license);
      verdict = lic.ok
        ? { ok: true }
        : { ok: false, reason: `license: ${lic.note}` };
    }
    out.push({
      title,
      url: ii.url,
      thumbUrl: ii.thumburl || ii.url,
      width: ii.width,
      license,
      licenseUrl,
      artist,
      credit,
      description: desc.slice(0, 300),
      filePage: ii.descriptionurl || ii.url,
      ok: verdict.ok,
      reason: verdict.reason || null,
    });
  }
  return out;
}

async function download(url, dest, tries = 4) {
  for (let i = 0; ; i++) {
    const wait = 1300 - (Date.now() - lastReq);
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    try {
      return await savePhoto(url, dest, { headers: { "User-Agent": UA } });
    } catch (e) {
      if ((e.status === 429 || e.status === 503) && i < tries) {
        console.log(`  download rate-limited (${e.status}); backing off…`);
        await sleep(8000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

// ---------------- main ----------------
const rejections = [];
const failures = [];
const photoCoverage = { profiles: 0, withPhoto: 0, png: 0, ufc: 0, retained: 0, initials: 0 };

const card = await espnCard(DATE);
console.log(`Event: ${card.eventName} (${card.date}) — ${card.fighters.length} fighters (cap ${MAX})`);

fs.mkdirSync(ROOT, { recursive: true });

for (const f of card.fighters) {
  const slug = slugify(f.name);
  const dir = path.join(ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });
  const log = (...m) => console.log(`[${f.name}]`, ...m);
  log("gathering…");

  const sources = [];
  // Preserve any previously-gathered history for this fighter (across events) so
  // insights.mjs can compute head-to-head / shared-card data over time.
  let prev = null;
  const prevFile = path.join(dir, "profile.json");
  if (fs.existsSync(prevFile)) {
    try { prev = JSON.parse(fs.readFileSync(prevFile, "utf8")); }
    catch { prev = null; }
  }
  const profile = {
    slug,
    name: f.name,
    nickname: null,
    initials: f.name.split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join(""),
    country: f.bouts[0]?.country || null,
    division: f.bouts[0]?.division || null,
    record: null,
    stats: [],
    facts: [],
    previousFights: prev?.previousFights || [],
    cards: prev?.cards || [],
    photo: null,
    sources: [],
    _event: { name: card.eventName, date: card.date, bouts: f.bouts },
  };

  // 1) ESPN
  sources.push({ url: `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${DATE.replace(/-/g, "")}`, note: "card, bout order, winner, division, country flag, record on card", checked: CHECKED });
  if (f.bouts[0]?.record) {
    const m = f.bouts[0].record.match(/^(\d+)-(\d+)-(\d+)$/);
    if (m) profile.record = { wins: +m[1], losses: +m[2], draws: +m[3] };
  }
  for (const b of f.bouts) {
    if (b.division && b.result) {
      const clash = profile.previousFights.some((x) => x.event === card.eventName && x.opponent === b.opponent);
      if (!clash) profile.previousFights.push({ event: card.eventName, opponent: b.opponent, result: b.result, division: b.division });
    }
  }
  if (!profile.cards.some((c) => c.name === card.eventName))
    profile.cards.push({ name: card.eventName, date: card.date });
  if (f.bouts.some((b) => b.result === "W")) profile.stats.push({ label: "Evento", value: "Ganó en " + card.eventName });
  profile.division = profile.division?.replace(/([a-z])([A-Z])/g, "$1 $2");

  // 2) Wikipedia
  let wiki = null, winfo = {};
  try {
    wiki = await wikipediaSummary(f.name);
    if (wiki) {
      sources.push({ url: wiki.url, note: "short factual summary", checked: CHECKED });
      profile.facts.push(wiki.extract.split(". ").slice(0, 2).join(". ") + ".");
      winfo = await wikipediaInfo(wiki.title);
      if (winfo.birthDate) profile.stats.push({ label: "Nac.", value: winfo.birthDate });
      if (winfo.nickname && !/^[?]/.test(winfo.nickname)) {
        profile.nickname = winfo.nickname.split(/<br\s*\/?>/i)[0]
          .replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/^["']+|["']+$/g, "").trim();
        if (!profile.nickname || profile.nickname.length > 40) profile.nickname = null;
        if (profile.nickname)
          sources.push({ url: winfo.pageUrl, note: "nickname (wikibox)", checked: CHECKED });
      }
      if (winfo.record && !profile.record) profile.record = { wins: winfo.record.wins, losses: winfo.record.losses, draws: 0 };
      if (winfo.pageUrl) sources.push({ url: winfo.pageUrl, note: "infobox: birth date, record, nickname", checked: CHECKED });
    } else log("no Wikipedia page found (summary 404 on all title variants)");
  } catch (e) { failures.push(`[${f.name}] wikipedia: ${e.message}`); log("wikipedia error:", e.message); }

  // Keep a usable local UFC image as the fallback before attempting any refresh.
  let retainedUfc = false;
  if (prev?.photo?.file === "photo.png" && isUfcSourced(prev.photo)) {
    const saved = path.join(dir, "photo.png");
    const decoded = path.join(dir, `.photo-retained-${process.pid}.png`);
    try {
      if (assertImageBytes(fs.readFileSync(saved)) !== "png") throw new Error("expected retained PNG");
      validateNativeDecode(saved, decoded);
      profile.photo = prev.photo;
      retainedUfc = true;
    } catch (e) { log("existing UFC photo unusable:", e.message); }
    finally { fs.rmSync(decoded, { force: true }); }
  }

  // 3a) UFC athlete page full-body cutout (PRIMARY — official, fighter-only, transparent PNG)
  let chosen = null;
  try {
    const keepManual = protectsManualCutout(dir, prev?.photo);
    const c = keepManual ? null : await ufcCutout(slug, dir);
    if (keepManual) {
      profile.photo = prev?.photo?.file === "photo.png" ? prev.photo : { file: "photo.png", license: "Manual cutout; attribution not recorded" };
      log("manual photo.png kept (not UFC-sourced)");
    }
    else if (c) {
      chosen = { ...c, ok: true, matched: true, via: "ufc athlete page" };
      sources.push({ url: c.filePage, note: "UFC athlete page: full-body press image (photo.png)", checked: CHECKED });
      log(`photo OK (UFC athlete page): ${c.url}`);
    } else log("no full-body image on UFC athlete page");
  } catch (e) { failures.push(`[${f.name}] ufc-photo: ${e.message}`); log("ufc-photo error:", e.message); }

  // 3b) Commons photo search — FALLBACK ONLY, opt-in (--commons-fallback). It produced
  // off-topic images (group/event shots, namesakes), so it never runs by default.
  try {
    const cands = chosen || profile.photo || !args["commons-fallback"] ? [] : await commonsCandidates(f.name);

    for (const c of cands) {
      if (!c.ok) { rejections.push(`[${f.name}] REJECT ${c.title} — ${c.reason}`); log(`reject ${c.title}: ${c.reason}`); continue; }
      // download best candidate
      const tmp = path.join(dir, ".photo.tmp");
      try {
        const result = await download(c.thumbUrl, tmp);
        fs.renameSync(tmp, path.join(dir, "photo.jpg"));
        chosen = { ...c, matched: true, ...result };
        log(`photo OK: ${c.title} [${c.license}]`);
        break;
      } catch (e) {
        rejections.push(`[${f.name}] DOWNLOAD FAIL ${c.title} — ${e.message}`);
        log("download failed:", c.title, e.message);
        try { fs.unlinkSync(tmp); } catch {}
      }
    }
    // fallback: Wikipedia lead image (also license-check via Commons metadata of that file)
    if (!chosen && !profile.photo && args["commons-fallback"] && winfo.pageImageName) {
      try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(winfo.pageImageName)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json&formatversion=2`;
        const d = await fetchJson(url);
        const p = d.query?.pages?.[0];
        const ii = p?.imageinfo?.[0];
        if (ii) {
          const meta = ii.extmetadata || {};
          const license = meta.LicenseShortName?.value || "";
          const lic = OK_LICENSE(license);
          const nameCheck = matchesName(f.name, p.title, meta.ImageDescription?.value?.replace(/<[^>]+>/g, "") || "");
          if (nameCheck !== true) rejections.push(`[${f.name}] REJECT ${p.title} (wiki lead) — ${nameCheck}`);
          else if (!lic.ok) rejections.push(`[${f.name}] REJECT ${p.title} (wiki lead) — license: ${lic.note}`);
          else {
            const tmp = path.join(dir, ".photo.tmp");
            await download(ii.thumburl || ii.url, tmp);
            fs.renameSync(tmp, path.join(dir, "photo.jpg"));
            chosen = { title: p.title, url: ii.url, thumbUrl: ii.thumburl || ii.url, license, licenseUrl: meta.LicenseUrl?.value || "", artist: (meta.Artist?.value || "").replace(/<[^>]+>/g, "").trim(), credit: "", filePage: ii.descriptionurl, ok: true, matched: true, via: "wikipedia lead image" };
            log(`photo OK (wiki lead): ${p.title} [${license}]`);
          }
        }
      } catch (e) { log("wiki-lead photo check failed:", e.message); }
    }
    if (!chosen && !profile.photo) log("NO photo — initials fallback");
  } catch (e) { failures.push(`[${f.name}] commons: ${e.message}`); log("commons error:", e.message); }

  if (chosen?.via === "ufc athlete page") {
    profile.photo = {
      file: "photo.png",
      source_url: chosen.filePage,
      download_url: chosen.url,
      license: chosen.license,
      license_url: null,
      artist: null,
      matched_name_score: 1,
    };
  } else if (!chosen && prev?.photo?.file === "photo.png" && protectsManualCutout(dir, prev.photo)) {
    profile.photo = prev.photo; // keep a manual cutout's record across gathers
  } else if (chosen) {
    profile.photo = {
      file: "photo.jpg",
      source_url: chosen.filePage || chosen.url,
      download_url: chosen.thumbUrl || chosen.url,
      license: chosen.license,
      license_url: chosen.licenseUrl || null,
      artist: chosen.artist || null,
      matched_name_score: 1, // exact rule-based match (surname + given name), not a score guess
    };
    sources.push({ url: chosen.filePage || chosen.url, note: `photo, license ${chosen.license}${chosen.via ? " (Wikipedia lead image)" : " (Commons search)"}`, checked: CHECKED });
  }

  if (!chosen && retainedUfc) {
    const oldSource = prev.sources?.find((s) => s.url === prev.photo.source_url);
    sources.push(oldSource || { url: prev.photo.source_url, note: "Retained UFC full-body PNG; original check date unavailable" });
    log("retained validated UFC photo.png (refresh unavailable)");
  }
  photoCoverage.profiles++;
  if (profile.photo?.file && fs.existsSync(path.join(dir, profile.photo.file))) {
    photoCoverage.withPhoto++;
    if (profile.photo.file.endsWith(".png")) photoCoverage.png++;
    if (isUfcSourced(profile.photo)) photoCoverage.ufc++;
    if (!chosen) photoCoverage.retained++;
  } else photoCoverage.initials++;
  profile.sources = sources;
  fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify(profile, null, 2) + "\n");

  // sources.md
  const lines = [
    `# ${f.name} — sources`,
    `Checked: ${CHECKED}`,
    "",
    `## Facts`,
    ...sources.map((s) => `- ${s.url} — ${s.note} (checked ${s.checked})`),
    "",
    `## Photo`,
    chosen
      ? `- File: ${profile.photo.file}\n- Image URL: ${profile.photo.download_url}\n- ${chosen.title}\n- License: ${chosen.license}${chosen.relaxed ? " (RELAXED: accepted under --any-license; review before wide use)" : ` (${chosen.licenseUrl || "n/a"})`}\n- Artist: ${chosen.artist || "n/a"}\n- Credit: ${chosen.credit || "n/a"}\n- File page: ${chosen.filePage || chosen.url}`
      : profile.photo
        ? `- File: ${profile.photo.file} (retained local image)\n- Source page: ${profile.photo.source_url || "not recorded"}\n- Image URL: ${profile.photo.download_url || "not recorded"}\n- License: ${profile.photo.license || "not recorded"}\n- Retained local image; no successful source refresh this run.`
        : `- No usable photo: official UFC full-body image unavailable; ${args["commons-fallback"] ? "opt-in Commons/Wikipedia fallback found no accepted image" : "Commons/Wikipedia fallback not requested"}. Initials fallback (${profile.initials}).`,
    "",
    `## Notes`,
    failures.filter((x) => x.startsWith(`[${f.name}]`)).map((x) => "- FAIL: " + x.replace(/^\[[^\]]+\]\s*/, "")).join("\n"),
  ];
  fs.writeFileSync(path.join(dir, "sources.md"), lines.filter((l) => l !== "").join("\n") + "\n");
}

// run report
const report = { date: card.date, event: card.eventName, fighters: card.fighters.length, generatedAt: new Date().toISOString(), photoCoverage, rejections, failures };
fs.writeFileSync(path.join(ROOT, "_gather-report.json"), JSON.stringify(report, null, 2));
console.log(`\nDone. Profiles in ${ROOT}/. Rejections: ${rejections.length}, failures: ${failures.length}`);
for (const r of rejections) console.log("  REJECT:", r);
for (const x of failures) console.log("  FAIL:", x);
if (failures.length > 0) process.exitCode = 1;