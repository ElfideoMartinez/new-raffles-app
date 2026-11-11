#!/usr/bin/env node
/**
 * build-drafts.mjs — Auto-draft Instagram content for the latest UFC event.
 *
 * Reads fighters/_insights.json, renders feed + story via generate.mjs,
 * optionally sends to Telegram and schedules on Antwork.
 *
 * Usage:
 *   node scripts/instagram/build-drafts.mjs --notify
 *   node scripts/instagram/build-drafts.mjs --event="UFC 334" --schedule --notify
 *   node scripts/instagram/build-drafts.mjs --dry-run
 *
 * Flags:
 *   --event="..."       Filter to a specific event (substring match on card name)
 *   --notify            Send story to Telegram
 *   --schedule          Auto-schedule feed post on Antwork
 *   --schedule-at="ISO" Override the default schedule time
 *   --dry-run           Build input JSON but skip generate/publish
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import url from "node:url";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FIGHTERS_DIR = path.join(ROOT, "fighters");
const DRAFTS_DIR = path.join(ROOT, "instagram-pack/.automation/drafts");

// ---- 0. Parse args ----------------------------------------------------------
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] ?? true;
}
const eventFilter = typeof flags.event === "string" ? flags.event : null;
const doNotify = flags.notify === true;
const doSchedule = flags.schedule === true;
const scheduleAt = typeof flags["schedule-at"] === "string" ? flags["schedule-at"] : null;
const dryRun = flags["dry-run"] === true;

// ---- 1. Load env files (Telegram + Antwork) ---------------------------------
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const tgEnv = loadEnv(path.join(process.env.HOME, ".hermes/scripts/.ufc-telegram.env"));
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || tgEnv.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || tgEnv.TELEGRAM_CHAT_ID || "5262019985";

const awEnv = loadEnv(path.join(process.env.HOME, ".hermes/scripts/.antwork.env"));
const ANTWORK_API_KEY = process.env.ANTWORK_API_KEY || awEnv.ANTWORK_API_KEY || "";
const ANTWORK_ACCOUNT_ID = "gUi1o3IWQLG6ws6vHnYi";
const ANTWORK_WORKSPACE_ID = "tUp47gQT6TMIUL6JZYnK";

// ---- 2. Read insights -------------------------------------------------------
const insightsPath = path.join(FIGHTERS_DIR, "_insights.json");
if (!fs.existsSync(insightsPath)) {
  console.error("No _insights.json found. Run insights.mjs first.");
  process.exit(1);
}
const insights = JSON.parse(fs.readFileSync(insightsPath, "utf8"));

// ---- 3. Determine target event ----------------------------------------------
let targetCard = null;
if (eventFilter) {
  targetCard = insights.cards.find((c) => c.includes(eventFilter));
  if (!targetCard) {
    console.error(`No card matching "${eventFilter}" in insights. Available: ${insights.cards.join(", ")}`);
    process.exit(1);
  }
} else {
  // Pick the latest card (last alphabetically, or by date from matchup data)
  targetCard = insights.cards[insights.cards.length - 1];
}

if (!targetCard) {
  console.error("No cards found in insights.");
  process.exit(1);
}

console.log(`Target event: ${targetCard}`);

// ---- 4. Parse main event from card name "UFC 334: Gane vs. Hokit" -----------
const mainEventMatch = targetCard.match(/^(.+?):\s*(.+?)\s+vs\.?\s+(.+)$/i);
const eventPrefix = mainEventMatch ? mainEventMatch[1].trim() : targetCard;
const mainFighterA = mainEventMatch ? mainEventMatch[2].trim() : null;
const mainFighterB = mainEventMatch ? mainEventMatch[3].trim() : null;

// ---- 5. Find the main event matchup from insights --------------------------
const cardMatchups = insights.matchups.filter((m) => m.event === targetCard);
let mainMatchup = null;

if (mainFighterA && mainFighterB) {
  // Try to find the matchup containing both main event fighters
  mainMatchup = cardMatchups.find(
    (m) =>
      m.matchup.some((n) => n.includes(mainFighterA) || mainFighterA.includes(n)) &&
      m.matchup.some((n) => n.includes(mainFighterB) || mainFighterB.includes(n))
  );
}

if (!mainMatchup && cardMatchups.length > 0) {
  // Fallback: first matchup on the card
  mainMatchup = cardMatchups[0];
}

if (!mainMatchup) {
  console.error(`No matchups found for card: ${targetCard}`);
  process.exit(1);
}

console.log(`Main matchup: ${mainMatchup.matchup.join(" vs. ")}`);

// ---- 6. Slug generation -----------------------------------------------------
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[:\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

const eventSlug = toSlug(targetCard);
const draftDir = path.join(DRAFTS_DIR, eventSlug);
fs.mkdirSync(draftDir, { recursive: true });

// ---- 7. Load fighter photos as data URIs ------------------------------------
function fighterSlug(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function loadFighterPhoto(name) {
  const slug = fighterSlug(name);
  const dir = path.join(FIGHTERS_DIR, slug);
  if (!fs.existsSync(dir)) return null;
  for (const ext of ["png", "jpg", "jpeg"]) {
    const photoPath = path.join(dir, `photo.${ext}`);
    if (fs.existsSync(photoPath)) {
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${fs.readFileSync(photoPath).toString("base64")}`;
    }
  }
  // Check profile.json for photo.file
  const profilePath = path.join(dir, "profile.json");
  if (fs.existsSync(profilePath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
      const file = profile.photo?.file;
      if (file && fs.existsSync(path.join(dir, file))) {
        const ext = file.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        return `data:image/${ext};base64,${fs.readFileSync(path.join(dir, file)).toString("base64")}`;
      }
    } catch {}
  }
  return null;
}

function loadFighterProfile(name) {
  const slug = fighterSlug(name);
  const profilePath = path.join(FIGHTERS_DIR, slug, "profile.json");
  if (!fs.existsSync(profilePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(profilePath, "utf8"));
  } catch {
    return null;
  }
}

const [nameA, nameB] = mainMatchup.matchup;
const profileA = loadFighterProfile(nameA);
const profileB = loadFighterProfile(nameB);
const photoA = loadFighterPhoto(nameA);
const photoB = loadFighterPhoto(nameB);

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fighterStats(profile, record) {
  if (!profile) return [{ label: "Récord", value: record }];
  const rec = profile.record;
  const recStr = rec
    ? rec.draws
      ? `${rec.wins}-${rec.losses}-${rec.draws}`
      : `${rec.wins}-${rec.losses}`
    : record;
  return [{ label: "Récord", value: recStr }];
}

// ---- 8. Build input JSON for generate.mjs -----------------------------------
// Feed: use feed-vs.html (VS matchup template)
// Story: use story-survey.html (poll: who wins?)
const feedTemplate = path.join(HERE, "templates/feed-vs.html");
const storyTemplate = path.join(HERE, "templates/story-survey.html");

const eventHashtag = eventPrefix.replace(/\s+/g, "");
const hashtags = `#${eventHashtag} #UFC #RifasMtz`;
// Caption: NEVER mention bets/apuestas in feed posts
const captionText = [
  `🥊 ${nameA} vs. ${nameB}`,
  `📋 ${mainMatchup.division || ""}`,
  mainMatchup.notes.join(" · "),
  "",
  `🔗 Prueba la app: https://rifasmtz.web.app/`,
].join("\n");

const generateInput = {
  slug: eventSlug,
  locale: "es-MX",
  templates: {
    feed: feedTemplate,
    story: storyTemplate,
  },
  brand: { name: "Rifas Mtz", handle: "@bet.mx.ufc" },
  event: {
    kicker: `${eventPrefix} · ESTELAR`,
    title: targetCard,
  },
  matchup: {
    label: `${eventPrefix} · ESTELAR`,
    center: "VS",
    left: {
      name: nameA,
      nickname: profileA?.nickname || "",
      initials: profileA?.initials || initials(nameA),
      photoDataUri: photoA || "",
      stats: fighterStats(profileA, mainMatchup.records[0]),
    },
    right: {
      name: nameB,
      nickname: profileB?.nickname || "",
      initials: profileB?.initials || initials(nameB),
      photoDataUri: photoB || "",
      stats: fighterStats(profileB, mainMatchup.records[1]),
    },
  },
  story: {
    headline: "¿Quién gana?",
    sub: `${nameA} vs. ${nameB}`,
    lines: [
      { label: "A", value: nameA },
      { label: "B", value: nameB },
    ],
  },
  cta: "Vota en la app 🥊",
  caption: {
    text: captionText,
    hashtags,
  },
};

const inputPath = path.join(draftDir, "input.json");
fs.writeFileSync(inputPath, JSON.stringify(generateInput, null, 2) + "\n");
console.log(`Input written: ${inputPath}`);

if (dryRun) {
  console.log("Dry run — skipping generate, notify, and schedule.");
  process.exit(0);
}

// ---- 9. Run generate.mjs ----------------------------------------------------
const generateScript = path.join(HERE, "generate.mjs");
console.log("Running generate.mjs...");
const genResult = spawnSync(process.execPath, [generateScript, inputPath], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
  },
});

if (genResult.status !== 0) {
  console.error(`generate.mjs failed with exit code ${genResult.status}`);
  process.exit(1);
}

// Output lives in instagram-pack/out/<eventSlug>/
const outDir = path.join(ROOT, "instagram-pack/out", eventSlug);
const feedJpg = path.join(outDir, "feed.jpg");
const storyJpg = path.join(outDir, "story.jpg");

// ---- 10. Write draft manifest (deduplication) -------------------------------
const manifestPath = path.join(draftDir, `${eventSlug}.json`);
let manifest = {};
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {}
}

// Determine event date from the matchup profiles
const eventDate = profileA?._event?.date || profileB?._event?.date || null;

manifest.event = targetCard;
manifest.eventSlug = eventSlug;
manifest.mainMatchup = mainMatchup.matchup;
manifest.generated_at = new Date().toISOString();
manifest.feedJpg = fs.existsSync(feedJpg) ? feedJpg : null;
manifest.storyJpg = fs.existsSync(storyJpg) ? storyJpg : null;
manifest.eventDate = eventDate;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest written: ${manifestPath}`);

// ---- 11. Telegram notify (story image) --------------------------------------
async function sendTelegramPhoto(filePath, caption) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("No TELEGRAM_BOT_TOKEN — skipping Telegram notification.");
    return;
  }
  const fileData = fs.readFileSync(filePath);
  const boundary = `----FormBoundary${crypto.randomBytes(16).toString("hex")}`;
  const truncCaption = caption.length > 1024 ? caption.slice(0, 1021) + "..." : caption;

  const parts = [];
  // chat_id field
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${TELEGRAM_CHAT_ID}\r\n`
  );
  // caption field
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${truncCaption}\r\n`
  );
  // photo file
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${path.basename(filePath)}"\r\nContent-Type: image/jpeg\r\n\r\n`
  );

  const head = Buffer.from(parts.join(""));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileData, tail]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log("Telegram photo sent successfully.");
            resolve(data);
          } else {
            console.error(`Telegram API error ${res.statusCode}: ${data.slice(0, 200)}`);
            resolve(null); // non-fatal
          }
        });
      }
    );
    req.on("error", (err) => {
      console.error(`Telegram request error: ${err.message}`);
      resolve(null); // non-fatal
    });
    req.write(body);
    req.end();
  });
}

// ---- 12. Antwork scheduling -------------------------------------------------
function antworkRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "antwork.io",
      path: `/api/v1${apiPath}`,
      method,
      headers: {
        Authorization: `Bearer ${ANTWORK_API_KEY}`,
        ...(bodyStr ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", (err) => reject(err));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function antworkUploadMedia(filePath) {
  const fileData = fs.readFileSync(filePath);
  const boundary = `----FormBoundary${crypto.randomBytes(16).toString("hex")}`;

  const parts = [];
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\nContent-Type: image/jpeg\r\n\r\n`
  );
  const head = Buffer.from(parts.join(""));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileData, tail]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "antwork.io",
        path: "/api/v1/media/upload",
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANTWORK_API_KEY}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
        timeout: 60000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.write(body);
    req.end();
  });
}

async function schedulePost() {
  if (!ANTWORK_API_KEY) {
    console.warn("No ANTWORK_API_KEY — skipping Antwork scheduling.");
    return;
  }

  // Dedupe: check manifest for existing scheduledPostId
  if (manifest.scheduledPostId) {
    console.log(`Post already scheduled (id: ${manifest.scheduledPostId}) — skipping.`);
    return;
  }

  if (!fs.existsSync(feedJpg)) {
    console.error("No feed.jpg — cannot schedule.");
    return;
  }

  console.log("Uploading feed image to Antwork...");
  const uploadRes = await antworkUploadMedia(feedJpg);
  if (uploadRes.status >= 300) {
    console.error(`Antwork upload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.body).slice(0, 200)}`);
    return;
  }
  const mediaId = uploadRes.body?.id || uploadRes.body?.media?.id;
  if (!mediaId) {
    console.error("Antwork upload: no media ID in response.");
    return;
  }
  console.log(`  Media uploaded: ${mediaId}`);

  // Create post
  const postBody = {
    accountId: ANTWORK_ACCOUNT_ID,
    workspaceId: ANTWORK_WORKSPACE_ID,
    mediaIds: [mediaId],
    content: generateInput.caption.text + "\n\n" + generateInput.caption.hashtags,
  };
  console.log("Creating Antwork post...");
  const createRes = await antworkRequest("POST", "/posts", postBody);
  if (createRes.status >= 300) {
    console.error(`Antwork create post failed (${createRes.status}): ${JSON.stringify(createRes.body).slice(0, 200)}`);
    return;
  }
  // The create response wraps in post_batch: real id at response.posts[0].id
  const postId =
    createRes.body?.posts?.[0]?.id ||
    createRes.body?.post?.id ||
    createRes.body?.id;
  if (!postId) {
    console.error("Antwork create post: no post ID in response.");
    return;
  }
  console.log(`  Post created: ${postId}`);

  // Schedule: event day 08:00 CST (14:00 UTC) or --schedule-at override
  let scheduledFor;
  if (scheduleAt) {
    scheduledFor = new Date(scheduleAt).toISOString();
  } else if (eventDate) {
    // Event date + 14:00 UTC (08:00 CST)
    scheduledFor = `${eventDate}T14:00:00.000Z`;
  } else {
    console.warn("No event date — scheduling for tomorrow 14:00 UTC.");
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    scheduledFor = `${tomorrow.toISOString().slice(0, 10)}T14:00:00.000Z`;
  }

  console.log(`Scheduling post for ${scheduledFor}...`);
  const schedRes = await antworkRequest("POST", `/posts/${postId}/schedule`, {
    scheduledFor,
  });
  if (schedRes.status >= 300) {
    console.error(`Antwork schedule failed (${schedRes.status}): ${JSON.stringify(schedRes.body).slice(0, 200)}`);
    return;
  }

  manifest.scheduledPostId = postId;
  manifest.scheduledFor = scheduledFor;
  manifest.antworkMediaId = mediaId;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`  Scheduled! Post ${postId} for ${scheduledFor}`);
}

// ---- 13. Execute notify + schedule (async) ----------------------------------
async function main() {
  if (doNotify && fs.existsSync(storyJpg)) {
    const caption = `📸 Draft: ${nameA} vs. ${nameB}\n${targetCard}\n\n${mainMatchup.notes.join("\n")}`;
    await sendTelegramPhoto(storyJpg, caption);
  } else if (doNotify) {
    console.warn("No story.jpg found — skipping Telegram notification.");
  }

  if (doSchedule) {
    await schedulePost();
  }

  console.log("\nDone.");
  console.log(`  Event: ${targetCard}`);
  console.log(`  Matchup: ${nameA} vs. ${nameB}`);
  console.log(`  Draft dir: ${draftDir}`);
  if (fs.existsSync(feedJpg)) console.log(`  Feed: ${feedJpg}`);
  if (fs.existsSync(storyJpg)) console.log(`  Story: ${storyJpg}`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
